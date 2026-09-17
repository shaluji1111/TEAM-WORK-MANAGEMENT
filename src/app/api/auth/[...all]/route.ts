import { getAuth } from "@/lib/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Deliberately expose only the JS ID login surface. No public sign-up, user
// profile updates, email login, role changes or administrative auth endpoints.
const allowed = new Map([
  ["/api/auth/sign-in/username", "POST"], ["/api/auth/sign-out", "POST"], ["/api/auth/get-session", "GET"]
]);
async function handler(request: Request) {
  if (allowed.get(new URL(request.url).pathname) !== request.method) return Response.json({ message: "Not found" }, { status: 404 });
  return getAuth().handler(request);
}
export { handler as GET, handler as POST };
