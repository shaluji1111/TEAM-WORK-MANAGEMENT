import { describe, expect, it } from "vitest";
import { occurrences } from "@/lib/recurrence";
import { fromLocal, localDate } from "@/lib/time";
const base = { frequency: "daily" as const, startDate: "2026-09-14", startTime: "09:00", weekdays: [1,2,3,4,5], monthDay: 31, month: 2, dueAfterDays: 2, dueTime: "18:00" };
describe("IST recurrence calendar", () => {
  it("creates independent weekday tasks with overlapping deadlines", () => {
    const result = occurrences(base, fromLocal("2026-09-14") - 1, fromLocal("2026-09-21"));
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({ availableAt: fromLocal("2026-09-14", "09:00"), dueAt: fromLocal("2026-09-16", "18:00") });
    expect(result[1].availableAt).toBeLessThan(result[0].dueAt);
  });
  it("selects only the specified weekly day", () => {
    const result = occurrences({ ...base, frequency: "weekly", weekdays: [5] }, fromLocal("2026-09-14"), fromLocal("2026-09-30"));
    expect(result.map(r => localDate(r.availableAt))).toEqual(["2026-09-18", "2026-09-25"]);
  });
  it("clamps month ends without drifting the next anchor", () => {
    const result = occurrences({ ...base, frequency: "monthly", startDate: "2026-01-01" }, fromLocal("2026-01-01") - 1, fromLocal("2026-04-01"));
    expect(result.map(r => localDate(r.availableAt))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });
  it("handles leap years for yearly tasks", () => {
    const result = occurrences({ ...base, frequency: "yearly", startDate: "2026-01-01", monthDay: 29 }, fromLocal("2026-01-01") - 1, fromLocal("2029-01-01"));
    expect(result.map(r => localDate(r.availableAt))).toEqual(["2026-02-28", "2027-02-28", "2028-02-29"]);
  });
  it("treats generation bounds as exclusive/inclusive and respects start time", () => {
    const point = fromLocal("2026-09-14", "09:00");
    expect(occurrences(base, point - 1, point)).toHaveLength(1);
    expect(occurrences(base, point, point + 100)).toHaveLength(0);
    expect(occurrences(base, fromLocal("2026-09-01"), point - 1)).toHaveLength(0);
  });
});
