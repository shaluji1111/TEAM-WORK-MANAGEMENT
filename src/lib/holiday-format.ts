import type { Holiday } from "@/db/schema";
export const holidayPortions = { full_day: "Full day", first_half: "Half day · First half", second_half: "Half day · Second half" };
export function holidayDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${date}T00:00:00+05:30`));
}
export function holidayRange(holiday: Pick<Holiday, "startDate" | "endDate">) {
  return holiday.startDate === holiday.endDate ? holidayDate(holiday.startDate) : `${holidayDate(holiday.startDate)} – ${holidayDate(holiday.endDate)}`;
}
