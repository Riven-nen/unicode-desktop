# Unicode Lab in Plain English

This guide explains what Unicode Lab is, who uses it, what it can do, and what is
still incomplete — without requiring a technical background.

---

## 1. What is Unicode Lab?

Unicode Lab is a desktop app for programming classes.

Students write real code in real files on their computer. The app quietly records
how the code changes over time, including pastes and typing rhythm. Professors
then get a review screen that shows not just the final answer, but how the student
arrived at it.

There is also a separate admin website for managing accounts, roles, classes, and
professor invitation codes.

In one sentence:

> **Unicode Lab is a programming classroom workspace with automatic edit history,
> integrity clues, and a professor review dashboard.**

---

## 2. The three users

| User          | What they use        | What they do                                                                                                 |
| ------------- | -------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Student**   | Desktop app          | Join classes, write code, run it locally, submit assignments, read feedback, see released grades             |
| **Professor** | Desktop app          | Create classes and assignments, review submissions, compare versions, grade, release grades, monitor the lab |
| **Admin**     | Separate web console | Manage users and roles, review classes, create professor invite codes                                        |

---

## 3. The big idea

Most learning platforms only see the final submitted file. That makes it hard to
tell whether a student:

- wrote the code themselves over time;
- pasted a large block from somewhere else;
- copied from a classmate;
- struggled, edited, and gradually improved.

Unicode Lab records evidence of the process:

- **Snapshots** — automatic copies of the code as it changes.
- **Paste events** — when text is pasted in, with the pasted text saved.
- **Typing rhythm** — the gaps between edits, which can suggest fast copying or
  normal thinking pauses.
- **Similarity checks** — whether two students’ pasted text or final code looks
  unusually alike.
- **Timeline and diff views** — a professor can move through snapshots in order or
  compare one version to the next.

These are **review clues**, not automatic proof of cheating. The professor makes
the final judgment.

---

## 4. What students can do

### Getting started

- Create an account or sign in with email and password.
- In development, a new account can enter immediately.
- In production, the account must confirm its email address first.
- Reset a forgotten password with a recovery link or code.
- Join a class with a short join code from the professor.
- Redeem a professor invitation code if an administrator issued one.

### The student dashboard

- See all enrolled classes as cards.
- See counts for classes, assignments, submitted work, grades, and feedback.
- Open a class to see its assignments.
- See “new assignment”, “new grade”, and unread feedback badges.
- Open an assignment’s details, file, or submission controls.
- See released grades and professor feedback.
- Reply to professor comments inside the same feedback thread.

### The workspace

- Files live in a fixed folder: `Documents\Unicode Lab`.
- Each class gets its own folder.
- Students can create, open, rename, save, export, and delete files.
- A file tree, editor tabs, status bar, and collapsible sidebar are included.
- New files are written to the real disk, not hidden inside a browser.

### The editor

- Monaco editor with syntax colors, themes, fonts, and ligatures.
- Syntax checking and an outline panel for Python, Java, and C/C++. Python also
  gets type checking from Pyright plus completion and hover help; Java/C/C++ get
  local compiler checks when the toolchain is installed.
- Find/replace, command palette, and quick-open shortcuts.
- Automatic save prompts when closing unsaved files.

### Running code

- A built-in PowerShell terminal.
- A **Run file** button for supported languages.
- The app checks whether the compiler/runtime is installed.
- If something is missing, it says what to install instead of failing silently.
- Supported local runtimes include Python, JavaScript/TypeScript, Java,
  C/C++, C#, Go, Rust, Ruby, PHP, Swift, Kotlin, and PowerShell.
- Judge0 remote test execution is integrated, but needs a working Judge0 server.

### Submitting work

- Submit the current file to the professor.
- If the connection is down, the submission waits in a queue and tries again.
- Retries cannot accidentally create duplicate submissions.
- Students see submitted/queued/graded states and late/past-due flags.

### What students do **not** get

- They cannot change their own grades.
- They cannot see unreleased grades.
- They cannot see hidden test cases.
- They cannot comment on another student’s submission.
- They do not get a personal “time travel” restore screen; history is for
  professor review.

---

## 5. What professors can do

### Classes and students

- Create, edit, archive, restore, and delete classes.
- Add students by email, remove students, or bulk import a list.
- Share a join code; rotate it if it leaks.
- See unread student replies and new submissions on class cards.

### Assignments

- Create and edit assignments with a title, language, description, file name,
  starter code, published/draft state, due date, and optional future publish time.
