"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Field } from "./forms";
export function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await authClient.signIn.username({ username: String(form.get("username")).trim().toLowerCase(), password: String(form.get("password")), rememberMe: true });
      if (result.error) { setError(result.error.status === 429 ? "Too many attempts. Wait a minute before trying again." : "Check your JS ID and password. If you need help, contact your manager."); setBusy(false); }
      else window.location.assign("/my-tasks");
    } catch { setError("We couldn't connect. Please try again in a moment."); setBusy(false); }
  }
  return <form onSubmit={submit} className="login-form">
    <Field label="JS ID"><Input name="username" autoComplete="username" placeholder="Your JS ID" autoCapitalize="none" spellCheck={false} required maxLength={40} /></Field>
    <Field label="Password"><Input name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required maxLength={128} /></Field>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    <Button type="submit" disabled={busy}>{busy ? <LoaderCircle size={18} className="spin" /> : <>Sign in <ArrowRight size={18} /></>}</Button>
    <p className="field-hint login-help">Need an account or a password reset?<br />Contact your manager or HOD.</p>
  </form>;
}
