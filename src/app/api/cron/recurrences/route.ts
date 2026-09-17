import { timingSafeEqual } from "node:crypto";
import { runScheduler } from "@/lib/scheduler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : "";
  const actual = request.headers.get("authorization") || "";
  if (!expected || actual.length !== expected.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try { return Response.json(await runScheduler(Date.now(), true)); }
  catch { return Response.json({ error: "Task generation failed" }, { status: 500 }); }
}
