"use client";
import { useState } from "react";
import { Field } from "./forms";
import { Input, Select } from "./ui/input";
import type { Series } from "@/db/schema";
import { localDate } from "@/lib/time";
const days = [{ n: 1, name: "Mon" }, { n: 2, name: "Tue" }, { n: 3, name: "Wed" }, { n: 4, name: "Thu" }, { n: 5, name: "Fri" }, { n: 6, name: "Sat" }, { n: 0, name: "Sun" }];
export function SeriesFields({ rule }: { rule?: Series }) {
  const [frequency, setFrequency] = useState(rule?.frequency || "daily");
  return <>
    <hr style={{ margin: "3px 0" }} /><h3>Repeating schedule</h3>
    <div className="form-grid"><Field label="Repeat"><Select name="frequency" value={frequency} onChange={e => setFrequency(e.target.value as Series["frequency"])}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></Select></Field><Field label="Start date"><Input name="startDate" type="date" required defaultValue={rule?.startDate || localDate()} min={rule ? undefined : localDate()} /></Field><Field label="Task appears at (IST)"><Input name="startTime" type="time" required defaultValue={rule?.startTime || "09:00"} /></Field></div>
    {frequency === "daily" && <div className="field"><span className="field-label">Repeat on these days</span><div className="day-options">{days.map(day => <label key={day.n} className="day-option"><input type="checkbox" name="weekdays" value={day.n} defaultChecked={rule ? rule.weekdays.includes(day.n) : day.n !== 0} />{day.name}</label>)}</div></div>}
    {frequency === "weekly" && <Field label="Day of the week"><Select name="weekdays" defaultValue={rule?.weekdays[0] ?? 1}>{days.map(day => <option key={day.n} value={day.n}>{day.name}</option>)}</Select></Field>}
    <div className="form-grid">
      {frequency === "yearly" ? <Field label="Month"><Select name="month" defaultValue={rule?.month || 1}>{Array.from({ length: 12 }, (_, i) => <option value={i + 1} key={i}>{new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, i, 1)))}</option>)}</Select></Field> : <input type="hidden" name="month" value={rule?.month || 1} />}
      {frequency === "monthly" || frequency === "yearly" ? <Field label="Day of the month" hint="If this day doesn't exist, use the month's last day."><Input name="monthDay" type="number" min={1} max={31} defaultValue={rule?.monthDay || 1} required /></Field> : <input type="hidden" name="monthDay" value={rule?.monthDay || 1} />}
    </div>
    <h3>Deadline for each occurrence</h3><div className="form-grid"><Field label="Days after the task appears" hint="0 means the same day. Each occurrence stays separate."><Input name="dueAfterDays" type="number" min={0} max={366} defaultValue={rule?.dueAfterDays || 0} required /></Field><Field label="Due at (IST)"><Input name="dueTime" type="time" required defaultValue={rule?.dueTime || "18:00"} /></Field></div>
  </>;
}
