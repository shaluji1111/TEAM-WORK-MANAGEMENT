import type { AppUser, Task } from "@/db/schema";
import { invariant } from "./errors";
export function isManagement(user: Pick<AppUser, "role">) { return user.role === "manager" || user.role === "hod"; }
export function canViewTask(actor: AppUser, task: Task, now = Date.now()) { return actor.active && task.availableAt <= now && (isManagement(actor) || actor.id === task.assigneeId); }
export function canEditTask(actor: AppUser, task: Task) { return task.status !== "completed" && (isManagement(actor) || (task.source === "self" && task.creatorId === actor.id && task.assigneeId === actor.id)); }
export function canManageUser(actor: AppUser, target: AppUser) { return actor.active && (actor.role === "hod" || (actor.role === "manager" && target.role === "member")); }
export function requireManagement(actor: AppUser) { invariant(actor.active && isManagement(actor), "You do not have permission to do this.", "forbidden"); }
