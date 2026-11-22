# Unicode Lab — QA Checklist

## Scope

This checklist covers demo/release readiness for the current Windows build.

**Out of scope for this pass**

- Judge0 execution correctness or availability. The live endpoint is an external
  dependency; if unavailable, disable auto tests or ignore the runner.
- Exact ICS formula/weight validation. The formula is implemented; accuracy is
  intentionally under review/paused.
- macOS/Linux packaging validation.
- Production security audit, FERPA/GDPR legal review, SSO, and code signing.

**Priority convention**

- **P0** — demo-blocking; verify before every presentation.
- **P1** — important regression.
- **P2** — polish or edge case.

---

## 1. Test environment

### 1.1 Prerequisites

- [ ] Node.js 20+ and npm installed.
- [ ] `.env` contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- [ ] `.env` contains `SUPABASE_SERVICE_ROLE_KEY` for seed and RLS checks (never
      bundled or committed).
- [ ] Migrations in `supabase/migrations/` applied in timestamp order.
- [ ] `npm install` completes.
- [ ] `npm run dev` starts desktop on **5173** and admin web on **5174**.
- [ ] Windows machine can write to `Documents\Unicode Lab`.

### 1.2 Seed data

Run:

```bash
node --env-file=.env scripts/seed.mjs
```

Expected accounts:

| Role      | Email                                                                          | Password       |
| --------- | ------------------------------------------------------------------------------ | -------------- |
| Professor | `professor@unicode.test`, `professor2@unicode.test`, `professor3@unicode.test` | `Password123!` |
| Admin     | `admin@unicode.test`                                                           | `Password123!` |
| Students  | `student1@unicode.test` … `student10@unicode.test`                             | `Password123!` |

Expected demo state:

- [ ] CS101 has 6 students and 3 Python assignments.
- [ ] CS102 has 3 students and 2 Python assignments; one is scheduled +3 days.
- [ ] CS201 belongs to Professor Lin and has a Java assignment.
- [ ] CS301 belongs to Professor Ortega and has a C++ assignment.
- [ ] HTML101 has 6 students, five HTML lessons, and a profile-page project.
- [ ] Join codes are `CS101J4K`, `CS102P8Q`, `CS201R7A`, `CS301M2Z`, `HTML101L5V`.
- [ ] Student1 has a released Fibonacci grade of 92 and a v3 ICS pass (95.0).
- [ ] Student2 has a private Fibonacci grade of 78 and a v3 ICS review (79.6).
- [ ] Student3 is ungraded and has a v3 ICS flag (5.0).
- [ ] Student3 has paste events; Student2 has a matching paste.
- [ ] Snapshots include typing intervals.

### 1.3 Automated gate

Run before manual QA:

```bash
npm run typecheck
npm run lint
npm test
npm run test:rls
npm --prefix admin-web run build
```

Expected:

- [ ] Typecheck passes.
- [ ] Lint passes with no errors.
- [ ] **121/121** Vitest tests pass.
- [ ] **41/41** RLS checks pass.
- [ ] Admin build passes.

---

## 2. Build, install, and launch

- [ ] **P0** `npm run build` completes.
- [ ] **P0** `npm run build:win` produces `dist\unicode-desktop-1.0.0-setup.exe`.
- [ ] **P0** `dist\win-unpacked\unicode-lab.exe` launches.
- [ ] **P0** Packaged app reaches the sign-in screen with no blank window.
- [ ] **P1** Installer creates per-user Start menu and desktop shortcuts.
- [ ] **P1** Uninstaller removes the app cleanly.
- [ ] **P1** About dialog shows Electron, Chromium, and Node versions.
- [ ] **P1** `dist/SHA256SUMS.txt` matches the installer hash.
- [ ] **P2** Unsigned SmartScreen warning is documented.
- [ ] **P2** App icon and product name are correct.

---

## 3. Authentication, sessions, and roles

- [ ] **P0** Student sign-in lands on the student dashboard.
- [ ] **P0** Professor sign-in lands on the professor dashboard.
- [ ] **P0** Admin signing into the desktop sees “Use the admin console”.
- [ ] **P0** Wrong password shows a readable error.
- [ ] **P1** Dev sign-up creates an account and enters the app immediately when the dev project has **Confirm email OFF**.
- [ ] **P1** Production sign-up returns no session and shows the email-confirmation message when **Confirm email ON**.
- [ ] **P1** Production mode signs out and shows a readable configuration error if the project returns a session during sign-up.
- [ ] **P1** Session survives app restart.
- [ ] **P1** Sign-out clears the session and returns to sign-in.
- [ ] **P1** No guest/editor access remains after sign-out.
- [ ] **P1** “Forgot password” sends reset mail for a real address.
- [ ] **P1** Reset accepts a pasted recovery link or 6-digit code.
- [ ] **P1** Reset rejects mismatched/short passwords.
- [ ] **P1** Re-sign-in works after reset.
- [ ] **P2** `.test` addresses are understood not to receive real mail.
- [ ] **P2** Supabase’s built-in email rate limit is understood; use seed accounts for immediate QA, or configure SMTP.

