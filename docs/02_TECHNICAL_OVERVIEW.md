# Unicode Lab — Technical Overview

This document describes the current implementation in enough detail to support a
capstone paper, defense, or handover. It is organized by architecture, data
model, subsystem, security boundary, and data flow.

---

## 1. Purpose and scope

Unicode Lab is a desktop programming-course environment with three cooperating
surfaces:

| Surface | Technology | Primary user | Responsibility |
|---|---|---|---|
| Desktop app | Electron + React + TypeScript | Student and professor | Files, editor, tracking, submissions, review, grading, Live Lab |
| Admin console | React + Vite | Administrator | Users, roles, classes, professor invite codes |
| Backend | Supabase Postgres/Auth/Realtime | All clients | Identity, persistence, RLS, RPCs, realtime fan-out |

The application prioritizes:

- real files on disk rather than an in-browser sandbox;
- automatic, auditable edit history;
- paste and typing-cadence evidence;
- professor review workflows that are useful without trusting a single score;
- RLS as the primary authorization mechanism;
- an offline-tolerant capture queue.

---

## 2. System context

```text
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ Electron desktop app         │        │ Admin web console            │
│                              │        │                              │
│ Student workspace            │        │ Users / roles / classes      │
│ Professor dashboard          │        │ Professor invites            │
│ Live Lab / review / grading  │        │                              │
└──────────────┬───────────────┘        └──────────────┬───────────────┘
               │ Supabase JS (publishable key)         │
               ▼                                       ▼
┌───────────────────────────────────────────────────────────────────────┐
│ Supabase                                                              │
│ Postgres + Auth + RLS + Realtime + SECURITY DEFINER RPCs             │
└───────────────────────────────────────────────────────────────────────┘
               │
               │ main-process IPC only
               ▼
┌───────────────────────────────────────────────────────────────────────┐
│ Electron main process                                                  │
│ filesystem bridge │ terminal │ toolchain probe │ Judge0 client         │
└───────────────────────────────────────────────────────────────────────┘
```

Judge0 is optional and external. Local terminal/Run File execution does not
depend on Supabase or Judge0.

---

## 3. Technology stack

| Layer | Choice |
|---|---|
| Desktop shell | Electron 44 |
| UI | React 19, TypeScript |
| Bundling/dev | electron-vite, Vite 8 |
| Editor | Monaco Editor (`@monaco-editor/react`) |
| Python analysis | `@lezer/python` |
| Icons | `lucide-react` |
| Backend | Supabase Postgres, Auth, Realtime |
| Similarity | Postgres `pg_trgm`, local token-sequence similarity |
| Local terminal | PowerShell child process managed in main |
| Remote execution | Judge0 HTTP API, optional |
| Tests | Vitest, live RLS script |
| Packaging | electron-builder / NSIS |
| Admin console | Separate Vite/React project |

---

## 4. Repository structure

```text
src/
  main/
    index.ts          Electron window, lifecycle, IPC handlers
    fs.ts             Workspace-scoped filesystem bridge
    terminal.ts       Inline PowerShell session
    toolchains.ts     Compiler/runtime detection and run planning
    judge0.ts         Judge0 HTTP client and token storage
  preload/
    index.ts          contextBridge APIs
    index.d.ts        window typings
  renderer/
    src/
      App.tsx         Session/role routing and workspace composition
      components/
        StudentDashboard.tsx
        AssignmentDetailModal.tsx
        JoinClassModal.tsx
        ProfessorInviteModal.tsx
        IntegrityDemo.tsx
        EditorPane.tsx
        WorkspacePanel.tsx
        BottomPanel.tsx
        TerminalPanel.tsx
        TestCasesPanel.tsx
        professor/
          ProfessorDashboard.tsx
          ClassGrid.tsx
          ClassOverview.tsx
          AssignmentModal.tsx
          AssignmentView.tsx
          SubmissionTable.tsx
          SubmissionDetail.tsx
          SnapshotTimeline.tsx
          IcsPanel.tsx
          TypingHeatmap.tsx
          PasteSimilarityPanel.tsx
          LiveLabView.tsx
          GradeBox.tsx
      hooks/
        useSupabaseSession.ts
        useProfileRole.ts
        useEnrolledCourses.ts
        useStudentAssignments.ts
        useStudentFeedback.ts
        usePendingSubmissions.ts
        useRealtimeRefresh.ts
        useCodeTracker.ts
        useStudentPresence.ts
        useToolchainStatus.ts
      lib/
        supabase.ts
        professorQueries.ts
        studentAssignments.ts
        enrollments.ts
        professorInvites.ts
        ics.ts
        analytics.ts
        similarity.ts
        gradebook.ts
        submissionQueue.ts
        snapshotQueue.ts
        notifications.ts
        judge0.ts
        runCommand.ts
  shared/             Main/preload/renderer shared types
supabase/
  migrations/         Database source of truth
  RLS_TEST_NOTES.md   Per-view access expectations
scripts/
  seed.mjs            Idempotent demo data
  rls-check.mjs       Live RLS regression suite
admin-web/            Separate admin console
docs/                 Paper and QA documentation
```

