import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
config({ path: ".env.local", quiet: true });
config({ quiet: true });
export default defineConfig({
  dialect: "turso", schema: "./src/db/schema.ts", out: "./drizzle",
  dbCredentials: { url: process.env.TURSO_DATABASE_URL || "file:./local.db", authToken: process.env.TURSO_AUTH_TOKEN }
});
