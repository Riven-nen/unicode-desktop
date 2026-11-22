# Unicode Lab QA Checklist

Scope: capstone demo readiness on Windows. **Judge0 execution and ICS formula
accuracy are out of scope** (both are still in progress). Everything else below
should pass before the demo.

## Test data

- Professors: `professor@unicode.test`, `professor2@unicode.test`,
  `professor3@unicode.test` / `Password123!`
- Admin: `admin@unicode.test` / `Password123!`
- Students: `student1@unicode.test` … `student10@unicode.test` / `Password123!`
- Classes: CS101 (6 students, 3 Python assignments), CS102 (3 students, 2
  Python assignments, one scheduled three days out), CS201 (Java, Professor
  Lin), CS301 (C++, Professor Ortega), HTML101 (6 students, 5 HTML lessons and
  a project, live local preview)
- Join codes: CS101 `CS101J4K`, CS102 `CS102P8Q`, CS201 `CS201R7A`,
  CS301 `CS301M2Z`, HTML101 `HTML101L5V`
- Demo grade state: student1 has a released Fibonacci grade, student2 has a
  private grade ready for the professor to release, student3 is ungraded
- Demo insight data: student3 has two paste events; student2 has a matching
  paste; all seeded snapshots include typing intervals
- Workspace: `C:\Users\<you>\Documents\Unicode Lab`
- If Judge0 is unavailable, turn **auto tests off** on demo assignments or
  ignore Test cases / Run tests; execution is not part of this pass.

## 1. Install, launch, and sign-in

- [ ] `npm install` and `npm run dev` start the app.
- [ ] `npm run build:win` produces `dist\unicode-desktop-1.0.0-setup.exe`.
- [ ] Installer installs per user and creates Start menu/desktop shortcuts.
- [ ] `dist\win-unpacked\unicode-lab.exe` launches the packaged app.
- [ ] Packaged app loads with no blank window and reports Electron/Chromium/Node
      versions in About.
- [ ] Sign-in rejects a wrong password with a readable error.
- [ ] Sign-up creates an account and shows the email-confirmation message when
      confirmation is enabled.
- [ ] Sign-in as student lands on the Student dashboard; professor lands on the
      Professor dashboard.
- [ ] An admin signing into the desktop app sees “Use the admin console”, not a
      student view.
- [ ] Forgot password sends a reset email for a real address; the reset form
      accepts a pasted recovery link or 6-digit code plus a new password.
- [ ] Reset rejects mismatched passwords and re-sign-in works with the new
      password.
- [ ] Refreshing/restarting restores the session.
- [ ] Sign out returns to the sign-in screen; no guest/editor access remains.
- [ ] No service-role key appears in DevTools, bundled files, or `.env` copies.

## 2. Student dashboard

- [ ] Welcome hero shows the student name and correct submitted/total summary.
- [ ] Five stats show correct values: Classes, Assignments, Submitted, Graded,
      Feedback.
- [ ] One card per enrolled class shows code, title, year & section, academic
      year, submitted progress, and feedback count.
- [ ] “N new assignments” chip appears for unseen assignments and clears after
      opening that class.
- [ ] A scheduled assignment stays hidden from students until its publish time;
      after that time it appears within a minute and gets a new-assignment chip.
- [ ] “N new grades” chips appear on the class card and assignment card after a
      professor release, and clear when the student opens Details.
- [ ] Unread Feedback badge counts professor comments and clears after opening
      Feedback.
- [ ] Clicking a class opens the class detail page, not the editor.
- [ ] Class detail shows class stats, progress, recent feedback, and that
      class’s assignment list.
- [ ] Back to All classes returns to the class grid.
- [ ] Refresh button reloads classes/assignments/feedback.
- [ ] Join class accepts a valid code (`CS102P8Q` for a student not already in
      CS102), shows the new class card, and creates its workspace folder.
- [ ] Invalid, lowercase-with-spaces, and archived-class codes show a readable
      error; joining an already-joined class says “You are already enrolled in…”
      and does not duplicate enrollment.
- [ ] The **Create account** form accepts an admin-generated professor code,
      switches the new account to the professor dashboard, and rejects
      invalid/expired/used codes.
- [ ] Empty class/assignment states are understandable.

## 3. Assignments and submissions

- [ ] Assignment card shows status, file, language, due date, late/past-due
      flags, description, and Details/Open file/Submit actions.
- [ ] Details opens a brief with instructions, starter code, due/submitted
      times, grade, and comment count.
- [ ] A grade saved privately by the professor stays hidden; the same assignment
      shows Graded and a New grade chip only after release.
