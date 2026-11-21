# Unicode Lab — Feature Master List

This is the paper-facing inventory of every feature in the current build. IDs are
stable and can be cited in the manuscript, appendices, or defense slides.

## Status legend

| Status                  | Meaning                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| **Implemented**         | Present and demo-ready in the current build                      |
| **External dependency** | Implemented in the app, but depends on Judge0 or another service |
| **Known limitation**    | Implemented, with a documented scope or accuracy caveat          |
| **Not implemented**     | Planned or explicitly out of scope for this capstone             |

## 1. Product summary

Unicode Lab is a desktop programming-course lab with three surfaces:

1. **Student desktop app** — real workspace files, Monaco editor, automatic edit
   history, paste tracking, local execution, submissions, grades, and feedback.
2. **Professor desktop dashboard** — classes, rosters, assignments, test cases,
   submissions, integrity analytics, timeline/diff/heatmap views, grading, and
   Live Lab.
3. **Admin web console** — separate React/Vite app for users, roles, classes, and
   professor invite codes. It never reads submissions or student code.

---

## 2. Authentication, sessions, and roles

| ID      | Feature                     | Description                                                                                                                                 | Status      |
| ------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| AUTH-01 | Email/password sign-in      | Supabase Auth session; workspace opens only after authentication                                                                            | Implemented |
| AUTH-02 | Account creation            | Sign-up with display name derived from email; profile row auto-created by trigger; dev auto-signs in, production expects email confirmation | Implemented |
| AUTH-03 | Session restore             | Persisted Supabase session routes back to the correct role surface                                                                          | Implemented |
| AUTH-04 | Sign-out                    | Clears the local session and returns to the sign-in screen                                                                                  | Implemented |
| AUTH-05 | Password reset by link/code | Sends a Supabase reset email; accepts a pasted recovery URL or 6-digit code plus a new password                                             | Implemented |
| AUTH-06 | Role routing                | `student`, `professor`, and `admin` profiles route to the correct desktop surface                                                           | Implemented |
| AUTH-07 | Admin desktop notice        | Admins signing into the desktop app see “Use the admin console” instead of student/professor UI                                             | Implemented |
| AUTH-08 | Professor invite redemption | The Create account form accepts an admin code and promotes the account to professor during registration                                     | Implemented |
| AUTH-09 | Invite role safety          | Only student accounts can redeem invites; admins/professors are rejected                                                                    | Implemented |
| AUTH-10 | Recovery-session completion | Recovery link/code establishes a session, then updates the password                                                                         | Implemented |

### Authentication notes

- `.test` email addresses cannot receive real Supabase reset mail. Recovery-link
  completion was verified with a generated recovery link.
- Role changes are guarded by RLS, column-level grants, and a database trigger.
- Professor promotion has two paths: admin role change (`admin_set_role`) or
  invite redemption (`redeem_professor_invite`).

---

## 3. Student dashboard and class workflow

| ID     | Feature                   | Description                                                                          | Status      |
| ------ | ------------------------- | ------------------------------------------------------------------------------------ | ----------- |
| STU-01 | Student dashboard landing | First screen after student sign-in; editor workspace is one action away              | Implemented |
| STU-02 | Welcome hero              | Student name, submitted/total summary, class count                                   | Implemented |
| STU-03 | Five stats                | Classes, Assignments, Submitted, Graded, Feedback                                    | Implemented |
| STU-04 | Class cards               | Code, title, year/section, academic year, submission progress, feedback count        | Implemented |
| STU-05 | Class detail page         | Class stats, progress, recent feedback, assignment list                              | Implemented |
| STU-06 | Assignment cards          | Status, file, language, due date, late/past-due flags, description                   | Implemented |
| STU-07 | Assignment detail modal   | Instructions, starter code, due/submitted times, grade, comment count                | Implemented |
| STU-08 | Open assignment file      | Opens/seeds the correct workspace file and switches to the editor                    | Implemented |
| STU-09 | Submit assignment         | Confirmation, success toast, immediate card/status update                            | Implemented |
| STU-10 | Late/overdue flags        | Compares submission time against `due_at`                                            | Implemented |
| STU-11 | Join class by code        | Student enters a professor-issued join code; enrollment and class folder appear      | Implemented |
| STU-12 | New-assignment chips      | Per-device “N new assignments” chip; clears after opening the class                  | Implemented |
| STU-13 | New-grade chips           | “N new grades” on class cards and “New grade” on assignment cards; clears on Details | Implemented |
| STU-14 | Scheduled assignments     | Future `publish_at` assignments are hidden until their publish time                  | Implemented |
| STU-15 | Queued submission banner  | Shows offline submissions waiting to retry                                           | Implemented |
| STU-17 | Empty states              | No classes, no assignments, no feedback, loading/error states                        | Implemented |

