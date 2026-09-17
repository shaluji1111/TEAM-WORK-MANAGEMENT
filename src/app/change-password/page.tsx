import { LockKeyhole } from "lucide-react";
import { currentUser } from "@/lib/current-user";
import { ActionForm } from "@/components/forms";
import { PasswordFields } from "@/components/password-fields";
import { passwordAction } from "@/app/actions";
import { ThemeControl } from "@/components/theme-provider";
export const dynamic = "force-dynamic";
export const metadata = { title: "Change your password" };
export default async function ChangePassword() {
  const person = await currentUser(true);
  return <main className="password-page"><div className="row-between"><span className="login-icon"><LockKeyhole size={24} /></span><ThemeControl /></div><p className="eyebrow">{person.username.toUpperCase()}</p><h1>Make this account yours.</h1><p className="muted">Change your temporary password before opening your workspace. You’ll then sign in with your new password.</p><ActionForm action={passwordAction} submit="Set new password"><PasswordFields /></ActionForm></main>;
}
