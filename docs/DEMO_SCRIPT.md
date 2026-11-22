# UniCode Demo Script — Exam Integrity and Grading

**Target runtime:** 13:30–14:30  
**Narrators:** Mau (lead), Ella, CJ, Laurence  
**Focus:** exam mode, suspicious-activity review, and faster grading.  
**Tone:** Short sentences, conversational, light jargon. Do not read the UI.

---

## Before recording

Prepare three signed-in sessions:

- **Student:** `student1@unicode.test`
- **Professor:** `professor@unicode.test`
- **Admin:** `admin@unicode.test`

Have these ready:

- CS101 with a roster and assignments.
- An **Exam Mode Demo** seatwork:
  - 5-minute duration
  - **2 allowed interruptions**
  - fullscreen required
  - paste blocked
  - run-only terminal
  - one attempt
- One scheduled seatwork for the countdown modal.
- One submitted seatwork with snapshots, a paste event, and a computed ICS.
- One active session for the professor monitor.
- Admin console open on the ICS metric panel.

**Do not demo:**

- Live Judge0 runs — the external endpoint is not reliable.
- C++ compilation if `g++` is unavailable.
- The installer or SmartScreen warning.
- MCQ quizzes — not implemented.
- The old student ICS demo — it lives in the admin console now.

---

## Run of show

| Time        | Segment                                                | Lead           | Main screen                |
| ----------- | ------------------------------------------------------ | -------------- | -------------------------- |
| 0:00–4:45   | Student experience and exam mode                       | Mau + Ella     | Student desktop app        |
| 4:45–9:45   | Professor monitoring, grading, and suspicious activity | Mau + CJ       | Professor desktop app      |
| 9:45–13:15  | Admin console and metric                               | Mau + Laurence | Admin web console          |
| 13:15–13:45 | Recap                                                  | Mau            | Split screen or title card |

---

# Segment 1 — Student Experience and Exam Mode

### 0:00 — Opening

**SCREEN:** Student dashboard.

**MAU:**  
“This is UniCode — a desktop lab for programming coursework. Three sides: student, professor, and admin. We’ll start with the student, then show how the professor uses the same data for grading and exam integrity.”

### 0:25 — Dashboard

**SCREEN:** Point to class cards and stats.

**ELLA:**  
“After sign-in, the student sees their classes, submissions, grades, and feedback in one place.”

**SCREEN:** Click **CS101**, then open one assignment’s **Details**.

**ELLA:**  
“Assignments hold the instructions, starter code, due date, and attempts. Seatworks are separate because they’re in-person and timed.”

### 1:00 — Workspace

**SCREEN:** Open a class file. Show the tree, tabs, and Monaco editor.

**MAU:**  
“The workspace uses real files on disk. Monaco gives syntax highlighting, and the file tree follows the class folders.”

**SCREEN:** Open `hello.py` and click **Run file**. Show output.

**MAU:**  
“Python runs locally. No upload step needed just to test the code.”

### 1:45 — HTML preview

**SCREEN:** Open an HTML file and show the live preview.

**ELLA:**  
“For web lessons, the preview updates from the editor. Relative CSS and images work because the class folder is served locally.”

### 2:15 — Enter exam mode

**SCREEN:** Go to **Seatworks**, open **Exam Mode Demo**, click **Start seatwork**. Show the assessment bar.

**MAU:**  
“This is exam mode. The timer is server-owned. The client only displays it, so changing the system clock does not add time.”

**SCREEN:** Point to the fullscreen requirement. If fullscreen opens, exit it after a second.

**MAU:**  
“The professor can require fullscreen, block paste, and restrict the terminal to running files only. Those settings are snapshotted when the attempt starts.”

### 2:50 — Tab-out warning

**SCREEN:** Switch to another window for about three seconds, then return.

**MAU:**  
“I just left the exam window. UniCode records that as an interruption and shows a warning. This demo allows two interruptions. The third one submits the attempt automatically.”

**SCREEN:** Let the warning modal show. Close it. Point to the interruption counter.

**MAU:**  
“The warning is immediate, and the professor sees the same event in real time.”

### 3:30 — Paste block and run-only terminal

**SCREEN:** Try to paste into the editor. Show the blocked toast. Then show the terminal with shell input disabled.

**MAU:**  
“Paste is blocked during the seatwork, and the terminal is run-only. The student can still run the file, but cannot type arbitrary shell commands.”

### 3:55 — Autosave and scheduled countdown

**SCREEN:** Type a few characters. Point to the draft indicator. Then open the scheduled seatwork and click **Starts in …**.

**MAU:**  
“Drafts save every ten seconds, again five seconds before the deadline, and when the window is hidden. If the app closes, the same attempt and deadline come back.”

**SCREEN:** Show the countdown modal ticking.

**MAU:**  
“A scheduled seatwork is still pressable. It opens a live countdown. Start unlocks when the server window opens.”

### 4:25 — Submit and feedback

**SCREEN:** Open a submitted assignment or the feedback panel.

**ELLA:**  
“Submissions keep the snapshot history. Grades and feedback come back in the same dashboard.”

**MAU:**  
“Now the professor side — where this becomes useful for marking and integrity review.”

---

# Segment 2 — Professor Monitoring, Grading, and Suspicious Activity

### 4:45 — Professor dashboard

**SCREEN:** Professor window. Show class grid and roster.

**MAU:**  
“The professor sees only their classes. Each class has a roster, join code, assignments, and seatworks.”

### 5:10 — Creating work

**SCREEN:** Open **New Seatwork**. Show title, language, starter code, duration, attempts, and exam controls.

**CJ:**  
“Creating a seatwork is a short form: duration, attempts, fullscreen, paste block, and run-only terminal. Templates and a bulk class policy keep the settings consistent.”

