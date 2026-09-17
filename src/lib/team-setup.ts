import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { db } from "@/db";
import { account, user } from "@/db/schema";
import { invariant } from "./errors";
import { activity } from "./service-common";
import { newUserSchema } from "./user-service";

// CLI-only bootstrap. This function has no server action or HTTP endpoint.
// All accounts are inserted atomically and an existing workspace is never overwritten.
export async function setupTeam(input: unknown) {
  const roster = z.array(newUserSchema).min(1).max(15).parse(input);
  invariant(roster.some(person => person.role === "hod"), "Include at least one HOD in the initial team.");
  invariant(new Set(roster.map(person => person.username)).size === roster.length, "Every JS ID must be unique (ignoring case).");
  const prepared = await Promise.all(roster.map(async person => ({ person, id: crypto.randomUUID(), hashed: await hashPassword(person.password) })));
  // The initial HOD is inserted first so audit references always resolve.
  prepared.sort((a, b) => Number(b.person.role === "hod") - Number(a.person.role === "hod"));
  return db.transaction(async tx => {
    invariant(!(await tx.select({ id: user.id }).from(user).limit(1)).length, "Team setup requires an empty workspace. Existing accounts were left unchanged.");
    const actorId = prepared[0].id;
    for (const { person, id, hashed } of prepared) {
      await tx.insert(user).values({ id, name: person.name, designation: person.designation, username: person.username, displayUsername: person.username.toUpperCase(),
        email: `${id}@accounts.invalid`, role: person.role, active: true, mustChangePassword: true });
      await tx.insert(account).values({ id: crypto.randomUUID(), accountId: id, userId: id, providerId: "credential", password: hashed });
      await activity(tx, actorId, "account_created", "Created an account during initial team setup", { subjectUserId: id });
    }
    return { created: prepared.length };
  });
}
