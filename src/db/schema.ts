import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const roles = ["member", "manager", "hod"] as const;
export const statuses = ["not_started", "in_progress", "blocked", "completed", "reopened"] as const;
export const priorities = ["low", "medium", "high"] as const;
export type Role = typeof roles[number];
export type TaskStatus = typeof statuses[number];

export const user = sqliteTable("user", {
  id: text("id").primaryKey(), name: text("name").notNull(),
  designation: text("designation").notNull().default(""),
  email: text("email").notNull().unique(), emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  username: text("username").notNull().unique(), displayUsername: text("display_username"),
  role: text("role", { enum: roles }).notNull().default("member"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
  authVersion: integer("auth_version").notNull().default(1)
});
export const session = sqliteTable("session", {
  id: text("id").primaryKey(), token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  ipAddress: text("ip_address"), userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" })
}, t => [index("session_user_idx").on(t.userId)]);
export const account = sqliteTable("account", {
  id: text("id").primaryKey(), accountId: text("account_id").notNull(), providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"), refreshToken: text("refresh_token"), idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
  scope: text("scope"), password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date())
}, t => [index("account_user_idx").on(t.userId)]);
export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date())
}, t => [index("verification_identifier_idx").on(t.identifier)]);
export const rateLimit = sqliteTable("rate_limit", {
  id: text("id").primaryKey(), key: text("key").notNull().unique(),
  count: integer("count").notNull(), lastRequest: integer("last_request").notNull()
});

export const holidays = sqliteTable("holiday", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => user.id),
  startDate: text("start_date").notNull(), endDate: text("end_date").notNull(),
  portion: text("portion", { enum: ["full_day", "first_half", "second_half"] }).notNull(),
  note: text("note").notNull().default(""),
  status: text("status", { enum: ["active", "cancelled", "reversed"] }).notNull().default("active"),
  closedBy: text("closed_by").references(() => user.id), closedAt: integer("closed_at"), closeReason: text("close_reason"),
  version: integer("version").notNull().default(1), createdAt: integer("created_at").notNull()
}, t => [index("holiday_user_dates_idx").on(t.userId, t.startDate, t.endDate), index("holiday_status_dates_idx").on(t.status, t.startDate, t.endDate)]);
export type Holiday = typeof holidays.$inferSelect;

export const series = sqliteTable("task_series", {
  id: text("id").primaryKey(), title: text("title").notNull(), description: text("description").notNull().default(""),
  assigneeId: text("assignee_id").notNull().references(() => user.id), creatorId: text("creator_id").notNull().references(() => user.id),
  priority: text("priority", { enum: priorities }).notNull().default("medium"),
  referenceLinks: text("reference_links", { mode: "json" }).notNull().$type<string[]>().default([]),
  requireLink: integer("require_link", { mode: "boolean" }).notNull().default(false),
  frequency: text("frequency", { enum: ["daily", "weekly", "monthly", "yearly"] }).notNull(),
  startDate: text("start_date").notNull(), startTime: text("start_time").notNull(),
  weekdays: text("weekdays", { mode: "json" }).notNull().$type<number[]>().default([]),
  monthDay: integer("month_day").notNull(), month: integer("month").notNull(),
  dueAfterDays: integer("due_after_days").notNull().default(0), dueTime: text("due_time").notNull(),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  generateFrom: integer("generate_from").notNull(), generatedThrough: integer("generated_through").notNull().default(0),
  version: integer("version").notNull().default(1),
  createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull()
}, t => [index("series_active_idx").on(t.active, t.generatedThrough), index("series_assignee_idx").on(t.assigneeId)]);

export const tasks = sqliteTable("task", {
  id: text("id").primaryKey(), title: text("title").notNull(), description: text("description").notNull().default(""),
  assigneeId: text("assignee_id").notNull().references(() => user.id), creatorId: text("creator_id").notNull().references(() => user.id),
  source: text("source", { enum: ["assigned", "self", "recurring"] }).notNull(),
  priority: text("priority", { enum: priorities }).notNull().default("medium"),
  status: text("status", { enum: statuses }).notNull().default("not_started"),
  referenceLinks: text("reference_links", { mode: "json" }).notNull().$type<string[]>().default([]),
  requireLink: integer("require_link", { mode: "boolean" }).notNull().default(false),
  availableAt: integer("available_at").notNull(), dueAt: integer("due_at").notNull(), initialDueAt: integer("initial_due_at").notNull(),
  completedAt: integer("completed_at"), completedLate: integer("completed_late", { mode: "boolean" }).notNull().default(false),
  seriesId: text("series_id").references(() => series.id),
  version: integer("version").notNull().default(1), createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull()
}, t => [
  uniqueIndex("task_occurrence_unique").on(t.seriesId, t.availableAt),
  index("task_assignee_due_idx").on(t.assigneeId, t.dueAt),
  index("task_status_due_idx").on(t.status, t.dueAt), index("task_available_idx").on(t.availableAt)
]);
export const submissions = sqliteTable("submission", {
  id: text("id").primaryKey(), taskId: text("task_id").notNull().references(() => tasks.id),
  authorId: text("author_id").notNull().references(() => user.id),
  note: text("note").notNull(), links: text("links", { mode: "json" }).notNull().$type<string[]>(),
  dueAt: integer("due_at").notNull(), late: integer("late", { mode: "boolean" }).notNull(), submittedAt: integer("submitted_at").notNull()
}, t => [index("submission_task_idx").on(t.taskId, t.submittedAt)]);
export const events = sqliteTable("activity", {
  id: text("id").primaryKey(), taskId: text("task_id").references(() => tasks.id), seriesId: text("series_id").references(() => series.id),
  subjectUserId: text("subject_user_id").references(() => user.id), actorId: text("actor_id").references(() => user.id),
  kind: text("kind").notNull(), message: text("message").notNull(),
  details: text("details", { mode: "json" }).$type<Record<string, unknown>>(), createdAt: integer("created_at").notNull()
}, t => [index("activity_task_idx").on(t.taskId, t.createdAt)]);
export const scheduler = sqliteTable("scheduler_state", {
  id: text("id").primaryKey(), lastAttemptAt: integer("last_attempt_at"), lastSuccessAt: integer("last_success_at"),
  lastError: text("last_error"), lastGenerated: integer("last_generated").notNull().default(0),
  leaseOwner: text("lease_owner"), leaseUntil: integer("lease_until").notNull().default(0)
});
export type AppUser = typeof user.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Series = typeof series.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