- [ ] Open file opens the correct workspace file and switches to the editor.
- [ ] Submit asks for confirmation with the assignment title.
- [ ] Cancel leaves status and data unchanged.
- [ ] Confirm creates a submission, shows a success toast, and updates the card
      to Submitted/Graded.
- [ ] Resubmit creates a later submission; the latest one is shown.
- [ ] Submitted-after-due work shows a Late flag.
- [ ] Queued submission shows the queued banner, Queued status, and a disabled
      Submit button.
- [ ] Offline test: disable the network, submit, see it queued; re-enable and
      verify it sends once (no duplicate submission).

## 3A. Timed assessments and seatworks (Phase 1)

- [ ] Professor class page has Assignments and Seatworks tabs with separate
      counts and New actions.
- [ ] A new seatwork defaults to a timed live window; a take-home assignment
      stays untimed by default.
- [ ] Professor can set duration, opening time, hard cut-off, auto-submit, and
      show-timer; invalid seatwork timing is rejected.
- [ ] Assignment header shows type, duration/window, and auto-submit policy.
- [ ] Professor session monitor shows each student's status, start, deadline,
      last save, revision, and Review link.
- [ ] Student class page has Assignments and Seatworks tabs.
- [ ] Starting a seatwork opens the workspace with the draft and a countdown
      bar; changing the system clock does not extend the deadline.
- [ ] Edits autosave within 8 seconds; restarting the app and resuming returns
      the draft and the original deadline.
- [ ] Submit creates one submission with the live content and blocks a second
      attempt.
- [ ] Leaving work past the deadline auto-submits the latest saved draft.
- [ ] Starting a second timed assessment while one is active is blocked.
- [ ] Timed submissions flow into the normal review, grading, ICS, comments,
      and similarity views.

## 3B. HTML class and live preview

- [ ] HTML101 appears for student1–student6 with five HTML lessons and a
      profile-page project.
- [ ] Opening an HTML lesson opens its file and shows the **Preview** tab.
- [ ] The preview starts on a loopback port and updates after typing.
- [ ] Preview and terminal toggle cleanly; closing the file stops the server.
- [ ] A linked CSS file in the class folder loads in the preview.
- [ ] Refresh and Browser actions work.
- [ ] HTML/CSS assignments show no Judge0 Test cases tab.
- [ ] Seatwork settings expose allowed interruptions, fullscreen, paste block,
      and run-only terminal.
- [ ] First allowed tab-out/fullscreen exit warns; the next auto-submits.
- [ ] Paste and drag-drop are blocked during a seatwork.
- [ ] Run-only terminal disables shell input but keeps Run file.
- [ ] Professor +5m and Excuse actions update the student and leave an audit note.
- [ ] Monitor updates over Realtime without pressing Refresh.
- [ ] Events opens the session timeline and CSV export works.
- [ ] Override modal supports extend, excuse, and reopen with a reason.
- [ ] Reopening a submitted attempt gives a new deadline and allows another
      submission.
- [ ] Seatwork ICS marks paste N/A.
- [ ] A 2-attempt seatwork allows attempt 2 and rejects attempt 3.
- [ ] Attempt history appears on student cards/details and professor monitor.
- [ ] One-time override code can be generated, redeemed once, and expires.
- [ ] Exam templates save/apply; bulk policy updates all class seatworks.
- [ ] Monitor filters and class exam overview show correct totals.
- [ ] WEB102 appears with four CSS/JS assignments and join code `WEB102C4S`.
- [ ] The project opens `profile-project/index.html` and creates that folder.
- [ ] New Folder creates nested project folders that persist after refresh.
- [ ] Add Images copies images into the selected folder; duplicates get a
      numeric suffix.
- [ ] Images appear in the tree and open in the system viewer when clicked.
- [ ] Project previews load linked CSS, JS, and images from the same folder.

## 4. Workspace and files

- [ ] Workspace is fixed to `Documents\Unicode Lab`; no folder picker exists.
- [ ] Class folders are created for each enrollment.
- [ ] File tree lists course folders and files in each folder.
- [ ] Create a file inside a course folder; it appears on disk and in the tree.
- [ ] Open a file from the tree; the correct content and tab open.
- [ ] Rename a file inline (Enter commits, Escape cancels); open tab and tree
      update.
- [ ] Deleting a file asks for confirmation, removes it from disk/tree, and
      closes its tab.
- [ ] Refresh Workspace reflects external file changes.
- [ ] Sidebar resize works; collapse animates to the icon rail and re-expands
      without moving the folder icon.
