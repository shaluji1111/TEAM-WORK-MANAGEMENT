import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function initials(name: string) { return name.split(/\s+/).slice(0, 2).map(n => n[0]).join("").toUpperCase(); }
export const statusLabels = { not_started: "Not started", in_progress: "In progress", blocked: "Blocked", completed: "Completed", reopened: "Reopened" };
export function dateLabel(value: number | Date, withTime = false) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) }).format(value);
}
