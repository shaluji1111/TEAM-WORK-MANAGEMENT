import { notFound } from "next/navigation";
import { desc } from "drizzle-orm";
import { Repeat2, Clock3, CalendarDays, UserRound } from "lucide-react";
import { db } from "@/db";
import { series, scheduler } from "@/db/schema";
import { currentUser } from "@/lib/current-user";
import { isManagement } from "@/lib/permissions";
import { teamMembers } from "@/lib/queries";
import { catchUp } from "@/lib/scheduler";
import { dateLabel } from "@/lib/utils";
import { ActionDialog, ActionForm } from "@/components/forms";
import { TaskFields } from "@/components/task-fields";
import { SeriesFields } from "@/components/series-fields";
import { saveSeriesAction, toggleSeriesAction } from "@/app/actions";
export const metadata = { title: "Recurring tasks" };
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export default async function Recurring() {
  const actor = await currentUser(); if (!isManagement(actor)) notFound();
  const warning = await catchUp();
  const [rules, people, [state]] = await Promise.all([db.select().from(series).orderBy(desc(series.createdAt)), teamMembers(actor), db.select().from(scheduler)]);
  return <>
    <div className="page-heading"><div><p className="eyebrow" style={{ margin: "0 0 8px" }}>A LITTLE LESS FOLLOW-UP</p><h1>Recurring tasks</h1><p>Set the rhythm. Every occurrence gets its own deadline.</p></div><div className="heading-actions"><ActionDialog title="Create a recurring task" description="Choose who does the work, when it repeats and when each occurrence is due." trigger="New schedule" action={saveSeriesAction.bind(null, undefined)} submit="Create schedule"><TaskFields people={people} actor={actor} hideDeadline /><SeriesFields /></ActionDialog></div></div>
    {warning && <p className="notice notice-warning" style={{ marginBottom: 20 }}>{warning}</p>}
    {rules.length ? <div className="series-grid">{rules.map(rule => <article className="surface series-card" key={rule.id}><div className="row-between"><span className="metric-icon"><Repeat2 size={19} /></span><span className={`badge ${rule.active ? "badge-completed" : "badge-not_started"}`}>{rule.active ? "Active" : "Paused"}</span></div><div><h2>{rule.title}</h2><p className="description" style={{ marginTop: 6 }}>{rule.description.length > 150 ? rule.description.slice(0, 150) + "…" : rule.description || "No additional instructions"}</p></div><div className="stack" style={{ gap: 9 }}><p className="series-info"><UserRound size={15} />{people.find(p => p.id === rule.assigneeId)?.name || "Team member"}</p><p className="series-info"><CalendarDays size={15} /><span style={{ textTransform: "capitalize" }}>{rule.frequency}</span> · {rule.frequency === "daily" || rule.frequency === "weekly" ? rule.weekdays.map(day => dayNames[day]).join(", ") : `Day ${rule.monthDay}${rule.frequency === "yearly" ? `, month ${rule.month}` : ""}`} · {rule.startTime} IST</p><p className="series-info"><Clock3 size={15} />Due {rule.dueAfterDays === 0 ? "the same day" : `${rule.dueAfterDays} day${rule.dueAfterDays > 1 ? "s" : ""} later`} at {rule.dueTime} IST</p></div><div className="series-footer"><ActionDialog title="Edit recurring task" description="Changes apply to future occurrences. Work that has already started stays unchanged." trigger="Edit schedule" variant="outline" action={saveSeriesAction.bind(null, { id: rule.id, version: rule.version })} submit="Update future tasks"><TaskFields people={people} actor={actor} task={rule} hideDeadline /><SeriesFields rule={rule} /></ActionDialog><ActionForm action={toggleSeriesAction.bind(null, rule.id, rule.version)} submit={rule.active ? "Pause" : "Resume"}><span className="sr-only">{rule.active ? "Pause" : "Resume"} {rule.title}</span></ActionForm></div></article>)}</div> : <div className="surface empty-state"><Repeat2 size={34} strokeWidth={1.4} /><h3>Make repeat work automatic</h3><p>Create your first schedule for a daily, weekly, monthly or yearly task.</p></div>}
    <div className="scheduler-note"><Clock3 size={16} /><span>{state?.lastSuccessAt ? `Last successful refresh: ${dateLabel(state.lastSuccessAt, true)} IST. ${state.lastGenerated} new tasks prepared.` : "No successful schedule refresh yet."}{state?.lastError && <span className="danger-text"> {state.lastError}</span>}</span></div>
    <p className="field-hint" style={{ marginTop: 12 }}>Tasks appear at their scheduled start time. Pausing keeps existing work and stops future occurrences.</p>
  </>;
}
