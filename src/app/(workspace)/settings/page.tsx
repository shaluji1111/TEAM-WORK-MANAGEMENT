import { currentUser } from "@/lib/current-user";
import { ActionForm } from "@/components/forms";
import { PasswordFields } from "@/components/password-fields";
import { passwordAction } from "@/app/actions";
import { ThemeControl } from "@/components/theme-provider";
export const metadata = { title: "Settings" };
export default async function Settings() {
  const person = await currentUser();
  return <div className="settings-container"><div className="page-heading"><div><h1>Account settings</h1><p>{person.name} · {person.username.toUpperCase()} · {person.role === "hod" ? "HOD" : person.role}</p></div></div><section className="surface surface-pad" style={{ marginBottom: 22 }}><div className="row-between wrap"><div><h2>Appearance</h2><p className="small muted" style={{ marginTop: 8 }}>Choose a theme for this browser, or follow your device.</p></div><ThemeControl /></div></section><section className="surface surface-pad"><h2>Change password</h2><p className="small muted" style={{ margin: "8px 0 24px" }}>Changing your password signs out all devices, including this one.</p><ActionForm action={passwordAction} submit="Change password"><PasswordFields /></ActionForm></section></div>;
}
