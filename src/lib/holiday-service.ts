import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { db } from "@/db";
import { holidays, user, type AppUser } from "@/db/schema";
import { invariant } from "./errors";
import { isManagement, requireManagement } from "./permissions";
import { activity, freshActor } from "./service-common";
import { localDate } from "./time";

export const holidayInputSchema = z.object({
  startDate: z.iso.date(), endDate: z.iso.date(),
  portion: z.enum(["full_day", "first_half", "second_half"]),
  note: z.string().trim().max(500).default("")
}).superRefine((value, ctx) => {
  if (value.endDate < value.startDate) ctx.addIssue({ code: "custom", message: "The end date must be on or after the start date.", path: ["endDate"] });
  if (value.portion !== "full_day" && value.startDate !== value.endDate) ctx.addIssue({ code: "custom", message: "A half-day holiday must be on a single date.", path: ["endDate"] });
});
export type HolidayInput = z.input<typeof holidayInputSchema>;

// The owner always comes from the authenticated actor, never from form data.
export async function recordHoliday(actor: AppUser, input: HolidayInput, now = Date.now()) {
  const data = holidayInputSchema.parse(input);
  return db.transaction(async tx => {
    actor = await freshActor(tx, actor);
    const overlapping = await tx.select({ portion: holidays.portion }).from(holidays).where(and(
      eq(holidays.userId, actor.id), eq(holidays.status, "active"),
      lte(holidays.startDate, data.endDate), gte(holidays.endDate, data.startDate)
    ));
    invariant(!overlapping.some(h => h.portion === "full_day" || data.portion === "full_day" || h.portion === data.portion),
      "You already have a holiday recorded for that day or half-day. Cancel it before adding a replacement.");
    const [holiday] = await tx.insert(holidays).values({ ...data, id: crypto.randomUUID(), userId: actor.id, createdAt: now }).returning();
    await activity(tx, actor.id, "holiday_recorded", "Recorded a holiday", { subjectUserId: actor.id, details: { holidayId: holiday.id, ...data } }, now);
    return holiday;
  });
}

export async function closeHoliday(actor: AppUser, id: string, version: number, reason: string, now = Date.now()) {
  const explanation = z.string().trim().min(3, "Give a short reason for this change.").max(500).parse(reason);
  z.number().int().positive().parse(version);
  return db.transaction(async tx => {
    actor = await freshActor(tx, actor);
    const [holiday] = await tx.select().from(holidays).where(eq(holidays.id, id));
    invariant(holiday && (holiday.userId === actor.id || isManagement(actor)), "Holiday not found.", "forbidden");
    invariant(holiday.status === "active" && holiday.version === version, "This holiday has changed. Refresh before trying again.", "conflict");
    const status = holiday.userId === actor.id ? "cancelled" : "reversed";
    const [updated] = await tx.update(holidays).set({ status, closeReason: explanation, closedBy: actor.id, closedAt: now, version: version + 1 })
      .where(and(eq(holidays.id, id), eq(holidays.version, version), eq(holidays.status, "active"))).returning();
    invariant(updated, "This holiday has changed. Refresh before trying again.", "conflict");
    await activity(tx, actor.id, `holiday_${status}`, status === "reversed" ? "Reversed a holiday" : "Cancelled their holiday", {
      subjectUserId: holiday.userId, details: { holidayId: id, reason: explanation, startDate: holiday.startDate, endDate: holiday.endDate, portion: holiday.portion }
    }, now);
    return updated;
  });
}

export type HolidayFilters = { view?: string; person?: string; page?: string };
export async function holidayList(actor: AppUser, filters: HolidayFilters = {}, now = Date.now()) {
  actor = await freshActor(db, actor);
  const today = localDate(now);
  const conditions = [isManagement(actor) ? (filters.person ? eq(holidays.userId, filters.person) : undefined) : eq(holidays.userId, actor.id)];
  if (filters.view === "history") conditions.push(sql`(${holidays.status} != 'active' OR ${holidays.endDate} < ${today})`);
  else {
    conditions.push(eq(holidays.status, "active"), gte(holidays.endDate, today));
    if (filters.view === "today") conditions.push(lte(holidays.startDate, today));
  }
  const where = and(...conditions);
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(holidays).where(where);
  const pages = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(pages, Math.max(1, Number.parseInt(filters.page || "1", 10) || 1));
  const closer = alias(user, "holiday_closer");
  const rows = await db.select({ holiday: holidays, name: user.name, username: user.username, closedByName: closer.name })
    .from(holidays).innerJoin(user, eq(holidays.userId, user.id)).leftJoin(closer, eq(holidays.closedBy, closer.id)).where(where)
    .orderBy(filters.view === "history" ? desc(holidays.startDate) : asc(holidays.startDate), desc(holidays.createdAt), asc(holidays.id))
    .limit(20).offset((page - 1) * 20);
  return { rows, total, page, pages };
}

export async function teamHolidaysToday(actor: AppUser, now = Date.now()) {
  actor = await freshActor(db, actor); requireManagement(actor);
  const today = localDate(now);
  return db.select({ id: holidays.id, userId: user.id, name: user.name, portion: holidays.portion }).from(holidays)
    .innerJoin(user, eq(holidays.userId, user.id)).where(and(eq(holidays.status, "active"), eq(user.active, true), lte(holidays.startDate, today), gte(holidays.endDate, today)))
    .orderBy(asc(user.name), asc(holidays.portion));
}