**SCREEN:** Close without saving.

### 5:45 — Live monitor

**SCREEN:** Open CS101, then the **Exam Mode Demo** monitor.

**MAU:**  
“This is the live monitor. It shows who is active, their attempt, deadline, interruptions, and blocked pastes.”

**SCREEN:** Point to the student’s row: interruption 1 of 2, blocked paste count.

**MAU:**  
“The interruption from the student demo is already here. The professor can see it while the exam is still running, not after the fact.”

**SCREEN:** Click **Refresh** and let the icon spin.

**MAU:**  
“Realtime updates handle most changes. Refresh gives manual feedback while it reloads.”

### 6:30 — Event timeline

**SCREEN:** Click **Events** on the same session.

**MAU:**  
“Events gives the full timeline: tab-outs, warnings, fullscreen exits, blocked paste, overrides, and auto-submits. It exports to CSV.”

**SCREEN:** Point to the tab-out and warning entries.

**MAU:**  
“This is the difference between ‘the student looked away’ and ‘here is exactly when it happened and what the system did about it.’”

### 7:00 — Override and one-time code

**SCREEN:** Close the timeline. Click **Override** or **Code** on the session.

**MAU:**  
“The professor can extend time, excuse an interruption, or reopen an attempt. Every override has a reason and an audit entry.”

**SCREEN:** Generate a one-time code and show it.

**MAU:**  
“A one-time code lets the student apply the exception themselves. It expires, works once, and is logged.”

### 7:45 — Grading workflow

**SCREEN:** Open **Submissions**, then one submission. Show the final snapshot, timeline, and diff.

**CJ:**  
“Review starts at the final snapshot. The timeline shows how the work was built, and the diff compares two stops.”

**SCREEN:** Add a short line comment.

**CJ:**  
“Comments are line-anchored. Grades stay private until the professor releases them, so marking can happen before students see the result.”

### 8:30 — Suspicious activity review

**SCREEN:** Point to the **Integrity Score** panel, then scroll to the **Paste audit**.

**MAU:**  
“This is the suspicious-activity view. The score is an evidence ledger: authorship raises it; paste, transcription shape, rhythm, and away patterns lower it. Confidence gates the band.”

**SCREEN:** Show the paste audit entries with full text and timestamps.

**MAU:**  
“Every paste is visible — the full text, when it happened, and which file. That is much more useful than a single number.”

**SCREEN:** Show the class **Exam overview** or analytics totals.

**MAU:**  
“At class level, the professor can see attempts, interruptions, blocked pastes, and overrides across the whole class. That helps spot patterns without opening every file.”

**MAU:**  
“Important: this is a review aid, not proof. The system surfaces evidence. The professor makes the judgment.”

### 9:30 — Transition

**MAU:**  
“The professor handles teaching, monitoring, and review. Account management and the global metric live in the admin console.”

---

# Segment 3 — Admin Console

### 9:45 — Admin console

**SCREEN:** Admin browser. Show accounts and roles.

**MAU:**  
“The admin console is a separate web app on the same backend. It is not part of the desktop bundle.”

### 10:10 — Accounts and roles

**SCREEN:** Search a user, show the role dropdown.

**MAU:**  
“Admins manage accounts and roles. Guards prevent changing your own role or demoting the last admin.”

### 10:30 — Classes and join codes

**SCREEN:** Scroll to **Classes**.

**LAURENCE:**  
“Admins can review every class, see the professor, and copy the join code students use to enroll.”

### 10:50 — ICS metric

**SCREEN:** Scroll to **ICS metric**. Drag **Authored weight**, then **Paste**. Point to the changing hint and band map.

**MAU:**  
“This is the global metric. These sliders control score composition, negative evidence weights, and band thresholds.”

**MAU:**  
“Each slider explains its effect as it moves. The band map shows Flag, Review, and Pass with preview scores.”

**SCREEN:** Click **Save settings**, then point to **Apply to existing v3 scores**.

**MAU:**  
“Saving creates a version. Re-applying re-scores stored v3 evidence without reading student code. Legacy v2 rows stay unchanged.”

### 11:45 — ICS demo

**SCREEN:** Click **ICS demo**. Type or paste a few lines.

**LAURENCE:**  
“The demo is an admin-only playground. It uses the live metric version, so admins can test a change before applying it.”

**SCREEN:** Point to the gauge, ledger, and timeline.

**LAURENCE:**  
“The gauge, evidence ledger, and score timeline update live. Saved runs keep a scenario and keylog for comparison.”

**SCREEN:** Close the demo.

### 12:30 — Security boundary

**SCREEN:** Return to the dashboard.

**MAU:**  
“The boundary is deliberate. Admins manage accounts, classes, and the metric, but cannot read submissions, snapshots, paste events, or source code.”

**MAU:**  
“That is enforced with Row-Level Security and guarded database functions, not just hidden buttons.”

### 13:00 — Recap

**SCREEN:** Split screen or title card.

**MAU:**  
“Students learn and submit. Professors monitor the exam, review evidence, and grade faster. Admins manage access and tune the metric.”

**MAU:**  
“The integrity score supports review. It does not replace professor judgment.”

**MAU:**  
“That’s UniCode.”

---

## Narration notes

- Keep each line short. Pause after clicks.
- Let warnings and counters land before explaining them.
- Use only Python and HTML in the recording.
- Do not say “caught cheating” or “proof.” Say “signals,” “evidence,” and “review aid.”
- If a label differs slightly, follow the visual intent instead of reading it word-for-word.
- Mau carries the exam-mode, grading, ICS, metric, and security explanations. Ella, CJ, and Laurence take the easier visual features.