---

## 5. Identity, roles, and session routing

### 5.1 Authentication

- Supabase Auth handles email/password sign-in, sign-up, session persistence,
  recovery, and token refresh.
- The renderer uses only the publishable/anon key.
- `profiles.role` is one of `student`, `professor`, `admin`.
- A trigger on `auth.users` creates the matching `profiles` row.
- Desktop routing:
  - `student` → student dashboard/workspace
  - `professor` → professor dashboard
  - `admin` → admin console notice

### 5.2 Role protection

- Table-level `UPDATE` is revoked from `authenticated` on `profiles`, then only
  `email` and `display_name` are re-granted.
- A trigger blocks role changes unless an admin RPC or the invite redemption
  transaction flag is active.
- `admin_set_role` enforces:
  - caller is admin;
  - cannot change self;
  - known role;
  - last admin cannot be demoted;
  - professor with classes cannot be demoted without reassignment/deletion.

### 5.3 Professor invites

- Admin-only table `professor_invites`.
- Admin RPC creates `PROF-XXXX-XXXX` codes with:
  - lifespan in hours (1–8760);
  - maximum uses (1–1000);
  - optional note.
- Redemption (`redeem_professor_invite`):
  - requires signed-in student;
  - locks the invite row;
  - checks revoked/expired/used-up;
  - increments uses and records last user/time;
  - sets `app.professor_invite` transaction-local GUC;
  - updates `profiles.role = 'professor'`;
  - the role guard accepts only this path.
- Admin can revoke a code; redemption then fails.

---

## 6. Data model

### 6.1 Core academic tables

| Table | Key fields | Purpose |
|---|---|---|
| `profiles` | `id`, `email`, `display_name`, `role`, `created_at` | User identity and role |
| `classes` | `id`, `name`, `code`, `professor_id`, `join_code`, `year_section`, `academic_year`, `archived_at` | Course/class instance |
| `enrollments` | `class_id`, `student_id`, PK | Student-class membership |
| `assignments` | `id`, `class_id`, `title`, `description`, `language`, `file_name`, `starter_code`, `published`, `publish_at`, `due_at`, `auto_test_enabled`, `archived_at` | Assignment definition |
| `test_cases` | `id`, `assignment_id`, `stdin`, `expected_stdout`, `ordinal`, `is_hidden` | Judge0 test definitions |
| `submissions` | `id`, `assignment_id`, `student_id`, `final_snapshot_id`, `status`, `submitted_at`, `grade`, `graded_at`, `graded_by`, `client_token`, `grade_released`, `grade_released_at` | Submission record |
| `submission_grades` | `submission_id` PK, `grade`, `graded_at`, `graded_by` | Professor-only private mark |
| `code_snapshots` | `id`, `user_id`, `submission_id`, `file_name`, `content`, `snapshot_type`, `version`, `char_count`, `line_count`, `language`, `typing_intervals`, `created_at` | Edit history |
| `paste_events` | `id`, `snapshot_id`, `user_id`, `file_name`, `pasted_text`, `pasted_chars`, `paste_mode`, `detected_via`, `created_at` | Paste audit trail |
| `ics_scores` | `submission_id` PK, term fields, `ics`, `band`, `computed_at` | Integrity score |
| `comments` | `id`, `submission_id`, `author_id`, `snapshot_id`, `parent_id`, `anchor_line`, `body`, `created_at` | Feedback threads |
| `code_runs` | submission/test/snapshot references, status, outputs, timing | Judge0 execution history |
| `professor_invites` | `id`, `code`, `note`, `created_by`, `expires_at`, `max_uses`, `uses`, `revoked_at`, timestamps | Professor onboarding |
| `student_presence` | `student_id` PK, `current_file`, `status`, `idle_seconds`, `last_seen_at`, `updated_at` | Live Lab heartbeat |