---

## 4. Workspace and file system

| ID    | Feature                     | Description                                                      | Status      |
| ----- | --------------------------- | ---------------------------------------------------------------- | ----------- |
| WS-01 | Fixed workspace             | `Documents\Unicode Lab`; no folder picker                        | Implemented |
| WS-02 | Class folders               | One folder per enrolled class, derived from enrollment data      | Implemented |
| WS-03 | Files-only sidebar          | Resizable, collapsible to a 54 px icon rail                      | Implemented |
| WS-04 | File tree                   | Lists class folders and files; refresh reflects external changes | Implemented |
| WS-05 | Create file                 | New file inside a class folder                                   | Implemented |
| WS-06 | Open file                   | Open from tree or native Open File dialog                        | Implemented |
| WS-07 | Save / Save As              | `Ctrl+S`, `Ctrl+Shift+S`, dirty-state handling                   | Implemented |
| WS-08 | Export file                 | Downloads current editor content                                 | Implemented |
| WS-09 | Inline rename               | Enter commits, Escape cancels; open tabs update                  | Implemented |
| WS-10 | Delete file                 | Native confirmation; removes disk file and closes its tab        | Implemented |
| WS-11 | Workspace-scoped filesystem | Renderer cannot read arbitrary paths outside the workspace       | Implemented |
| WS-12 | Workspace errors            | Readable error banners for filesystem failures                   | Implemented |
| WS-13 | Status bar                  | File, language, cursor, snapshots, pastes, sync state, toolchain | Implemented |
| WS-14 | Class focus                 | Opening a class expands/focuses its workspace folder             | Implemented |

---

## 5. Editor and language intelligence

| ID    | Feature                         | Description                                                                                                       | Status                           |
| ----- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| ED-01 | Monaco editor                   | Multi-file tabs, dirty indicators, save prompts                                                                   | Implemented                      |
| ED-02 | Syntax highlighting             | Python, Java, C/C++, JavaScript/TypeScript, Markdown, JSON, SQL, and more                                         | Implemented                      |
| ED-03 | Themes                          | App and Monaco themes, persisted                                                                                  | Implemented                      |
| ED-04 | Fonts                           | Font family, size, ligatures, word wrap, minimap, line numbers                                                    | Implemented                      |
| ED-05 | Local diagnostics               | Live Lezer parser errors with red squiggles and status-bar count for Python, Java, C, and C++                     | Implemented                      |
| ED-06 | Outline panel                   | Functions, methods, classes, namespaces, fields, and module-level names; click to jump                            | Implemented                      |
| ED-07 | Python completion               | Type-aware Pyright LSP completion, with local-symbol fallback                                                     | Implemented                      |
| ED-08 | Python hover                    | Pyright LSP type/signature hover, with local-definition fallback                                                  | Implemented                      |
| ED-09 | Python name resolution          | Conservative parser-level scope pass for undefined names                                                          | Implemented                      |
| ED-10 | Java/C/C++ compiler diagnostics | Local `javac`/`gcc`/`g++` pass adds semantic errors when the toolchain is installed                               | Implemented (external toolchain) |
| ED-16 | Python type diagnostics         | Bundled Pyright reports inferred-type errors, argument/assignment mismatches, bad attributes, and undefined names | Implemented                      |
| ED-17 | Python LSP features             | Type-aware completion, hover, and go-to-definition from Pyright                                                   | Implemented                      |
| ED-11 | Find/replace                    | Monaco find/replace and shortcuts                                                                                 | Implemented                      |
| ED-12 | Command palette                 | `Ctrl+Shift+P`                                                                                                    | Implemented                      |
| ED-13 | Quick open                      | `Ctrl+P`                                                                                                          | Implemented                      |
| ED-14 | Standard editing                | Undo/redo, cut/copy/paste, comment toggle, select-all                                                             | Implemented                      |
| ED-15 | Editor IPC focus                | Dashboard overlay blurs hidden Monaco focus to avoid stray edits                                                  | Implemented                      |

