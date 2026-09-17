import { Field } from "./forms";
import { Input, Select, Textarea } from "./ui/input";
import type { PersonOption } from "@/lib/queries";
import type { Task, AppUser } from "@/db/schema";
import { localDateTime } from "@/lib/time";
export function TaskFields({ people, actor, task, hideDeadline = false }: { people: PersonOption[]; actor: Pick<AppUser, "id" | "role">; task?: Partial<Task>; hideDeadline?: boolean }) {
  const management = actor.role !== "member";
  return <>
    <Field label="Task title"><Input name="title" placeholder="What needs to get done?" required minLength={3} maxLength={180} defaultValue={task?.title} /></Field>
    <Field label="Instructions"><Textarea name="description" placeholder="Add context, expectations and anything the member needs." maxLength={10000} defaultValue={task?.description} /></Field>
    <div className="form-grid">
      <Field label="Assigned to"><Select name="assigneeId" defaultValue={task?.assigneeId || actor.id} required>{people.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}{p.id === actor.id ? " (you)" : ""}</option>)}</Select></Field>
      <Field label="Priority"><Select name="priority" defaultValue={task?.priority || "medium"}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select></Field>
      {!hideDeadline && <Field label="Deadline (IST)"><Input name="dueAt" type="datetime-local" required defaultValue={task?.dueAt ? localDateTime(task.dueAt) : ""} /></Field>}
    </div>
    <Field label="Reference links" hint="Optional. One http:// or https:// link per line, up to 10 links."><Textarea name="referenceLinks" rows={2} placeholder="https://…" defaultValue={task?.referenceLinks?.join("\n")} /></Field>
    {management ? <label className="check-label"><input type="checkbox" name="requireLink" defaultChecked={task?.requireLink} /><span>Require a work link when submitting</span></label> : task?.requireLink && <input type="hidden" name="requireLink" value="on" />}
  </>;
}