- [ ] Opening a class from the dashboard focuses/expands that class folder.
- [ ] Sidebar Outline shows Python/Java/C/C++ symbols and syntax diagnostics;
      clicking a symbol jumps to the line.
- [ ] Files outside the workspace cannot be read by path (only via Open File
      dialog).

## 5. Editor and tracking

- [ ] Tabs open/close, dirty dots appear, and closing a dirty tab prompts
      Save / Don’t Save / Cancel.
- [ ] Save (`Ctrl+S`) writes to disk; Save As (`Ctrl+Shift+S`) writes a new file.
- [ ] New File and Open File dialogs work.
- [ ] Export File downloads the current content.
- [ ] Monaco syntax highlighting works for Python, Java, C/C++, Markdown, JSON,
      and plain text.
- [ ] Themes, fonts, ligatures, word wrap, minimap, and line numbers apply.
- [ ] Find/replace, undo/redo, cut/copy/paste, comment toggle, and select-all
      work from menu and shortcuts.
- [ ] Command palette (`Ctrl+Shift+P`) and quick open (`Ctrl+P`) work.
- [ ] Python diagnostics show syntax errors, undefined names, and an OK state;
      they update as you type, including in files opened from disk after the
      editor starts.
- [ ] Python type errors (wrong assignment, wrong argument type) appear after a
      short pause; Pyright is bundled, so no extra install is needed.
- [ ] Python completion after `name.` offers string methods, hover shows the
      inferred type, and F12 jumps to a local definition.
- [ ] Java files show syntax squiggles and a class/method outline. With a JDK
      installed, an undefined variable is also flagged after a short pause.
- [ ] C/C++ files show syntax squiggles and a function/class outline. With GCC
      installed, compiler errors are added; without it, the status bar labels
      the check as syntax-only.
- [ ] Autocomplete/hover for local symbols and builtins works in Python.
- [ ] HTML `!` offers `!DOCTYPE` and expands to a full document skeleton.
- [ ] HTML `<div>` auto-closes; void tags like `<br>` and `<img>` do not.
- [ ] HTML snippets for CSS links, scripts, images, links, forms, and tables
      appear.
- [ ] Edits create snapshots; the status bar count updates.
- [ ] Paste creates a paste event and increments the paste count.
- [ ] Offline edits queue and sync when the connection/session returns.
- [ ] Status bar shows file, language, cursor, snapshots, pastes, sync state,
      and toolchain status.

## 6. Terminal and local run

- [ ] Terminal is always visible and starts in the workspace root.
- [ ] Prompt and caret are inline; typing, Enter, Up/Down history, and `Ctrl+L`
      work.
- [ ] Clear and Restart behave correctly.
- [ ] Terminal stays visible when Test cases is opened as a side panel.
- [ ] Toolchain chip matches the active file (`ready` / `missing`).
- [ ] Missing toolchain shows a banner naming the missing command, an install
      hint, and a disabled Run file button.
- [ ] Recheck updates the chip after installing a toolchain.
- [ ] Python file: Run file executes and prints output.
- [ ] JavaScript/TypeScript file: Run file executes with `node`.
- [ ] Java file: Run file compiles with `javac` then runs with `java`.
- [ ] C/C++ file: Run file compiles then runs.
- [ ] Go/Rust/Ruby/PHP/Swift/Kotlin files: Run file works when installed.
- [ ] C# file runs through `dotnet run` on .NET 10+; otherwise the error is
      readable.
- [ ] PowerShell script runs via Run file.
- [ ] Markdown/JSON/SQL/HTML files show no Run button.
- [ ] Running a missing toolchain from a stale state blocks with a terminal
      message rather than a silent failure.

## 7. Feedback and notifications

- [ ] Student feedback modal groups comments by submission with submitted time
      and grade (or Not graded).
- [ ] Professor comments and student replies are labelled; line anchors show.
- [ ] Reply composer posts a student reply into the same thread.
- [ ] Cancel clears the composer; sending refreshes the thread.
- [ ] Unread feedback badge excludes the student’s own replies.
- [ ] New feedback appears without a manual refresh (realtime).
- [ ] Professor class card shows “N new student replies”; opening the class
      clears it.
- [ ] Professor class card shows “N new submissions”; opening the class clears
      it, and a later submission brings it back.
- [ ] Realtime badge counts stay correct after clock/timezone changes.

## 8. ICS demo (display only)

> Formula values are in progress; test the interaction and clarity, not whether
> the weights are final.

- [ ] ICS demo opens from the dashboard and class page.
- [ ] The demo editor is Monaco with Python syntax highlighting; typing and
      pasting still update the metrics.