### 6.2 Relationships

```text
profiles (professor) 1 ─── * classes 1 ─── * assignments 1 ─── * test_cases
     │                         │                    │
     │                         │                    └── * submissions 1 ─── 1 ics_scores
     │                         │                              │
     │                         └── * enrollments * ──────────┤
     │                                                        ├── * code_snapshots
     │                                                        ├── * paste_events
     │                                                        ├── * comments
     │                                                        └── 1 submission_grades

profiles (student) 1 ─── * submissions
                  1 ─── 1 student_presence
                  1 ─── * code_snapshots / paste_events / comments

profiles (admin) 1 ─── * professor_invites (created_by)
```

### 6.3 Public RPCs and helper functions

| Function | Caller | Purpose |
|---|---|---|
| `submit_assignment` | Student | Enrollment check, submission, snapshot attachment, idempotent token |
| `join_class_by_code` | Student | Join active class by code |
| `rotate_class_join_code` | Professor | Rotate class code |
| `add_student_to_class` / `add_students_to_class` | Professor | Roster management |
| `recompute_ics` / `recompute_ics_for_assignment` | Professor | Integrity score computation |
| `save_submission_grade` | Professor | Save private mark and hide public copy |
| `set_submission_grade_release` | Professor | Release/hide one grade |
| `release_assignment_grades` | Professor | Bulk release |
| `admin_set_role` | Admin | Guarded role change |
| `admin_create_professor_invite` | Admin | Generate invite |
| `admin_revoke_professor_invite` | Admin | Revoke invite |
| `redeem_professor_invite` | Student | Promote via invite |
| `touch_student_presence` | Student | Upsert own heartbeat |
| `professor_paste_matches` | Professor | Class-scoped pg_trgm matches |

Helper functions used by RLS: `is_admin`, `is_professor_of_class`,
`is_professor_of_submission`, `is_professor_of_snapshot`,
`is_enrolled_in_class`, `class_of_assignment`, `owns_submission`.

### 6.4 Views

| View | Purpose |
|---|---|
| `student_submissions` | Student-facing submission rows; masks unreleased grade and release timestamp |

---

## 7. Row-Level Security and authorization

RLS is the authority for row visibility. The app never relies on UI hiding alone.

### 7.1 Main policies

| Area | Student | Professor | Admin |
|---|---|---|---|
| Profiles | Own row | Own + enrolled students | All profiles |
| Classes | Enrolled, non-archived | Own classes | All classes |
| Enrollments | Own | Own classes | All |
| Assignments | Published, non-archived, `publish_at <= now()` | Own classes, including drafts/scheduled | Metadata |
| Test cases | Visible only | All in own classes | Metadata only |
| Submissions | Own | Own classes | None |
| Private grades | None | Own classes | None |
| Comments | Own submission threads | Own classes | None |
| Paste events | Own | Own class submissions | None |
| Presence | Own row | Own students | None |
| Professor invites | None | None | All |
| Code runs | Own | Own class submissions | None |

### 7.2 Grade privacy

Two-layer design:

1. `submission_grades` stores the private mark and is professor-only.
2. `submissions.grade` is NULL until release; release copies the private value.
3. `student_submissions` masks grade/release timestamp as defense in depth.
4. Realtime therefore cannot leak a private mark through `submissions`.

### 7.3 Hidden tests and scheduled assignments

- Students only see `test_cases.is_hidden = false`.
- Student assignment RLS requires:
  `published AND archived_at IS NULL AND (publish_at IS NULL OR publish_at <= now())`.

### 7.4 Invite and presence guards

- Invite creation/revocation: admin only.
- Invite redemption: student only, row-locked, expiry/use checked.
- Presence heartbeat: writes only `auth.uid()`.
- Presence reads: own row or professor of an enrolled student.
- Paste similarity: professor of the target submission's class only.

### 7.5 Renderer hardening

- Chromium sandbox enabled.
- Preload exposes narrow typed wrappers only.
- Clipboard and external links go through main-process IPC.
- CSP blocks remote script execution.
- Service-role key never enters the renderer or bundle.
- Judge0 token stays in the main process / userData folder.

---

