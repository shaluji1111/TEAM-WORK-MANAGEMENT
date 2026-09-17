"use client";
import { useEffect, startTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CheckCheck, ListTodo, LayoutGrid, Repeat2, UsersRound, Settings2, LogOut, Clock3, ChevronRight, CalendarDays } from "lucide-react";
import { ThemeControl } from "./theme-provider";
import { authClient } from "@/lib/auth-client";
import { initials, cn } from "@/lib/utils";
import type { Role } from "@/db/schema";
const links = [
  { href: "/my-tasks", label: "My tasks", icon: ListTodo, management: false },
  { href: "/team", label: "Team overview", icon: LayoutGrid, management: true },
  { href: "/holidays", label: "Holidays", icon: CalendarDays, management: false },
  { href: "/recurring", label: "Recurring tasks", icon: Repeat2, management: true },
  { href: "/people", label: "People", icon: UsersRound, management: true },
  { href: "/settings", label: "Settings", icon: Settings2, management: false }
];
export function AppShell({ person, children, today }: { person: { name: string; role: Role; username: string }; children: React.ReactNode; today: string }) {
  const pathname = usePathname(); const router = useRouter();
  const visible = links.filter(link => !link.management || person.role !== "member");
  const title = links.find(link => pathname.startsWith(link.href))?.label || "Task details";
  useEffect(() => {
    function refresh() { if (document.visibilityState === "visible" && !document.querySelector('[role="dialog"]') && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName || "")) startTransition(() => router.refresh()); }
    const timer = setInterval(refresh, 60_000); window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [router]);
  async function signout() { await authClient.signOut(); window.location.assign("/login"); }
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <aside className="sidebar"><Link href="/my-tasks" className="sidebar-brand"><span className="brand-symbol"><CheckCheck size={22} /></span>Team Task Tracker</Link>
      <p className="sidebar-eyebrow">WORKSPACE</p><nav className="nav-links" aria-label="Main navigation">{visible.map(link => <Link key={link.href} href={link.href} className={cn("nav-link", pathname.startsWith(link.href) && "active")} aria-current={pathname.startsWith(link.href) ? "page" : undefined}><link.icon size={18} />{link.label}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="timezone-note"><Clock3 size={14} />All times in IST</div><div className="user-chip"><span className="avatar">{initials(person.name)}</span><div><p className="user-chip-name">{person.name}</p><p className="user-chip-role">{person.role === "hod" ? "HOD" : person.role}</p></div><button className="signout" aria-label="Sign out" title="Sign out" onClick={signout}><LogOut size={17} /></button></div></div>
    </aside>
    <div className="main-column"><header className="topbar"><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{title}</strong></div><div className="row topbar-controls"><span className="topbar-date">{today}</span><ThemeControl /><span className="avatar topbar-avatar" title={person.name}>{initials(person.name)}</span></div></header>
      <nav className="mobile-nav" aria-label="Mobile navigation">{visible.map(link => <Link key={link.href} href={link.href} className={pathname.startsWith(link.href) ? "active" : ""} aria-current={pathname.startsWith(link.href) ? "page" : undefined}><link.icon size={15} />{link.label}</Link>)}<button className="signout" onClick={signout} aria-label="Sign out"><LogOut size={17} /></button></nav>
      <main id="main-content" className="page-content">{children}</main>
    </div>
  </div>;
}
