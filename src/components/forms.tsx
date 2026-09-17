"use client";
import { useState, useId, cloneElement, Children, startTransition, type ReactNode, type ReactElement, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./ui/dialog";
export type ActionResult = { ok: boolean; message?: string; redirect?: string };
export type FormAction = (data: FormData) => Promise<ActionResult>;
export function ActionForm({ action, children, submit = "Save changes", onSuccess, destructive = false, className = "" }: { action: FormAction; children: ReactNode; submit?: string; onSuccess?: () => void; destructive?: boolean; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const router = useRouter();
  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true); setResult(null);
    startTransition(async () => { try {
      const next = await action(data); setResult(next);
      if (next.ok) {
        onSuccess?.();
        if (next.redirect) { router.push(next.redirect); }
        router.refresh();
      }
    } catch { setResult({ ok: false, message: "We couldn't save your changes. Your input is still here; please try again." }); }
    finally { setBusy(false); } });
  }
  return <form onSubmit={handle} className={`action-form ${className}`}>
    <fieldset disabled={busy}>{children}</fieldset>
    {result?.message && <div role={result.ok ? "status" : "alert"} className={`notice ${result.ok ? "notice-success" : "notice-error"}`}>{result.message}</div>}
    <Button disabled={busy} type="submit" variant={destructive ? "destructive" : "default"}>{busy && <LoaderCircle size={16} className="spin" />}{busy ? "Saving…" : submit}</Button>
  </form>;
}
export function ActionDialog({ title, description, trigger, action, children, submit, variant = "default" }: {
  title: string; description: string; trigger: string; action: FormAction; children: ReactNode; submit?: string; variant?: "default" | "outline" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant={variant}>{variant === "default" && <Plus size={17} />}{trigger}</Button></DialogTrigger>
    <DialogContent><DialogTitle className="dialog-title">{title}</DialogTitle><DialogDescription className="muted dialog-description">{description}</DialogDescription>
      <ActionForm action={action} submit={submit} onSuccess={() => setOpen(false)}>{children}</ActionForm>
    </DialogContent>
  </Dialog>;
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const generated = useId();
  const child = Children.only(children) as ReactElement<{ id?: string; "aria-describedby"?: string }>;
  const id = child.props.id || generated;
  return <div className="field"><label htmlFor={id} className="field-label">{label}</label>{cloneElement(child, { id, "aria-describedby": hint ? `${id}-hint` : child.props["aria-describedby"] })}{hint && <span id={`${id}-hint`} className="field-hint">{hint}</span>}</div>;
}
