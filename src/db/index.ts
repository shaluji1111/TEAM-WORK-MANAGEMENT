import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
const url = process.env.TURSO_DATABASE_URL || "file:./local.db";
if (process.env.VERCEL && (!process.env.TURSO_DATABASE_URL || url.startsWith("file:"))) {
  throw new Error("Set a remote TURSO_DATABASE_URL for Vercel. Local files are development-only.");
}
export const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
export const db = drizzle(client, { schema });
export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Connection = Database | Transaction;
