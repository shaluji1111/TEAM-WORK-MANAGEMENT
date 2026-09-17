import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { mkdirSync } from "node:fs";
import { migrate } from "drizzle-orm/libsql/migrator";
import { and, eq, gt, sql } from "drizzle-orm";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import type { AppUser } from "@/db/schema";
import { fromLocal } from "@/lib/time";

mkdirSync(".test-db", { recursive: true });
process.env.TURSO_DATABASE_URL = `file:./.test-db/unit-${crypto.randomUUID()}.db`;
process.env.BETTER_AUTH_SECRET = "isolated-tests-only-secret-at-least-32-characters";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.CRON_SECRET = "isolated-test-cron-secret";
const { db, client } = await import("@/db");
const schema = await import("@/db/schema");
const { tasks, user, account, events, series, session, submissions, scheduler } = schema;
const taskService = await import("@/lib/task-service");
const people = await import("@/lib/user-service");
const { setupTeam } = await import("@/lib/team-setup");
const recurring = await import("@/lib/series-service");
const holidayService = await import("@/lib/holiday-service");
const { runScheduler, catchUp } = await import("@/lib/scheduler");
const queries = await import("@/lib/queries");
const { getAuth } = await import("@/lib/auth");
const authRoute = await import("@/app/api/auth/[...all]/route");
const cronRoute = await import("@/app/api/cron/recurrences/route");
const now = fromLocal("2026-09-14", "10:00");
let hod: AppUser, manager: AppUser, member: AppUser, other: AppUser;
let hash: string;
beforeAll(async () => { await migrate(db, { migrationsFolder: "./drizzle" }); hash = await hashPassword("Original-pass-2026"); });
beforeEach(async () => {
  for (const table of [events, schema.holidays, submissions, tasks, series, session, account, user, scheduler, schema.rateLimit]) await db.delete(table);
  const rows = [];
  for (const [id, role] of [["hod", "hod"], ["manager", "manager"], ["member", "member"], ["other", "member"]] as const) {
    const [row] = await db.insert(user).values({ id, name: id, username: `js-${id}`, displayUsername: `JS-${id.toUpperCase()}`, email: `${id}@accounts.invalid`, role, mustChangePassword: false }).returning();
    await db.insert(account).values({ id: `acc-${id}`, providerId: "credential", accountId: id, userId: id, password: hash }); rows.push(row);
  }
  [hod, manager, member, other] = rows;
});

