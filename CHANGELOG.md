# Changelog

All notable changes to Unicode Lab are recorded here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **HTML101 - Web Foundations:** five seeded HTML lessons plus a profile-page
  project, with teaching notes in each assignment description.
- **Live HTML preview in the workspace:** HTML files automatically open a
  bottom-panel preview backed by a loopback-only static server. The project
  folder is served as-is so relative CSS, JS, and images work, while the active
  HTML file is overlaid with unsaved editor content.
- **Multi-file projects:** class tree now supports nested project folders, a
  New Folder action, image import into any folder, image files in the tree, and
  assignment paths such as `profile-project/index.html`.
- ICS demo language dropdown with Python, Java, C/C++, C#, JavaScript,
  TypeScript, Go, Rust, Ruby, PHP, Swift, Kotlin, HTML, and plain text, plus an
  HTML preview using the same preview server.
- HTML typing help: `!DOCTYPE`/`html:5` document skeleton, CSS/script/image/
  link/form/table snippets, automatic closing tags for normal elements, and
  format-on-type/paste with Tab-accepted suggestions.
- Seed now computes demo ICS rows through the live v3 `recompute_ics` RPC using
  synthetic `edit_stats`/`focus_stats`, so the demo matches the shipped model.
- **Phase 2 exam controls:** seatwork settings for allowed interruptions,
  fullscreen, paste blocking, and run-only terminal; server-side tab-out and
  fullscreen warnings; auto-submit after the allowance; event audit; professor
  +5-minute/override actions with an audit trail.
- **Phase 3 exam ICS:** seatwork scores mark paste as N/A and preserve the
  remaining evidence score.
- **Exam operations:** Realtime session/event refresh, per-session event
  timeline with CSV export, reason/minutes override modal, and reopen-attempt
  flow with a fresh deadline and audit trail.
- **Phase 5 product features:** multiple attempts with history, one-time
  override codes, saved exam templates, bulk class exam policy, proctoring
  filters, class-wide exam analytics, and a WEB102 CSS/JavaScript course.
- **Paste audit:** submission review now lists every recorded paste with its
  full text, character count, detection source, mode, file, and timestamp.
- **Timed assessments (Phase 1):** take-home assignments may carry a
  per-student timer, and seatworks are in-person work with a shared live window.
  Deadlines are server-owned; students get draft autosave, crash resume, a
  countdown bar, and deadline auto-submit. Professors get Assignments/Seatworks
  tabs, timing settings, and a live session monitor. See
  [docs/changelog/2026-11-22-timed-assessments-phase-1.md](docs/changelog/2026-11-22-timed-assessments-phase-1.md).
- Student class dashboard with class cards, class detail pages, assignment briefs, unread feedback badges, and “new assignment” chips.
- Two-way feedback: students can reply to professor comments inside the same submission thread.
- Assignment analytics for professors: submitted vs. enrolled, late count, averages, and ICS band distribution.
- Cross-student similarity panel with a configurable threshold and inspect action.
- Live integrity-score demo: typing and pasting update the gauge in real time and highlight the active signal.
- ICS demo playground uses Monaco with Python syntax highlighting.
- `npm run dev` starts the desktop app and admin web console together.
- Class-wide gradebook CSV export (student × assignment, with grades, ICS, band, late flag, and comment counts).
- Professor unread student-reply badges on class cards.
- Professor new-submission badges on class cards.
- Grade release: professors save grades privately, release one submission or a
  whole assignment, and hide a released grade again.
- Student `New grade` badges and class-card counters when a grade is released.
- Assignment scheduling: an optional publish time keeps published assignments
  hidden from students until that moment; student dashboards poll for newly
  visible assignments.
- Admin-generated professor invite codes with a configurable lifespan
  (hours/days) and usage limit, plus copy/revoke actions in the admin console.
- **Professor invite code** field on the Create account form: a valid code
  promotes the new account to professor and re-routes the desktop app.
- Snapshot **Diff mode** in submission review, comparing the selected snapshot
  with the previous one in Monaco's inline diff editor.
- **Typing rhythm heatmap** behind the Cadence bar: edit gaps per snapshot with
  median and longest-pause stats.
- Cadence now uses captured typing intervals with a snapshot-gap fallback, and
  long overnight breaks no longer force Cadence/Focus to zero.
- ICS paste scoring now counts only **novel** pasted text. Moving or
  duplicating code that already exists in an earlier snapshot no longer reduces
  the paste term, while the first external insertion is still counted.
- Snapshot timeline is now a compact horizontally scrollable rail with larger
  click targets and automatic scrolling to the selected snapshot.
- Replay was removed; the snapshot timeline is the sole navigation surface for
  review history.
- Fixed Python diagnostics for files loaded after the editor mounted; editing a
  disk-loaded `.py` file now updates squiggles, the outline badge, and the
  status bar immediately.
- Java and C/C++ language support: Monaco highlighting plus Lezer syntax
  diagnostics and an outline of classes, namespaces, methods, fields, and
  functions.
- Python intelligence from the bundled **Pyright language server**: type-aware
  completion, hover, and go-to-definition. The server runs in the main process
  and is bridged to Monaco over IPC; type diagnostics come from the bundled
  Pyright CLI, and local completion/hover remain as fallbacks.
