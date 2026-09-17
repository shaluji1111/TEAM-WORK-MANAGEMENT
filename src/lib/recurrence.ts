import type { Series } from "@/db/schema";
import { addDays, daysInMonth, fromLocal, localDate, weekday } from "./time";
type Rule = Pick<Series, "frequency" | "startDate" | "startTime" | "weekdays" | "monthDay" | "month" | "dueAfterDays" | "dueTime">;
export function occurrences(rule: Rule, after: number, through: number): { availableAt: number; dueAt: number }[] {
  const result = [];
  const firstDate = localDate(Math.max(after, fromLocal(rule.startDate, rule.startTime)));
  const lastDate = localDate(through);
  for (let date = firstDate; date <= lastDate; date = addDays(date, 1)) {
    const [y, m, d] = date.split("-").map(Number);
    const matches = rule.frequency === "daily" || rule.frequency === "weekly"
      ? rule.weekdays.includes(weekday(date))
      : d === Math.min(rule.monthDay, daysInMonth(y, m)) && (rule.frequency === "monthly" || m === rule.month);
    if (!matches) continue;
    const availableAt = fromLocal(date, rule.startTime);
    if (availableAt < fromLocal(rule.startDate, rule.startTime) || availableAt <= after || availableAt > through) continue;
    const dueAt = fromLocal(addDays(date, rule.dueAfterDays), rule.dueTime);
    result.push({ availableAt, dueAt });
  }
  return result;
}