describe("holiday recording, visibility and reversals", () => {
  const day = { startDate: "2026-09-14", endDate: "2026-09-14", portion: "full_day" as const, note: "Family plans" };
  it("records immediately for the authenticated employee and protects other employees' entries", async () => {
    const record = await holidayService.recordHoliday(member, { ...day, userId: other.id } as typeof day, now);
    expect(record.userId).toBe(member.id); expect(record.status).toBe("active");
    expect((await holidayService.holidayList(member, {}, now)).total).toBe(1);
    expect((await holidayService.holidayList(other, { person: member.id }, now)).total).toBe(0);
    expect((await holidayService.holidayList(manager, { person: member.id }, now)).total).toBe(1);
    expect((await holidayService.teamHolidaysToday(hod, now))[0].name).toBe(member.name);
    await expect(holidayService.teamHolidaysToday(member, now)).rejects.toThrow("permission");
    await expect(holidayService.closeHoliday(other, record.id, 1, "Not my holiday", now)).rejects.toThrow("not found");
  });
  it("allows separate halves but rejects duplicate or overlapping full days", async () => {
    await holidayService.recordHoliday(member, { ...day, portion: "first_half" }, now);
    await holidayService.recordHoliday(member, { ...day, portion: "second_half" }, now);
    expect((await holidayService.holidayList(member, {}, now)).total).toBe(2);
    await expect(holidayService.recordHoliday(member, { ...day, portion: "first_half" }, now)).rejects.toThrow("already have");
    await expect(holidayService.recordHoliday(member, { ...day, endDate: "2026-09-16" }, now)).rejects.toThrow("already have");
    await holidayService.recordHoliday(other, { ...day, endDate: "2026-09-16" }, now);
    await expect(holidayService.recordHoliday(other, { ...day, startDate: "2026-09-16", endDate: "2026-09-16", portion: "second_half" }, now)).rejects.toThrow("already have");
  });
  it("rejects invalid dates, backwards ranges and half days spanning multiple dates", async () => {
    await expect(holidayService.recordHoliday(member, { ...day, startDate: "2026-02-30" }, now)).rejects.toThrow();
    await expect(holidayService.recordHoliday(member, { ...day, endDate: "2026-09-13" }, now)).rejects.toThrow("on or after");
    await expect(holidayService.recordHoliday(member, { ...day, endDate: "2026-09-15", portion: "first_half" }, now)).rejects.toThrow("single date");
  });
  it("lets both management roles reverse with a reason and keeps employee-visible history", async () => {
    for (const supervisor of [manager, hod]) {
      const record = await holidayService.recordHoliday(member, day, now);
      await expect(holidayService.closeHoliday(supervisor, record.id, 1, "", now)).rejects.toThrow("reason");
      const reversed = await holidayService.closeHoliday(supervisor, record.id, 1, "Dates entered incorrectly", now + 1000);
      expect(reversed.status).toBe("reversed"); expect(reversed.closedBy).toBe(supervisor.id);
      await expect(holidayService.closeHoliday(member, record.id, 1, "Old screen", now)).rejects.toThrow("Refresh");
    }
    expect((await holidayService.holidayList(member, {}, now)).total).toBe(0);
    expect((await holidayService.holidayList(member, { view: "history" }, now)).rows).toHaveLength(2);
    expect((await holidayService.teamHolidaysToday(hod, now))).toHaveLength(0);
    const history = await db.select().from(events).where(eq(events.kind, "holiday_reversed"));
    expect(history).toHaveLength(2); expect(history[0].details?.reason).toBe("Dates entered incorrectly");
  });
  it("supports employee cancellation and replacement without deleting the original entry", async () => {
    const record = await holidayService.recordHoliday(member, day, now);
    expect((await holidayService.closeHoliday(member, record.id, 1, "Plans changed", now)).status).toBe("cancelled");
    await holidayService.recordHoliday(member, { ...day, portion: "first_half" }, now);
    expect((await holidayService.holidayList(member, {}, now)).total).toBe(1);
    const [old] = (await holidayService.holidayList(member, { view: "history" }, now)).rows;
    expect(old.holiday.closeReason).toBe("Plans changed"); expect(old.closedByName).toBe(member.name);
  });
  it("uses IST date boundaries, including both ends of a full-day range, without changing task deadlines", async () => {
    const task = await taskService.createTask(manager, input(), now);
    await holidayService.recordHoliday(member, { ...day, endDate: "2026-09-16" }, now);
    expect((await holidayService.teamHolidaysToday(hod, fromLocal("2026-09-14") - 1))).toHaveLength(0);
    expect((await holidayService.teamHolidaysToday(hod, fromLocal("2026-09-14")))).toHaveLength(1);
    expect((await holidayService.teamHolidaysToday(hod, fromLocal("2026-09-17") - 1))).toHaveLength(1);
    expect((await holidayService.holidayList(member, {}, fromLocal("2026-09-17")))).toMatchObject({ total: 0 });
    expect((await holidayService.holidayList(member, { view: "history" }, fromLocal("2026-09-17")))).toMatchObject({ total: 1 });
    expect((await queries.taskDetail(member, task.id, now))?.task.dueAt).toBe(task.dueAt);
  });
  it("rejects access after deactivation or an administrative password reset", async () => {
    const record = await holidayService.recordHoliday(member, day, now);
    await people.resetPassword(manager, member.id, "Temporary-reset-2026");
    await expect(holidayService.recordHoliday(member, day, now)).rejects.toThrow("access has changed");
    await expect(holidayService.closeHoliday(member, record.id, 1, "Stale session", now)).rejects.toThrow("access has changed");
    await expect(holidayService.holidayList(member, {}, now)).rejects.toThrow("access has changed");
    await people.updatePerson(hod, other.id, { name: other.name, role: "member", active: false, authVersion: 1 }, now);
    await expect(holidayService.recordHoliday(other, day, now)).rejects.toThrow("access has changed");
  });
});
afterAll(() => client.close());
const input = (assigneeId = "member") => ({ title: "Prepare the handover", description: "Share the final work", assigneeId, dueAt: now + 3600_000, priority: "medium" as const, requireLink: false, referenceLinks: [] });
const ruleInput = () => ({ ...input(), frequency: "daily" as const, startDate: "2026-09-14", startTime: "09:00", weekdays: [0,1,2,3,4,5,6], month: 1, monthDay: 1, dueAfterDays: 2, dueTime: "18:00" });

