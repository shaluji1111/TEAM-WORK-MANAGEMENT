"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="error-page"><h1>We couldn’t load this page.</h1><p className="muted">Please try again. If this continues, contact your manager.</p><Button onClick={reset}>Try again</Button><a href="/my-tasks">Back to my tasks</a></main>; }