### Editor notes

- Python diagnostics, completion, hover, definitions, signatures, document
  symbols, rename, and semantic tokens come from the bundled Pyright language
  server (the engine behind Pylance). The Lezer parser remains the instant
  syntax/outline layer and the fallback if the server cannot start.
- Java and C/C++ highlighting comes from Monaco's built-in tokenizers. Syntax
  errors and the outline come from Lezer grammars; when `javac` or
  `gcc`/`g++` is on PATH, a local compile pass adds semantic errors. There is no
  language server, so code actions, refactors, and clangd-style inspections are
  out of scope.
- JavaScript/TypeScript semantic errors come from Monaco's bundled TypeScript
  worker. Other languages still rely on local run/compile checks.

---

## 6. Edit tracking, snapshots, paste analytics, and typing rhythm

| ID     | Feature                            | Description                                                                                      | Status          |
| ------ | ---------------------------------- | ------------------------------------------------------------------------------------------------ | --------------- |
| TRK-01 | Automatic snapshots                | Captures edits after an idle debounce                                                            | Implemented     |
| TRK-02 | Snapshot throttling                | Minimum spacing between automatic snapshots                                                      | Implemented     |
| TRK-03 | Snapshot types                     | `auto`, `paste`, `manual`, `restore`                                                             | Implemented     |
| TRK-04 | Clipboard paste capture            | Monaco paste event stores pasted text and detection source                                       | Implemented     |
| TRK-05 | Velocity paste heuristic           | Large inserted bursts without a paste event are treated as suspected paste                       | Implemented     |
| TRK-06 | Full pasted text                   | `paste_events.pasted_text` retained for similarity analysis                                      | Implemented     |
| TRK-07 | Typing intervals                   | Edit-burst gaps attached to snapshots as `typing_intervals`                                      | Implemented     |
| TRK-08 | Snapshot history                   | Per-file snapshot list and local state                                                           | Implemented     |
| TRK-09 | Forced capture on submit           | Submission captures current editor content even without a recent snapshot                        | Implemented     |
| TRK-10 | Student-facing restore/time-travel | Intentionally removed; students review history through professor feedback, not a restore browser | Not implemented |
| TRK-11 | Offline capture queue              | Local queue for snapshots and paste events                                                       | Implemented     |
| TRK-12 | Idempotent submission token        | Client token prevents duplicate submissions on retry                                             | Implemented     |
| TRK-13 | Sync status                        | `local-only`, `signed-out`, `queued`, `syncing`, `synced`, `offline`, `error`                    | Implemented     |
| TRK-14 | Retry/backoff                      | Failed sync retries after a delay; online/offline events flush                                   | Implemented     |
| TRK-15 | History hydration                  | Loads recent snapshots/pastes for the signed-in user                                             | Implemented     |
| TRK-16 | Typing rhythm data                 | Cadence samples available to professor heatmap                                                   | Implemented     |
| TRK-17 | Paste count                        | Submission summaries count paste events                                                          | Implemented     |

### Tracking scope note

Typing rhythm is derived from Monaco content-change intervals attached to
snapshots. It is not a raw per-keystroke surveillance log.