### Professor invites

- [ ] **P0** Admin creates an invite with a note, lifespan, and max uses.
- [ ] **P0** Generated code has `PROF-XXXX-XXXX` shape.
- [ ] **P0** Student enters a valid code on the Create account form.
- [ ] **P0** Account role changes to professor and the app re-routes.
- [ ] **P1** The dashboard no longer shows a professor invite button.
- [ ] **P1** Lowercase code is accepted.
- [ ] **P1** Invalid, expired, revoked, and used-up codes show readable errors.
- [ ] **P1** Admin can revoke a code; revocation blocks redemption.
- [ ] **P1** Only student accounts can redeem.
- [ ] **P1** Admin can copy the code from the invite panel.
- [ ] **P2** Invite list shows active/used-up/expired/revoked status and use count.

---

## 4. Student dashboard and classes

- [ ] **P0** Dashboard shows welcome name and correct summary.
- [ ] **P0** Five stats show Classes, Assignments, Submitted, Graded, Feedback.
- [ ] **P0** One card per enrolled class with code, title, year/section, AY,
      progress, feedback count.
- [ ] **P0** Clicking a class opens its detail page, not the editor.
- [ ] **P0** Class detail shows stats, progress, recent feedback, assignments.
- [ ] **P0** Back returns to all classes.
- [ ] **P1** Refresh reloads classes, assignments, feedback.
- [ ] **P1** Join class accepts `CS102P8Q` for an eligible student.
- [ ] **P1** Joining creates enrollment and class folder.
- [ ] **P1** Invalid/archived/lowercase-with-spaces code errors are readable.
- [ ] **P1** Joining an already-joined class says “You are already enrolled in…”
      and does not duplicate enrollment.
- [ ] **P1** “N new assignments” chip clears after opening the class.
- [ ] **P1** “N new grades” chip clears after opening Details.
- [ ] **P1** New grade chip appears after a professor release.
- [ ] **P1** Scheduled assignment is hidden from students until publish time.
- [ ] **P1** After publish time it appears within one minute and gets a new chip.
- [ ] **P2** Empty class/assignment states are clear.

---

## 5. Assignments and submissions

- [ ] **P0** Assignment card shows status, file, language, due date, flags.
- [ ] **P0** Details opens instructions, starter code, dates, grade, comments.
- [ ] **P0** Open file opens/seeds the correct workspace file.
- [ ] **P0** Submit asks for confirmation.
- [ ] **P0** Cancel leaves data unchanged.
- [ ] **P0** Confirm creates a submission and shows success toast.
- [ ] **P0** Card updates to Submitted/Graded.
- [ ] **P1** Resubmit creates a later submission; latest is shown.
- [ ] **P1** Submitted-after-due shows Late.
- [ ] **P1** Missing submission after due shows Past due.
- [ ] **P1** Queued submission shows banner/queued status/disabled Submit.
- [ ] **P1** Offline submit queues, retries, and does not duplicate.
- [ ] **P1** Private grade is not shown to the student.
- [ ] **P1** Released grade appears in card/details/feedback.
- [ ] **P2** Grade-release timestamp is used for the New grade chip.

---

## 5A. Timed assessments and live seatworks (Phase 1)

### Professor setup

- [ ] **P0** Class overview shows Assignments and Seatworks tabs with correct
      counts.
- [ ] **P0** New from Assignments creates a take-home assignment; New from
      Seatworks defaults to a timed live window.
- [ ] **P0** Timing settings accept duration, opening time, cut-off, auto-submit,
      and show-timer values.
- [ ] **P0** Saving a seatwork with no timing mode is rejected with a clear
      message.
- [ ] **P0** Saving a live-window seatwork without an opening time is rejected.
- [ ] **P0** A closing time at or before the opening time is rejected.
- [ ] **P0** The assignment header shows type, duration, window, and auto-submit
      policy.
- [ ] **P0** The session monitor lists started students with status, start,
      deadline, last save, and draft revision.
- [ ] **P0** Monitor Refresh picks up a new draft save within a few seconds and
      finalizes a past-deadline session.
- [ ] **P0** Review on a finished session opens the normal submission detail.

### Student flow

- [ ] **P0** Class detail shows Assignments and Seatworks tabs with correct
      counts.
- [ ] **P0** A live seatwork before `opens_at` shows Scheduled and cannot start.
- [ ] **P0** A past `closes_at` seatwork shows Closed and cannot start.
- [ ] **P0** Start opens the workspace, seeds/restores the assignment file, and
      shows the countdown bar.
