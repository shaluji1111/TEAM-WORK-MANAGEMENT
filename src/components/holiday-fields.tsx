"use client";
import { useState } from "react";
import { Field } from "./forms";
import { Input, Select, Textarea } from "./ui/input";
export function HolidayFields({ today }: { today: string }) {
  const [portion, setPortion] = useState("full_day");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const half = portion !== "full_day";
  return <>
    <Field label="Duration"><Select name="portion" value={portion} onChange={event => setPortion(event.target.value)}><option value="full_day">Full day</option><option value="first_half">Half day — First half</option><option value="second_half">Half day — Second half</option></Select></Field>
    <div className="form-grid"><Field label={half ? "Holiday date (IST)" : "Start date (IST)"}><Input name="startDate" type="date" required value={start} onChange={event => { setStart(event.target.value); if (event.target.value > end) setEnd(event.target.value); }} /></Field>
      {half ? <input name="endDate" type="hidden" value={start} /> : <Field label="End date (IST)" hint="Use the same date for a single day."><Input name="endDate" type="date" required min={start} value={end} onChange={event => setEnd(event.target.value)} /></Field>}
    </div>
    <Field label="Note (optional)" hint="Visible to you, your Manager and HOD."><Textarea name="note" maxLength={500} placeholder="Add a short note for your team manager" /></Field>
    <p className="field-hint">Recorded immediately. Managers and HODs can reverse an entry with a reason. Task deadlines and recurring schedules stay as set; discuss any adjustments with your manager.</p>
  </>;
}