- Optional local compiler diagnostics for Java and C/C++: `javac` and
  `gcc`/`g++` run in the main process and replace parser diagnostics with real
  compile errors when the toolchain is installed.
- Professor submission review now includes a **local terminal**. It writes the
  selected snapshot to a temporary directory, opens a shell there, and exposes
  **Run file** for the installed toolchain. This runs outside Judge0, so the UI
  warns that student code executes with the professor's local permissions.
- Timed assessment schema and RPCs: `assessment_sessions`,
  `assessment_drafts`, `submissions.assessment_session_id`, and server-side
  start/draft/submit/expire/monitor functions.
- Expanded demo data: three professors, ten students, four classes, and Java
  and C++ assignments with test cases.
- Cross-student **paste similarity** panel using `pg_trgm`, with a red
  Paste detected badge and matched student.
- **Live Lab** page showing student presence heartbeats as active, idle,
  flagged, or offline.
- Inline file rename and delete in the workspace sidebar.
- Themed in-app confirmation for submissions (replaces the native OS prompt).
- Offline submission queue with idempotent client tokens and automatic retry.
- Supabase Realtime refresh for student and professor dashboards.
- Compiler/runtime check when a file becomes active, with a status-bar and terminal chip, plus a **Run file** action that is gated on the local toolchain for Python, JavaScript/TypeScript, Java, C/C++, C#, Go, Rust, Ruby, PHP, Swift, Kotlin, and PowerShell.
- Password reset from the sign-in screen using a recovery link or code.
- Class join codes: students self-enroll with a code, professors copy or rotate it.
- Re-joining an already-joined class now returns a clear class-specific
  “already enrolled” message instead of silently succeeding.
- Separate `admin-web` Node project with an admin role, user search, role management, and class/join-code review.
- Error boundary for renderer crashes.
- Unit tests (Vitest) and an RLS regression script (`npm run test:rls`).
- CI workflow running lint, typecheck, unit tests, and a production bundle build.
- Windows NSIS installer and unpacked build via electron-builder; packaged-app smoke test passes.

### Changed

- **ICS v3 evidence ledger:** the integrity score now starts at 50 and moves
  only with evidence. Authored behaviour (fixes, reworks, revisits, undo) raises
  it; novel paste, line-chunk transcription, robotic rhythm, and away/resume
  patterns lower it. Confidence gates the band, so limited evidence cannot pass,
  and Judge0 is shown as quality rather than integrity. A single revisit counts
  as one excursion and cannot unlock a pass; authored evidence is volume-scaled
  below 200 characters. The demo gains a scenario input, a **Track** button, a
  local run log, and JSON export. See
  [docs/changelog/2026-11-22-ics-evidence-v3.md](docs/changelog/2026-11-22-ics-evidence-v3.md).
- **ICS authorship term:** the 25-point typing term now scores edit behaviour
  instead of typing speed. Corrections, revisits, and mid-line hesitation raise
  it; complete uncorrected lines after a pause lower it. Pauses are neutral, a
  2–5 minute think no longer hurts Focus, and a strong line-chunk pattern is
  capped at review. The weight and `cadence_term` column are unchanged. See
  [docs/changelog/2026-11-22-ics-authorship.md](docs/changelog/2026-11-22-ics-authorship.md).
- Student workspace is fixed at `Documents/Unicode Lab`; the workspace picker was removed.
- Sidebar is Files-only, with an animated collapse into an icon rail.
- Renderer runs with the Chromium sandbox; clipboard and external links go through main-process IPC.
- About dialog reports Electron, Chromium, and Node versions.
- Saving a grade now stores it privately; the professor explicitly releases it
  to the student (or releases all saved grades for an assignment at once).
- Assignments can be scheduled with a publish time instead of only draft or
  published.
- Sign-up now defaults to immediate access in development and required email
  confirmation in production builds; production signs out and reports a
  configuration error if Supabase returns a session unexpectedly.

### Security

- Two-way comments migration: `comments.professor_id` → `author_id`, professors keep their policy, students may reply only inside threads on their own submission.
- Idempotent submission tokens: retries cannot create duplicate submissions, and the token is scoped to the student.
- Realtime publication for comments, submissions, and assignments; verified that a student subscription receives only comments on their own submissions.
- RLS checks cover submissions, hidden tests, comments, grades, grade release,
  and scheduled assignment visibility.
- Private grades are stored in a professor-only `submission_grades` table;
  `submissions.grade` receives the mark only when it is released. Student reads
  use a masked `student_submissions` view.
- Professor invites live in an admin-only table. Creation, revocation, and
  redemption are guarded RPCs; expiry and usage limits are checked under a row
  lock, and only student accounts can redeem.
- Live Lab presence is scoped to a professor's own students. Students can only
  read/write their own heartbeat row.
- Paste similarity is a class-scoped, professor-only RPC; it never returns
  another class's pastes. Typing intervals are attached to snapshots and only
  visible through the same submission policies.

## [1.0.0] - 2026-11-14

Initial capstone build: Electron + React desktop lab with Supabase auth/RLS,
Monaco editor, workspace filesystem, snapshot and paste tracking, Professor
review dashboard, Judge0 test runner, local PowerShell terminal, ICS review
bands, and seeded demo data.
