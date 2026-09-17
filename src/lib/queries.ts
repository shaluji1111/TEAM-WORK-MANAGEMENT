import { and, asc, desc, eq, gte, like, lt, lte, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { events, submissions, tasks, user, type AppUser } from "@/db/schema";
import { isManagement, canViewTask } from "./permissions";
import { invariant } from "./errors";
import { dayBounds, fromLocal, addDays } from "./time";
export type Filters = { view?: string; status?: string; priority?: string; assignee?: string; q?: string; from?: string; to?: string; page?: string };
export function taskConditions(actor: AppUser, scope: "mine" | "team", filters: Filters, now: number, includeView = true) {
  invariant(scope === "mine" || isManagement(actor), "This view is not available.", "forbidden");
  const conditions: (SQL | undefined)[] = [lte(tasks.availableAt, now)];
  if (scope === "mine" || !isManagement(actor)) conditions.push(eq(tasks.assigneeId, actor.id));
  if (scope === "team" && filters.assignee) conditions.push(eq(tasks.assigneeId, filters.assignee));
  if (filters.q) conditions.push(like(tasks.title, `%${filters.q.slice(0, 200)}%`));
  if (["not_started", "in_progress", "blocked", "completed", "reopened"].includes(filters.status || "")) conditions.push(eq(tasks.status, filters.status as typeof tasks.$inferSelect["status"]));
  if (["low", "medium", "high"].includes(filters.priority || "")) conditions.push(eq(tasks.priority, filters.priority as "low" | "medium" | "high"));
  if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from) && Number.isFinite(fromLocal(filters.from))) conditions.push(gte(tasks.dueAt, fromLocal(filters.from)));
  if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to) && Number.isFinite(fromLocal(filters.to))) conditions.push(lt(tasks.dueAt, fromLocal(addDays(filters.to, 1))));
  if (includeView) {
    const bounds = dayBounds(now);
    if (filters.view === "today") conditions.push(gte(tasks.dueAt, bounds.start), lt(tasks.dueAt, bounds.end), ne(tasks.status, "completed"));
    if (filters.view === "upcoming") conditions.push(gte(tasks.dueAt, bounds.end), ne(tasks.status, "completed"));
    if (filters.view === "overdue") conditions.push(lt(tasks.dueAt, now), ne(tasks.status, "completed"));
    if (filters.view === "completed") conditions.push(eq(tasks.status, "completed"));
    if (filters.view === "open") conditions.push(ne(tasks.status, "completed"));
  }
  return and(...conditions);
}
export async function taskList(actor: AppUser, scope: "mine" | "team", filters: Filters, now = Date.now()) {
  const where = taskConditions(actor, scope, filters, now);
  const requestedPage = Math.min(Math.floor(Number.MAX_SAFE_INTEGER / 20), Math.max(1, Number.parseInt(filters.page || "1", 10) || 1));
  const fetchRows = (page: number) => db.select({ task: tasks, name: user.name, username: user.username, active: user.active }).from(tasks).innerJoin(user, eq(tasks.assigneeId, user.id))
    .where(where).orderBy(sql`CASE WHEN ${tasks.status} = 'completed' THEN 1 ELSE 0 END`, asc(tasks.dueAt), asc(tasks.id)).limit(20).offset((page - 1) * 20);
  const [[{ total }], requestedRows] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(tasks).where(where), fetchRows(requestedPage)
  ]);
  const pages = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(pages, requestedPage);
  // Re-query only if a stale/deep link points beyond the last page.
  const rows = page === requestedPage ? requestedRows : await fetchRows(page);
  return { rows, total, pages, page };
}
export type TaskListResult = Awaited<ReturnType<typeof taskList>>;
export async function taskStats(actor: AppUser, scope: "mine" | "team", filters: Filters = {}, now = Date.now()) {
  const [stats] = await db.select({
    total: sql<number>`count(*)`,
    pending: sql<number>`coalesce(sum(case when ${tasks.status} != 'completed' then 1 else 0 end), 0)`,
    overdue: sql<number>`coalesce(sum(case when ${tasks.status} != 'completed' and ${tasks.dueAt} < ${now} then 1 else 0 end), 0)`,
    blocked: sql<number>`coalesce(sum(case when ${tasks.status} = 'blocked' then 1 else 0 end), 0)`,
    completed: sql<number>`coalesce(sum(case when ${tasks.status} = 'completed' then 1 else 0 end), 0)`,
    late: sql<number>`coalesce(sum(case when ${tasks.status} = 'completed' and ${tasks.completedLate} = 1 then 1 else 0 end), 0)`
  }).from(tasks).where(taskConditions(actor, scope, filters, now, false));
  return stats;
}
export async function teamMembers(actor: AppUser, activeOnly = false) {
  const result = await db.select({ id: user.id, name: user.name, username: user.username, active: user.active, role: user.role }).from(user)
    .where(and(activeOnly ? eq(user.active, true) : undefined, isManagement(actor) ? undefined : eq(user.id, actor.id))).orderBy(asc(user.name));
  return result;
}
export type PersonOption = Awaited<ReturnType<typeof teamMembers>>[number];
export async function memberSummary(actor: AppUser, filters: Filters = {}, now = Date.now()) {
  invariant(isManagement(actor), "This view is not available.", "forbidden");
  return db.select({ id: user.id, name: user.name, active: user.active,
    total: sql<number>`count(*)`,
    pending: sql<number>`sum(case when ${tasks.status} != 'completed' then 1 else 0 end)`,
    overdue: sql<number>`sum(case when ${tasks.status} != 'completed' and ${tasks.dueAt} < ${now} then 1 else 0 end)`,
    blocked: sql<number>`sum(case when ${tasks.status} = 'blocked' then 1 else 0 end)`,
    completed: sql<number>`sum(case when ${tasks.status} = 'completed' then 1 else 0 end)`,
    late: sql<number>`sum(case when ${tasks.status} = 'completed' and ${tasks.completedLate} = 1 then 1 else 0 end)`
  }).from(tasks).innerJoin(user, eq(tasks.assigneeId, user.id)).where(taskConditions(actor, "team", filters, now, false)).groupBy(user.id).orderBy(asc(user.name));
}
export async function taskDetail(actor: AppUser, id: string, now = Date.now()) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task || !canViewTask(actor, task, now)) return null;
  const [[assignee], submitted, history] = await Promise.all([
    db.select({ name: user.name, active: user.active, username: user.username }).from(user).where(eq(user.id, task.assigneeId)),
    db.select({ submission: submissions, author: user.name }).from(submissions).innerJoin(user, eq(user.id, submissions.authorId)).where(eq(submissions.taskId, id)).orderBy(desc(submissions.submittedAt)),
    db.select({ event: events, author: user.name }).from(events).leftJoin(user, eq(user.id, events.actorId)).where(eq(events.taskId, id)).orderBy(desc(events.createdAt))
  ]);
  return { task, assignee, submitted, history };
}
