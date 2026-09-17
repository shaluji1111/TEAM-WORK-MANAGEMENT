import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { UsersRound } from "lucide-react";
import { db } from "@/db";
import { user } from "@/db/schema";
import { currentUser } from "@/lib/current-user";
import { isManagement, canManageUser } from "@/lib/permissions";
import { initials, dateLabel } from "@/lib/utils";
import { ActionDialog, Field } from "@/components/forms";
import { Input, Select } from "@/components/ui/input";
import { createPersonAction, updatePersonAction, resetPasswordAction } from "@/app/actions";
export const metadata = { title: "People" };
export default async function People() {
  const actor = await currentUser(); if (!isManagement(actor)) notFound();
  const people = await db.select().from(user).orderBy(asc(user.name));
  return <>
    <div className="page-heading"><div><p className="eyebrow" style={{ margin: "0 0 8px" }}>THE PEOPLE BEHIND THE WORK</p><h1>People</h1><p>{people.filter(p => p.active).length} active members in your workspace.</p></div><div className="heading-actions"><ActionDialog title="Add a team member" description="Share the JS ID and temporary password directly with this person. They must change the password on first sign-in." trigger="Add person" action={createPersonAction} submit="Create account">
      <Field label="Full name"><Input name="name" required minLength={2} maxLength={100} autoComplete="off" placeholder="e.g. Riya Mehta" /></Field><Field label="JS ID" hint="JS IDs are not case-sensitive. Letters, numbers, dots, underscores and hyphens are allowed."><Input name="username" required minLength={2} maxLength={40} pattern="[A-Za-z0-9._\-]+" autoComplete="off" autoCapitalize="none" placeholder="e.g. JS1024" /></Field><Field label="Role"><Select name="role" defaultValue="member"><option value="member">Member</option>{actor.role === "hod" && <><option value="manager">Manager</option><option value="hod">HOD</option></>}</Select></Field><Field label="Temporary password" hint="At least 10 characters. The password is never displayed again after saving."><Input name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" /></Field>
      <Field label="Designation (optional)" hint="Job title. App permissions are set by the role."><Input name="designation" maxLength={100} placeholder="e.g. Video editor" /></Field>
    </ActionDialog></div></div>
    <section className="surface" aria-label="Team members">{people.map(person => <article className="people-row" key={person.id}><div className="assignee"><span className="avatar">{initials(person.name)}</span><div><strong className="small">{person.name}{actor.id === person.id ? " (you)" : ""}</strong>{person.designation && <p className="small muted">{person.designation}</p>}<p className="field-hint">{person.mustChangePassword ? "Password change required" : "Account ready"}</p></div></div><span className="small muted people-jsid">{person.username.toUpperCase()}</span><span className="people-role">{person.role === "hod" ? "HOD" : person.role}</span><span className={`badge ${person.active ? "badge-completed" : "badge-not_started"}`}>{person.active ? "Active" : "Inactive"}</span><div className="row wrap" style={{ gap: 5 }}>{canManageUser(actor, person) && <>
      <ActionDialog title={`Manage ${person.name}`} description="Changing account details signs this person out. Deactivating also pauses their recurring schedules; existing tasks remain available for reassignment." trigger="Edit" variant="ghost" action={updatePersonAction.bind(null, person.id, person.authVersion)} submit="Save account"><Field label="Full name"><Input name="name" required minLength={2} maxLength={100} defaultValue={person.name} /></Field><Field label="Designation (optional)" hint="Job title. App permissions are set by the role."><Input name="designation" maxLength={100} defaultValue={person.designation} /></Field><Field label="Role"><Select name="role" defaultValue={person.role}><option value="member">Member</option>{actor.role === "hod" && <><option value="manager">Manager</option><option value="hod">HOD</option></>}</Select></Field><Field label="Account status"><Select name="active" defaultValue={String(person.active)}><option value="true">Active</option><option value="false">Inactive</option></Select></Field><p className="field-hint">Added {dateLabel(person.createdAt)}. JS IDs cannot be changed.</p></ActionDialog>
      <ActionDialog title={`Reset password for ${person.name}`} description="Existing sessions will be signed out. Share the new temporary password directly; the member must change it before accessing tasks." trigger="Reset password" variant="ghost" action={resetPasswordAction.bind(null, person.id)} submit="Reset password"><Field label="New temporary password"><Input name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required /></Field></ActionDialog>
    </>}</div></article>)}</section>
    <p className="field-hint row" style={{ marginTop: 18 }}><UsersRound size={15} />{actor.role === "hod" ? "HODs manage all accounts. At least one active HOD must remain." : "Managers can manage member accounts. Contact an HOD to change management access."}</p>
  </>;
}
