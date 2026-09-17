import { and, eq, gt, lte, sql } from "drizzle-orm";
import { db, type Transaction } from "@/db";
import { series, tasks, scheduler, user, type Series } from "@/db/schema";
import { occurrences } from "./recurrence";

const HORIZON = 7 * 86_400_000;
// A bounded window keeps a years-long outage from timing out a single request.
export async function materialize(tx: Transaction, rule: Series, through: number, now = Date.now()) {
  const after = Math.max(rule.generatedThrough, rule.generateFrom - 1);
  const end = Math.min(through, after + 366 * 86_400_000);
  if (end <= after || !rule.active) return { generated: 0, caughtUp: true };
  const slots = occurrences(rule, after, end);
  let generated = 0;
  for (let offset = 0; offset < slots.length; offset += 25) {
    const rows = slots.slice(offset, offset + 25).map(slot => ({
      id: crypto.randomUUID(), title: rule.title, description: rule.description,
      assigneeId: rule.assigneeId, creatorId: rule.creatorId, source: "recurring" as const,
      priority: rule.priority, requireLink: rule.requireLink, referenceLinks: rule.referenceLinks,
      availableAt: slot.availableAt, dueAt: slot.dueAt, initialDueAt: slot.dueAt, seriesId: rule.id,
      createdAt: now, updatedAt: now
    }));
    if (rows.length) generated += (await tx.insert(tasks).values(rows).onConflictDoNothing({ target: [tasks.seriesId, tasks.availableAt] }).returning({ id: tasks.id })).length;
  }
  await tx.update(series).set({ generatedThrough: end }).where(eq(series.id, rule.id));
  return { generated, caughtUp: end >= through };
}
export async function discardFuture(tx: Transaction, seriesId: string, now: number) {
  // Only unpublished occurrences are replaceable. They cannot have user activity.
  await tx.delete(tasks).where(and(eq(tasks.seriesId, seriesId), gt(tasks.availableAt, now)));
}
export async function runScheduler(now = Date.now(), force = false) {
  const owner = crypto.randomUUID();
  await db.insert(scheduler).values({ id: "recurrences" }).onConflictDoNothing();
  const [acquired] = await db.update(scheduler).set({ leaseOwner: owner, leaseUntil: now + 120_000, lastAttemptAt: now })
    .where(and(eq(scheduler.id, "recurrences"), lte(scheduler.leaseUntil, now), force ? sql`1=1` : sql`(${scheduler.lastSuccessAt} IS NULL OR ${scheduler.lastSuccessAt} < ${now - 60_000})`)).returning();
  if (!acquired) return { skipped: true, generated: 0, caughtUp: true };
  let generated = 0;
  let caughtUp = true;
  try {
    const rules = await db.select({ id: series.id }).from(series).innerJoin(user, eq(user.id, series.assigneeId)).where(and(eq(series.active, true), eq(user.active, true)));
    for (const { id } of rules) {
      const result = await db.transaction(async tx => {
        const [rule] = await tx.select().from(series).where(eq(series.id, id));
        if (!rule?.active) return { generated: 0, caughtUp: true };
        const [person] = await tx.select().from(user).where(eq(user.id, rule.assigneeId));
        if (!person?.active) return { generated: 0, caughtUp: true };
        return materialize(tx, rule, now + HORIZON, now);
      });
      generated += result.generated;
      caughtUp &&= result.caughtUp;
    }
    await db.update(scheduler).set({ lastSuccessAt: caughtUp ? now : acquired.lastSuccessAt, lastError: caughtUp ? null : "Catching up older occurrences. Refresh to continue.", lastGenerated: generated, leaseOwner: null, leaseUntil: 0 })
      .where(and(eq(scheduler.id, "recurrences"), eq(scheduler.leaseOwner, owner)));
    return { skipped: false, generated, caughtUp };
  } catch (error) {
    console.error("Recurrence generation failed", error);
    await db.update(scheduler).set({ lastError: "Task generation failed. Refresh to retry or check the server logs.", leaseOwner: null, leaseUntil: 0 })
      .where(and(eq(scheduler.id, "recurrences"), eq(scheduler.leaseOwner, owner)));
    throw error;
  }
}
export async function catchUp() {
  try { const result = await runScheduler(); return result.caughtUp ? null : "Older repeating tasks are still catching up. Refresh to continue."; }
  catch { return "Repeating tasks could not be refreshed. Existing tasks are available; refresh to try again."; }
}
