"use client";
import { useState } from "react";
import { Field } from "./forms";
import { Select, Textarea } from "./ui/input";
import type { TaskStatus } from "@/db/schema";
export function StatusFields({ status }: { status: TaskStatus }) {
  const [value, setValue] = useState<TaskStatus>(status === "reopened" ? "in_progress" : status);
  return <><Field label="Status"><Select name="status" value={value} onChange={e => setValue(e.target.value as TaskStatus)}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option></Select></Field><Field label={value === "blocked" ? "What’s blocking this task?" : "Progress note (optional)"}><Textarea name="reason" required={value === "blocked"} maxLength={10000} rows={3} placeholder={value === "blocked" ? "Explain what you need to move forward." : "Add a short update…"} /></Field></>;
}