- Schedule an assignment so students cannot see it until a chosen moment.
- Turn Judge0 auto-tests on or off.
- Add test cases and hide some from students.
- Archive, restore, or delete assignments.

### Reviewing submissions

- See a table of submissions with grade, integrity score, band, paste count, and
  comment count.
- Sort and filter the table, or export it as CSV.
- Open a submission and inspect:
  - the student’s code at any snapshot through the timeline;
  - the **Diff** between two versions;
  - the integrity score breakdown;
  - a typing-rhythm chart;
  - cross-student paste matches;
  - another similarity view based on final code structure;
  - comments, grade controls, and test-run history.

### Grading

- Save a grade privately.
- Release the grade when ready.
- Hide a released grade again if needed.
- Release all saved grades for an assignment at once.
- Export a class gradebook.

### Feedback

- Comment on a specific line of a submission.
- Reply inside threads.
- Students can reply back in the same thread.
- Unread badges show when replies or new submissions arrive.

### Live Lab

- A monitoring page showing students who are currently using the app.
- Green = active.
- Red = idle.
- Yellow = flagged because of a recent paste.
- Grey = offline.
- Shows the student’s current file and how long they have been idle.

---

## 6. What admins can do

The admin console is a separate website, not part of the desktop app.

Admins can:

- sign in with an admin account;
- search and filter users;
- change a user’s role;
- prevent unsafe changes such as demoting the last admin;
- review classes, professors, join codes, student counts, and assignment counts;
- create professor invitation codes;
- choose how long a code lasts (hours or days);
- choose how many people can use it;
- copy or revoke a code;
- adjust the global ICS metric (weights, score range, band thresholds) with a
  live preview;
- re-apply the metric to stored v3 scores without reading student code;
- open the live ICS demo to type or paste and see the current metric react.

Admins **cannot** read student submissions, code, snapshots, paste events, or
grades. Their access is intentionally limited.

---

## 7. How professor invitations work

1. An admin opens the admin console.
2. The admin creates an invite with a lifespan and usage limit.
3. The console generates a code such as `PROF-16B5-0C6E`.
4. The admin shares the code directly with the new professor.
5. The professor creates or signs in to a normal desktop account.
6. The professor enters the code in the **Professor invite code** field while creating their account.
7. The account becomes a professor account and the app switches to the professor
   dashboard.

Codes stop working when they expire, run out of uses, or are revoked.

---

## 8. How the integrity tools work — in plain terms

### Snapshots

Think of snapshots as automatic save points. The app does not wait for the
student to press Save. When the code settles after typing, it records a copy.

### Paste detection

The app notices when text is pasted in. It also notices very large sudden inserts
that probably came from a drag-and-drop or middle-click paste.

### Typing rhythm and authorship

The app records how edits unfold, not how fast someone types. A pause is not
treated as suspicious — people stop to think. What matters is what happens when
typing resumes: fixing a mistake, going back to an earlier line, or hesitating
in the middle of a line all count in the student's favour. Typing a complete,
perfect line in one go and never correcting anything looks like copying, and that
is the only pattern the score penalises. This is a clue, not a lie detector.

### Diff

The **Diff** button compares two versions. Green means added; red means removed.

### Paste similarity

If a pasted block in one student’s work closely matches a pasted block in another
student’s work in the same class, the professor sees a red **Paste detected**
badge and a similarity percentage.

### Token similarity

A second similarity view compares the structure of final code. It ignores some
renaming, so it can highlight suspiciously similar solutions.

### Integrity Confidence Score (ICS)

The ICS is a 0–100 review score that starts at 50 and moves only when there is
evidence:

- fixing mistakes, going back to earlier lines, and pausing inside a line raise
  it;
- novel paste, typing complete lines straight from a reference, machine-regular
  typing, and leaving the window then immediately typing lower it;
- short or thin sessions are held at **review** because there is not enough
  evidence;
- test results are shown separately as **quality**, not integrity.

It is shown as **pass**, **review**, or **flag**. It is a review aid, not a
verdict. A long thinking pause never lowers the score; copying a whole line at a
time is what holds a submission at review.

---

## 9. Privacy and security in plain terms

- Each user signs in before seeing class data.
- The database decides what each user can see; the app does not merely hide
  buttons.
- Students can only see their own submissions, snapshots, pastes, grades, and
  feedback.
- Professors can only see their own classes and students.
- Admins can see account and class information, but not student code or
  submissions.