## 8. Desktop process architecture

### 8.1 Main process

Responsibilities:

- create the Electron window;
- load the renderer;
- register filesystem IPC;
- manage terminal sessions;
- detect toolchains;
- run local commands;
- call Judge0;
- handle native dialogs and external links.

### 8.2 Preload

The preload bridge exposes typed, narrow APIs such as:

- workspace root/read/write/list/create/rename/delete;
- native open/save dialogs;
- clipboard write;
- external link opening;
- terminal start/write/resize/clear;
- toolchain detection/recheck;
- Judge0 configuration/test calls;
- native confirm dialog.

The renderer cannot use Node or `ipcRenderer` directly.

### 8.3 Renderer

`App.tsx` owns:

- session state;
- role routing;
- open files/tabs;
- workspace state;
- active file and dirty state;
- assignment targeting;
- student view state (`dashboard` / `workspace`);
- student feedback modal;
- toast/error surfaces;
- presence heartbeat.

Major UI regions:

- title bar / menu bar;
- files sidebar;
- editor pane;
- bottom panel (terminal/test cases);
- status bar;
- student dashboard overlay;
- professor dashboard;
- admin console notice.

---

## 9. Workspace and filesystem

- Workspace root is fixed at `Documents/Unicode Lab`.
- Class folders are derived from enrollments.
- Filesystem operations are restricted to the workspace root in `src/main/fs.ts`.
- Native dialogs are the only way to open files outside the workspace.
- Tabs track dirty state against the last disk write.
- Closing a dirty tab prompts Save / Don’t Save / Cancel.
- Rename updates the open tab and disk file.
- Delete asks for native confirmation and closes the tab.
- External file changes appear after Refresh Workspace.

---

## 10. Editor and Python intelligence

### 10.1 Monaco

- Multi-file tabs.
- Syntax highlighting for supported languages.
- Themes and Monaco theme definitions.
- Font family/size/ligatures.
- Find/replace, command palette, quick open.
- Read-only snapshot viewer and DiffEditor.

### 10.2 Python analysis

- Lezer parser produces syntax diagnostics.
- Status bar shows diagnostic count.
- Outline extracts functions, methods, classes, and module names.
- Completion covers local symbols, keywords, and builtins.
- Hover shows local definition details.

This is not a full language server: imports and inferred types are out of scope.

---

## 11. Tracking engine

`useCodeTracker` is the core client-side telemetry pipeline.

### 11.1 Snapshot capture

- Content changes start a debounce timer (1.5 s).
- Automatic snapshots are at least 10 s apart.
- A waited burst is captured when the debounce fires.
- Submission capture forces a snapshot so the final file state is always stored.
- The tracker retains manual/restore APIs, but the student-facing time-travel
  browser is intentionally removed.
- Each snapshot stores content, type, version, character/line counts, language,
  and typing intervals.

### 11.2 Paste detection

Two paths:

1. **Monaco paste event** — captures clipboard text and exact range.
2. **Velocity heuristic** — a burst of at least 120 inserted characters without
   a paste event is treated as suspected paste (drag/drop, middle-click, IME).

Paste events store the full pasted text for later similarity analysis.

### 11.3 Typing intervals

- One interval is recorded per content-change event when text is inserted.
- Undo/redo, restore, and paste events are excluded.
- Intervals are clamped to 20 ms–10 s, capped at 800 per snapshot.
- Intervals attach to the next snapshot and are cleared afterwards.
- This powers the professor typing-rhythm heatmap.

### 11.4 Queue and sync

- Captures are queued locally before Supabase writes.
- Snapshots are inserted before paste rows so `snapshot_id` references exist.
- Batch size: 25.
- Failed sync retries after 30 s; online/offline events trigger flush.
- Queue state is exposed in the status bar.
- Submissions use an idempotent `client_token` so retries cannot duplicate.

---

## 12. Student submission flow

```text
Student clicks Submit
        │
        ▼
Confirm dialog
        │
        ▼
Tracker flush/capture final snapshot
        │
        ▼
submit_assignment RPC
        │
        ├─ verify signed-in student
        ├─ verify enrollment
        ├─ create submission (client_token idempotency)
        ├─ attach unsent snapshots for the file
        ├─ create fallback snapshot if none exists
        └─ set final_snapshot_id
        │
        ▼
Dashboard refresh / toast
```