describe("task authorization and lifecycle", () => {
  it("allows self tasks but rejects cross-member assignment and disclosure", async () => {
    const self = await taskService.createTask(member, input(member.id), now);
    expect(self.source).toBe("self");
    await expect(taskService.createTask(member, input(other.id), now)).rejects.toThrow("only create");
    expect(await queries.taskDetail(other, self.id, now)).toBeNull();
    await expect(taskService.commentTask(other, self.id, "hello", now)).rejects.toThrow("not found");
    await expect(taskService.submitTask(other, self.id, self.version, "done", [], now)).rejects.toThrow("not found");
    await expect(queries.taskList(member, "team", {}, now)).rejects.toThrow("not available");
    expect((await queries.taskList(other, "mine", { assignee: member.id }, now)).total).toBe(0);
  });
  it("protects assigned instructions but lets a member edit their own self task", async () => {
    const assigned = await taskService.createTask(manager, input(), now);
    await expect(taskService.editTask(member, assigned.id, 1, { ...input(), title: "Changed instructions" }, now)).rejects.toThrow("cannot edit");
    const self = await taskService.createTask(member, input(member.id), now);
    expect((await taskService.editTask(member, self.id, 1, { ...input(member.id), title: "Updated self task" }, now)).title).toBe("Updated self task");
    await expect(taskService.editTask(member, self.id, 2, input(other.id), now)).rejects.toThrow("assignment");
  });
  it("requires blocker explanations and respects stale versions", async () => {
    const task = await taskService.createTask(manager, input(), now);
    await expect(taskService.changeStatus(member, task.id, 1, "blocked", "", now)).rejects.toThrow("blocking");
    await taskService.changeStatus(member, task.id, 1, "blocked", "Need access", now);
    await expect(taskService.changeStatus(member, task.id, 1, "in_progress", "", now)).rejects.toThrow("Refresh");
  });
  it("enforces evidence and preserves late/reopened submissions", async () => {
    const task = await taskService.createTask(manager, { ...input(), requireLink: true }, now);
    await expect(taskService.submitTask(member, task.id, 1, "Done", [], now)).rejects.toThrow("work link");
    await expect(taskService.submitTask(member, task.id, 1, "", ["https://example.com"], now)).rejects.toThrow("completion note");
    const late = await taskService.submitTask(member, task.id, 1, "Final file", ["https://example.com/final"], now + 7200_000);
    expect(late.completedLate).toBe(true); expect(late.status).toBe("completed");
    await expect(taskService.changeStatus(member, task.id, 2, "reopened", "fix", now)).rejects.toThrow("permission");
    await expect(taskService.changeStatus(manager, task.id, 2, "reopened", "", now)).rejects.toThrow("Explain");
    const open = await taskService.changeStatus(hod, task.id, 2, "reopened", "Add missing totals", now + 7300_000);
    const final = await taskService.submitTask(member, task.id, open.version, "Totals added", ["https://example.com/revised"], now + 7400_000);
    expect(final.status).toBe("completed");
    expect((await db.select().from(submissions).where(eq(submissions.taskId, task.id)))).toHaveLength(2);
    expect((await db.select().from(events).where(eq(events.taskId, task.id))).some(e => e.kind === "reopened")).toBe(true);
  });
  it("rejects unsafe link schemes and double submissions", async () => {
    const task = await taskService.createTask(manager, input(), now);
    await expect(taskService.submitTask(member, task.id, 1, "done", ["javascript:alert(1)"], now)).rejects.toThrow();
    await taskService.submitTask(member, task.id, 1, "done", [], now);
    await expect(taskService.submitTask(member, task.id, 1, "done twice", [], now)).rejects.toThrow("already completed");
  });
  it("records deadline and assignee changes; old assignees lose access", async () => {
    const task = await taskService.createTask(manager, input(), now);
    const edited = await taskService.editTask(hod, task.id, 1, { ...input(other.id), dueAt: now + 7200_000 }, now);
    expect(edited.initialDueAt).toBe(task.dueAt);
    expect(await queries.taskDetail(member, task.id, now)).toBeNull();
    const [event] = await db.select().from(events).where(and(eq(events.taskId, task.id), eq(events.kind, "edited")));
    expect(event.details?.dueAt).toEqual({ before: task.dueAt, after: edited.dueAt });
  });
  it("paginates and counts filtered tasks consistently", async () => {
    for (let i = 0; i < 23; i++) await taskService.createTask(manager, { ...input(), title: `Weekly handover ${i}` }, now);
    expect((await queries.taskList(member, "mine", { page: "2" }, now)).rows).toHaveLength(3);
    const beyondLastPage = await queries.taskList(member, "mine", { page: "999999999999999999999999" }, now);
    expect(beyondLastPage.page).toBe(2); expect(beyondLastPage.rows).toHaveLength(3);
    expect((await queries.taskStats(member, "mine", {}, now)).pending).toBe(23);
    expect((await queries.taskList(member, "mine", { q: "nonexistent" }, now)).total).toBe(0);
  });
});
describe("initial team setup", () => {
  const roster = [
    { name: "Initial HOD", username: "JS-FIRST", role: "hod", designation: "Department head", password: "Initial-HOD-pass-2026" },
    { name: "Initial lead", username: "JS-LEAD", role: "manager", designation: "Team lead", password: "Initial-lead-pass-2026" }
  ];
  it("does not overwrite existing accounts", async () => {
    await expect(setupTeam(roster)).rejects.toThrow("empty workspace");
    expect((await db.select().from(user))).toHaveLength(4);
  });
  it("validates the complete roster and creates forced-password accounts with separate designations", async () => {
    for (const table of [events, account, user]) await db.delete(table);
    await expect(setupTeam([roster[0], { ...roster[1], username: "js-FIRST" }])).rejects.toThrow("unique");
    await expect(setupTeam([roster[1]])).rejects.toThrow("HOD");
    expect((await db.select().from(user))).toHaveLength(0);
    expect(await setupTeam(roster)).toEqual({ created: 2 });
    const created = await db.select({ person: user, credential: account }).from(user).innerJoin(account, eq(user.id, account.userId));
    expect(created.every(row => row.person.mustChangePassword)).toBe(true);
    const lead = created.find(row => row.person.username === "js-lead")!;
    expect(lead.person.designation).toBe("Team lead"); expect(lead.person.role).toBe("manager");
    expect(await verifyPassword({ hash: lead.credential.password!, password: roster[1].password })).toBe(true);
    await expect(taskService.createTask(lead.person, input(lead.person.id), now)).rejects.toThrow("temporary password");
  });
});

