import { eq } from "drizzle-orm";
import type { Connection } from "@/db";
import { events, user, type AppUser } from "@/db/schema";
import { invariant } from "./errors";
export async function freshActor(conn: Connection, actor: AppUser, allowPasswordChange = false) {
  const [fresh] = await conn.select().from(user).where(eq(user.id, actor.id));
  invariant(fresh?.active && fresh.authVersion === actor.authVersion, "Your access has changed. Please sign in again.", "forbidden");
  invariant(allowPasswordChange || !fresh.mustChangePassword, "Change your temporary password before continuing.", "forbidden");
  return fresh;
}
export async function activeAssignee(conn: Connection, id: string) {
  const [person] = await conn.select().from(user).where(eq(user.id, id));
  invariant(person?.active, "Choose an active team member.");
  return person;
}
export async function activity(conn: Connection, actorId: string | null, kind: string, message: string,
  refs: { taskId?: string; seriesId?: string; subjectUserId?: string; details?: Record<string, unknown> } = {}, now = Date.now()) {
  await conn.insert(events).values({ id: crypto.randomUUID(), actorId, kind, message, ...refs, createdAt: now });
}
