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

- Sign-in screen with email/password and a local-only guest mode
- Real workspace on disk:
  - `Documents/Unicode Lab` by default
  - `Open Workspace…` for any folder
  - class folders derived from enrollments
  - create, open, edit, and save files with `Ctrl+S` / `Ctrl+O` / `Ctrl+Shift+S`
- Monaco editor with themes, fonts, and ligatures
- Automatic snapshots with type metadata (`auto`, `paste`, `restore`) and a local sync queue
- Paste capture through `onDidPaste` plus a typing-velocity heuristic for non-clipboard inserts
- Read-only professor feedback panel
- The student-facing time-travel browser was intentionally removed; history is still recorded automatically and is reviewed by professors.

### Professor

- Role-gated dashboard after login
- Class grid with student/assignment counts, plus create/edit class
- Class view with assignments and a persistent student roster
- Manage students by email (add/remove)
- Create/edit assignments (title, language, description, starter code)
- Manage test cases (add, hide from students, delete)
- Submissions table:
  - sortable by ICS and submitted time
  - filter by pass/review/flag
  - paste/comment counts and band indicators
- Submission detail:
  - read-only Monaco snapshot viewer
  - SVG snapshot timeline (click a node to inspect that moment)
  - ICS breakdown with weighted term bars and a plain-language explanation
  - inline comments anchored to line numbers, with threaded replies
  - numeric grade save
  - Judge0 test runner (when configured)

## Tech stack

| Layer | Choice |
|---|---|
| Desktop shell | Electron 44 |
| UI | React 19 + TypeScript |
| Build | electron-vite / Vite 8 |
| Editor | Monaco Editor |
| Backend | Supabase (Postgres, Auth, Row-Level Security) |
| Visuals | Existing CSS theme tokens + plain SVG (no charting dependency) |
| Execution | Judge0 (optional, env-gated) |
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
```

## Getting started

### Prerequisites

- Node.js 20+ and npm
- A Supabase project (optional if you only want local-only mode)
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
| Student | `student1@unicode.test` | `Password123!` |
| Student | `student2@unicode.test` | `Password123!` |
| Student | `student3@unicode.test` | `Password123!` |

Do not reuse these credentials for anything real.

### 5. Run

```bash
npm run dev
```

Sign in as the professor to see the dashboard, or as a student to see the editor.

### Optional: Judge0

The professor test runner calls Judge0 when configured:

```ini
VITE_JUDGE0_URL=http://localhost:2358
# VITE_JUDGE0_KEY=...   # if your instance requires an auth token
```

Without `VITE_JUDGE0_URL`, the button stays disabled and explains why.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Electron + Vite development app |
| `npm run build` | Typecheck and build |
| `npm run build:win` / `build:mac` / `build:linux` | Package installers |
| `npm run typecheck` | TypeScript checks (main + renderer) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `node scripts/seed.mjs` | Seed demo data (requires service-role key) |

## Security model

- RLS is enabled on every application table.
- Students read/insert only their own snapshots, paste events, submissions, and ICS rows.
- Professors are scoped to their own classes through `SECURITY DEFINER` helpers.
- Profile roles cannot be escalated by signed-in users (column-level grants + a guard trigger).
- Hidden test cases are filtered out for students.
- The renderer only receives `VITE_`-prefixed variables; the service-role key is never bundled into the app.
- Judge0 calls currently run from the renderer. If a Judge0 key is used, move that call behind the main process for a public deployment.

Detailed per-view access expectations are in [`supabase/RLS_TEST_NOTES.md`](supabase/RLS_TEST_NOTES.md).

## Known limitations / in development

- **ICS recomputation** is not implemented yet. Seeded scores display fully, but the “Recompute” action is disabled until the Chapter 3 signal pipeline exists.
- **Judge0** is implemented but disabled unless `VITE_JUDGE0_URL` is configured.
- Classes and assignments cannot be deleted yet (create/edit only).
- The terminal panel is still a mock; it is reserved for the execution phase.
- `courses_legacy` and `enrollments_legacy` remain from the pre-migration schema.
- Visible test cases still expose expected output to students; hidden cases are filtered.
- No real-time collaboration.

## Roadmap

1. Judge0 end-to-end flow, run history, and output in the app
2. ICS signal pipeline + professor recomputation
3. Class/assignment lifecycle (archive/delete, exports)
4. Automated RLS regression tests
5. Installers and release notes

## Why a revision?

The original VS Code extension proved the core ideas — snapshots and paste tracking — but couldn't own the filesystem, the class workspace, or the full professor review workflow that the capstone scope called for. This desktop app is the version that fits that scope: Electron for real files and native dialogs, Supabase for multi-user history, and a dedicated professor surface.

## License

No license has been selected yet. This is a capstone project; treat the code as source-available for review until a license is added.