- Private grades are stored in a professor-only place until released.
- Hidden test cases are filtered out for students.
- Scheduled assignments are invisible until their publish time.
- The service-role key (a powerful database key) is never included in the app.
- The app runs with Electron’s sandbox and a narrow bridge between the screen and
  the computer.
- Judge0 credentials stay in the desktop app’s main process, not the visible UI.

---

## 10. What is ready for the capstone demo

| Area                                                 | Status                                    |
| ---------------------------------------------------- | ----------------------------------------- |
| Student dashboard, classes, assignments, feedback    | Ready                                     |
| Workspace, file management, Monaco editor            | Ready                                     |
| Automatic snapshots, paste capture, typing intervals | Ready                                     |
| Local terminal, toolchain checks, Run file           | Ready                                     |
| Professor class/assignment management                | Ready                                     |
| Timeline, diff, typing heatmap, paste similarity     | Ready                                     |
| Grade save/release, bulk release                     | Ready                                     |
| Live Lab                                             | Ready                                     |
| Admin roles and professor invites                    | Ready                                     |
| Security rules and RLS checks                        | Ready                                     |
| Windows installer                                    | Ready, unsigned                           |
| Judge0 remote execution                              | Implemented, but needs an external server |
| Exact ICS formula accuracy                           | Implemented, but under review             |
| macOS/Linux packages                                 | Scripts exist, not validated              |

---

## 11. What is not finished or not included

- Emailing professor invitations (codes are shared manually).
- Rate limiting for join/invite attempts.
- Automated end-to-end UI tests.
- Single sign-on (SSO).
- Code signing and automatic updates.
- Crash reporting.
- Bulk user creation in the admin console.
- Reassigning a professor’s classes before demotion.
- Real-time collaboration.
- A mobile or browser version for students.
- A production-grade plagiarism verdict.
- Full keystroke logging.
- Cross-device notification sync.
- FERPA/GDPR legal policy pack.
- A final validated ICS formula.

---

## 12. Good demo path

1. Sign in as the professor.
2. Show the class cards and new-submission badges.
3. Open CS101 → Fibonacci.
4. Open student3’s submission.
5. Show **Diff**, then **Authorship** heatmap, then **Paste detected**.
6. Use the timeline to step through snapshots and show **Diff**.
7. Show the private grade and release it.
8. Open **Live Lab** while a student is signed in on another window.
9. Sign in as the student and show the new-grade chip.
10. Open the workspace, make an edit, paste something, and submit.
11. Open the admin console and create a professor invite.
12. Create a new account with the invite code and show the professor dashboard.
13. Run the automated checks and mention 59 unit tests and 41/41 RLS checks.

---

## 13. Plain-English glossary

| Term                    | Plain meaning                                                 |
| ----------------------- | ------------------------------------------------------------- |
| **Snapshot**            | An automatic copy of the code at a point in time              |
| **Paste event**         | A record that text was pasted in, including the pasted text   |
| **Typing rhythm / IKI** | The time gaps between edits                                   |
| **ICS**                 | Integrity Confidence Score, a 0–100 review aid                |
| **RLS**                 | Database rules that decide who can see which rows             |
| **RPC**                 | A controlled database action the app can request              |
| **Realtime**            | The app updates automatically when data changes               |
| **Judge0**              | An external service that runs code against test cases         |
| **Monaco**              | The code editor component used by the app                     |
| **Electron**            | The framework that turns the app into a desktop program       |
| **Supabase**            | The hosted database and login service                         |
| **Service-role key**    | A very powerful database key; never shipped in the app        |
| **Snapshot diff**       | A side-by-side/combined view of what changed between versions |
| **Live Lab**            | A professor’s live student-activity monitor                   |
| **Token similarity**    | A structural comparison of final code                         |
| **pg_trgm**             | A database tool for measuring text similarity                 |

---

## 14. One-paragraph summary for a non-technical reader

Unicode Lab is a desktop programming classroom that saves a student’s work as it
evolves, notices pastes and typing rhythm, and gives professors a clear review
screen with version comparisons, timeline navigation, similarity checks, grading, and a live
activity monitor. Students work in real files on their own computer, can run code
locally, submit assignments, receive feedback, and see grades when released.
Admins use a separate website to manage accounts and issue professor invitation
codes. The system is built around database-level privacy rules, so students only
see their own work and professors only see their own classes. The current build is
demo-ready for the Windows desktop app and admin console; remote Judge0 execution
and final ICS formula validation remain external or under review.