---

## 7. ICS — Integrity Confidence Score

| ID     | Feature             | Description                                                                                    | Status      |
| ------ | ------------------- | ---------------------------------------------------------------------------------------------- | ----------- |
| ICS-01 | Weighted score      | Paste 35%, Cadence 25%, Focus 20%, Compilation 20%                                             | Implemented |
| ICS-02 | Bands               | `pass` ≥ 80, `review` ≥ 60, otherwise `flag`                                                   | Implemented |
| ICS-03 | Server recompute    | `recompute_ics` RPC                                                                            | Implemented |
| ICS-04 | Bulk recompute      | `recompute_ics_for_assignment` RPC                                                             | Implemented |
| ICS-05 | Stored terms        | `ics_scores` stores each term, final score, band, timestamp                                    | Implemented |
| ICS-06 | Professor ICS panel | Score, band, term bars, raw inputs, plain-language explanation                                 | Implemented |
| ICS-07 | Cadence heatmap     | Clicking Cadence opens typing rhythm scatter plot                                              | Implemented |
| ICS-08 | ICS demo            | Student-facing live Monaco playground; typing/pasting/idle update metrics                      | Implemented |
| ICS-09 | Demo responsiveness | Gauge and active signal highlight update in real time                                          | Implemented |
| ICS-10 | Novel paste term    | Only pasted text that did not exist in an earlier snapshot counts; internal moves are excluded | Implemented |

### ICS caveat

The formula and weights are implemented and functional, but the exact formula
accuracy is intentionally treated as in review/paused for this capstone. The
demo is a simulator; real scores are server-recomputed from telemetry.

---

## 8. Terminal, local execution, and toolchains

| ID     | Feature                    | Description                                                                                    | Status           |
| ------ | -------------------------- | ---------------------------------------------------------------------------------------------- | ---------------- |
| RUN-01 | Inline PowerShell terminal | Workspace-rooted, inline prompt/caret, command history                                         | Implemented      |
| RUN-02 | Clear/restart terminal     | Terminal controls                                                                              | Implemented      |
| RUN-03 | Toolchain detection        | Python, JDK, GCC/G++, .NET, Node, Go, Rust, Ruby, PHP, Swift, Kotlin                           | Implemented      |
| RUN-04 | Toolchain chip             | `ready`/`missing` for the active file                                                          | Implemented      |
| RUN-05 | Missing-toolchain guidance | Banner naming missing command and install hint                                                 | Implemented      |
| RUN-06 | Recheck toolchain          | Re-detect after installation                                                                   | Implemented      |
| RUN-07 | Run file                   | Compiles/runs active file with the detected toolchain                                          | Implemented      |
| RUN-08 | Language coverage          | Python, JavaScript/TypeScript, Java, C/C++, C#, Go, Rust, Ruby, PHP, Swift, Kotlin, PowerShell | Implemented      |
| RUN-09 | Run gating                 | Run is blocked with a readable message when toolchain is missing                               | Implemented      |
| RUN-10 | Non-runnable file types    | Markdown/JSON/SQL/HTML show no Run action                                                      | Implemented      |
| RUN-11 | Artifact caveat            | Compiled languages may leave build outputs beside source                                       | Known limitation |

---

## 9. Assignments, submissions, and student feedback

