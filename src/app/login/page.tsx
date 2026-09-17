import { CheckCheck, LockKeyhole, ArrowUpRight } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { ThemeControl } from "@/components/theme-provider";
export default async function Login({ searchParams }: { searchParams: Promise<{ changed?: string }> }) {
  const { changed } = await searchParams;
  return <main className="login-page">
    <div className="login-header"><div className="login-brand"><span className="brand-symbol"><CheckCheck size={23} /></span> Team Task Tracker</div><ThemeControl /></div>
    <section className="login-panel">
      <div className="login-icon"><LockKeyhole size={24} /></div><p className="eyebrow">YOUR TEAM WORKSPACE</p>
      <h1>Welcome back.</h1><p className="muted login-intro">Sign in to see what needs your attention.</p>
      {changed && <p className="notice notice-success" role="status">Password changed. Sign in with your new password.</p>}
      <LoginForm />
    </section>
    <div className="login-foot"><span>One team. Every task accounted for.</span><ArrowUpRight size={18} /><span>Private workspace</span></div>
  </main>;
}