- [ ] **P0** The countdown uses server time; changing the Windows clock does not
      extend the displayed deadline.
- [ ] **P0** Editing for at least 8 seconds then refreshing/restarting returns the
      same draft and the same deadline.
- [ ] **P0** Window hide triggers a draft save.
- [ ] **P0** Submit asks for confirmation and creates one submission with the live
      content.
- [ ] **P0** The submitted seatwork becomes Submitted and no second attempt can
      start.
- [ ] **P0** A draft left past the deadline auto-submits the latest saved content.
- [ ] **P0** Starting a second timed assessment while one is active is blocked
      with a readable message.
- [ ] **P1** Hiding the countdown keeps the deadline enforced but removes the
      numeric timer.
- [ ] **P1** Auto-submit while the student is on the dashboard updates the card
      after refresh.
- [ ] **P1** The final timed submission appears in ICS, grading, comments, and
      similarity review like a normal submission.

### Server checks

- [ ] **P0** A hand-crafted `submit_assessment_session` after the grace period
      marks `auto_submitted` and uses the saved draft.
- [ ] **P0** `start_assessment_session` rejects non-enrolled students and
      unpublished/closed work.
- [ ] **P0** A second start after submission is rejected.
- [ ] **P0** Professor monitor RPC rejects a professor outside the class.
- [ ] **P0** Student cannot read another student's session or draft through the
      table API.

---

## 6. Workspace and files

- [ ] **P0** Workspace is fixed to `Documents\Unicode Lab`; no picker.
- [ ] **P0** Class folders appear for all enrollments.
- [ ] **P0** File tree lists folders/files.
- [ ] **P0** Create file inside a course folder.
- [ ] **P0** Open file from tree.
- [ ] **P0** Save writes to disk.
- [ ] **P0** Save As writes a new file.
- [ ] **P0** Closing dirty tab prompts Save/Don’t Save/Cancel.
- [ ] **P0** Rename inline commits on Enter, cancels on Escape.
- [ ] **P0** Delete confirms and removes the file.
- [ ] **P1** Refresh Workspace sees external changes.
- [ ] **P1** Export File downloads current content.
- [ ] **P1** Sidebar resizes.
- [ ] **P1** Sidebar collapse animates to icon rail and re-expands.
- [ ] **P1** Opening a class focuses its folder.
- [ ] **P1** Files outside workspace cannot be read by arbitrary path.
- [ ] **P2** Filesystem errors are readable.

---

## 6A. HTML live preview and HTML101

- [ ] **P0** `HTML101 - Web Foundations` appears for student1–student6.
- [ ] **P0** HTML101 has five lesson assignments and a profile-page project.
- [ ] **P0** HTML lessons open `index.html`, `links.html`, `forms.html`,
      `styles.html`, and `interactive.html`.
- [ ] **P0** The project opens `profile-project/index.html` and creates that
      nested folder on first open.
- [ ] **P0** The course tree shows nested project folders and image assets.
- [ ] **P0** New Folder creates a folder inside the selected class/project
      folder and survives Refresh.
- [ ] **P0** Add Images copies one or more images into the selected folder;
      duplicate names get a numeric suffix.
- [ ] **P0** Clicking an image opens it in the system viewer.
- [ ] **P0** Renaming or deleting an image updates the tree.
- [ ] **P0** A project-level HTML preview can load `styles.css`, `script.js`,
      and images from its own folder.
- [ ] **P0** Relative paths outside the project folder are not served.
- [ ] **P0** Opening an HTML file selects the **Preview** tab in the bottom panel
      by default.
- [ ] **P0** The preview is served from `127.0.0.1` on a random port.
- [ ] **P0** Typing in the editor updates the preview after a short pause without
      saving.
- [ ] **P0** Toggling Preview off returns the bottom panel to the terminal.
- [ ] **P0** Refresh reloads the frame; Browser opens the same preview externally.
- [ ] **P0** A linked `style.css` in the same class folder loads and applies.
- [ ] **P0** An image or script with a relative path in the class folder loads.
- [ ] **P0** The class folder is served read-only; unsaved HTML remains only in
      the preview overlay.
- [ ] **P0** Closing the preview stops the server; no preview port remains open.
- [ ] **P0** A file outside the workspace cannot be previewed.
- [ ] **P0** HTML/CSS assignments disable Judge0 auto tests in the editor.
- [ ] **P1** ICS playground HTML Preview still uses its own temporary preview.
- [ ] **P1** The seeded HTML lessons include teaching text in their descriptions.

---

## 6B. Exam controls (Phase 2/3)