| ID     | Feature                  | Description                                                                       | Status      |
| ------ | ------------------------ | --------------------------------------------------------------------------------- | ----------- |
| SUB-01 | Assignment brief         | Instructions, starter code, file name, language, due date                         | Implemented |
| SUB-02 | Submission RPC           | Verifies enrollment, creates submission, attaches snapshots                       | Implemented |
| SUB-03 | Final snapshot           | Uses newest snapshot or captures live content                                     | Implemented |
| SUB-04 | Idempotent retry         | `client_token` returns the original submission                                    | Implemented |
| SUB-05 | Submission status        | Submitted/graded/queued/not submitted states                                      | Implemented |
| SUB-06 | Latest submission        | Student card shows latest submission only                                         | Implemented |
| SUB-07 | Grade visibility         | Released grade appears; private grade stays hidden                                | Implemented |
| SUB-08 | Feedback modal           | Comments grouped by submission, grade shown, threaded replies                     | Implemented |
| SUB-09 | Student replies          | Students may reply inside threads on their own submission                         | Implemented |
| SUB-10 | Unread feedback badge    | Clears after opening Feedback                                                     | Implemented |
| SUB-11 | Comment counts           | Shown on assignment/submission cards                                              | Implemented |
| SUB-12 | Read-only submission API | Students cannot update their own grade/status through the client                  | Implemented |
| SUB-13 | Online/offline submit    | Queue with automatic retry when connection returns                                | Implemented |
| SUB-14 | Assessment tabs          | Student class page separates Assignments (take-home) from Seatworks (in-person)   | Implemented |
| SUB-15 | Server-owned timer       | Start/deadline come from the database; the client only displays a countdown       | Implemented |
| SUB-16 | Draft autosave           | Latest content is saved to `assessment_drafts` every 8 seconds and on window hide | Implemented |
| SUB-17 | Crash resume             | Start/reopen returns the saved draft and the same deadline                        | Implemented |
| SUB-18 | Deadline finalize        | Server auto-submits the latest draft after the deadline (10s grace)               | Implemented |
| SUB-19 | Single attempt           | One active/submitted session per student per assessment in Phase 1                | Implemented |
| SUB-20 | Timed workspace bar      | Countdown, autosave state, Open file, and Submit appear above the editor          | Implemented |

---

## 10. Professor class and assignment management

| ID     | Feature                     | Description                                                                 | Status      |
| ------ | --------------------------- | --------------------------------------------------------------------------- | ----------- |
| PRO-01 | Professor dashboard         | Role-gated class grid after sign-in                                         | Implemented |
| PRO-02 | Class CRUD                  | Create/edit/archive/restore/delete classes                                  | Implemented |
| PRO-03 | Class metadata              | Year/section and academic year                                              | Implemented |
| PRO-04 | Join code                   | Auto-generated; copy and rotate                                             | Implemented |
| PRO-05 | Roster management           | Add by email, remove, bulk import emails/CSV                                | Implemented |
| PRO-06 | Student reply badge         | “N new student replies” on class cards                                      | Implemented |
| PRO-07 | New-submission badge        | “N new submissions” on class cards                                          | Implemented |
| PRO-08 | Assignment CRUD             | Title, language, description, file name, starter code                       | Implemented |
| PRO-09 | Assignment lifecycle        | Draft, published, archived, deleted                                         | Implemented |
| PRO-10 | Publish scheduling          | `publish_at` hides published assignments until a future time                | Implemented |
| PRO-11 | Due dates                   | Stored, displayed, used for late flags                                      | Implemented |
| PRO-12 | Auto-tests toggle           | Enables student Test cases/Run tests                                        | Implemented |
| PRO-13 | Test case CRUD              | Add/delete cases                                                            | Implemented |
| PRO-14 | Hidden test cases           | `is_hidden` hides cases from students                                       | Implemented |
| PRO-15 | Assignment file naming      | Default/derived workspace file name                                         | Implemented |
| PRO-16 | Class/assignment CSV export | Gradebook export                                                            | Implemented |
| PRO-17 | Assignment/seatwork tabs    | Class overview separates take-home work from in-person seatworks            | Implemented |
| PRO-18 | Timing settings             | Type, duration, opening time, cut-off, auto-submit, show-timer              | Implemented |
| PRO-19 | Session monitor             | Per-student status, start, deadline, last save, draft revision, review link | Implemented |
| PRO-20 | Lazy expiry                 | Monitor refresh finalizes past-deadline sessions without `pg_cron`          | Implemented |

---

## 11. Submission review and professor insights

