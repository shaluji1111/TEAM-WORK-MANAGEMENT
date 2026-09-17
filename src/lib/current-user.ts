import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getAuth } from "./auth";
export async function currentUser(allowPasswordChange = false) {
  const data = await getAuth().api.getSession({ headers: await headers() });
  if (!data) redirect("/login");
  const person = await db.query.user.findFirst({ where: eq(user.id, data.user.id) });
  if (!person?.active) redirect("/login");
  if (person.mustChangePassword && !allowPasswordChange) redirect("/change-password");
  return person;
}
