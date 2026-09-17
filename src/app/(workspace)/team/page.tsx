import { notFound } from "next/navigation";
import { currentUser } from "@/lib/current-user";
import { isManagement } from "@/lib/permissions";
import { taskList, taskStats, teamMembers, memberSummary, type Filters } from "@/lib/queries";
import { catchUp } from "@/lib/scheduler";
import { initials } from "@/lib/utils";
import { ActionDialog } from "@/components/forms";
import { TaskFields } from "@/components/task-fields";
import { TaskList, Stats } from "@/components/task-list";
import { createTaskAction } from "@/app/actions";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { teamHolidaysToday } from "@/lib/holiday-service";
import { holidayPortions } from "@/lib/holiday-format";
export const metadata = { title: "Team overview" };
export default async function Team({ searchParams }: { searchParams: Promise<Filters> }) {
  const actor = await currentUser(); if (!isManagement(actor)) notFound();
  const filters = await searchParams; const warning = await catchUp(); const now = Date.now();
  const [result, stats, people, members, away] = await Promise.all([taskList(actor, "team", filters, now), taskStats(actor, "team", filters, now), teamMembers(actor), memberSummary(actor, filters, now), teamHolidaysToday(actor, now)]);
  return <>
    <div className="page-heading"><div><p className="eyebrow" style={{ margin: "0 0 8px" }}>THE BIG PICTURE</p><h1>Team overview</h1><p>Keep work moving, wherever you are.</p></div><div className="heading-actions"><ActionDialog title="Assign a task" description="Add instructions, choose a member and set a deadline." trigger="Assign task" action={createTaskAction} submit="Assign task"><TaskFields people={people} actor={actor} /></ActionDialog></div></div>
    {warning && <p className="notice notice-warning" role="status" style={{ marginBottom: 20 }}>{warning}</p>}
    <section className="surface surface-pad availability-panel" aria-label="Team holidays today"><div className="row-between wrap"><div className="row"><CalendarDays size={19} /><h2>On holiday today</h2></div><Link className="link small" href="/holidays">View holidays</Link></div>{away.length ? <div className="availability-list">{away.map(holiday => <Link href={`/holidays?view=today&person=${holiday.userId}`} className="availability-person" key={holiday.id}><span className="avatar">{initials(holiday.name)}</span><span><strong>{holiday.name}</strong><span className="small muted">{holidayPortions[holiday.portion]}</span></span></Link>)}</div> : <p className="small muted" style={{ marginTop: 12 }}>No holidays recorded for today.</p>}</section>
    <Stats stats={stats} /><TaskList result={result} filters={filters} people={people} base="/team" team now={now} />
    <section className="section-gap"><div className="section-header"><div><h2>Member progress</h2><p>All matching work, across the date tabs.</p></div><span className="small muted">{members.length} members with tasks</span></div>
      <div className="member-grid">{members.map(person => <article className="member-summary" key={person.id}><div className="row"><span className="avatar">{initials(person.name)}</span><div><p className="name">{person.name}</p><p className="small muted">{person.total} tasks{!person.active && " · inactive"}</p></div><span className="spacer" /><span className="small muted">{Math.round(person.completed / person.total * 100)}%</span></div><div className="progress-track" aria-label={`${person.name}: ${person.completed} of ${person.total} completed`}><div className="progress-value" style={{ width: `${person.completed / person.total * 100}%` }} /></div><div className="member-stats"><div><strong>{person.pending}</strong><span>Open</span></div><div><strong className={person.overdue ? "danger-text" : ""}>{person.overdue}</strong><span>Overdue</span></div><div><strong>{person.completed}</strong><span>Done</span></div></div><p className="field-hint" style={{ marginTop: 12 }}>{person.blocked} blocked · {person.late} completed late</p></article>)}</div>
    </section>
  </>;
}
