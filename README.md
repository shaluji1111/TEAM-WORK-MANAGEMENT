# Team Task Tracker

A private workspace for a team of up to 15 people, with JS ID/password login, member privacy, management oversight, work submissions, an audit trail and daily/weekly/monthly/yearly tasks.

## Try it locally

Requires Node.js 22 or newer. Run these commands from this folder:

```sh
npm ci
npm run local:init
npm run db:migrate
npm run demo:seed
npm run dev
```

Open **http://127.0.0.1:3000**. `local:init` creates random local secrets without printing them. `demo:seed` only works with an empty, local file database; it refuses remote Turso databases.

| Local demo account | JS ID | Password |
| --- | --- | --- |
| HOD — Aditi Sharma | JS1001 | TeamTracker-Demo-2026! |
| Manager — Karan Malhotra | JS1002 | TeamTracker-Demo-2026! |
| Member — Riya Mehta | JS1003 | TeamTracker-Demo-2026! |

The additional sample members JS1004 and JS1005 use the same demo password. These sample accounts and example.com work links are **only for local testing**. Production starts with an empty database and your own HOD account. To start locally with real accounts, skip `demo:seed` and use the HOD setup below instead.

## Deploy to Vercel with Turso

No paid add-on or separate scheduler is required by the code. Vercel Hobby restricts use to personal, non-commercial projects; an internal organizational app is not automatically exempt. Check [Vercel's Hobby policy](https://vercel.com/docs/plans/hobby) for your situation.

1. Create two **Turso libSQL** databases: one for production and another for previews/testing. Obtain each database URL and database-scoped auth token. The integration uses `@libsql/client`, not an embedded database on Vercel. See [Turso's Next.js guide](https://docs.turso.tech/sdk/ts/guides/nextjs).
2. Put this source folder in a Git repository and import it into Vercel as a **Next.js** project. If it is nested, set the Vercel Root Directory to this folder. Use `npm ci` to install and `npm run build` to build.
3. Add the environment variables below in Vercel. Use distinct values for Production and Preview. Never upload `.env.local`, local databases, demo data, or test artifacts.
4. In a local terminal, point `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` at the production database using process-scoped environment variables. Run `npm run db:migrate`, then `npm run setup:hod`. Repeat against the preview database with separate test accounts. Existing applied migrations are immutable; new schema changes require new migration files.
5. Deploy. Set `BETTER_AUTH_URL` to the final stable HTTPS origin, then redeploy if the origin changed. Use a separate stable preview branch URL for the Preview environment; do not trust arbitrary request hosts or share production cookies with previews.
6. Sign in as the HOD and change the temporary password. Add your Manager and 2–3 pilot Members in **People**. Check assignment, completion links, reopening and a repeating schedule before adding everyone else.
7. Verify Vercel's daily cron is registered for `/api/cron/recurrences`. Visit **Recurring tasks** to see the last successful scheduler refresh and any recovery message.

### Environment variables

| Variable | Value |
| --- | --- |
| `TURSO_DATABASE_URL` | Remote `libsql://…` URL on Vercel; `file:./local.db` is local development only |
| `TURSO_AUTH_TOKEN` | Database-scoped Turso token; blank only for local file databases |
| `BETTER_AUTH_URL` | Exact app origin, e.g. `https://your-project.vercel.app`, without a path |
| `BETTER_AUTH_SECRET` | Independently generated random secret, at least 32 characters |
| `CRON_SECRET` | A different random secret for the scheduled endpoint |

Generate each secret separately:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Do not prefix any of these variables with `NEXT_PUBLIC_`. The scheduler checks `Authorization: Bearer <CRON_SECRET>`; Vercel sends it automatically. The cron schedule is once daily at 00:00 UTC and intentionally does not depend on exact execution time. Task, holiday and account data stay in the database. Only the display-theme preference is stored in browser local storage.

### Create the first HOD securely

`setup:hod` works only when the user table is empty. It prompts for the name and JS ID. Supply the password as a temporary process environment variable; it is never a command-line argument or printed by the script.

PowerShell 7:

```powershell
$initialPassword = Read-Host 'Temporary HOD password (at least 10 characters)' -AsSecureString
$env:SETUP_HOD_PASSWORD = [System.Net.NetworkCredential]::new('', $initialPassword).Password
try {
  npm run setup:hod
} finally {
  Remove-Item Env:\SETUP_HOD_PASSWORD -ErrorAction SilentlyContinue
  $initialPassword.Dispose()
}
```

Bash:

```bash
read -rsp 'Temporary HOD password: ' SETUP_HOD_PASSWORD
export SETUP_HOD_PASSWORD
npm run setup:hod
unset SETUP_HOD_PASSWORD
```

Afterwards, HODs create additional management accounts in **People**. Managers can manage only member accounts. A role change or deactivation revokes sessions. The final active HOD cannot be demoted or deactivated. JS IDs are immutable and case-insensitive.

### Initial team import

For an empty database, `npm run setup:team` can create the initial roster in one transaction. Set the process environment variable `TEAM_SETUP_FILE` to a private JSON file outside this repository. Its value is an array of objects with `name`, `username`, `role` (`member`, `manager` or `hod`), `password`, and optional `designation`. Passwords must be at least 10 characters. Include an HOD and no more than 15 people. IDs are validated case-insensitively; an invalid roster or a database containing accounts is rejected without changing existing accounts.

Every imported account must change its temporary password on first sign-in. The command never prints passwords. Keep the roster and login handover outside Git. Use **People** for later changes. Designation is a job title; it does not grant permissions. For example, a Team lead can have Manager access while their displayed designation remains Team lead.

## Themes and holidays

Use the **System / Light / Dark** selector in the header, on the sign-in page or in Settings. System follows the device preference. An explicit choice is remembered in that browser, applied before the page paints and shared across its tabs. Forms, dialogs, task details and mobile views support both themes.

**Holidays** is available to every employee:

- Record a full day, an inclusive range of full days, or a single half day (**First half** or **Second half**). All dates use Asia/Kolkata. An optional note is visible to the employee and management.
- Entries take effect immediately without approval. Employees create entries only for themselves and see only their own holiday records. Managers and HODs see the team and can filter by employee.
- An employee can cancel their own entry. A Manager or HOD can reverse another person's entry. Both actions require a reason; the original dates, note, actor, timestamp and reason remain in History. Concurrent stale changes are rejected.
- Overlapping full days or duplicate halves are rejected. Distinct first-half and second-half entries on the same day are allowed. Cancelled or reversed entries do not block a replacement.
- **Team overview → On holiday today** shows recorded absences, including which half of the day. Current/upcoming entries, today's entries and history are available separately.
- Recording or reversing a holiday does not change task deadlines, completion status or recurring schedules. Managers can use the existing task and schedule controls for any agreed adjustments.

For an existing installation, run `npm run db:migrate` before deploying this update. Migration `0001_dry_jackpot.sql` adds the holiday table and indexes without changing existing accounts or tasks.

## Task workflow rules

- Members see only their own tasks, including by direct URL and server action. They can create and edit an incomplete self-assigned task, but cannot assign another person or change a manager-assigned task's instructions/deadline.
- Every completion needs a note. Work links are optional unless a manager requires one. Only http/https links are accepted. The app stores the link; it does not upload files or grant access to linked documents.
- Submission completes a task immediately. Managers/HODs can reopen with a reason. Each submission stays in history, including its deadline and whether it was late. Completing at or before the deadline is on time.
- Overdue is computed from the deadline and current status. Late submission remains possible. Completed tasks cannot be edited until reopened. A deadline extension changes current overdue status; the original deadline and change history remain recorded.
- Comments, status changes, reassignment, edits, completion and reopening are recorded with actor and timestamp. There is no permanent deletion interface.
- Optimistic version checks reject stale task/schedule/account edits. A conflict keeps your input and asks you to refresh; it does not overwrite another person's changes.
- Dashboard metric cards and member summaries use member/search/status/priority/deadline filters, across date tabs. The list additionally applies the selected date tab and pagination. Only started tasks are counted. The default list includes all statuses.

## Recurrence and recovery

All calendar rules use **Asia/Kolkata**. Daily rules select weekdays; weekly rules select one weekday; monthly/yearly rules use a fixed calendar date, clamped to the month's last day when necessary. Each occurrence has a start time and a deadline offset in calendar days plus local time.

- Each occurrence is a separate database task. It is generated up to seven days ahead but stays hidden until its start time. No minute-by-minute cron is needed.
- The daily cron and authenticated task-page reads share a database lease, transactional generation cursor and unique `(series_id, available_at)` constraint. Retries do not duplicate occurrences. Reads normally run catch-up no more than once a minute.
- Missed runs retain original occurrence dates and deadlines. Each series processes up to 366 calendar days per run to bound outage recovery. If more is needed, the management screen displays a catch-up message and subsequent refreshes continue the work.
- Editing first catches up already-started work, preserves those tasks and regenerates unpublished future occurrences. An edit to one existing task does not change its series.
- Pause discards only future unpublished occurrences, retaining started tasks. Resume skips the paused period. Deactivating an assignee pauses their schedules; reactivating the account does not automatically resume schedules.
- The UI refreshes each minute and when returning to a tab. Refresh is deferred while a dialog/input is being edited to avoid disrupting unfinished work.
- Scheduler success/failure metadata is stored in Turso. Provider logs contain technical errors; user-facing errors contain no credentials or database details. There is no external alerting service in v1.

## Architecture

- Next.js App Router, TypeScript, Tailwind CSS and shadcn-style Radix primitives.
- Better Auth username login, database-backed sessions and production rate limiting. Public signup, email login, profile mutation and administrative auth endpoints are not exposed. Account provisioning/password changes use Better Auth's password hashing and verification helpers in authorized transactions.
- The library's required email field is a generated UUID at `accounts.invalid`, never an actual login/contact address. No email service is configured.
- Drizzle schema and checked-in SQL migrations; server-side libSQL queries work with local SQLite during development and remote Turso in deployment.
- Business logic: `src/lib/*-service.ts`. Permission and lifecycle checks run inside database write transactions. Read queries scope data to the authenticated user.
- UI mutations are server actions, not an unauthenticated REST API. The only route handlers are the restricted Better Auth handler and authenticated cron endpoint.

## Validation commands

```sh
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Unit/integration tests use separate random databases under `.test-db/`. Browser tests start their own server on `127.0.0.1:3101` and their own database; they never reset your local or production data. On Windows they use installed Microsoft Edge; elsewhere install Playwright Chromium with `npx playwright install chromium` first. Port 3101 must be free.

Tests cover ownership and role boundaries, temporary passwords, case-insensitive login, session revocation, evidence requirements, stale writes, late completion, reopening/resubmission, calendar edge cases, missed schedules, duplicates, future-task visibility, edits, pause/resume and deactivation. They also cover holiday privacy, overlapping days/halves, cancellations, management reversals, IST boundaries, theme persistence and desktop/mobile flows. Migration generation can be checked with `npm run db:generate`.

The esbuild override keeps Drizzle's older transitive configuration loader on a patched esbuild version; recheck `npm audit` and migration generation when upgrading dependencies.

## Operations and rollout

Keep Turso database URLs/tokens distinct across environments. Apply migrations explicitly before deployment; do not run production migrations from every preview build. Back up the database through Turso before schema upgrades and test restoration on the preview database. Keep the previous Vercel deployment available for application rollback, while preserving forward-compatible schema changes.

This version has no projects/subtasks, direct uploads, daily reports, email/WhatsApp notifications or multiple departments. Hosting and remote-database verification require your Vercel project and Turso credentials; local checks alone do not verify a cloud deployment.
