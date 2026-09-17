# Validation record

Verified locally on 17 September 2026 with Node.js 24.13.1 on Windows.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run test` | 30 tests passed across calendar, database, authorization, task, holiday and initial-account setup tests |
| `npm run test:e2e` | 5 browser tests passed, including desktop and 390px mobile flows |
| `npm run build` | Production build passed |
| `npm run db:generate` | No schema changes; checked-in migrations match the schema |
| Dependency audit during installation | 0 reported vulnerabilities |

Browser coverage includes assignment, member submission, another member's URL being denied, reopening and resubmission; account creation, forced password change, password reset and deactivation; and recurring schedule creation, pause/resume and a mobile task workflow.

The theme and holiday update adds browser coverage for device theme changes, explicit theme selection and persistence, dark dialogs, full-day and half-day recording, member privacy, immediate team-dashboard visibility, management reversal and employee cancellation. Database tests also check overlapping dates/halves, invalid dates, stale writes, permission revocation, immutable history and IST date boundaries. Desktop and mobile dark-theme screenshots were visually inspected. The additive holiday migration was applied successfully to the existing local demo database.

A separate production-mode smoke check used an isolated local database and the built application. Login and an authenticated team page returned HTTP 200. Cron rejected an unauthenticated request with HTTP 401 and accepted the configured secret with HTTP 200. Repeated failed sign-ins reached HTTP 429, with rate-limit records persisted in the database.

The initial-account update adds employee designations independently of permissions and an atomic, empty-database-only team import. Tests verify duplicate-ID rejection, the required HOD, protection of existing accounts, password hashes and forced password changes. Browser tests include the designation field in account creation.

The provided production Turso database was then initialized and verified with nine real accounts (one HOD, two Managers and six Members). Stored names, JS IDs, designations, permissions, password hashes and first-login password-change flags matched the private roster. No demo tasks, schedules or holidays were inserted. Hosted migration execution passed after restricting the optional SQLite maintenance pragma to local databases.

Most automated workflow checks use isolated local libSQL databases and test accounts. A Vercel deployment, scheduled Vercel cron execution and the real-member pilot have not yet been exercised. Follow README.md to configure separate preview/production databases and complete that rollout. Credentials and the real roster are kept outside this source repository.

The source ZIP excludes local credentials, databases, installed dependencies, build output and generated test artifacts. Its demo credentials are intentionally public development fixtures; use the initial-HOD setup command with a fresh password for production.