- [ ] Typing updates the gauge, authorship metric, and event line.
- [ ] Pasting updates the paste metric, drops the score, and highlights Paste.
- [ ] Idling highlights Focus and lowers it.
- [ ] Reset clears the playground, metrics, and highlight.
- [ ] Compact layout works at a narrow window width.
- [ ] Copy clearly says the real score comes from submission telemetry.

## 9. Professor dashboard

- [ ] Class grid shows counts, archived toggle, and New class.
- [ ] Create/edit class with code, name, year & section, and academic year.
- [ ] Archive/restore and delete class with confirmation.
- [ ] Class page shows assignments and roster.
- [ ] Join code is visible; Copy puts it on the clipboard; Rotate asks for
      confirmation, issues a new code, and the old code stops working.
- [ ] New classes get a join code automatically.
- [ ] Manage students: add by email, remove, bulk import pasted emails/CSV,
      duplicate/invalid emails handled.
- [ ] Create/edit assignment: title, language, description, file name, starter
      code, publish time, due date, published/draft.
- [ ] A published assignment with a future publish time shows Scheduled in the
      professor view and stays hidden from students.
- [ ] Assignment archive/restore/delete with confirmation.
- [ ] Auto-test toggle saves (execution itself excluded).
- [ ] Test case management: add, hide/show, delete (execution excluded).
- [ ] Submissions table loads, sorts by ICS/time, filters Pass/Review/Flag.
- [ ] Submission CSV export downloads with the visible rows.
- [ ] Submission detail opens: read-only code, snapshot timeline, comments,
      grade box, ICS panel.
- [ ] Paste audit lists every paste with its full text and timestamp.
- [ ] `npm run prune:snapshots -- --days 0` is a dry run; `--apply` removes only redundant auto snapshots.
- [ ] A pruned submission keeps its ICS and cannot be recomputed.
- [ ] Admin ICS metric saves a new version and the preview reflects the weights.
- [ ] Re-applying the metric re-scores v3 rows but leaves v2 rows unchanged.
- [ ] Local terminal opens for the selected snapshot in a temporary directory;
      Run file uses the local toolchain, shows output, and closing it removes
      the temporary copy.
- [ ] Add a line-anchored comment; reply to it; grade numeric updates.
- [ ] Saving a grade marks it Private; Release to student makes it visible;
      Hide from student removes it again.
- [ ] Assignment view shows the unreleased count and **Release grades** releases
      every saved grade in one action.
- [ ] Submissions table shows grade values with a private marker until release.
- [ ] **Diff** compares the selected snapshot with the previous one and shows
      green additions and red deletions; snapshots after the first enable it.
- [ ] The snapshot timeline scrolls horizontally when needed and keeps the
      selected snapshot visible.
- [ ] Clicking **Typing rhythm** opens the heatmap with points, median, longest
      pause, and an empty state for old submissions.
- [ ] The ICS panel shows the v3 evidence ledger, confidence, and band reason.
- [ ] Student3’s flagged submission shows **Paste detected** and a cross-student
      paste match with student2.
- [ ] **Live lab** opens from the dashboard/nav, shows active students with the
      current file, and updates over Realtime.
- [ ] Live Lab shows idle students in red, recent pastes in yellow, and
      heartbeats older than 90 seconds as offline.
- [ ] Class-wide **Export grades** downloads a CSV with one row per student ×
      assignment (due, late, grade, ICS, band, comments).
- [ ] Assignment analytics shows submitted/enrolled, late, averages, and band
      distribution.
- [ ] Recomputing a normally typed submission gives a passing v3 score with
      sufficient confidence.
- [ ] A long thinking pause does not lower the score.
- [ ] A short session shows `review — limited evidence`.
- [ ] **P1** A stall mid-line does not raise the score.
- [ ] Demo **Start/Stop** stores a labelled run with a score timeline; **Copy JSON** exports it and **Copy keylog** exports events.
- [ ] The snapshot timeline scrolls horizontally when needed, with large
      clickable dots and the selected snapshot kept in view.
- [ ] Cross-student similarity shows pairs at the selected threshold, score
      bars, and Inspect opens a submission.
- [ ] Realtime refresh updates submissions/comments/assignments without reload.

## 10. Security and data isolation

- [ ] `npm run test:rls` passes 41/41.
- [ ] Student sees only their own submissions and snapshots.
- [ ] Student view masks a private grade and reveals it only after release.
- [ ] Student cannot read `submission_grades`, and the base submission row holds
      no private grade value.
- [ ] Student cannot release a grade; a scheduled assignment is invisible before
      its publish time.
