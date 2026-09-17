import { currentUser } from "@/lib/current-user";
import { AppShell } from "@/components/app-shell";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const person = await currentUser();
  const today = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(Date.now());
  return <AppShell person={{ name: person.name, role: person.role, username: person.username }} today={today}>{children}</AppShell>;
}
