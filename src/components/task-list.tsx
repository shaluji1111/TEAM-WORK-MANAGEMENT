import Link from "next/link";
import { ArrowUp, ArrowDown, Minus, Repeat2, ArrowUpRight, ClipboardCheck, Search, Clock3, CircleCheck, CircleAlert, ListTodo } from "lucide-react";
import type { Task } from "@/db/schema";
import type { Filters, PersonOption, TaskListResult, taskStats } from "@/lib/queries";
import { dateLabel, initials, statusLabels } from "@/lib/utils";
import { Input, Select } from "./ui/input";
import { Field } from "./forms";
import { Button } from "./ui/button";
export function StatusBadge({ task, now = Date.now() }: { task: Task; now?: number }) {
  const late = task.status === "completed" && task.completedLate;
  return <div className="row wrap" style={{ gap: 6 }}><span className={`badge badge-${late ? "late" : task.status}`}>{late ? "Completed late" : statusLabels[task.status]}</span>{task.status !== "completed" && task.dueAt < now && <span className="badge badge-overdue">Overdue</span>}</div>;
}
export function Priority({ priority }: { priority: Task["priority"] }) { const Icon = priority === "high" ? ArrowUp : priority === "low" ? ArrowDown : Minus; return <span className={`priority priority-${priority}`}><Icon size={14} />{priority[0].toUpperCase() + priority.slice(1)}</span>; }
export function Stats({ stats }: { stats: Awaited<ReturnType<typeof taskStats>> }) {
  const cards = [{ label: "Open tasks", value: stats.pending, foot: "Waiting for completion", icon: ListTodo, type: "" }, { label: "Overdue", value: stats.overdue, foot: "Past the deadline", icon: Clock3, type: "alert" }, { label: "Completed", value: stats.completed, foot: `${stats.late} submitted late`, icon: CircleCheck, type: "success" }, { label: "Blocked", value: stats.blocked, foot: "Need a helping hand", icon: CircleAlert, type: "warning" }];
  return <div className="overview-cards">{cards.map(card => <div className={`metric ${card.type}`} key={card.label}><div className="metric-top"><span>{card.label}</span><span className="metric-icon"><card.icon size={17} /></span></div><p className="metric-number mono">{card.value}</p><p className="metric-foot">{card.foot}</p></div>)}</div>;
}
function url(base: string, filters: Filters, changes: Partial<Filters>) { const params = new URLSearchParams(); Object.entries({ ...filters, ...changes }).forEach(([key, value]) => { if (value) params.set(key, value); }); return `${base}?${params}`; }
export function TaskList({ result, filters, people, base, team = false, now }: { result: TaskListResult; filters: Filters; people: PersonOption[]; base: string; team?: boolean; now: number }) {
  const tabs = [{ value: "all", label: "All tasks" }, { value: "today", label: "Today" }, { value: "upcoming", label: "Upcoming" }, { value: "overdue", label: "Overdue" }, { value: "completed", label: "Completed" }];
  return <section className="surface" aria-label="Task list">
    <div className="toolbar"><nav className="tabs" aria-label="Filter tasks">{tabs.map(tab => <Link key={tab.value} href={url(base, filters, { view: tab.value, page: "1" })} className={`tab ${(filters.view || "all") === tab.value ? "active" : ""}`} aria-current={(filters.view || "all") === tab.value ? "page" : undefined}>{tab.label}</Link>)}</nav></div>
    <form className="filters filter-bar" action={base}>
      <input type="hidden" name="view" value={filters.view || "all"} />
      <div className="field search-field"><label htmlFor="task-search" className="field-label">Search tasks</label><div className="search-wrap"><Search size={15} /><Input id="task-search" name="q" defaultValue={filters.q} placeholder="Search by task name…" maxLength={200} /></div></div>
      {team && <Field label="Member"><Select name="assignee" defaultValue={filters.assignee || ""}><option value="">All members</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}{!p.active ? " (inactive)" : ""}</option>)}</Select></Field>}
      <Field label="Status"><Select name="status" defaultValue={filters.status || ""}><option value="">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
      <Field label="Priority"><Select name="priority" defaultValue={filters.priority || ""}><option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></Select></Field>
      <Field label="Due from"><Input name="from" type="date" defaultValue={filters.from} /></Field><Field label="Due to"><Input name="to" type="date" defaultValue={filters.to} /></Field>
      <Button variant="outline" type="submit" size="sm">Apply</Button><Link className="button button-ghost button-sm" href={base}>Reset</Link>
    </form>
    {result.rows.length ? <><div className="mobile-task-list">{result.rows.map(({ task, name, active }) => <article className="mobile-task-card" key={task.id}>
      <div className="row-between"><Link className="task-title-link" href={`/tasks/${task.id}`}>{task.title}</Link><Link href={`/tasks/${task.id}`} className="button button-ghost button-icon" aria-label={`Open ${task.title}`}><ArrowUpRight size={17} /></Link></div>
      <div className="task-meta">{task.source === "recurring" ? <><Repeat2 />Recurring</> : task.source === "self" ? "Self-assigned" : "Assigned task"}{task.requireLink && <span>· Work link required</span>}</div>
      {team && <div className="assignee"><span className="avatar">{initials(name)}</span><span>{name}{!active && <span className="danger-text"> · inactive</span>}</span></div>}
      <div className="row-between wrap"><StatusBadge task={task} now={now} /><Priority priority={task.priority} /></div>
      <p className={`row small ${task.status !== "completed" && task.dueAt < now ? "danger-text" : "muted"}`}><Clock3 size={14} />Due {dateLabel(task.dueAt, true)} IST</p>
    </article>)}</div><div className="table-scroll"><table className="task-table"><thead><tr><th>Task</th>{team && <th>Assigned to</th>}<th>Status</th><th>Priority</th><th>Deadline · IST</th><th><span className="sr-only">Open task</span></th></tr></thead><tbody>{result.rows.map(({ task, name, active }) => <tr key={task.id}>
      <td className="task-title-cell"><Link className="task-title-link" href={`/tasks/${task.id}`}>{task.title}</Link><div className="task-meta">{task.source === "recurring" ? <><Repeat2 />Recurring</> : task.source === "self" ? "Self-assigned" : "Assigned task"}{task.requireLink && <><span>·</span><span>Work link required</span></>}</div></td>
      {team && <td><div className="assignee"><span className="avatar">{initials(name)}</span><span>{name}{!active && <small className="danger-text" style={{ display: "block" }}>Inactive · reassign</small>}</span></div></td>}
      <td><StatusBadge task={task} now={now} /></td><td><Priority priority={task.priority} /></td><td className={`date-cell ${task.status !== "completed" && task.dueAt < now ? "overdue" : ""}`}>{dateLabel(task.dueAt)}<small>{new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }).format(task.dueAt)}</small></td>
      <td><Link className="button button-ghost button-icon" href={`/tasks/${task.id}`} aria-label={`Open ${task.title}`}><ArrowUpRight size={17} /></Link></td>
    </tr>)}</tbody></table></div></> : <div className="empty-state"><ClipboardCheck size={34} strokeWidth={1.4} /><h3>No tasks in this view</h3><p>Try another filter, or create a task to get started.</p></div>}
    <div className="table-footer"><span>{result.total ? `${(result.page - 1) * 20 + 1}–${Math.min(result.page * 20, result.total)} of ${result.total} tasks` : "0 tasks"}</span><div className="row"><span>Page {result.page} of {result.pages}</span>{result.page > 1 && <Link className="button button-outline button-sm" href={url(base, filters, { page: String(result.page - 1) })}>Previous</Link>}{result.page < result.pages && <Link className="button button-outline button-sm" href={url(base, filters, { page: String(result.page + 1) })}>Next</Link>}</div></div>
  </section>;
}
