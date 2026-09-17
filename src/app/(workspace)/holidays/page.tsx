import Link from "next/link";
import { CalendarDays, CalendarOff } from "lucide-react";
import { currentUser } from "@/lib/current-user";
import { isManagement } from "@/lib/permissions";
import { holidayList, type HolidayFilters } from "@/lib/holiday-service";
import { holidayPortions, holidayRange } from "@/lib/holiday-format";
import { teamMembers } from "@/lib/queries";
import { localDate } from "@/lib/time";
import { dateLabel, initials } from "@/lib/utils";
import { ActionDialog, Field } from "@/components/forms";
import { HolidayFields } from "@/components/holiday-fields";
import { Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { recordHolidayAction, closeHolidayAction } from "@/app/actions";

export const metadata = { title: "Holidays" };
export default async function Holidays({ searchParams }: { searchParams: Promise<HolidayFilters> }) {
  const actor = await currentUser();
  const filters = await searchParams;
  const management = isManagement(actor);
  const now = Date.now(); const today = localDate(now);
  const [result, people] = await Promise.all([holidayList(actor, filters, now), teamMembers(actor)]);
  const view = ["today", "history"].includes(filters.view || "") ? filters.view! : "upcoming";
  function href(patch: Partial<HolidayFilters>) {
    const params = new URLSearchParams({ view, ...(management && filters.person ? { person: filters.person } : {}), ...patch });
    return `/holidays?${params}`;
  }
  return <>
    <div className="page-heading"><div><p className="eyebrow" style={{ margin: "0 0 8px" }}>PLAN TIME AWAY</p><h1>Holidays</h1><p>{management ? "See your team’s holidays and keep coverage in view." : "Let your Manager and HOD know when you’ll be away."}</p></div><div className="heading-actions"><ActionDialog title="Record a holiday" description="Add your own full-day or half-day holiday. No approval is needed." trigger="Add holiday" action={recordHolidayAction} submit="Record holiday"><HolidayFields today={today} /></ActionDialog></div></div>
    <section className="surface" aria-label="Holiday entries">
      <div className="toolbar"><nav className="tabs" aria-label="Holiday dates">{[["upcoming", "Current & upcoming"], ["today", "Today"], ["history", "History"]].map(([key, label]) => <Link key={key} href={href({ view: key })} className={`tab ${view === key ? "active" : ""}`} aria-current={view === key ? "page" : undefined}>{label}</Link>)}</nav><span className="spacer" /><span className="small muted">{result.total} {result.total === 1 ? "entry" : "entries"}</span></div>
      {management && <form className="holiday-filters" method="get"><input type="hidden" name="view" value={view} /><Field label="Employee"><Select name="person" defaultValue={filters.person || ""}><option value="">All employees</option>{people.map(person => <option key={person.id} value={person.id}>{person.name}{!person.active && " (inactive)"}</option>)}</Select></Field><Button variant="outline" type="submit">Apply filter</Button></form>}
      {!result.rows.length ? <div className="empty-state"><CalendarDays size={34} /><h3>No holidays here</h3><p>{view === "history" ? "Past, cancelled and reversed entries will appear here." : "Full-day and half-day holidays will appear as soon as they are recorded."}</p></div> : <div className="holiday-list">{result.rows.map(({ holiday, name, username, closedByName }) => {
        const own = holiday.userId === actor.id;
        const ongoing = holiday.startDate <= today && holiday.endDate >= today;
        return <article className="holiday-card" key={holiday.id} aria-label={`${name}: ${holidayRange(holiday)}, ${holidayPortions[holiday.portion]}`}>
          <div className="row-between wrap"><div className="row"><span className="avatar">{initials(name)}</span><div><h2>{own ? `${name} (you)` : name}</h2><p className="small muted">{username.toUpperCase()}</p></div></div><span className={`badge ${holiday.status === "active" ? "badge-in_progress" : "badge-not_started"}`}>{holiday.status === "active" ? ongoing ? "Today" : holiday.endDate < today ? "Past" : "Recorded" : holiday.status === "reversed" ? "Reversed by management" : "Cancelled"}</span></div>
          <div className="holiday-dates"><CalendarDays size={18} /><strong>{holidayRange(holiday)}</strong><span className="badge badge-reopened">{holidayPortions[holiday.portion]}</span></div>
          {holiday.note && <p className="pre-wrap small">{holiday.note}</p>}
          {holiday.status !== "active" && <div className="notice notice-info"><div className="row"><CalendarOff size={16} /><strong>{holiday.status === "reversed" ? "Reversed" : "Cancelled"} by {closedByName} · {dateLabel(holiday.closedAt!, true)}</strong></div><p className="pre-wrap" style={{ marginTop: 6 }}>{holiday.closeReason}</p></div>}
          <div className="row-between wrap"><span className="field-hint">Recorded {dateLabel(holiday.createdAt, true)}</span>{holiday.status === "active" && <ActionDialog title={own ? "Cancel holiday" : "Reverse holiday"} description={`${holidayRange(holiday)} · ${holidayPortions[holiday.portion]}. This entry will stay in history, with your name and reason.`} trigger={own ? "Cancel holiday" : "Reverse holiday"} variant="outline" action={closeHolidayAction.bind(null, holiday.id, holiday.version)} submit={own ? "Confirm cancellation" : "Confirm reversal"}><Field label={own ? "Reason for cancellation" : "Reason for reversal"}><Textarea name="reason" required minLength={3} maxLength={500} /></Field></ActionDialog>}</div>
        </article>;
      })}</div>}
      <div className="table-footer"><span>Page {result.page} of {result.pages} · All dates in IST</span><div className="row">{result.page > 1 && <Link className="button button-outline button-sm" href={href({ page: String(result.page - 1) })}>Previous</Link>}{result.page < result.pages && <Link className="button button-outline button-sm" href={href({ page: String(result.page + 1) })}>Next</Link>}</div></div>
    </section>
  </>;
}
