import { eq } from "drizzle-orm";
import { db } from "@/db";
import { series, type AppUser } from "@/db/schema";
import { invariant } from "./errors";
import { requireManagement } from "./permissions";
import { activeAssignee, activity, freshActor } from "./service-common";
import { seriesInputSchema, type SeriesInput } from "./validation";
import { fromLocal, localDate } from "./time";
import { discardFuture, materialize } from "./scheduler";
export async function saveSeries(actor: AppUser, input: SeriesInput, existing?: { id: string; version: number }, now = Date.now()) {
  const data = seriesInputSchema.parse(input);
  return db.transaction(async tx => {
    actor = await freshActor(tx, actor); requireManagement(actor);
    await activeAssignee(tx, data.assigneeId);
    if (existing) {
      const [old] = await tx.select().from(series).where(eq(series.id, existing.id));
      invariant(old, "Schedule not found.", "not_found");
      invariant(old.version === existing.version, "This schedule changed. Refresh before saving.", "conflict");
      const catchup = await materialize(tx, old, now, now);
      invariant(catchup.caughtUp, "Older tasks are still catching up. Refresh the dashboard, then try again.");
      await discardFuture(tx, old.id, now);
      const [updated] = await tx.update(series).set({ ...data, generateFrom: now + 1, generatedThrough: now, version: old.version + 1, updatedAt: now }).where(eq(series.id, old.id)).returning();
      await materialize(tx, updated, now + 7 * 86_400_000, now);
      await activity(tx, actor.id, "series_edited", "Updated future occurrences", { seriesId: old.id, details: { before: old, after: data } }, now);
      return updated;
    }
    invariant(data.startDate >= localDate(now), "A new schedule must start today or later.");
    const [created] = await tx.insert(series).values({ ...data, id: crypto.randomUUID(), creatorId: actor.id,
      generateFrom: fromLocal(data.startDate, data.startTime), generatedThrough: 0, createdAt: now, updatedAt: now }).returning();
    await materialize(tx, created, now + 7 * 86_400_000, now);
    await activity(tx, actor.id, "series_created", `Created repeating task: ${data.title}`, { seriesId: created.id, details: data }, now);
    return created;
  });
}
export async function toggleSeries(actor: AppUser, id: string, version: number, now = Date.now()) {
  await db.transaction(async tx => {
    actor = await freshActor(tx, actor); requireManagement(actor);
    const [rule] = await tx.select().from(series).where(eq(series.id, id));
    invariant(rule, "Schedule not found.", "not_found");
    invariant(rule.version === version, "This schedule changed. Refresh and try again.", "conflict");
    const catchup = await materialize(tx, rule, now, now);
    invariant(catchup.caughtUp, "Older tasks are still catching up. Refresh the dashboard, then try again.");
    if (!rule.active) await activeAssignee(tx, rule.assigneeId);
    await discardFuture(tx, id, now);
    const [updated] = await tx.update(series).set({ active: !rule.active, generateFrom: now + 1, generatedThrough: now, version: rule.version + 1, updatedAt: now }).where(eq(series.id, id)).returning();
    if (updated.active) await materialize(tx, updated, now + 7 * 86_400_000, now);
    await activity(tx, actor.id, updated.active ? "series_resumed" : "series_paused", updated.active ? "Resumed future occurrences; paused dates are skipped" : "Paused future occurrences", { seriesId: id }, now);
  });
}
