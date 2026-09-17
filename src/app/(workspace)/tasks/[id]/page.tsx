import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, MessageSquare, History, CheckCheck, Repeat2 } from "lucide-react";
import { currentUser } from "@/lib/current-user";
import { taskDetail, teamMembers } from "@/lib/queries";
import { catchUp } from "@/lib/scheduler";
import { canEditTask, isManagement } from "@/lib/permissions";
import { dateLabel } from "@/lib/utils";
import { ActionDialog, ActionForm, Field } from "@/components/forms";
import { TaskFields } from "@/components/task-fields";
import { StatusBadge, Priority } from "@/components/task-list";
import { StatusFields } from "@/components/status-fields";
import { Textarea } from "@/components/ui/input";
import { commentAction, editTaskAction, statusAction, submitAction } from "@/app/actions";
export const metadata = { title: "Task details" };
function WorkLink({ href }: { href: string }) { return <a href={href} className="work-link" target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /><span>{href}</span></a>; }
function Changes({ details }: { details: Record<string, unknown> | null }) {
  if (!details) return null;
  const labels: Record<string, string> = { title: "Title", description: "Instructions", assigneeId: "Assignee", dueAt: "Deadline", priority: "Priority", referenceLinks: "Reference links", requireLink: "Work link requirement" };
  return <div className="timeline-detail">{Object.entries(details).map(([key, value]) => {
    if (!value || typeof value !== "object" || !("before" in value) || !("after" in value)) return null;
    const change = value as { before: unknown; after: unknown };
    if (key === "dueAt") return <p key={key}>Deadline: {dateLabel(Number(change.before), true)} → {dateLabel(Number(change.after), true)}</p>;
    return <p key={key}>{labels[key] || key} changed{["title", "priority"].includes(key) ? `: ${String(change.before)} → ${String(change.after)}` : ""}</p>;
  })}</div>;
}
export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await currentUser(); const { id } = await params;
  await catchUp(); const detail = await taskDetail(actor, id); if (!detail) notFound();
  const { task, assignee, submitted, history } = detail; const people = await teamMembers(actor, true);
  return <>
    <Link href={isManagement(actor) ? "/team" : "/my-tasks"} className="row small muted" style={{ marginBottom: 24 }}><ArrowLeft size={16} />Back to tasks</Link>
    <div className="page-heading"><div><div className="row small muted" style={{ marginBottom: 12 }}>{task.source === "recurring" && <Repeat2 size={15} />}{task.source === "self" ? "SELF-ASSIGNED TASK" : task.source === "recurring" ? "RECURRING TASK" : "ASSIGNED TASK"}</div><h1 className="detail-title">{task.title}</h1><div style={{ marginTop: 15 }}><StatusBadge task={task} /></div></div>
      {canEditTask(actor, task) && <ActionDialog title="Edit task" description="Changes to this task are recorded in its activity history." trigger="Edit task" variant="outline" action={editTaskAction.bind(null, task.id, task.version)} submit="Save changes"><TaskFields people={people} actor={actor} task={task} /></ActionDialog>}
    </div>
    <div className="detail-layout"><div className="detail-main">
      <section className="surface surface-pad"><h2>Instructions</h2><p className="detail-description pre-wrap" style={{ marginTop: 14 }}>{task.description || "No additional instructions were provided."}</p>{task.referenceLinks.length > 0 && <div className="link-list">{task.referenceLinks.map(link => <WorkLink key={link} href={link} />)}</div>}</section>
      {task.status !== "completed" && <section className="surface surface-pad"><div className="section-header"><div><h2>Submit your work</h2><p>Add the result and mark this task complete.</p></div><CheckCheck size={22} color="#8170ce" /></div>
        {task.dueAt < Date.now() && <p className="notice notice-warning" style={{ marginBottom: 18 }}>The deadline has passed. You can still submit; this task will be marked completed late.</p>}
        <ActionForm key={`submit-${task.version}`} action={submitAction.bind(null, task.id, task.version)} submit="Submit & complete"><Field label="Completion note"><Textarea name="note" placeholder="What did you complete? Include any useful handoff details." required maxLength={10000} /></Field><Field label={task.requireLink ? "Work links (at least one required)" : "Work links (optional)"} hint="One link per line. Make sure your manager and HOD can open the links."><Textarea name="links" placeholder="https://…" required={task.requireLink} rows={2} /></Field></ActionForm>
      </section>}
      {submitted.length > 0 && <section className="surface surface-pad"><div className="section-header"><h2>Submitted work</h2><span className="small muted">{submitted.length} submission{submitted.length > 1 ? "s" : ""}</span></div>{submitted.map(({ submission, author }) => <article className="submission" key={submission.id}><div className="submission-head"><div><strong className="small">{author}</strong><p className="field-hint">{dateLabel(submission.submittedAt, true)} IST</p></div><span className={`badge ${submission.late ? "badge-overdue" : "badge-completed"}`}>{submission.late ? "Submitted late" : "On time"}</span></div><p className="submission-note">{submission.note}</p><div className="link-list">{submission.links.map(link => <WorkLink href={link} key={link} />)}</div></article>)}</section>}
      <section className="surface surface-pad"><div className="section-header"><h2>Activity & comments</h2><History size={18} color="#8b91a3" /></div>
        <ActionForm action={commentAction.bind(null, task.id)} submit="Post comment"><Field label="Add a comment"><Textarea name="comment" required maxLength={10000} rows={2} placeholder="Ask a question or share an update…" /></Field></ActionForm><hr />
        <div className="timeline">{history.map(({ event, author }) => <div className="timeline-item" key={event.id}><span className="timeline-mark">{event.kind === "comment" ? <MessageSquare size={14} /> : <History size={14} />}</span><div className="timeline-body"><p className="small" style={{ fontWeight: 600 }}>{author || "System"}</p><p className="message">{event.message}</p>{event.kind === "edited" && <Changes details={event.details} />}<p className="time">{dateLabel(event.createdAt, true)} IST</p></div></div>)}{!history.length && <p className="small muted">Created automatically from the recurring schedule.</p>}</div>
      </section>
    </div><aside className="detail-side"><section className="surface surface-pad"><h2 style={{ marginBottom: 22 }}>Task details</h2><dl className="metadata-list"><dt>Assigned to</dt><dd>{assignee.name}{!assignee.active && <p className="danger-text small">Inactive · needs reassignment</p>}</dd><dt>JS ID</dt><dd>{assignee.username.toUpperCase()}</dd><dt>Deadline</dt><dd>{dateLabel(task.dueAt, true)} IST</dd><dt>Priority</dt><dd><Priority priority={task.priority} /></dd><dt>Created</dt><dd>{dateLabel(task.availableAt, true)}</dd><dt>Work link</dt><dd>{task.requireLink ? "Required" : "Optional"}</dd></dl></section>
      {task.status !== "completed" ? <section className="surface surface-pad"><h2 style={{ marginBottom: 20 }}>Update progress</h2><ActionForm key={`status-${task.version}`} action={statusAction.bind(null, task.id, task.version)} submit="Update status"><StatusFields status={task.status} /></ActionForm></section> : isManagement(actor) && <section className="surface surface-pad"><h2>Needs more work?</h2><p className="small muted" style={{ margin: "9px 0 20px" }}>Reopen the task and explain what’s missing. Previous submissions stay in the history.</p><ActionForm action={statusAction.bind(null, task.id, task.version)} submit="Reopen task"><input type="hidden" name="status" value="reopened" /><Field label="Reason for reopening"><Textarea name="reason" required maxLength={10000} placeholder="What should the member change or complete?" /></Field></ActionForm></section>}
    </aside></div>
  </>;
}
