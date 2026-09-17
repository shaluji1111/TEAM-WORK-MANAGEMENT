import "./env";
import { eq } from "drizzle-orm";
import { db, client } from "../src/db";
import { tasks, user, type AppUser } from "../src/db/schema";
import { createPerson, changeOwnPassword } from "../src/lib/user-service";
import { createTask, submitTask, changeStatus } from "../src/lib/task-service";
import { saveSeries } from "../src/lib/series-service";
import { addDays, fromLocal, localDate } from "../src/lib/time";
if (!(process.env.TURSO_DATABASE_URL || "file:./local.db").startsWith("file:")) throw new Error("Demo data is only allowed in a local file database.");
if ((await db.select().from(user).limit(1)).length) throw new Error("Demo seeding requires an empty database; existing data was left unchanged.");
const temporary = "Demo-Temporary-2026!";
const password = "TeamTracker-Demo-2026!";
async function ready(person: AppUser) {
  await changeOwnPassword(person, temporary, password);
  return (await db.select().from(user).where(eq(user.id, person.id)))[0];
}
const hod = await ready(await createPerson(null, { name: "Aditi Sharma", username: "JS1001", password: temporary, role: "hod" }, true));
const manager = await ready(await createPerson(hod, { name: "Karan Malhotra", username: "JS1002", password: temporary, role: "manager" }));
const riya = await ready(await createPerson(hod, { name: "Riya Mehta", username: "JS1003", password: temporary, role: "member" }));
const arjun = await ready(await createPerson(hod, { name: "Arjun Rao", username: "JS1004", password: temporary, role: "member" }));
const neha = await ready(await createPerson(hod, { name: "Neha Singh", username: "JS1005", password: temporary, role: "member" }));
const now = Date.now(); const today = localDate(now); const yesterday = addDays(today, -1);
const specs = [
  { title: "Prepare the weekly progress report", person: riya, due: fromLocal(today, "18:00"), priority: "high", status: "in_progress" },
  { title: "Review the client handover notes", person: arjun, due: fromLocal(yesterday, "17:00"), priority: "high", status: "in_progress" },
  { title: "Update the shared resource tracker", person: neha, due: fromLocal(today, "17:30"), priority: "medium", status: "blocked" },
  { title: "Confirm next week’s team priorities", person: manager, due: fromLocal(addDays(today, 1), "12:00"), priority: "high", status: "not_started" },
  { title: "Review outstanding approvals", person: hod, due: fromLocal(today, "18:30"), priority: "medium", status: "in_progress" },
  { title: "Share the updated onboarding checklist", person: riya, due: fromLocal(addDays(today, 2), "16:00"), priority: "low", status: "not_started" },
  { title: "Consolidate the meeting action items", person: arjun, due: fromLocal(yesterday, "18:00"), priority: "medium", status: "completed" },
  { title: "Complete the documentation review", person: neha, due: fromLocal(today, "20:00"), priority: "low", status: "completed" },
  { title: "Check coverage while managers are away", person: hod, due: fromLocal(addDays(today, 1), "11:00"), priority: "high", status: "not_started" },
  { title: "Follow up on the pending data request", person: riya, due: fromLocal(yesterday, "15:00"), priority: "medium", status: "blocked" }
] as const;
for (const spec of specs) {
  const created = await createTask(hod, { title: spec.title, description: "Review the latest information, complete the work and share a brief update. Add a link to the finished document so the team can pick up from here.", assigneeId: spec.person.id, dueAt: spec.due, priority: spec.priority, requireLink: false, referenceLinks: [] }, fromLocal(addDays(today, -3), "09:00"));
  if (spec.status === "completed") await submitTask(spec.person, created.id, created.version, "Completed the review and shared the final handover notes with the team.", ["https://example.com/demo-work"], now);
  else if (spec.status !== "not_started") await changeStatus(spec.person, created.id, created.version, spec.status, spec.status === "blocked" ? "Waiting for the source data before I can finish. Please help with access." : "Started the first review; on track to finish.", now);
}
await saveSeries(manager, { title: "Update the daily work tracker", description: "Add today’s progress and flag any blockers before the end of the day.", assigneeId: riya.id, priority: "medium", referenceLinks: [], requireLink: false,
  frequency: "daily", startDate: today, startTime: "09:00", weekdays: [1,2,3,4,5,6], monthDay: 1, month: 1, dueAfterDays: 0, dueTime: "18:00" }, undefined, now);
await saveSeries(hod, { title: "Send the weekly team handover", description: "Summarize open tasks and links for the coming week.", assigneeId: manager.id, priority: "high", referenceLinks: [], requireLink: true,
  frequency: "weekly", startDate: today, startTime: "10:00", weekdays: [5], monthDay: 1, month: 1, dueAfterDays: 2, dueTime: "18:00" }, undefined, now);
console.log("Local demo created. JS1001 (HOD), JS1002 (manager), JS1003 (member). See README.md for the local-demo password. Never seed demo accounts into production.");
client.close();
