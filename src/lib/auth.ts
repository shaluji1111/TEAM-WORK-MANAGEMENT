import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";

function makeAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Set BETTER_AUTH_SECRET to a random value of at least 32 characters.");
  return betterAuth({
    appName: "Team Task Tracker", baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000", secret,
    database: drizzleAdapter(db, { provider: "sqlite", schema, transaction: true }),
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 10, maxPasswordLength: 128 },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    user: { additionalFields: {
      designation: { type: "string", defaultValue: "", input: false },
      role: { type: "string", defaultValue: "member", input: false },
      active: { type: "boolean", defaultValue: true, input: false },
      mustChangePassword: { type: "boolean", defaultValue: true, input: false },
      authVersion: { type: "number", defaultValue: 1, input: false }
    } },
    plugins: [username({ minUsernameLength: 2, maxUsernameLength: 40,
      usernameValidator: s => /^[A-Za-z0-9._-]+$/.test(s), usernameNormalization: s => s.trim().toLowerCase() })],
    rateLimit: { enabled: process.env.NODE_ENV === "production", storage: "database", window: 60, max: 100,
      customRules: { "/sign-in/username": { window: 60, max: 10 } } },
    databaseHooks: { session: { create: { before: async (value) => {
      const person = await db.query.user.findFirst({ where: eq(schema.user.id, value.userId) });
      return !!person?.active;
    } } } }
  });
}
let instance: ReturnType<typeof makeAuth> | undefined;
export function getAuth() { return instance ??= makeAuth(); }