If the network is unavailable, the submission is queued locally and retried with
the same token when possible.

---

## 13. ICS — Integrity Confidence Score

### 13.1 Inputs

- Paste events and character counts.
- Snapshot intervals.
- Snapshot timestamps.
- Latest Judge0 pass/fail result per test case.

### 13.2 Server computation

```text
P = pasted_chars / greatest(final_chars, pasted_chars, 1)
Cadence:
    100 × max(0, 1 − stddev(snapshot gaps) / mean(snapshot gaps))
    shrunk toward 50 when fewer than four gaps
Focus:
    100 × active_seconds / elapsed_seconds
    active = gaps ≤ 120 seconds
    shrunk toward 50 when fewer than four gaps
Compilation:
    100 × latest_passed_cases / latest_tested_cases
    neutral 50 when no Judge0 result exists

Paste term       = 35 × (1 − P)
Cadence term     = 25 × (Cadence / 100)
Focus term       = 20 × (Focus / 100)
Compilation term = 20 × (Compilation / 100)

ICS = sum of terms
Band: pass ≥ 80, review ≥ 60, otherwise flag
```

Stored in `ics_scores`; recompute can target one submission or an assignment.

### 13.3 Presentation

- ICS panel shows score, band, term bars, raw inputs, and explanation.
- Cadence click opens the typing-rhythm heatmap.
- Student-facing ICS demo is a live simulator; it does not claim to be a real
  evidence score.

---

## 14. Professor review views

### 14.1 Snapshot timeline

- SVG rail with nodes colored by snapshot type.
- Clicking selects a snapshot; hover shows timestamp, character delta, paste info.
- Comments with line anchors can jump to the relevant snapshot/line.

### 14.2 Diff mode

- Uses Monaco `DiffEditor`.
- Original = previous snapshot, modified = selected snapshot.
- Inline mode (`renderSideBySide: false`) shows additions/deletions in one pane.
- Disabled for the first snapshot.
- Diff models are retained to avoid model-disposal warnings during mode changes.

### 14.3 Replay

- Playback starts at the first snapshot.
- Replay duration is compressed to 3–45 seconds based on the real session span.
- Snapshot selection follows playback.
- Content is revealed progressively (prefix reveal).
- Progress bar and Stop control are shown.
- Long sessions are intentionally compressed for demo usability.

### 14.4 Typing-rhythm heatmap

- Points are reconstructed by walking each snapshot’s `typing_intervals`
  backwards from the snapshot timestamp.
- Y-axis is log-scaled gap between edits.
- Median line and longest-pause statistic.
- Points above 2× median are visually emphasized as pauses.

### 14.5 Paste similarity

- `pg_trgm` compares the target submission’s pastes with other students in the
  same class.
- Minimum default similarity: 45%.
- Only pastes with at least 20 characters participate.
- Returns the best match per target paste with matched student and timestamp.
- RPC verifies the caller is the class professor.

### 14.6 Token similarity

- Separate from paste similarity.
- Compares final snapshot token sequences across students.
- Configurable threshold (60/75/90%).
- Normalizes identifiers; highlights review candidates, not verdicts.

### 14.7 Grading

- Save writes to `submission_grades` and clears public grade.
- Release copies to `submissions.grade` and sets `grade_released_at`.
- Hide removes the public copy.
- Bulk release operates on all saved unreleased grades in an assignment.

### 14.8 Live Lab

- Student heartbeat every 30 seconds through `touch_student_presence`.
- Client status:
  - `flagged` if a paste was recorded in the last 15 minutes;
  - `idle` if the workspace is not active or no input for 2 minutes;
  - `active` otherwise.
- Professor view marks a row offline after 90 seconds without a heartbeat.
- Realtime subscription refreshes the page; a manual Refresh button also exists.

---

## 15. Admin console

### 15.1 Separation

- `admin-web/` is a separate Vite/React project.
- It is deployed as a static site and is not part of the Electron bundle.
- It uses the same Supabase URL/publishable key as the desktop app.

### 15.2 Admin-only gate

- Sign-in uses Supabase Auth.
- Profile role must be `admin`; students/professors see “Not authorized”.
- Admin data policies expose profiles, classes, enrollments, assignment metadata,
  and professor invites.
- Admin policies do not expose submissions, snapshots, paste events, or code.

### 15.3 Operations

