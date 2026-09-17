import { z } from "zod";
import { fromLocal } from "./time";
export const jsIdSchema = z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9._-]+$/, "Use letters, numbers, dots, underscores or hyphens.").transform(s => s.toLowerCase());
export const passwordSchema = z.string().min(10, "Use at least 10 characters.").max(128);
export const linksSchema = z.array(z.url().max(2000).refine(s => /^https?:\/\//i.test(s), "Links must begin with https:// or http://.")).max(10);
export const taskInputSchema = z.object({
  title: z.string().trim().min(3).max(180), description: z.string().trim().max(10000).default(""),
  assigneeId: z.string().min(1), dueAt: z.number().int().positive(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  referenceLinks: linksSchema.default([]), requireLink: z.boolean().default(false)
});
export const seriesInputSchema = taskInputSchema.omit({ dueAt: true }).extend({
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  startDate: z.iso.date(), startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  monthDay: z.number().int().min(1).max(31), month: z.number().int().min(1).max(12),
  dueAfterDays: z.number().int().min(0).max(366), dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
}).superRefine((s, ctx) => {
  if ((s.frequency === "daily" && !s.weekdays.length) || (s.frequency === "weekly" && s.weekdays.length !== 1)) ctx.addIssue({ code: "custom", message: "Choose the days this task repeats.", path: ["weekdays"] });
  if (s.dueAfterDays === 0 && fromLocal(s.startDate, s.dueTime) <= fromLocal(s.startDate, s.startTime)) ctx.addIssue({ code: "custom", message: "The deadline must be after the task start time.", path: ["dueTime"] });
});
export type TaskInput = z.input<typeof taskInputSchema>;
export type SeriesInput = z.input<typeof seriesInputSchema>;