- [ ] **P0** A seatwork editor exposes allowed interruptions, fullscreen, paste block, and run-only terminal settings.
- [ ] **P0** Starting a seatwork requests fullscreen when required.
- [ ] **P0** Exiting fullscreen shows a warning and increments the interruption counter.
- [ ] **P0** Leaving the window for more than ~2.5 seconds records a tab-out; a quick switch does not.
- [ ] **P0** The first interruption warns when allowed = 1; the next auto-submits.
- [ ] **P0** Allowed = 0 auto-submits on the first interruption.
- [ ] **P0** Paste and drag-drop are rejected during a seatwork; a toast appears and the monitor count rises.
- [ ] **P0** Shell input is disabled in run-only mode, but Run file still works.
- [ ] **P0** The countdown bar shows interruptions, blocked pastes, fullscreen re-entry, and override state.
- [ ] **P0** The professor monitor shows tab-outs, fullscreen exits, blocked pastes, interruption count, and override note.
- [ ] **P0** +5m extends the server deadline and updates the student countdown.
- [ ] **P0** Excuse resets interruptions and writes an override audit row.
- [ ] **P0** Recompute on a seatwork submission marks paste as N/A and shows the exam-mode reason.
- [ ] **P1** A submitted session cannot be extended.
- [ ] **P1** An override is visible in `assessment_overrides` and the event audit.
- [ ] **P1** A student cannot read another student’s exam events or apply overrides.
- [ ] **P0** The monitor refreshes over Realtime when a session or event changes.
- [ ] **P0** Events opens a timeline of tab-outs, fullscreen exits, blocked
      pastes, warnings, overrides, and auto-submits.
- [ ] **P0** Export CSV downloads the selected session’s event trail.
- [ ] **P0** Override modal collects action, minutes, and reason.
- [ ] **P0** A terminal session can be reopened with a fresh deadline.
- [ ] **P0** Reopening clears the final submission link, resets counters, and
      allows a second submission.
- [ ] **P0** Reopen increments `reopen_count` and writes override/audit rows.

---

## 6C. Phase 5 product features

- [ ] **P0** Set a seatwork to 2 attempts; submit attempt 1, then start attempt 2.
- [ ] **P0** Attempt 3 is rejected with “You have used all 2 attempts…”.
- [ ] **P0** Seatwork cards and assignment details show attempt number/history.
- [ ] **P0** Professor monitor shows attempt number and reopen count.
- [ ] **P0** Generate a one-time override code from the monitor.
- [ ] **P0** Student redeems it from assignment details; the code applies.
- [ ] **P0** Reusing the same code is rejected.
- [ ] **P0** Expired codes are rejected.
- [ ] **P0** Save an exam template and apply it to a new seatwork.
- [ ] **P0** Bulk exam policy updates every seatwork in a class.
- [ ] **P0** Monitor filters work for search, status, interruptions, and overrides.
- [ ] **P0** Class exam overview shows attempts, active, auto-submitted,
      interruptions, blocked pastes, and overrides.
- [ ] **P0** WEB102 appears for student1–student6 with four CSS/JS assignments.
- [ ] **P0** `WEB102C4S` joins the class.
- [ ] **P1** Templates persist across app restarts.
- [ ] **P1** Existing sessions keep their snapshotted policy after a bulk update.

---

## 6D. Snapshot retention

- [ ] **P0** Automatic snapshots are spaced at least 30 s apart during active typing.
- [ ] **P0** `npm run prune:snapshots -- --days 0` is a dry run and deletes nothing.
- [ ] **P0** The dry-run report shows candidate rows, kept rows, and content bytes.
- [ ] **P0** Dry-run output matches the rows that `--apply` removes.
- [ ] **P0** Apply keeps the final snapshot, paste snapshots, manual snapshots, and restore snapshots.
- [ ] **P0** Apply keeps snapshots referenced by paste events and inline comments.
- [ ] **P0** Apply keeps the first and last snapshot of each file.
- [ ] **P0** Apply removes only `snapshot_type = 'auto'` rows.
- [ ] **P0** A pruned submission keeps its stored ICS score, band, confidence, and evidence.
- [ ] **P0** `recompute_ics` on a pruned submission raises the "ICS is frozen" error.
- [ ] **P0** Bulk recompute skips pruned submissions and returns the recomputed count.
- [ ] **P0** Reopening a pruned attempt creates a new submission with new snapshots.
- [ ] **P0** `snapshots_pruned_at` and `snapshots_pruned_count` are recorded.
- [ ] **P1** `--auto-per-hour 0` keeps only milestones and the first/last snapshot.
- [ ] **P1** `--class`, `--assignment`, and `--submission` scopes select the expected rows.

---

## 6E. Admin ICS metric

