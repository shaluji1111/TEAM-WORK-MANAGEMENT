import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
import "./themes.css";
export const metadata: Metadata = { title: { default: "Team Task Tracker", template: "%s · Team Task Tracker" }, description: "Your team's work, progress and handoffs in one place.", robots: { index: false, follow: false }, icons: { icon: "/favicon.svg" } };
// Apply the saved preference before paint; only this static script touches the HTML attribute.
const themeScript = `(function(){var t='system';try{var s=localStorage.getItem('team-tracker-theme');if(s==='dark'||s==='light')t=s}catch(e){}document.documentElement.dataset.theme=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'})()`;
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body><ThemeProvider>{children}</ThemeProvider></body></html>; }
