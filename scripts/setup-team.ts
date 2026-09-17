import "./env";
import { readFile } from "node:fs/promises";
import { setupTeam } from "../src/lib/team-setup";
import { client } from "../src/db";
import { AppError } from "../src/lib/errors";
import { ZodError } from "zod";
try {
  const filename = process.env.TEAM_SETUP_FILE;
  if (!filename) throw new AppError("Set TEAM_SETUP_FILE to the private roster JSON path first.");
  const data: unknown = JSON.parse(await readFile(filename, "utf8"));
  const result = await setupTeam(data);
  console.log(`Created ${result.created} accounts. Every account must change its temporary password on first sign-in.`);
} catch (error) {
  if (error instanceof AppError) console.error(error.message);
  else if (error instanceof ZodError) console.error("Invalid roster. Check names, JS IDs, roles, designations and password lengths.");
  else console.error("Team setup failed. Check the roster file and database connection. No passwords were printed.");
  process.exitCode = 1;
} finally { client.close(); }
