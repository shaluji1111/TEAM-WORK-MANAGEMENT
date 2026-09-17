"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { currentUser } from "@/lib/current-user";
import { AppError } from "@/lib/errors";
import { createTask, editTask, changeStatus, submitTask, commentTask } from "@/lib/task-service";
import { createPerson, updatePerson, resetPassword, changeOwnPassword } from "@/lib/user-service";
import { saveSeries, toggleSeries } from "@/lib/series-service";
import { recordHoliday, closeHoliday, type HolidayInput } from "@/lib/holiday-service";
import { fromLocalInput } from "@/lib/time";
import type { ActionResult } from "@/components/forms";
import type { TaskStatus, Role } from "@/db/schema";
import type { SeriesInput } from "@/lib/validation";
const str = (form: FormData, key: string) => String(form.get(key) ?? "");
const links = (form: FormData, key: string) => str(form, key).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
function taskData(form: FormData) {
  return { title: str(form, "title"), description: str(form, "description"), assigneeId: str(form, "assigneeId"),
    dueAt: fromLocalInput(str(form, "dueAt")), priority: str(form, "priority") as "low" | "medium" | "high",
    requireLink: form.get("requireLink") === "on", referenceLinks: links(form, "referenceLinks") };
}
async function attempt(operation: () => Promise<ActionResult>): Promise<ActionResult> {
  try { const result = await operation(); revalidatePath("/", "layout"); return result; }
  catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.message };
    if (error instanceof ZodError) return { ok: false, message: error.issues[0]?.message || "Check your entries." };
    console.error("Action failed", error);
    return { ok: false, message: "We couldn't save this change. Your input is still here. Please try again." };
  }
}
export async function createTaskAction(form: FormData) {
  const actor = await currentUser();
  return attempt(async () => { const task = await createTask(actor, taskData(form)); return { ok: true, redirect: `/tasks/${task.id}` }; });
}
export async function editTaskAction(id: string, version: number, form: FormData) {
  const actor = await currentUser();
  return attempt(async () => { await editTask(actor, id, version, taskData(form)); return { ok: true, message: "Task updated." }; });
}
export async function statusAction(id: string, version: number, form: FormData) {
  const actor = await currentUser();
  return attempt(async () => { await changeStatus(actor, id, version, str(form, "status") as TaskStatus, str(form, "reason")); return { ok: true, message: "Status updated." }; });
}
export async function submitAction(id: string, version: number, form: FormData) {
  const actor = await currentUser();
  return attempt(async () => { await submitTask(actor, id, version, str(form, "note"), links(form, "links")); return { ok: true, message: "Work submitted. This task is now completed." }; });
}
export async function commentAction(id: string, form: FormData) {
  const actor = await currentUser();
  return attempt(async () => { await commentTask(actor, id, str(form, "comment")); return { ok: true, message: "Comment added." }; });
}
export async function createPersonAction(form: FormData) {
  const actor = await currentUser();
  return attempt(async () => { await createPerson(actor, { name: str(form, "name"), designation: str(form, "designation"), username: str(form, "username"), password: str(form, "password"), role: str(form, "role") as Role }); return { ok: true, message: "Account created. Share the temporary password directly with this person." }; });
}
export async function updatePersonAction(id: string, version: number, form: FormData) {
  const actor = await currentUser();
  return attempt(async () => { await updatePerson(actor, id, { name: str(form, "name"), designation: str(form, "designation"), role: str(form, "role") as Role, active: str(form, "active") === "true", authVersion: version }); return { ok: true, message: "Account updated. Existing sessions have been signed out." }; });
}
export async function resetPasswordAction(id: string, form: FormData) {
  const actor = await currentUser();
  return attempt(async () => { await resetPassword(actor, id, str(form, "password")); return { ok: true, message: "Password reset. Share the new temporary password directly with this person." }; });
}
export async function passwordAction(form: FormData) {
  const actor = await currentUser(true);
  if (str(form, "password") !== str(form, "confirmPassword")) return { ok: false, message: "The new passwords do not match." };
  return attempt(async () => { await changeOwnPassword(actor, str(form, "currentPassword"), str(form, "password")); return { ok: true, redirect: "/login?changed=1" }; });
}
export async function saveSeriesAction(existing: { id: string; version: number } | undefined, form: FormData) {
  const actor = await currentUser();
  return attempt(async () => {
    const { dueAt: _dueAt, ...base } = taskData(form);
    const data: SeriesInput = { ...base, frequency: str(form, "frequency") as SeriesInput["frequency"], startDate: str(form, "startDate"), startTime: str(form, "startTime"),
      weekdays: form.getAll("weekdays").map(Number), monthDay: Number(form.get("monthDay")), month: Number(form.get("month")), dueAfterDays: Number(form.get("dueAfterDays")), dueTime: str(form, "dueTime") };
    await saveSeries(actor, data, existing); return { ok: true, message: existing ? "Future occurrences updated." : "Repeating task created." };
  });
}
export async function toggleSeriesAction(id: string, version: number, _form: FormData) {
  const actor = await currentUser();
  return attempt(async () => { await toggleSeries(actor, id, version); return { ok: true, message: "Schedule updated." }; });
}
export async function recordHolidayAction(form: FormData) {
  const actor = await currentUser();
  return attempt(async () => {
    await recordHoliday(actor, { startDate: str(form, "startDate"), endDate: str(form, "endDate"), portion: str(form, "portion") as HolidayInput["portion"], note: str(form, "note") });
    return { ok: true, message: "Holiday recorded. Your Manager and HOD can see it immediately." };
  });
}
export async function closeHolidayAction(id: string, version: number, form: FormData) {
  const actor = await currentUser();
  return attempt(async () => {
    const holiday = await closeHoliday(actor, id, version, str(form, "reason"));
    return { ok: true, message: holiday.status === "reversed" ? "Holiday reversed. The reason is visible in history." : "Holiday cancelled. The entry remains in history." };
  });
}