- [ ] **P0** Admin console shows the ICS metric panel with version and last editor.
- [ ] **P0** The live preview updates when a weight or threshold changes.
- [ ] **P0** The pass threshold must be above the review threshold.
- [ ] **P0** The score floor must be below the ceiling.
- [ ] **P0** Saving increments the settings version and shows a success notice.
- [ ] **P0** Defaults button reloads the shipped v3 values without saving.
- [ ] **P0** A professor recompute uses the new weights and records `settings_version`.
- [ ] **P0** `ics_scores.settings_snapshot` contains the applied metric values.
- [ ] **P0** “Apply to existing v3 scores” re-scores stored v3 evidence.
- [ ] **P0** Changing the pass threshold can move a score between Review and Pass.
- [ ] **P0** Legacy v2 rows keep their original score and null `settings_version`.
- [ ] **P0** Re-applying still works on a submission whose snapshots were pruned.
- [ ] **P0** An admin token can read/update settings; a professor or student token cannot.
- [ ] **P1** Settings survive a console reload and a new sign-in.

---

## 7. Editor and language intelligence

- [ ] **P0** Monaco opens with syntax highlighting for Python/Java/C/C++.
- [ ] **P0** In an HTML file, typing `!` offers `!DOCTYPE`; accepting it inserts
      the full document skeleton.
- [ ] **P0** Typing `!DOCTYPE` and pressing Enter/Tab accepts the snippet.
- [ ] **P0** Typing `<div>` inserts `</div>`; `<br>`, `<img>`, and `<input>` do not
      get closing tags.
- [ ] **P0** Typing after an existing closing tag does not duplicate it.
- [ ] **P0** `link:css`, `script:src`, `img`, `a`, `form`, and `table` snippets
      are offered in HTML files.
- [ ] **P1** HTML and CSS respect format-on-type and format-on-paste.
- [ ] **P0** Tabs open/close and dirty dots appear.
- [ ] **P0** Undo/redo, cut/copy/paste, comment toggle, select-all.
- [ ] **P0** Find/replace works.
- [ ] **P1** Command palette `Ctrl+Shift+P`.
- [ ] **P1** Quick open `Ctrl+P`.
- [ ] **P1** Themes apply and persist.
- [ ] **P1** Fonts/size/ligatures apply and persist.
- [ ] **P1** Word wrap/minimap/line numbers toggles work.
- [ ] **P1** Python syntax errors and undefined names show red squiggles and the
      status count.
- [ ] **P1** Typing an error into a disk-loaded `.py` file updates diagnostics
      without reopening the file.
- [ ] **P1** Python type errors appear after a short pause: a wrong assignment,
      a wrong argument type, and an undefined name are each reported.
- [ ] **P1** Python completion is type-aware: after `name = "hi"`, typing
      `name.` offers `upper`, `capitalize`, and other string methods.
- [ ] **P1** Python hover shows the inferred type, and F12 jumps to a local
      definition.
- [ ] **P2** If the Pyright language server cannot start, Python falls back to
      local completion/hover plus the Pyright CLI checker.
- [ ] **P1** Outline lists Python functions/classes/names and jumps on click.
- [ ] **P1** Java syntax errors show squiggles and an outline of classes/methods.
- [ ] **P1** With a JDK installed, a Java semantic error (undefined variable)
      appears after a short pause and the status bar reads `N Java errors`.
- [ ] **P1** Without a JDK, the status bar says `Java syntax OK` and the
      toolchain chip reports the missing JDK.
- [ ] **P1** C/C++ syntax errors show squiggles and a function/class outline.
- [ ] **P1** With `g++` installed, C++ semantic errors appear after a short
      pause; without it, the status bar labels the check as syntax-only.
- [ ] **P1** Completion shows Python local symbols/keywords/builtins.
- [ ] **P1** Hover shows Python local definition details.
- [ ] **P2** Python language-server limitation is understood: Pyright supplies
      Python intelligence, but Java/C++ still use compiler diagnostics rather
      than clangd/JDT language servers.
- [ ] **P2** Java/C++ limitation (compile diagnostics, not a language server) is
      understood.

---

## 8. Terminal, toolchains, and Run file

- [ ] **P0** Terminal is always visible and rooted in workspace.
- [ ] **P0** Inline prompt/caret accepts commands.
- [ ] **P0** Enter executes; Up/Down history works; `Ctrl+L` clears.
- [ ] **P0** Clear and Restart work.
- [ ] **P0** Toolchain chip matches active file.
- [ ] **P0** Missing toolchain shows banner and install hint.
- [ ] **P0** Run file disabled/messaged when toolchain is missing.
- [ ] **P0** Python Run file executes.
- [ ] **P1** JavaScript/TypeScript Run file executes with Node.
- [ ] **P1** Java compiles with `javac` and runs.
- [ ] **P1** C/C++ compiles and runs where installed.
- [ ] **P1** C# uses `dotnet run` where installed.
- [ ] **P1** Go/Rust/Ruby/PHP/Swift/Kotlin have readable behavior.
- [ ] **P1** PowerShell script runs.
- [ ] **P1** Markdown/JSON/SQL/HTML show no Run action.
- [ ] **P1** Recheck updates the chip after installing a toolchain.
- [ ] **P2** Compiled artifacts caveat is understood.