- Search/filter users.
- Change roles through `admin_set_role`.
- Review classes, professors, join codes, counts.
- Create professor invites with note, lifespan, and max uses.
- Copy/revoke invites.
- See active/total invite counts.

---

## 16. Realtime and offline behavior

### 16.1 Realtime

- Supabase Realtime publication includes `submissions`, `comments`,
  `assignments`, and `student_presence`.
- Subscriptions are RLS-filtered by Supabase.
- Dashboards debounce refreshes by ~500 ms.
- Live Lab uses the same mechanism with a dedicated table.

### 16.2 Offline

- Snapshot and paste captures queue in localStorage-backed queues.
- Submissions queue with idempotent client tokens.
- Status bar shows queue/sync state.
- Retry triggers on online event, app focus, and 30 s timer.
- Queued items retry on the next launch if the app was closed.

---

## 17. Build, test, and release

| Concern | Implementation |
|---|---|
| Dev | `npm run dev` runs desktop + admin concurrently |
| Desktop only | `npm run dev:desktop` |
| Admin only | `npm run dev:admin` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit tests | `npm test` (Vitest, 59 tests) |
| RLS regression | `npm run test:rls` (40 checks) |
| Production build | `npm run build` |
| Windows installer | `npm run build:win` |
| Admin build | `npm --prefix admin-web run build` |
| CI | lint, typecheck, unit tests, production build |
| Installer | NSIS, per-user, unsigned |
| Checksum | `dist/SHA256SUMS.txt` |

### Current release artifact

- `dist/unicode-desktop-1.0.0-setup.exe`
- SHA-256:
  `36BDD335629533BFC2DE73C93D87EC32F69519B006FF84B36CFAA9BA735F1BA4`

---

## 18. Seed data and demo state

`scripts/seed.mjs` is idempotent and creates deterministic demo data.

| Item | Value |
|---|---|
| Professor | `professor@unicode.test` / `Password123!` |
| Admin | `admin@unicode.test` / `Password123!` |
| Students | `student1@unicode.test`, `student2@unicode.test`, `student3@unicode.test` / `Password123!` |
| CS101 | 3 students, 3 assignments |
| CS102 | 2 students, 2 assignments (one scheduled +3 days) |
| Join codes | `CS101J4K`, `CS102P8Q` |
| Grade state | student1 released 92; student2 private 78; student3 ungraded |
| Paste demo | student3 has two pastes; student2 shares a 100% match |
| Typing demo | seeded intervals produce jagged/steady/fast-flat rhythms |

---

## 19. Key design decisions and trade-offs

| Decision | Reason | Trade-off |
|---|---|---|
| Electron desktop app instead of VS Code extension | Real files, native dialogs, class workspace, full review surface | Larger binary, Windows-centric packaging |
| Fixed workspace | Predictable file paths for assignments and tracking | No user-chosen root |
| Supabase + RLS | Fast multi-user backend with declarative authorization | Requires network for shared features; RLS must be maintained carefully |
| Private grade table | Prevent API/Realtime leakage | Extra table and copy step on release |
| Masked student view | Defense in depth for grade visibility | Student feedback queries need a second lookup |
| Edit intervals, not raw keystrokes | Privacy and storage efficiency | Heatmap is a cadence approximation |
| Prefix-reveal replay | Simple and visually effective | Mid-file rewrites appear as jumps |
| Per-device seen state | No extra notification tables | No cross-device synchronization |
| Token + pg_trgm similarity | Two complementary review signals | Neither proves plagiarism |
| Separate admin web app | Keeps admin surface out of student/professor bundle | Second deployment target |
| Unsigned installer | No certificate available | SmartScreen warning |

---

## 20. Known technical limitations

- Judge0 execution depends on a reachable endpoint; the demo environment may not
  have one.
- ICS formula accuracy is under review/paused; the score is a review aid.
- Typing heatmap uses edit intervals, not raw key events.
- Replay compresses long sessions and uses prefix reveal.
- Live Lab depends on 30-second heartbeats; offline detection is client-side.
- Notification seen state is per device.
- Similarity panels are heuristics, not plagiarism verdicts.
- PowerShell terminal is pipe-based, not a full PTY.
- Toolchain detection only checks PATH presence, not version.
- macOS/Linux packaging scripts exist but were not validated.
- No code signing, auto-update, SSO, audit-log export, or production legal pack.
- Professor invites are shared out-of-band and are not rate-limited.
