import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks, submissions, type AppUser, type TaskStatus } from "@/db/schema";
import { invariant } from "./errors";
import { canEditTask, canViewTask, isManagement, requireManagement } from "./permissions";
import { activeAssignee, activity, freshActor } from "./service-common";
import { linksSchema, taskInputSchema, type TaskInput } from "./validation";

export async function createTask(actor: AppUser, input: TaskInput, now = Date.now()) {
  const data = taskInputSchema.parse(input);
  return db.transaction(async tx => {
    actor = await freshActor(tx, actor);
    invariant(isManagement(actor) || data.assigneeId === actor.id, "You can only create tasks for yourself.", "forbidden");
    invariant(isManagement(actor) || !data.requireLink, "Only managers can require a submission link.", "forbidden");
    await activeAssignee(tx, data.assigneeId);
    invariant(data.dueAt > now, "Choose a deadline in the future.");
    const [task] = await tx.insert(tasks).values({ ...data, id: crypto.randomUUID(), creatorId: actor.id,
      source: data.assigneeId === actor.id ? "self" : "assigned", availableAt: now, initialDueAt: data.dueAt,
      createdAt: now, updatedAt: now }).returning();
    await activity(tx, actor.id, "created", "Created this task", { taskId: task.id, details: { assigneeId: task.assigneeId, dueAt: task.dueAt } }, now);
    return task;
  });
}
export async function editTask(actor: AppUser, id: string, version: number, input: TaskInput, now = Date.now()) {
  const data = taskInputSchema.parse(input);
  return db.transaction(async tx => {
    actor = await freshActor(tx, actor);
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, id));
    invariant(task && canViewTask(actor, task, now), "Task not found.", "not_found");
    invariant(canEditTask(actor, task), "You cannot edit this task. Completed tasks must be reopened first.", "forbidden");
    invariant(isManagement(actor) || (data.assigneeId === actor.id && data.requireLink === task.requireLink), "You cannot change assignment or link requirements.", "forbidden");
    await activeAssignee(tx, data.assigneeId);
    invariant(data.dueAt > task.availableAt, "The deadline must be after the task start time.");
    const [updated] = await tx.update(tasks).set({ ...data, version: task.version + 1, updatedAt: now })
      .where(and(eq(tasks.id, id), eq(tasks.version, version))).returning();
    invariant(updated, "This task changed while you were editing. Refresh and try again.", "conflict");
    const changes = Object.fromEntries(Object.entries(data).filter(([key, value]) => JSON.stringify(task[key as keyof typeof task]) !== JSON.stringify(value)).map(([key, value]) => [key, { before: task[key as keyof typeof task], after: value }]));
    await activity(tx, actor.id, "edited", "Updated task details", { taskId: id, details: changes }, now);
    return updated;
  });
}
export async function changeStatus(actor: AppUser, id: string, version: number, status: TaskStatus, reason = "", now = Date.now()) {
  invariant(["not_started", "in_progress", "blocked", "reopened"].includes(status), "Use Submit work to complete a task.");
  invariant(reason.length <= 10000, "Keep the note under 10,000 characters.");
  return db.transaction(async tx => {
    actor = await freshActor(tx, actor);
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, id));
    invariant(task && canViewTask(actor, task, now), "Task not found.", "not_found");
    if (status === "reopened") {
      requireManagement(actor);
      invariant(task.status === "completed", "Only completed tasks can be reopened.");
      invariant(reason.trim(), "Explain what needs to be done before reopening.");
    } else {
      invariant(task.status !== "completed", "Ask your manager to reopen this completed task.");
      invariant(status !== "blocked" || reason.trim(), "Explain what is blocking this task.");
    }
    const [updated] = await tx.update(tasks).set({ status, completedAt: null, completedLate: false, updatedAt: now, version: task.version + 1 })
      .where(and(eq(tasks.id, id), eq(tasks.version, version))).returning();
    invariant(updated, "This task changed. Refresh before updating its status.", "conflict");
    await activity(tx, actor.id, status === "reopened" ? "reopened" : "status", reason.trim() || `Changed status to ${status.replaceAll("_", " ")}`, { taskId: id, details: { from: task.status, to: status } }, now);
    return updated;
  });
}
export async function submitTask(actor: AppUser, id: string, version: number, note: string, links: string[], now = Date.now()) {
  links = linksSchema.parse(links);
  invariant(note.trim().length > 0 && note.length <= 10000, "Add a completion note (up to 10,000 characters).");
  return db.transaction(async tx => {
    actor = await freshActor(tx, actor);
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, id));
    invariant(task && canViewTask(actor, task, now), "Task not found.", "not_found");
    invariant(task.status !== "completed", "This task is already completed. Refresh to see the submission.", "conflict");
    invariant(!task.requireLink || links.length > 0, "This task needs at least one work link.");
    const late = now > task.dueAt;
    const [updated] = await tx.update(tasks).set({ status: "completed", completedAt: now, completedLate: late, version: task.version + 1, updatedAt: now })
      .where(and(eq(tasks.id, id), eq(tasks.version, version))).returning();
    invariant(updated, "This task changed. Refresh before submitting.", "conflict");
    await tx.insert(submissions).values({ id: crypto.randomUUID(), taskId: id, authorId: actor.id, note: note.trim(), links, late, dueAt: task.dueAt, submittedAt: now });
    await activity(tx, actor.id, "submitted", late ? "Submitted work after the deadline" : "Submitted work", { taskId: id }, now);
    return updated;
  });
}
export async function commentTask(actor: AppUser, id: string, message: string, now = Date.now()) {
  invariant(message.trim().length > 0 && message.length <= 10000, "Write a comment (up to 10,000 characters).");
  await db.transaction(async tx => {
    actor = await freshActor(tx, actor);
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, id));
    invariant(task && canViewTask(actor, task, now), "Task not found.", "not_found");
    await activity(tx, actor.id, "comment", message.trim(), { taskId: id }, now);
  });
}
