import "./env";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db, client } from "../src/db";
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  // Hosted Turso does not expose local SQLite maintenance pragmas.
  if ((process.env.TURSO_DATABASE_URL || "file:./local.db").startsWith("file:")) await client.execute("PRAGMA optimize");
  console.log("Database migrations are up to date.");
} finally { client.close(); }