---

## 9. Tracking, snapshots, pastes, and typing rhythm

- [ ] **P0** Editing creates an automatic snapshot.
- [ ] **P0** Snapshot count in status bar updates.
- [ ] **P0** Snapshot types show auto/paste; restore is not exposed in student UI.
- [ ] **P0** Pasting creates a paste event and increments paste count.
- [ ] **P0** Large drag-drop insert is detected as velocity paste.
- [ ] **P0** Paste text is stored for similarity.
- [ ] **P0** Submission forces a final snapshot even without a recent automatic one.
- [ ] **P0** Snapshots/pastes sync when signed in.
- [ ] **P1** Offline captures queue and sync later.
- [ ] **P1** Failed sync retries without duplicates.
- [ ] **P1** Typing intervals attach to snapshots.
- [ ] **P1** Heatmap has data for newly tracked edits.
- [ ] **P1** Typing intervals are not created from paste bursts.
- [ ] **P1** Queue status is visible in the status bar.
- [ ] **P2** History hydration loads recent snapshots/pastes.

---

## 10. ICS and student demo

- [ ] **P0** Professor ICS panel shows score, band, confidence, evidence ledger, band reason.
- [ ] **P0** Recompute updates a submission.
- [ ] **P0** Bulk recompute updates an assignment.
- [ ] **P0** Band thresholds: pass ≥80, review ≥40, flag below 40, with a confidence gate.
- [ ] **P0** Typing rhythm opens the heatmap.
- [ ] **P0** Heatmap shows points and median/longest-pause stats.
- [ ] **P1** A normally typed submission gets a passing v3 score with sufficient confidence.
- [ ] **P1** A long thinking pause (2–5 min) does not lower the score.
- [ ] **P1** Corrections and revisits raise the authorships value.
- [ ] **P1** A single revisit (move up, change something) does not push a run to pass; it needs two structural events.
- [ ] **P1** Moving up and typing several characters counts one revisit, not one per keystroke.
- [ ] **P1** A hand-copied block is held at review; corroborated refocus copying can flag.
- [ ] **P1** A short session shows `review — limited evidence`, not pass.
- [ ] **P1** A 120–299-char authored run stays `review — short submission` even with perfect evidence.
- [ ] **P1** Judge0 results appear as quality, not in the integrity score.
- [ ] **P1** Overnight/long idle gaps do not force the score to zero.
- [ ] **P1** Timeline scrolls horizontally when snapshots exceed the card width;
      every snapshot is reachable and the selected dot stays visible.
- [ ] **P1** Heatmap empty state is readable for old/no-interval data.
- [ ] **P1** Student dashboard no longer shows an ICS demo button.
- [ ] **P1** Admin console header shows an **ICS demo** button.
- [ ] **P1** The demo loads lazily; the accounts/classes dashboard still works before it opens.
- [ ] **P1** Demo editor uses Monaco Python highlighting.
- [ ] **P1** The demo header shows the live metric version, or “shipped defaults” if loading fails.
- [ ] **P1** Typing updates gauge/authored evidence.
- [ ] **P1** Pasting drops paste evidence and highlights Paste.
- [ ] **P1** Leaving and returning to the window updates the Away signal.
- [ ] **P1** Scenario input + Start recording runs a timer; Stop & save stores score, band, confidence, counts, and the score timeline.
- [ ] **P1** The score timeline updates while recording and uses the live pass/review thresholds.
- [ ] **P1** Keylog records change events plus keydown/keyup, cursor, focus, and paste; Copy keylog exports it.
- [ ] **P1** Stalling mid-line does not raise the score.
- [ ] **P1** Saved runs survive closing/reopening the demo.
- [ ] **P1** Copy JSON exports the tracked runs.
- [ ] **P1** Reset clears the playground and metrics.
- [ ] **P1** HTML mode previews inline with an iframe and no desktop preview server.
- [ ] **P2** Demo copy states it is a simulator.

---

## 11. Professor class and assignment management

