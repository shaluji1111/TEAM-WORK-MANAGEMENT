import { and, eq, sql } from "drizzle-orm";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { z } from "zod";
import { db } from "@/db";
import { account, user, session, series, type AppUser } from "@/db/schema";
import { invariant } from "./errors";
import { canManageUser, requireManagement } from "./permissions";
import { activity, freshActor } from "./service-common";
import { jsIdSchema, passwordSchema } from "./validation";
import { discardFuture, materialize } from "./scheduler";

export const newUserSchema = z.object({ name: z.string().trim().min(2).max(100), designation: z.string().trim().max(100).default(""), username: jsIdSchema, password: passwordSchema, role: z.enum(["member", "manager", "hod"]) });
export type NewUserInput = z.input<typeof newUserSchema>;
export async function createPerson(actor: AppUser | null, input: NewUserInput, bootstrap = false) {
  const data = newUserSchema.parse(input);
  const hashed = await hashPassword(data.password);
  return db.transaction(async tx => {
    if (bootstrap) {
      invariant(!actor && data.role === "hod", "Only the first HOD can be bootstrapped.");
      const existing = await tx.select({ id: user.id }).from(user).limit(1);
      invariant(!existing.length, "Setup is already complete. Ask an HOD to add accounts.");
    } else {
      invariant(actor, "Sign in to add a person.", "forbidden");
      actor = await freshActor(tx, actor);
      requireManagement(actor);
      invariant(actor.role === "hod" || data.role === "member", "Managers can create only member accounts.", "forbidden");
    }
    const existingId = await tx.select({ id: user.id }).from(user).where(eq(user.username, data.username));
    invariant(!existingId.length, "That JS ID already exists.");
    const id = crypto.randomUUID();
    const [person] = await tx.insert(user).values({ id, name: data.name, designation: data.designation, username: data.username, displayUsername: data.username.toUpperCase(),
      email: `${id}@accounts.invalid`, role: data.role, active: true, mustChangePassword: true }).returning();
    await tx.insert(account).values({ id: crypto.randomUUID(), accountId: id, providerId: "credential", userId: id, password: hashed });
    await activity(tx, actor?.id ?? id, "account_created", `Created an account for ${data.name}`, { subjectUserId: id });
    return person;
  });
}
export async function resetPassword(actor: AppUser, id: string, password: string) {
  passwordSchema.parse(password);
  const hashed = await hashPassword(password);
  await db.transaction(async tx => {
    actor = await freshActor(tx, actor);
    const [target] = await tx.select().from(user).where(eq(user.id, id));
    invariant(target && canManageUser(actor, target), "You cannot reset this account.", "forbidden");
    await tx.update(account).set({ password: hashed, updatedAt: new Date() }).where(and(eq(account.userId, id), eq(account.providerId, "credential")));
    await tx.update(user).set({ mustChangePassword: true, authVersion: target.authVersion + 1 }).where(eq(user.id, id));
    await tx.delete(session).where(eq(session.userId, id));
    await activity(tx, actor.id, "password_reset", "Reset the account password and signed out existing sessions", { subjectUserId: id });
  });
}
export async function changeOwnPassword(actor: AppUser, current: string, replacement: string) {
  passwordSchema.parse(replacement);
  invariant(current !== replacement, "Choose a different password from your current password.");
  const [credential] = await db.select().from(account).where(and(eq(account.userId, actor.id), eq(account.providerId, "credential")));
  invariant(credential?.password && await verifyPassword({ hash: credential.password, password: current }), "Your current password is incorrect.");
  const hashed = await hashPassword(replacement);
  await db.transaction(async tx => {
    actor = await freshActor(tx, actor, true);
    const changed = await tx.update(account).set({ password: hashed, updatedAt: new Date() }).where(and(eq(account.id, credential.id), eq(account.password, credential.password!))).returning();
    invariant(changed.length, "Your password was changed elsewhere. Sign in again.", "conflict");
    await tx.update(user).set({ mustChangePassword: false, authVersion: actor.authVersion + 1 }).where(eq(user.id, actor.id));
    await tx.delete(session).where(eq(session.userId, actor.id));
    await activity(tx, actor.id, "password_changed", "Changed their password and signed out existing sessions", { subjectUserId: actor.id });
  });
}
export async function updatePerson(actor: AppUser, id: string, input: { name: string; designation?: string; role: AppUser["role"]; active: boolean; authVersion: number }, now = Date.now()) {
  const data = z.object({ name: z.string().trim().min(2).max(100), designation: z.string().trim().max(100).optional(), role: z.enum(["member", "manager", "hod"]), active: z.boolean(), authVersion: z.number().int() }).parse(input);
  await db.transaction(async tx => {
    actor = await freshActor(tx, actor);
    const [target] = await tx.select().from(user).where(eq(user.id, id));
    invariant(target && canManageUser(actor, target), "You cannot manage this account.", "forbidden");
    invariant(actor.role === "hod" || data.role === "member", "Managers cannot change management roles.", "forbidden");
    invariant(target.authVersion === data.authVersion, "This account changed. Refresh before saving.", "conflict");
    if (target.active && target.role === "hod" && (!data.active || data.role !== "hod")) {
      const [{ total }] = await tx.select({ total: sql<number>`count(*)` }).from(user).where(and(eq(user.active, true), eq(user.role, "hod")));
      invariant(total > 1, "At least one active HOD must remain.");
    }
    if (target.active && !data.active) {
      const rules = await tx.select().from(series).where(and(eq(series.assigneeId, id), eq(series.active, true)));
      for (const rule of rules) {
        const result = await materialize(tx, rule, now, now);
        invariant(result.caughtUp, "Older tasks are still catching up. Refresh the dashboard, then try again.");
        await discardFuture(tx, rule.id, now);
        await tx.update(series).set({ active: false, version: rule.version + 1, updatedAt: now, generatedThrough: now }).where(eq(series.id, rule.id));
        await activity(tx, actor.id, "series_paused", "Paused because the assignee was deactivated", { seriesId: rule.id }, now);
      }
    }
    await tx.update(user).set({ name: data.name, designation: data.designation ?? target.designation, role: data.role, active: data.active, authVersion: target.authVersion + 1 }).where(eq(user.id, id));
    await tx.delete(session).where(eq(session.userId, id));
    await activity(tx, actor.id, "account_updated", `Updated ${target.name}'s account`, { subjectUserId: id, details: { before: { name: target.name, designation: target.designation, role: target.role, active: target.active }, after: data } }, now);
  });
}
