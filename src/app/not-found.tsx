import Link from "next/link";
export default function NotFound() { return <main className="error-page"><h1>Page not found</h1><p className="muted">This page may not exist or may not be available to your account.</p><Link href="/my-tasks" className="button button-primary">Back to my tasks</Link></main>; }