| ID     | Feature                   | Description                                                                                     | Status                          |
| ------ | ------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------- |
| REV-01 | Submission table          | Student, submitted time, grade, ICS, band, pastes, comments                                     | Implemented                     |
| REV-02 | Sort/filter               | Sort by ICS/time; filter pass/review/flag                                                       | Implemented                     |
| REV-03 | Submission CSV            | Export visible submission rows                                                                  | Implemented                     |
| REV-04 | Assignment analytics      | Submitted/enrolled, late, average ICS/grade, band distribution                                  | Implemented                     |
| REV-05 | Token similarity panel    | Cross-student final-snapshot token similarity with threshold                                    | Implemented                     |
| REV-06 | Submission detail         | Student, assignment, class, band, ICS                                                           | Implemented                     |
| REV-07 | Snapshot timeline         | Horizontally scrollable rail with large click targets                                           | Implemented                     |
| REV-08 | Diff mode                 | Compare selected snapshot to previous in inline Monaco diff                                     | Implemented                     |
| REV-09 | Paste similarity          | Red Paste detected badge; matched cross-student paste                                           | Implemented                     |
| REV-10 | Typing heatmap            | Cadence scatter plot, median gap, longest pause                                                 | Implemented                     |
| REV-11 | ICS panel                 | Weighted terms, score, band, explanation                                                        | Implemented                     |
| REV-12 | Inline comments           | Line-anchored comments with threaded replies                                                    | Implemented                     |
| REV-13 | Comment navigation        | Jump to snapshot/line; highlight commented lines                                                | Implemented                     |
| REV-14 | Grade save                | Private grade store                                                                             | Implemented                     |
| REV-15 | Grade release             | Release/hide one submission grade                                                               | Implemented                     |
| REV-16 | Bulk grade release        | Release all saved grades in an assignment                                                       | Implemented                     |
| REV-17 | Judge0 test runner        | Run test cases against a snapshot                                                               | External dependency             |
| REV-18 | Run history               | Persisted execution history per submission                                                      | External dependency             |
| REV-19 | Recompute ICS             | Single submission or all submissions                                                            | Implemented                     |
| REV-20 | Live Lab                  | Active/idle/flagged/offline student monitor with current file                                   | Implemented                     |
| REV-21 | Local submission terminal | Writes the selected snapshot to a temporary directory and opens a local shell with **Run file** | Implemented (local permissions) |

### Review caveats

- Diff mode is disabled for the first snapshot.
- Paste similarity is a review signal, not a plagiarism verdict.
- Token similarity normalizes identifiers but does not prove copying.
- The local submission terminal executes student code with the professor's OS
  permissions, outside the Judge0 sandbox. It should only be used for trusted
  review runs.

---

## 12. Feedback, notifications, and realtime

| ID     | Feature                     | Description                                                 | Status           |
| ------ | --------------------------- | ----------------------------------------------------------- | ---------------- |
| NOT-01 | Student feedback modal      | Comments grouped by submission with timestamps and grade    | Implemented      |
| NOT-02 | Two-way replies             | Professor/student authorship and threaded replies           | Implemented      |
| NOT-03 | Unread feedback             | Per-device seen timestamp                                   | Implemented      |
| NOT-04 | New-assignment chips        | Per-device seen timestamp                                   | Implemented      |
| NOT-05 | New-grade chips             | Per-device grade-release timestamp                          | Implemented      |
| NOT-06 | Professor reply badges      | Per-class seen timestamp                                    | Implemented      |
| NOT-07 | Professor submission badges | Per-class seen timestamp                                    | Implemented      |
| NOT-08 | Realtime dashboard refresh  | Submissions/comments/assignments changes refresh dashboards | Implemented      |
| NOT-09 | Live Lab realtime           | `student_presence` changes refresh the monitor              | Implemented      |
| NOT-10 | Per-device seen state       | localStorage; no cross-device sync                          | Known limitation |

---

## 13. Admin web console