- [ ] **P0** Class grid shows counts and archived toggle.
- [ ] **P0** Create/edit class with metadata.
- [ ] **P0** Archive/restore class.
- [ ] **P0** Delete class with confirmation.
- [ ] **P0** Class page shows assignments and roster.
- [ ] **P0** Join code is visible; Copy works.
- [ ] **P0** Rotate confirms, issues new code, old code stops working.
- [ ] **P1** New class gets a code automatically.
- [ ] **P1** Add students by email.
- [ ] **P1** Remove students.
- [ ] **P1** Bulk import pasted emails/CSV; duplicate/invalid handled.
- [ ] **P1** Create/edit assignment with file name and starter.
- [ ] **P1** Publish/draft states work.
- [ ] **P1** Future publish time shows Scheduled and hides from students.
- [ ] **P1** Due date round-trips.
- [ ] **P1** Auto-tests toggle saves.
- [ ] **P1** Test cases add/hide/delete.
- [ ] **P1** Assignment archive/restore/delete.

---

## 12. Submission review, diff, timeline, heatmap, paste similarity

- [ ] **P0** Submissions table loads with grade/ICS/band/pastes/comments.
- [ ] **P0** Paste audit lists every paste with its full text and metadata.
- [ ] **P0** Large pastes scroll inside their entry instead of breaking the layout.
- [ ] **P0** Sort by ICS/time works.
- [ ] **P0** Filter Pass/Review/Flag works.
- [ ] **P0** Submission CSV export downloads.
- [ ] **P0** Submission detail opens.
- [ ] **P1** Local terminal opens a temporary copy of the selected snapshot,
      Run file produces local output, and Close removes the temporary copy.
- [ ] **P0** Snapshot timeline selects snapshots.
- [ ] **P0** Timeline scrolls horizontally when needed and keeps the selected dot visible.
- [ ] **P0** Diff toggle compares selected snapshot to previous.
- [ ] **P0** Diff shows green additions and red deletions.
- [ ] **P0** Diff disabled on first snapshot.
- [ ] **P0** No Replay control is present.
- [ ] **P0** Authorship heatmap opens with points.
- [ ] **P0** Paste detected badge appears for student3.
- [ ] **P0** Paste panel shows matched student and similarity.
- [ ] **P1** Assignment analytics shows submitted/enrolled, late, averages, bands.
- [ ] **P1** Token similarity threshold buttons work; Inspect opens submission.
- [ ] **P1** Inline comments anchor to lines.
- [ ] **P1** Reply inside thread works.
- [ ] **P1** Comment highlight/jump works.
- [ ] **P1** Grade save marks Private.
- [ ] **P1** Release makes grade visible.
- [ ] **P1** Hide removes grade again.
- [ ] **P1** Bulk Release grades updates all saved unreleased grades.
- [ ] **P1** Grade export includes released/private status appropriately.
- [ ] **P2** Judge0 runner/history behavior is readable when unavailable.

---

## 13. Live Lab

- [ ] **P0** Live Lab opens from dashboard and nav.
- [ ] **P0** A signed-in student with workspace open appears.
- [ ] **P0** Current file is shown.
- [ ] **P0** Active status is green.
- [ ] **P0** Idle status is red after no input / non-workspace view.
- [ ] **P0** Flagged status is yellow after a recent paste.
- [ ] **P0** Heartbeats refresh automatically over Realtime.
- [ ] **P0** Refresh button reloads.
- [ ] **P1** After 90 seconds without heartbeat, student shows Offline.
- [ ] **P1** Summary counts match cards.
- [ ] **P1** No-heartbeat empty state is readable.
- [ ] **P1** Student cannot read another student’s presence row.
- [ ] **P2** Idle duration and last-seen labels update.

---

## 14. Realtime and offline behavior

- [ ] **P0** New submission refreshes professor dashboard.
- [ ] **P0** New comment refreshes student feedback.
- [ ] **P0** Assignment publish/update refreshes relevant dashboards.
- [ ] **P0** Live Lab heartbeat refreshes professor view.
- [ ] **P1** Offline snapshot capture queues.
- [ ] **P1** Offline submission queues.
- [ ] **P1** Reconnect sends queued work once.
- [ ] **P1** App restart retries queued work.
- [ ] **P1** Queue/status indicators are accurate.
- [ ] **P2** Realtime outage falls back to manual Refresh.

---

## 15. Feedback and notifications

- [ ] **P0** Student feedback modal groups by submission with time/grade.
- [ ] **P0** Professor comments and student replies are labelled.
- [ ] **P0** Reply composer posts into the same thread.
- [ ] **P0** Cancel clears composer.
- [ ] **P0** Unread feedback badge ignores the student’s own replies.
- [ ] **P0** Professor class card shows new replies.
- [ ] **P0** Professor class card shows new submissions.
- [ ] **P0** Opening a class clears both professor badges.
- [ ] **P1** New feedback appears without manual refresh.
- [ ] **P1** Seen/unread state is per device.
- [ ] **P2** Clock/timezone changes do not create permanent false badges.

---

## 16. Admin web console

