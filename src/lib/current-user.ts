import { headers } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getAuth } from "./auth";
// Deduplicate layout/page checks only within this request. Never cache a user
// across requests: resets and deactivation must still revoke access immediately.
const authenticatedUser = cache(async () => {
  const data = await getAuth().api.getSession({ headers: await headers() });
  if (!data) redirect("/login");
  const person = await db.query.user.findFirst({ where: eq(user.id, data.user.id) });
  if (!person?.active) redirect("/login");
  return person;
});
export async function currentUser(allowPasswordChange = false) {
  const person = await authenticatedUser();
  if (person.mustChangePassword && !allowPasswordChange) redirect("/change-password");
  return person;
}