| ID     | Feature                  | Description                                                  | Status      |
| ------ | ------------------------ | ------------------------------------------------------------ | ----------- |
| ADM-01 | Separate console         | `admin-web/` Vite/React project, not part of Electron bundle | Implemented |
| ADM-02 | Admin-only gate          | Non-admin accounts see “Not authorized”                      | Implemented |
| ADM-03 | User list                | Profiles with role and join date                             | Implemented |
| ADM-04 | Search/filter            | Filter by name/email and role                                | Implemented |
| ADM-05 | Role changes             | Uses guarded `admin_set_role` RPC                            | Implemented |
| ADM-06 | Self-role guard          | Admin cannot change their own role                           | Implemented |
| ADM-07 | Last-admin guard         | Cannot demote the last admin                                 | Implemented |
| ADM-08 | Professor demotion guard | Professor with classes must be reassigned/deleted first      | Implemented |
| ADM-09 | Class review             | Professor, join code, student count, assignment count        | Implemented |
| ADM-10 | Join-code copy           | Copies class join code                                       | Implemented |
| ADM-11 | Professor invites        | Generate codes with note, lifespan (hours/days), max uses    | Implemented |
| ADM-12 | Invite lifecycle         | Active/expired/used-up/revoked states                        | Implemented |
| ADM-13 | Invite copy/revoke       | Copy code; revoke stops future redemption                    | Implemented |
| ADM-14 | Invite stats             | Active invite count                                          | Implemented |
| ADM-15 | Admin data boundary      | No submissions, snapshots, paste events, or code             | Implemented |

---

## 14. Security and privacy

| ID     | Feature                        | Description                                                         | Status      |
| ------ | ------------------------------ | ------------------------------------------------------------------- | ----------- |
| SEC-01 | RLS on application tables      | Every user-visible table protected                                  | Implemented |
| SEC-02 | Role escalation guard          | Column grants + trigger + guarded role RPC                          | Implemented |
| SEC-03 | Hidden test cases              | Student queries exclude `is_hidden = true`                          | Implemented |
| SEC-04 | Private grades                 | `submission_grades` professor-only; public grade only when released | Implemented |
| SEC-05 | Masked student submission view | `student_submissions` exposes released grade only                   | Implemented |
| SEC-06 | Scheduled visibility           | Student RLS checks `publish_at <= now()`                            | Implemented |
| SEC-07 | Join-code RPC                  | Active code only; already-enrolled students get a clear message     | Implemented |
| SEC-08 | Professor invite RPCs          | Admin-only create/revoke; student-only redeem; row lock             | Implemented |
| SEC-09 | Live Lab isolation             | Presence visible to student and class professor only                | Implemented |
| SEC-10 | Paste similarity isolation     | Professor-only, class-scoped RPC                                    | Implemented |
| SEC-11 | Student comment scope          | Replies only inside own-submission threads                          | Implemented |
| SEC-12 | Submission immutability        | Only grade fields writable by professor guard trigger               | Implemented |
| SEC-13 | Sandboxed renderer             | Chromium sandbox; narrow preload bridge                             | Implemented |
| SEC-14 | CSP                            | Remote scripts blocked                                              | Implemented |
| SEC-15 | Service-role key exclusion     | Never in renderer/bundle; only seed script                          | Implemented |
| SEC-16 | Judge0 token handling          | Main-process only; stored in userData                               | Implemented |
| SEC-17 | External link handling         | Opens only http(s) through OS browser                               | Implemented |
| SEC-18 | Password privacy               | Password never logged or persisted by app                           | Implemented |
| SEC-19 | RLS regression coverage        | `npm run test:rls` - 41 checks                                      | Implemented |

---

## 15. Engineering, quality, and release