- [ ] Students cannot run the paste-similarity RPC.
- [ ] Presence rows are readable only by the student and their class professor.
- [ ] Typing intervals only reach the class professor through submission access.
- [ ] Student never receives hidden test cases.
- [ ] Student cannot start a top-level comment or comment on another student.
- [ ] Student can reply inside a thread on their own submission.
- [ ] Student cannot change a grade or `final_snapshot_id`.
- [ ] Professor sees only their own classes/students.
- [ ] Realtime delivers only rows the user is allowed to read.
- [ ] Renderer is sandboxed (`process` undefined; `window.api` present).
- [ ] External links open in the OS browser; non-http(s) links are rejected.
- [ ] CSP blocks remote scripts.

## 11. Installer and release

- [ ] Installer version/name matches `package.json`.
- [ ] Shortcuts, uninstall entry, and app icon appear.
- [ ] Unsigned SmartScreen warning is documented.
- [ ] Packaged app signs in, opens Documents workspace, and loads class files.
- [ ] Packaged app can open About and shows runtime versions.
- [ ] `dist/SHA256SUMS.txt` matches the installer.
- [ ] CHANGELOG and README installer section are current.

## 12. Help, appearance, and error handling

- [ ] Keyboard Shortcuts modal opens/closes (Escape works).
- [ ] About shows version and runtime versions.
- [ ] Report an Issue opens the browser.
- [ ] Theme switching updates editor and UI; persists after restart.
- [ ] Font/size/ligature changes apply and persist.
- [ ] Toasts appear for submit/rename/delete/queued-submission actions.
- [ ] Renderer crash shows the error boundary with Reload/Copy details.
- [ ] File-system and Supabase errors show readable messages.

## 13. Admin web console (`admin-web/`)

- [ ] `cd admin-web`, copy `.env.example` to `.env`, `npm install`, `npm run dev`
      starts on port 5174.
- [ ] `npm run build` produces a static `admin-web/dist` with no TypeScript
      errors.
- [ ] `admin@unicode.test` signs in and sees the dashboard.
- [ ] Student/professor accounts see “Not authorized”.
- [ ] Stats show users, professors, admins, classes, and active invites.
- [ ] User search and role filter work.
- [ ] Changing a student to professor and back updates the badge and database.
- [ ] An admin cannot change their own role (select is disabled).
- [ ] Demoting a professor who owns classes is rejected with the guard message.
- [ ] The last admin cannot be demoted.
- [ ] Generate a professor invite with a note, lifespan in hours/days, and max
      uses; the new code, expiry, and uses appear immediately.
- [ ] Copy puts the invite code on the clipboard; the invite list shows Active,
      Used up, Expired, and Revoked statuses.
- [ ] Revoke stops the code from working.
- [ ] Invalid lifespan/use values show a readable error.
- [ ] Classes table shows professor, join code, student count, and assignment
      count; Copy join code works.
- [ ] Admin RLS cannot read submissions, snapshots, paste events, or code.
- [ ] Students/professors cannot read, create, or revoke professor invites.

## Excluded from this pass

- Judge0 execution: Run tests, execution history, Judge0 settings, live
  compilation term.
- ICS formula/weights and whether a band is “correct”; only UI/plumbing is in
  scope.
- Automated end-to-end UI tests (not implemented yet).

## Known gaps / not production-ready

- Email-verification UI and account settings/profile management.
- Admin console covers role changes, professor invite codes, and class review: no bulk user creation, class reassignment, or submission access.
- Admin web hosting, SSO, and audit-log export are not set up.
- Join codes and professor invite codes are shared out-of-band (no email delivery); attempts are not rate-limited.
- Password reset requires pasting the recovery link/code (no deep link).
- Code signing, auto-update channel, crash reporting, and telemetry.
- Privacy policy, terms, data export/delete, retention, FERPA/GDPR posture.
- Rate limiting and a full audit log for grades/comments/roles.
- Accessibility audit and modal focus trapping.
- Local terminal/Run file execute with user privileges; needs an admin policy
  or sandbox for shared lab machines.
- Offline queue has no inspect/retry/remove UI; capped at 5 entries.
- Seen/unread state is per device; no cross-device sync.
- Similarity/analytics run client-side; fine for a class, not a department.
- Python type diagnostics come from bundled Pyright, but completion/hover are
  still local-symbol based. Java/C++ use local compilers, not language servers
  (no code actions, refactors, semantic tokens, or clangd inspections).
- macOS/Linux builds are untested.
- Installer uses the stock Electron icon.
- C# Run file depends on .NET 10 file-based apps.
- Compiled runs may leave `.exe`/`.class`/`.jar` artifacts next to the source.
- No live Judge0 endpoint; no E2E UI test suite.