describe("accounts and sessions", () => {
  it("requires a password change and prevents privilege escalation", async () => {
    const created = await people.createPerson(manager, { name: "New member", username: "JS-NEW", password: "Temporary-pass-123", role: "member" });
    expect(created.username).toBe("js-new"); expect(created.mustChangePassword).toBe(true);
    await expect(taskService.createTask(created, input(created.id), now)).rejects.toThrow("temporary password");
    await expect(people.createPerson(manager, { name: "Bad manager", username: "JS-BAD", password: "Temporary-pass-123", role: "hod" })).rejects.toThrow("only member");
    await expect(people.createPerson(hod, { name: "Duplicate", username: "js-NEW", password: "Temporary-pass-123", role: "member" })).rejects.toThrow("already exists");
    await expect(people.updatePerson(manager, member.id, { name: "member", role: "hod", active: true, authVersion: 1 })).rejects.toThrow("management roles");
  });
  it("normalizes JS ID login and revokes sessions after a reset", async () => {
    const login = await getAuth().api.signInUsername({ body: { username: "JS-MEMBER", password: "Original-pass-2026" } });
    expect(login.user.id).toBe(member.id);
    expect((await db.select().from(session))).toHaveLength(1);
    await people.resetPassword(manager, member.id, "Reset-password-2026");
    expect((await db.select().from(session))).toHaveLength(0);
    await expect(getAuth().api.signInUsername({ body: { username: "js-member", password: "Original-pass-2026" } })).rejects.toThrow();
    const fresh = (await db.select().from(user).where(eq(user.id, member.id)))[0];
    expect(fresh.mustChangePassword).toBe(true);
    await people.changeOwnPassword(fresh, "Reset-password-2026", "New-personal-pass-2026");
    expect((await db.select().from(user).where(eq(user.id, member.id)))[0].mustChangePassword).toBe(false);
    expect((await getAuth().api.signInUsername({ body: { username: "js-member", password: "New-personal-pass-2026" } })).user.id).toBe(member.id);
  });
  it("protects the last active HOD", async () => {
    await expect(people.updatePerson(hod, hod.id, { name: "hod", role: "member", active: true, authVersion: 1 })).rejects.toThrow("At least one");
    await expect(people.updatePerson(hod, hod.id, { name: "hod", role: "hod", active: false, authVersion: 1 })).rejects.toThrow("At least one");
  });
  it("deactivation revokes sessions, blocks login and pauses future work", async () => {
    await recurring.saveSeries(manager, ruleInput(), undefined, now);
    await getAuth().api.signInUsername({ body: { username: "js-member", password: "Original-pass-2026" } });
    await people.updatePerson(hod, member.id, { name: member.name, role: "member", active: false, authVersion: 1 }, now);
    expect((await db.select().from(session))).toHaveLength(0);
    expect((await db.select().from(series))[0].active).toBe(false);
    expect((await db.select().from(tasks).where(gt(tasks.availableAt, now)))).toHaveLength(0);
    expect((await db.select().from(tasks))).toHaveLength(1);
    await expect(getAuth().api.signInUsername({ body: { username: "js-member", password: "Original-pass-2026" } })).rejects.toThrow();
    await expect(taskService.createTask(member, input(member.id), now)).rejects.toThrow("access has changed");
  });
  it("does not expose signup, profile escalation or alternate login routes", async () => {
    for (const path of ["sign-up/email", "update-user", "sign-in/email", "admin/set-role", "change-password"]) {
      const result = await authRoute.POST(new Request(`http://localhost:3000/api/auth/${path}`, { method: "POST" }));
      expect(result.status).toBe(404);
    }
    expect((await cronRoute.GET(new Request("http://localhost:3000/api/cron/recurrences"))).status).toBe(401);
  });
});
describe("recurrence persistence and recovery", () => {
  it("keeps normal page reads free of scheduler writes, while recovering an expired horizon", async () => {
    expect(await catchUp(now)).toBeNull();
    await recurring.saveSeries(manager, ruleInput(), undefined, now);
    const before = (await client.execute("select total_changes() as count")).rows[0].count;
    expect(await catchUp(now)).toBeNull();
    expect(await catchUp(now + 120_000)).toBeNull();
    expect((await client.execute("select total_changes() as count")).rows[0].count).toBe(before);
    expect((await db.select().from(scheduler))).toHaveLength(0);
    const later = fromLocal("2026-10-01", "10:00");
    expect(await catchUp(later)).toBeNull();
    const [missed] = await db.select().from(tasks).where(eq(tasks.availableAt, fromLocal("2026-09-24", "09:00")));
    expect(missed.dueAt).toBe(fromLocal("2026-09-26", "18:00"));
    const count = (await db.select().from(tasks)).length;
    expect(await catchUp(later)).toBeNull();
    expect((await db.select().from(tasks))).toHaveLength(count);
  });
  it("hides future tasks and creates each occurrence exactly once", async () => {
    const rule = await recurring.saveSeries(manager, ruleInput(), undefined, now);
    const total = (await db.select().from(tasks)).length;
    expect(total).toBeGreaterThan(1);
    expect((await queries.taskList(member, "mine", {}, now)).total).toBe(1);
    expect((await queries.taskStats(manager, "team", {}, now)).total).toBe(1);
    const future = (await db.select().from(tasks).where(gt(tasks.availableAt, now)))[0];
    expect(await queries.taskDetail(hod, future.id, now)).toBeNull();
    await runScheduler(now, true); await runScheduler(now, true);
    expect((await db.select().from(tasks))).toHaveLength(total);
    expect((await db.select().from(tasks).where(eq(tasks.seriesId, rule.id))).length).toBe(total);
  });
  it("catches up missed days with their original deadlines", async () => {
    await recurring.saveSeries(manager, ruleInput(), undefined, now);
    await runScheduler(fromLocal("2026-10-01", "10:00"), true);
    const [missed] = await db.select().from(tasks).where(eq(tasks.availableAt, fromLocal("2026-09-24", "09:00")));
    expect(missed.dueAt).toBe(fromLocal("2026-09-26", "18:00"));
    const late = await taskService.submitTask(member, missed.id, 1, "Completed afterwards", [], fromLocal("2026-10-01", "10:00"));
    expect(late.completedLate).toBe(true);
  });
  it("preserves started tasks when editing and skips paused dates on resume", async () => {
    const rule = await recurring.saveSeries(manager, ruleInput(), undefined, now);
    await recurring.saveSeries(hod, { ...ruleInput(), title: "Updated future work" }, { id: rule.id, version: rule.version }, now);
    const first = (await db.select().from(tasks).where(eq(tasks.availableAt, fromLocal("2026-09-14", "09:00"))))[0];
    expect(first.title).toBe("Prepare the handover");
    const future = (await db.select().from(tasks).where(gt(tasks.availableAt, now)))[0]; expect(future.title).toBe("Updated future work");
    await recurring.toggleSeries(hod, rule.id, 2, now);
    await recurring.toggleSeries(hod, rule.id, 3, fromLocal("2026-09-17", "08:00"));
    expect((await db.select().from(tasks).where(and(gt(tasks.availableAt, now), sql`${tasks.availableAt} < ${fromLocal("2026-09-17")}`)))).toHaveLength(0);
    expect((await db.select().from(tasks).where(eq(tasks.availableAt, fromLocal("2026-09-17", "09:00"))))).toHaveLength(1);
  });
  it("prevents members from creating or pausing schedules", async () => {
    await expect(recurring.saveSeries(member, ruleInput(), undefined, now)).rejects.toThrow("permission");
    const rule = await recurring.saveSeries(manager, ruleInput(), undefined, now);
    await expect(recurring.toggleSeries(member, rule.id, 1, now)).rejects.toThrow("permission");
  });
});