| ID     | Feature              | Description                                     | Status           |
| ------ | -------------------- | ----------------------------------------------- | ---------------- |
| ENG-01 | TypeScript typecheck | Main/preload/renderer and admin web             | Implemented      |
| ENG-02 | ESLint               | Desktop and admin source                        | Implemented      |
| ENG-03 | Unit tests           | 59 Vitest tests                                 | Implemented      |
| ENG-04 | RLS regression       | 40 live checks against Supabase                 | Implemented      |
| ENG-05 | CI workflow          | Lint, typecheck, unit tests, build              | Implemented      |
| ENG-06 | Seed script          | Idempotent demo data                            | Implemented      |
| ENG-07 | Error boundary       | Renderer crash surface                          | Implemented      |
| ENG-08 | Windows installer    | NSIS per-user installer                         | Implemented      |
| ENG-09 | Unpacked build       | `dist/win-unpacked`                             | Implemented      |
| ENG-10 | Installer checksum   | `dist/SHA256SUMS.txt`                           | Implemented      |
| ENG-11 | Release notes        | CHANGELOG and QA checklist                      | Implemented      |
| ENG-12 | Admin build          | Static `admin-web/dist`                         | Implemented      |
| ENG-13 | macOS/Linux packages | Scripts exist; not validated on those platforms | Known limitation |

---

## 16. Explicitly not implemented / out of scope

| ID     | Item                                         | Status                                           |
| ------ | -------------------------------------------- | ------------------------------------------------ |
| OUT-01 | Email delivery of professor invites          | Not implemented; codes are shared out-of-band    |
| OUT-02 | Rate limiting for join/invite attempts       | Not implemented                                  |
| OUT-03 | End-to-end Playwright/Electron test suite    | Not implemented                                  |
| OUT-04 | SSO / institutional identity                 | Not implemented                                  |
| OUT-05 | Code signing / notarization                  | Not implemented                                  |
| OUT-06 | Auto-update channel / crash reporting        | Not implemented                                  |
| OUT-07 | Bulk user creation in admin console          | Not implemented                                  |
| OUT-08 | Class reassignment during professor demotion | Guard only; reassignment UI not implemented      |
| OUT-09 | Real-time collaboration                      | Not implemented                                  |
| OUT-10 | Mobile/web student app                       | Not implemented                                  |
| OUT-11 | Production-grade plagiarism verdict          | Similarity is a review signal only               |
| OUT-12 | Live Judge0 hosting guarantee                | External dependency; endpoint may be unavailable |
| OUT-13 | Final ICS formula validation                 | Paused / under review                            |
| OUT-14 | Cross-device notification sync               | Seen state is per device                         |
| OUT-15 | Full keystroke logging                       | Typing rhythm uses edit intervals only           |
| OUT-16 | FERPA/GDPR/legal policy pack                 | Not implemented                                  |
| OUT-17 | Audit-log export                             | Not implemented                                  |
| OUT-18 | Tab-out detection and strikes                | Phase 2, not implemented                         |
| OUT-19 | Professor override / waiver code             | Phase 2, not implemented                         |
| OUT-20 | Paste blocking and run-only terminal         | Phase 2, not implemented                         |
| OUT-21 | Fullscreen enforcement                       | Phase 2, not implemented                         |
| OUT-22 | MCQ quizzes                                  | Phase 2, not implemented; UniCode remains an IDE |
| OUT-23 | Exam-mode ICS renormalization                | Phase 2, not implemented                         |

---

## 17. Demo-critical feature set

The shortest convincing demo path uses these features:

1. AUTH-01/06 — professor and student sign-in.
2. STU-01–STU-13 — class cards, assignment cards, grade chips, feedback.
3. WS-01–WS-13 — workspace, files, Monaco, terminal, Run file.
4. TRK-01–TRK-16 — snapshots, paste capture, typing intervals.
5. ICS-01–ICS-10 — score, bands, heatmap, live demo, novel paste.
6. PRO-01–PRO-20 — class/assignment management, scheduling, timing, monitor.
7. SUB-14–SUB-20 — seatwork tabs, timer, drafts, resume, auto-submit.
8. REV-01–REV-21 — table, diff, timeline, paste similarity, grades, Live Lab, local terminal.
9. ADM-01–ADM-15 — admin console, roles, professor invites.
10. SEC-01–SEC-19 — RLS and privacy evidence.