- [ ] **P0** Admin console runs on 5174.
- [ ] **P0** `npm --prefix admin-web run build` passes.
- [ ] **P0** Admin sign-in works.
- [ ] **P0** Student/professor accounts see “Not authorized”.
- [ ] **P0** Dashboard shows users, professors, admins, classes, active invites.
- [ ] **P0** User search works.
- [ ] **P0** Role filter works.
- [ ] **P0** Changing role updates badge and database.
- [ ] **P0** Self role select disabled.
- [ ] **P1** Professor with classes cannot be demoted.
- [ ] **P1** Last admin cannot be demoted.
- [ ] **P1** Classes table shows professor/join code/counts.
- [ ] **P1** Copy join code works.
- [ ] **P1** Create professor invite with note/lifespan/uses.
- [ ] **P1** Generated code/expiry/use count appear immediately.
- [ ] **P1** Copy invite code works.
- [ ] **P1** Revoke invite works.
- [ ] **P1** Invalid lifespan/use values show errors.
- [ ] **P2** Admin cannot read submissions/snapshots/pastes/code.

---

## 17. Security and data isolation

- [ ] **P0** `npm run test:rls` passes 41/41.
- [ ] **P0** Student sees only their own submissions/snapshots.
- [ ] **P0** Student never receives hidden test cases.
- [ ] **P0** Student cannot start a top-level comment on another student.
- [ ] **P0** Student can reply only in their own submission thread.
- [ ] **P0** Student cannot change a grade or `final_snapshot_id`.
- [ ] **P0** Private grade is absent from base submissions and `submission_grades`
      for students.
- [ ] **P0** Student cannot release a grade.
- [ ] **P0** Scheduled assignment invisible before publish time.
- [ ] **P0** Students cannot run paste similarity.
- [ ] **P0** Presence rows are visible only to owner/class professor.
- [ ] **P0** Invite table is admin-only; students cannot create/revoke/read.
- [ ] **P0** Professor invites expire/use up/revoke correctly.
- [ ] **P0** Renderer sandbox is enabled (`process` unavailable; `window.api` exists).
- [ ] **P0** Service-role key is not present in DevTools or bundles.
- [ ] **P1** External links open only http(s) in OS browser.
- [ ] **P1** CSP blocks remote scripts.
- [ ] **P1** Judge0 token not exposed to renderer.
- [ ] **P1** Admin role change guards work.
- [ ] **P1** RLS regression suite runs against the live project.

---

## 18. Accessibility, responsiveness, and resilience

- [ ] **P1** Keyboard navigation reaches primary actions.
- [ ] **P1** Escape closes modals.
- [ ] **P1** Focus returns to a sensible element after modal close.
- [ ] **P1** Diff/heatmap controls and timeline stops have accessible labels.
- [ ] **P1** Error boundary catches renderer crashes and offers Reload.
- [ ] **P1** File/Supabase errors show readable messages.
- [ ] **P1** Toasts appear for submit/rename/delete/queued actions.
- [ ] **P1** Layout works at a narrow window width.
- [ ] **P1** Live Lab cards wrap correctly.
- [ ] **P1** Invite form stacks on narrow admin viewport.
- [ ] **P2** Color is not the only status signal (labels accompany dots).

---

## 19. Release and artifact checks

- [ ] **P0** `package.json` version matches artifact version.
- [ ] **P0** Installer hash recorded in `dist/SHA256SUMS.txt`.
- [ ] **P0** README/QA/CHANGELOG describe the current build.
- [ ] **P0** Packaged app signs in and opens workspace files.
- [ ] **P0** Packaged app shows Diff/Authorship/Paste/Live Lab controls and the timeline.
- [ ] **P1** Admin `dist/` builds from a clean install.
- [ ] **P1** CI workflow runs lint/typecheck/tests/build.
- [ ] **P2** Unsigned-build warning is included in release notes.

### Current installer baseline

- Artifact: `dist/unicode-desktop-1.0.0-setup.exe`
- SHA-256:
  `36BDD335629533BFC2DE73C93D87EC32F69519B006FF84B36CFAA9BA735F1BA4`

---

## 20. Suggested demo runbook

1. Sign in as professor.
2. Show class cards and new-submission/reply badges.
3. Open CS101 → Fibonacci.
4. Open student3’s submission:
   - show the scrollable snapshot timeline;
   - toggle **Diff**;
   - click **Authorship** and show typing rhythm;
   - show **Paste detected** and 100% student2 match;
   - show grade box is private and release a grade.
5. Open **Live Lab** with a student signed in on another window.
6. Sign in as a student:
   - show new-grade chip;
   - open Details and clear it;
   - open workspace, edit/paste, show status and terminal;
   - submit an assignment.
7. Open admin console:
   - show user/role management;
   - generate a professor invite with lifespan/uses;
   - copy/revoke it.
8. Create a new account with the invite code; show professor routing.
9. Run `npm run test:rls` and mention 41/41.
