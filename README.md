# Unicode Lab

**A desktop lab for programming coursework — real files, automatic edit history, paste analytics, and a professor review dashboard.**

[![Status: in development](https://img.shields.io/badge/status-in%20development-orange)](#status)
[![Electron](https://img.shields.io/badge/Electron-44-47848f)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ecf8e)](https://supabase.com/)

## Status

> **In development.** This is an early build. Features, schema, and UI are still changing, and it is not ready for production use.

## About this project

Unicode Lab is a ground-up **desktop revision of my first Unicode extension**.

The original version was built as a VS Code extension. After reviewing it with my capstone adviser, it became clear that the extension model didn't align with the capstone scope we had agreed on — the project needed a real workspace, a full professor review surface, and an auditable submission history rather than an in-editor helper.

Instead of stretching the extension past that scope, this repository is the corrected direction: a standalone Electron app that keeps the original idea (edit history + paste integrity) and builds the coursework workflow around it.

This project is part of my capstone and is being developed iteratively.

## What it will be

Unicode Lab is intended to be a complete, local-first lab environment for programming classes:

- Students edit **real files** in a workspace folder, organized by the classes they are enrolled in.
- Every meaningful edit is captured **automatically** as a snapshot, so nothing depends on the student remembering to save history.
- Paste activity is recorded and scored so professors can review how a submission was produced, not just what it contains.
- Professors get a dedicated dashboard for classes, rosters, assignments, test cases, submissions, timelines, integrity scores, inline feedback, and grades.
- The app stays useful offline: captures queue locally and sync with Supabase when signed in.
- Supabase row-level security is the authority for who can see what.

## Current feature set

### Student

- Sign-in screen with email/password; the workspace opens only after authentication
- Password reset from the sign-in screen: send a reset email, then paste the recovery link or 6-digit code with a new password
- Join a class with the professor-issued join code; the class and its workspace folder appear immediately
- Fixed workspace on disk at `Documents/Unicode Lab` — there is no folder picker
  - class folders derived from enrollments
  - create, open, edit, and save files with `Ctrl+S` / `Ctrl+O` / `Ctrl+Shift+S`
- Monaco editor with themes, fonts, and ligatures
- Language intelligence:
  - live syntax diagnostics with red squiggles and a status-bar count for
    Python, Java, C, and C++
  - an Outline panel listing functions, methods, classes, namespaces, fields,
    and module-level names, with click-to-jump
  - Python diagnostics from the bundled **Pyright** engine (the engine behind
    Pylance): inferred types, wrong arguments, bad assignments, unknown
    attributes, and undefined names
  - type-aware Python completion, hover, and go-to-definition from the bundled
    Pyright language server
  - Java and C/C++ compile diagnostics (undefined names, type errors, missing
    symbols) when `javac` or `gcc`/`g++` is installed
  - JavaScript/TypeScript semantic checking through Monaco's bundled TypeScript
    worker
  - local Python completion/hover remains as a fallback if the language server
    cannot start
- Automatic snapshots with type metadata (`auto`, `paste`, `restore`) and a local sync queue
- Offline-safe submissions: a network failure queues the submission locally and retries with an idempotent token when the app is back online
- Paste capture through `onDidPaste` plus a typing-velocity heuristic for non-clipboard inserts
- Class dashboard as the first screen after sign-in:
  - stats for classes, assignments, submitted, graded, and feedback
  - a card per enrolled class with code, name, year & section, academic year, progress, and feedback count
  - clicking a class opens a class info dashboard with that class's stats, progress, recent feedback, and assignment list
  - unread feedback badges, “N new assignments”, and “N new grades” chips are tracked per device until the class, assignment details, or feedback panel is opened
  - assignment cards show status, file name, language, due date, and late/past-due flags, with **Details**, **Open file**, and **Submit** actions
  - scheduled assignments appear automatically when their publish time arrives
  - **Details** opens the brief: full instructions, starter code, due date, submission time, grade, and comment count
  - “Open class files” jumps into the editor with the class folder expanded
  - one click into the editor workspace, and a dashboard button to return
  - submitting asks for confirmation first, then shows a success toast
- Professor feedback panel with two-way replies:
  - feedback grouped by submission with the submitted time and grade (or “Not graded”)
  - comments and professor replies anchored to submission lines, with student replies in the same thread
- Integrity score demo: a live playground where typing and pasting update the weighted gauge in real time and flash the signal that just changed
- Real code execution panel in the editor:
  - **Terminal dock**: always-visible local PowerShell session rooted in the workspace
  - type directly into the terminal buffer with an inline prompt and caret
  - a toolchain chip shows whether the active file’s compiler/runtime is installed (Python, JDK, GCC/G++, .NET, Node, Go, Rust, Ruby, PHP, Swift, Kotlin)
  - **Run file** checks that toolchain first, then compiles/runs the active file; if it is missing, the terminal explains what to install instead of failing silently
  - **Test cases** button opens a side panel next to the terminal when the professor enables Judge0 auto tests
  - **Run tests** shows visible test cases and pass/fail output
  - **Submit assignment** button in the dock header
  - draggable dock height
- Files-only sidebar that resizes and collapses into an icon rail
  - rename files inline and delete them with a native confirmation
- The student-facing time-travel browser was intentionally removed; history is still recorded automatically and is reviewed by professors.

### Professor

- Role-gated dashboard after login
- Class grid with student/assignment counts, plus create/edit/archive/delete class
- Class metadata: year & section and academic year, shown on class cards and in the class header
- Class join code with copy and rotate actions for student self-enrollment
- Class view with assignments and a persistent student roster
- Unread student-reply and new-submission badges on class cards, cleared when the class is opened
- Dashboards refresh live through Supabase Realtime when submissions, comments, or assignments change
- Class-wide gradebook CSV export (student × assignment with due, late, grade, ICS, band, comments)
- Manage students by email (add/remove) or bulk import from pasted emails/CSV
- Create/edit assignments (title, language, description, workspace file name, starter code)
- Assignment lifecycle: draft vs published, optional future publish time, due date, Judge0 auto-tests toggle, archive/restore/delete
- Manage test cases (add, hide from students, delete)
- Submissions table:
  - sortable by ICS and submitted time
  - filter by pass/review/flag
  - paste/comment counts and band indicators
  - CSV export
- Assignment analytics derived from the loaded submissions:
  - submitted vs. enrolled, late count, average ICS, average grade
  - pass / review / flag / not-scored distribution bars
- Cross-student similarity for each assignment:
  - compares the final snapshot of each student's latest submission
  - configurable 60 / 75 / 90% threshold with an inspect action
- Submission detail:
  - read-only Monaco snapshot viewer
  - SVG snapshot timeline (click a node to inspect that moment)
  - **Diff mode**: compare the selected snapshot with the previous one in Monaco's inline diff
  - horizontally scrollable timeline for navigating snapshots
  - ICS breakdown with weighted term bars and a plain-language explanation
  - clickable Cadence bar with a **typing rhythm** scatter plot, median gap, and longest pause
  - cross-student **paste similarity** (pg_trgm) with a Paste detected badge and matched student
  - **Recompute ICS** for one submission or all submissions in an assignment
  - inline comments anchored to line numbers, with threaded replies
  - numeric grade save with private/released visibility control, per submission or for the whole assignment
  - Judge0 test runner (fixed endpoint, optional token) with persisted execution history
  - **local terminal** for the selected snapshot: writes a temporary copy and runs it with the installed toolchain, outside Judge0, with the professor's local OS permissions
- **Live Lab** page: student heartbeats every 30 seconds show active, idle, flagged (recent paste), or offline, with the current file. Updates arrive over Realtime.

## Tech stack

| Layer | Choice |
|---|---|
| Desktop shell | Electron 44 |
| UI | React 19 + TypeScript |
| Build | electron-vite / Vite 8 |
| Editor | Monaco Editor + Lezer language analysis (Python, Java, C/C++) + bundled Pyright |
| Backend | Supabase (Postgres, Auth, Row-Level Security) |
| Visuals | Existing CSS theme tokens + plain SVG (no charting dependency) |
| Execution | Judge0 (optional, configured in the app) |
| Packaging | electron-builder |

## Repository layout

```text
src/
├── main/                  Electron main process
│   ├── index.ts           window/lifecycle + IPC registration
│   └── fs.ts              workspace-scoped filesystem bridge
├── preload/               minimal contextBridge APIs + window typings
├── renderer/
│   ├── index.html         CSP, entry point
│   └── src/
│       ├── components/    student UI + components/professor/*
│       ├── hooks/         auth, roles, enrollments, tracker
│       ├── lib/           Supabase client, queries, ICS, Judge0, workspace paths
│       ├── themes/        theme tokens + Monaco themes
│       ├── fonts/         bundled code fonts
│       └── types/         shared renderer types
└── shared/                types shared by main/preload/renderer

supabase/
├── migrations/            source of truth for the database
├── RLS_TEST_NOTES.md      expected professor/student access per view
└── schema.sql             legacy hand-run schema (do not run; migrations win)

scripts/seed.mjs           idempotent demo data

admin-web/                 separate Node project for the admin console
```

## Getting started

### Prerequisites

- Node.js 20+ and npm
- A Supabase project (required; there is no offline guest mode)
- The Supabase CLI if you want to apply migrations from the terminal

### 1. Install

```bash
npm install
```

### 2. Configure

Copy the example environment file and fill in your project:

```bash
cp .env.example .env
```

```ini
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

The publishable key (or a legacy anon key) is safe to ship in the renderer — every table is protected by RLS. The service-role key is only needed for the seed script: keep it out of version control and out of `VITE_` variables.

### Email confirmation by mode

The app defaults to **no email confirmation in development** and **required email confirmation in production** (`import.meta.env.PROD`). `VITE_AUTH_EMAIL_CONFIRMATION` can override this when a project deliberately differs.

The Supabase project must match the mode:

- Dev project: **Authentication → Providers → Email → Confirm email OFF**
- Production project: **Confirm email ON**, with a configured SMTP sender and Site URL

If production returns a session during sign-up, the app signs the account out and shows a configuration error. Supabase’s built-in email sender is intentionally low-volume and can hit a rate limit during testing; use seed accounts or configure real SMTP for production.

### 3. Apply the database migrations

The files in `supabase/migrations/` are the source of truth. Apply them to your project with the CLI:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --remote
```

Or run the migration SQL in the Supabase SQL editor in timestamp order.

> `supabase/schema.sql` is the original hand-run schema. It is kept for history and must not be run against the current migrations.

### 4. Seed demo data (optional)

The seed creates the demo professor, students, classes, assignments, test cases, submissions, snapshots, paste events, ICS rows, and comments. It is idempotent.

```bash
# PowerShell
$env:SUPABASE_SERVICE_ROLE_KEY = "<service-role key>"
node scripts/seed.mjs
```

The URL defaults to the project in this repository; override it with `SUPABASE_URL` if needed. The script never prints or stores the service-role key.

**Development-only accounts created by the seed:**

| Role | Email | Password |
|---|---|---|
| Professor | `professor@unicode.test` | `Password123!` |
| Professor | `professor2@unicode.test` | `Password123!` |
| Professor | `professor3@unicode.test` | `Password123!` |
| Admin | `admin@unicode.test` | `Password123!` |
| Students | `student1@unicode.test` … `student10@unicode.test` | `Password123!` |

The seed also creates four classes: CS101 and CS102 (Professor Demo), CS201
(Professor Lin, Java), and CS301 (Professor Ortega, C++). Do not reuse these
credentials for anything real.

### 5. Run

```bash
npm run dev
```

Sign in as the professor to see the dashboard, or as a student to land on the class dashboard and open the editor workspace from there. `npm run dev` also starts the admin console at <http://localhost:5174>.

### Judge0

The professor test runner executes code through Judge0. The endpoint is **fixed in the app and hidden from the UI**:

- Default: `http://localhost:2358` (self-hosted Docker — free, private, no account)
- Developers can point at another instance by launching with `JUDGE0_URL` in the shell, or by changing `DEFAULT_ENDPOINT` in `src/main/judge0.ts`
- If the endpoint requires a token, open a submission → **Test cases → Judge0**, enter the token, and use **Save & test**

The token is kept in the app's `userData/judge0.json`, never in the repository or renderer. **Run test cases** executes each test against the selected snapshot and shows pass/fail, runtime, memory, and compiler output. Each execution is stored in `code_runs`, and the submission sidebar shows the execution history.

Students get an always-visible **Terminal** dock with a local PowerShell session rooted in the workspace, plus **Run file** for Python/JavaScript/PowerShell. The prompt and caret live inside the terminal buffer, so commands are typed directly in the terminal. When the professor enables **auto tests** on an assignment, a **Test cases** button opens a side panel next to the terminal with visible tests and a **Run tests** button, plus a **Submit assignment** action in the dock header. Requests are capped at 30 per minute and 120k source characters; test runs are capped at 20 cases.

Calls run in the Electron main process, so the token is not exposed to the renderer and local Judge0 instances don't hit browser CORS rules. `JUDGE0_URL` / `JUDGE0_KEY` can be used as a development fallback.

Free options: self-host Judge0 with Docker (default and private), or use a hosted free tier — those require an endpoint URL and an API key, and have request limits.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Desktop app + admin web console together |
| `npm run dev:desktop` | Desktop app only |
| `npm run dev:admin` | Admin web console only (port 5174) |
| `npm run build` | Typecheck and build |
| `npm run build:win` / `build:mac` / `build:linux` | Package installers |
| `npm run build:unpack` | Build an unpacked app folder (no installer) |
| `npm run typecheck` | TypeScript checks (main + renderer) |
| `npm test` | Unit tests (Vitest) |
| `npm run test:rls` | Live RLS regression checks (uses `.env`) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `node scripts/seed.mjs` | Seed demo data (requires service-role key) |

CI runs lint, typecheck, unit tests, and a production bundle build on every push and pull request.

## Installers

`npm run build:win` produces:

- `dist/unicode-desktop-1.0.0-setup.exe` — per-user NSIS installer with Start menu and desktop shortcuts.
- `dist/win-unpacked/unicode-lab.exe` — the same app as a portable folder.

Builds are **unsigned**, so Windows SmartScreen may ask for confirmation on first launch. Increase the version in `package.json` before cutting a new installer; the artifact name follows it. macOS and Linux scripts exist but have not been exercised on those platforms.

## Admin web console

`admin-web/` is a separate Node/Vite project — not part of the Electron bundle. It is intended for account and class administration:

- sign in with an `admin` profile
- search/filter users and change roles through `admin_set_role`
- generate professor invite codes with a lifespan (`hours` or `days`) and usage limit, then copy or revoke them
- review classes, professors, join codes, student counts, and assignment counts
- never reads submissions or code

Professor invite holders enter the code in the **Professor invite code** field on the **Create account** form. A successful registration redeems it immediately in development; when email confirmation is required, the code is stored in account metadata and applied automatically after the confirmed user signs in.

The root `npm run dev` starts both the desktop app and this console. To run the console alone:

```bash
cd admin-web
cp .env.example .env   # same Supabase URL + publishable key as the desktop app
npm install
npm run dev            # http://localhost:5174
npm run build          # static output in admin-web/dist
```

The seed creates `admin@unicode.test` / `Password123!`. For a real deployment, promote an account once with the service role:

```sql
update public.profiles set role = 'admin' where email = 'you@school.edu';
```

Deploy `admin-web/dist` to any static host. See [`admin-web/README.md`](admin-web/README.md) for the safety rules. Admin accounts that sign into the desktop app see a notice pointing them to this console instead of the student view.

## Security model

- RLS is enabled on every application table.
- Students read/insert only their own snapshots, paste events, submissions, and ICS rows.
- Professors are scoped to their own classes through `SECURITY DEFINER` helpers.
- Profile roles cannot be escalated by signed-in users (column-level grants + a guard trigger).
- Hidden test cases are filtered out for students.
- Unreleased grades live in a professor-only `submission_grades` table. `submissions.grade` holds only the released copy, and student reads go through a guarded `student_submissions` view, so a private mark cannot be read from the API or Realtime.
- Published assignments with a future `publish_at` are invisible to enrolled students until that time.
- Class join codes are resolved by a `SECURITY DEFINER` function; only an active class code enrolls, and a student who is already enrolled gets a clear class-specific message instead of a silent no-op.
- Live Lab presence rows are readable only by the student and professors of that student's classes; the heartbeat RPC always writes the caller's own row.
- Paste similarity is a professor-only, class-scoped RPC. Typing interval arrays travel with snapshots and are hidden by the same submission policies.
- Professor invites live in an admin-only table. Creation, revocation, and redemption are guarded RPCs; expiry and usage counts are checked while the invite row is locked, and redemption sets a transaction-local flag that the profile role guard accepts.
- Admin accounts can read profiles, class metadata, enrollments, assignment metadata, and professor invites — never submissions, snapshots, paste events, or code — and change roles only through the guarded `admin_set_role` RPC.
- Password recovery goes through Supabase's recovery link/OTP; the app never stores or logs passwords.
- The renderer only receives `VITE_`-prefixed variables; the service-role key is never bundled into the app.
- The renderer runs with the Chromium sandbox enabled; the preload exposes only narrow IPC wrappers, and clipboard/link handling stays in the main process.
- Judge0 calls run in the main process; the token stays out of the renderer and is stored in the app's user-data folder, not the repository.

Detailed per-view access expectations are in [`supabase/RLS_TEST_NOTES.md`](supabase/RLS_TEST_NOTES.md).

## Integrity score (ICS)

The professor **Recompute** action runs a server-side pipeline:

- **Paste (35%)** — pasted chars ÷ the larger of final content and pasted chars
- **Cadence (25%)** — share of captured typing/edit gaps at or below 1.5 seconds, pulled toward neutral when there are too few samples; older captures fall back to session snapshot gaps
- **Focus (20%)** — share of session time covered by gaps of two minutes or less, ignoring breaks longer than 30 minutes
- **Compilation (20%)** — newest Judge0 result per test case, as a pass percentage; neutral 50 when no test-case run exists

The weighted terms are stored on `ics_scores` and the band is `pass` at 80+, `review` at 60+, otherwise `flag`. Recompute works for one submission or every submission in an assignment.

## Known limitations / in development

- **Judge0** points at a fixed endpoint; if that instance isn't reachable, the run panel reports it.
- **ICS** uses the documented snapshot/paste/Judge0 model above; it does not claim access to keystroke-level telemetry.
- **Python** combines the Lezer parser, the bundled **Pyright** checker, and the bundled Pyright language server. Diagnostics come from Pyright; completion, hover, and go-to-definition are type-aware. The Lezer layer still supplies instant syntax feedback and the outline fallback.
- **Java and C/C++** use Monaco's built-in highlighting plus Lezer syntax trees for diagnostics and the outline. When a local JDK (`javac`) or GCC (`gcc`/`g++`) is installed, the app also runs a real compiler pass for semantic errors.
- **Java/C++ parity caveat:** this is compiler-level checking, not the full language-server experience of VS Code's extensions (no completion, code actions, refactors, semantic tokens, or clangd inspections). Python's language server is bundled; C/C++ needs `g++`/`gcc` on PATH.
- The local PowerShell terminal is pipe-based, not a full PTY. It runs commands and scripts well, but interactive stdin-heavy programs are better tested through Judge0.
- `courses_legacy` and `enrollments_legacy` remain from the pre-migration schema.
- **Similarity** is a token-sequence heuristic (renamed identifiers are normalized); it highlights pairs to review, not a plagiarism verdict.
- The **ICS demo** is a simulator for students; real scores are recomputed from submission telemetry on the server.
- **Realtime** refresh depends on Supabase Realtime; **queued submissions** retry while the app is running (or on the next launch).
- **Typing rhythm** stores edit-burst gaps with each snapshot, not raw per-key events. It is a cadence fingerprint, not a full keystroke log.
- **Live Lab** depends on the 30-second heartbeat and treats a student as offline after 90 seconds without one. Flagged means a paste was recorded in the last 15 minutes.
- **Password recovery** uses a pasted recovery link/code rather than a deep link; join-code and professor-invite attempts are not rate-limited yet.
- **Professor accounts** are promoted by redeeming an admin invite, through the admin console role change, or manually; class reassignment is not implemented yet. Invite codes are shared out-of-band (no email delivery) and have no per-user lock beyond the global usage count.
- The **toolchain check** looks for commands on PATH; it confirms presence, not versions. **Run file** executes locally, so compiled languages may leave build artifacts next to the source.
- Visible test cases still expose expected output to students; hidden cases are filtered.
- No real-time collaboration.

## Roadmap

1. Configurable Judge0 limits and hosted-instance presets
2. Similarity review queue
3. clangd and Eclipse JDT language servers for C/C++ and Java parity with VS Code
4. Code signing and notarized macOS builds

## Why a revision?

The original VS Code extension proved the core ideas — snapshots and paste tracking — but couldn't own the filesystem, the class workspace, or the full professor review workflow that the capstone scope called for. This desktop app is the version that fits that scope: Electron for real files and native dialogs, Supabase for multi-user history, and a dedicated professor surface.

## License

No license has been selected yet. This is a capstone project; treat the code as source-available for review until a license is added.
