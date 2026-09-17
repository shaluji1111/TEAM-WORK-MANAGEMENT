export const ZONE = "Asia/Kolkata";
const OFFSET = 330 * 60_000;
const DAY = 86_400_000;
export function localDate(ms = Date.now()): string { return new Date(ms + OFFSET).toISOString().slice(0, 10); }
export function localDateTime(ms: number): string { return new Date(ms + OFFSET).toISOString().slice(0, 16); }
export function fromLocal(date: string, time = "00:00"): number { return Date.parse(`${date}T${time}:00+05:30`); }
export function fromLocalInput(input: string): number { const [date, time] = input.split("T"); return fromLocal(date, time); }
export function addDays(date: string, days: number): string { return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10); }
export function weekday(date: string): number { return new Date(`${date}T00:00:00Z`).getUTCDay(); }
export function daysInMonth(year: number, month: number): number { return new Date(Date.UTC(year, month, 0)).getUTCDate(); }
export function dayBounds(now = Date.now()) { const today = localDate(now); return { start: fromLocal(today), end: fromLocal(addDays(today, 1)) }; }
