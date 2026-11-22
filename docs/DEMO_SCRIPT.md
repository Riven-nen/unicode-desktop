# UniCode Demo Script — Exam Integrity and Grading

**Target runtime:** 14:30, 15:00 max  
**Narrators:** Mau (lead), Ella, CJ, Laurence  
**Focus:** exam mode, interruption keys, suspicious-activity review, and faster grading.  
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
  - **1 allowed interruption**
  - fullscreen optional — turn it off for recording stability, then show the
    checkbox in the professor segment
  - paste blocked
  - run-only terminal
  - one attempt
- One scheduled seatwork for the countdown modal.
- The seeded **Fibonacci** submissions:
  - Student One — 95.0, pass
  - Student Two — 79.6, review, one 156-character paste with a 100% match to
    Student Three
  - Student Three — 5.0, flag, two pastes and a line-chunk/away pattern
- Use the seeded **Fibonacci** submissions for the cases. Recent manual test files
  may contain extra paste noise.
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
| 0:00–3:45   | Student experience and first interruption              | Mau + Ella     | Student desktop app        |
| 3:45–10:45  | Professor key, second interruption, grading, and cases | Mau + CJ       | Professor desktop app      |
| 10:45–14:00 | Admin console and metric                               | Mau + Laurence | Admin web console          |
| 14:00–14:30 | Recap                                                  | Mau            | Split screen or title card |

### Case files at a glance

| Case | What it shows                           | Where to click                                                 |
| ---- | --------------------------------------- | -------------------------------------------------------------- |
| 1    | Full-code similarity, Student One/Two   | Assignment → **Cross-student similarity** → **Run similarity** |
| 2    | Paste similarity, Student Two/Three     | Student Two → **Paste similarity**                             |
| 3    | Paste-heavy flag with full pasted text  | Student Three → **Integrity Score** + **Paste audit**          |
| 4    | How the code changed between snapshots  | Student Two → **Timeline** → **Diff**                          |
| 5    | No paste, but a line-chunk/away pattern | Student Three → **Integrity Score** ledger                     |

---

# Segment 1 — Student Experience and First Interruption

### 0:00 — Opening

**SCREEN:** Student dashboard.

**MAU:**  
“This is UniCode — a desktop lab for programming coursework. Three sides: student, professor, and admin. We’ll follow one seatwork from starting it to grading it.”

### 0:20 — Dashboard

**SCREEN:** Point to class cards and stats.

**ELLA:**  
“After sign-in, the student sees their classes, submissions, grades, and feedback in one place.”

**SCREEN:** Click **CS101**, then open one assignment’s **Details**.

**ELLA:**  
“Assignments hold the instructions, starter code, due date, and attempts. Seatworks are separate because they’re in-person and timed.”

### 0:55 — Workspace

**SCREEN:** Open a class file. Show the tree, tabs, and Monaco editor.

**MAU:**  
“The workspace uses real files on disk. Monaco gives syntax highlighting, and the file tree follows the class folders.”

**SCREEN:** Open `hello.py` and click **Run file**. Show output.

**MAU:**  
“Python runs locally. No upload step needed just to test the code.”

### 1:35 — HTML preview

**SCREEN:** Open an HTML file and show the live preview.

**ELLA:**  
“For web lessons, the preview updates from the editor. Relative CSS and images work because the class folder is served locally.”

### 2:00 — Enter exam mode

**SCREEN:** Go to **Seatworks**, open **Exam Mode Demo**, click **Start seatwork**. Show the assessment bar.

**MAU:**  
“This is exam mode. The timer is server-owned. The client only displays it, so changing the system clock does not add time.”

**SCREEN:** Point to the exam controls in the bar or the assignment settings.

**MAU:**  
“The professor can require fullscreen, block paste, and restrict the terminal to running files only. I’ll keep fullscreen off for the recording and trigger a tab-out instead.”

### 2:30 — Paste block and run-only terminal

**SCREEN:** Try to paste into the editor. Show the blocked toast. Then show the terminal with shell input disabled.

**MAU:**  
“Paste is blocked, and the terminal is run-only. The student can run the file, but cannot type arbitrary shell commands.”

### 2:50 — Autosave and scheduled countdown

**SCREEN:** Type a few characters. Point to the draft indicator. Then briefly show the scheduled seatwork’s **Starts in …** countdown modal, and close it.

**MAU:**  
“Drafts save every ten seconds, again five seconds before the deadline, and when the window is hidden. A scheduled seatwork shows a live countdown until Start unlocks.”

**SCREEN:** Return to the active exam.

### 3:15 — First interruption

**SCREEN:** Switch to another window for about three seconds, then return.

**MAU:**  
“I just left the exam window. This demo allows one interruption. The attempt is now locked until the professor comes over and gives me a resume key. The timer keeps running.”

**SCREEN:** Show the interruption modal with the professor-key input. Point to the countdown.

**MAU:**  
“The next interruption will submit the attempt automatically. We’ll get the key from the professor side. No written explanation is stored — this is a physical intervention.”

---

# Segment 2 — Professor Key, Second Interruption, and Grading

### 3:45 — Professor dashboard

**SCREEN:** Professor window. Show class grid and roster.

**MAU:**  
“The professor sees only their classes. Each class has a roster, join code, assignments, and seatworks.”

### 4:10 — Creating work

**SCREEN:** Open **New Seatwork**. Show title, language, starter code, duration, attempts, and exam controls.

**CJ:**  
“Creating a seatwork is a short form: duration, attempts, fullscreen, paste block, and run-only terminal. Templates and a bulk class policy keep the settings consistent.”

**SCREEN:** Close without saving.

### 4:40 — Monitor and generate the key

**SCREEN:** Open CS101, then the **Exam Mode Demo** monitor. Point to the student’s interruption count.

**MAU:**  
“The student’s interruption is already here. The attempt is locked, and the timer is still running. I’ll generate a resume key.”

**SCREEN:** Click **Code**, choose **Resume after interruption**, and generate the key.

**MAU:**  
“The key is one-time, expiring, and tied to this session. I’ll copy it and give it to the student.”

### 5:25 — CUT BACK TO STUDENT: redeem the key

**SCREEN:** Student window with the interruption modal.

**MAU:**  
“The professor comes to the station and gives the key. The student enters it and continues. The intervention stays physical — nothing is typed into a confession box.”

**SCREEN:** Enter the key and click **Unlock and continue**.

**MAU:**  
“The attempt continues, but the interruption still counts. This was their one allowed interruption.”

### 6:00 — Second interruption auto-submits

**SCREEN:** Switch away from the exam window for about three seconds, then return.

**MAU:**  
“If they leave again, the next interruption submits the attempt automatically.”

**SCREEN:** Show the **Time is up** modal.

**MAU:**  
“That is the consequence. The draft is final, and later edits are not included.”

### 6:25 — CUT BACK TO PROFESSOR: audit trail

**SCREEN:** Professor monitor. Open **Events** on the session.

**MAU:**  
“This is the audit trail: the first tab-out, the resume key used, the second tab-out, and the auto-submit. It exports to CSV.”

**SCREEN:** Point to the **Resume key used** entry and the auto-submit entry.

**MAU:**  
“This is the difference between ‘the student looked away’ and ‘here is exactly when it happened, which key was used, and what the system did about it.’”

### 7:00 — Grading workflow

**SCREEN:** Open the auto-submitted submission. Show the final snapshot, timeline, and diff.

**CJ:**  
“Review starts at the final snapshot. The timeline shows how the work was built, and the diff compares two stops.”

**SCREEN:** Add a short line comment.

**CJ:**  
“Comments are line-anchored. Grades stay private until the professor releases them.”

### 7:45 — Case 1: full-code similarity run

**SCREEN:** From CS101, open the **Fibonacci** assignment. Scroll to **Cross-student similarity**. Click **Run similarity**.

**MAU:**  
“This is the full-code check, not the paste check. It compares the final snapshot of every student’s latest submission using shared token sequences. Student One and Student Two come back at **100%** — a structural copy.”

**SCREEN:** Point to the threshold selector and the **Inspect** buttons.

**MAU:**  
“Renaming variables doesn’t hide it, because identifiers are normalized. The threshold lets you tighten or loosen the list, and Inspect opens either submission.”

### 8:25 — Case 2: paste similarity

**SCREEN:** Open **Student Two’s Fibonacci submission**. Point to the **Paste similarity** panel.

**MAU:**  
“The paste check tells a different story. Student Two and Student Three share the same 156-character pasted block. Student Two pasted first; Student Three about a day later.”

**SCREEN:** Point to the match percentage and the two timestamps.

**MAU:**  
“Two similarity views, two different questions: who has the same final code, and who pasted the same text.”

### 9:00 — Case 3: paste-heavy flag

**SCREEN:** Open **Student Three’s submission**. Show the **Integrity Score** — 5.0, flag. Point to the evidence ledger.

**MAU:**  
“Student Three is flagged. The evidence ledger shows two large pastes and very little authored evidence. Confidence is low, but the signals agree.”

**SCREEN:** Scroll to the **Paste audit** and show both pasted blocks with full text.

**MAU:**  
“The paste audit shows the exact text of both blocks, the file, the size, and the timestamp. You are reading the pasted content, not guessing from a paste count.”

**SCREEN:** Select the paste snapshot on the timeline. Click **Diff** to compare it with the previous stop.

**MAU:**  
“The diff shows the block landing in one moment. That is much clearer than staring at the final file and wondering how it got there.”

### 9:40 — Case 4: snapshot history and the diff

**SCREEN:** Open **Student Two’s timeline**. Select the second stop, then click **Diff**.

**MAU:**  
“The snapshot history is the time machine. Pick a stop and see exactly what changed from the one before it.”

**MAU:**  
“Normal revision looks gradual — small edits, corrections, a little backtracking. A paste stop looks like a sudden block. The professor can tell the difference without reading every line from scratch.”

### 10:10 — Case 5: no paste, still suspicious

**SCREEN:** Return to Student Three’s **Integrity Score** panel. Point to the transcription and away evidence.

**MAU:**  
“Not every case has a paste. Student Three also shows a line-chunk transcription pattern after a refocus. That is a review signal, not proof.”

**SCREEN:** Show the class **Exam overview** or analytics totals.

**MAU:**  
“At class level, the professor can see attempts, interruptions, blocked pastes, and overrides across the whole class. That helps prioritize which files to open.”

**MAU:**  
“Important: this is a review aid, not proof. The system surfaces evidence. The professor makes the judgment.”

### 10:45 — Transition

**MAU:**  
“The professor handles teaching, monitoring, and review. Account management and the global metric live in the admin console.”

---

# Segment 3 — Admin Console

### 10:45 - Admin console

**SCREEN:** Admin browser. Show accounts and roles.

**MAU:**  
“The admin console is a separate web app on the same backend. It is not part of the desktop bundle.”

### 11:10 - Accounts and roles

**SCREEN:** Search a user, show the role dropdown.

**MAU:**  
“Admins manage accounts and roles. Guards prevent changing your own role or demoting the last admin.”

### 11:30 - Classes and join codes

**SCREEN:** Scroll to **Classes**.

**LAURENCE:**  
“Admins can review every class, see the professor, and copy the join code students use to enroll.”

### 11:50 - ICS metric

**SCREEN:** Scroll to **ICS metric**. Drag **Authored weight**, then **Paste**. Point to the changing hint and band map.

**MAU:**  
“This is the global metric. These sliders control score composition, negative evidence weights, and band thresholds.”

**MAU:**  
“Each slider explains its effect as it moves. The band map shows Flag, Review, and Pass with preview scores.”

**SCREEN:** Click **Save settings**, then point to **Apply to existing v3 scores**.

**MAU:**  
“Saving creates a version. Re-applying re-scores stored v3 evidence without reading student code. Legacy v2 rows stay unchanged.”

### 12:45 - ICS demo

**SCREEN:** Click **ICS demo**. Type or paste a few lines.

**LAURENCE:**  
“The demo is an admin-only playground. It uses the live metric version, so admins can test a change before applying it.”

**SCREEN:** Point to the gauge, ledger, and timeline.

**LAURENCE:**  
“The gauge, evidence ledger, and score timeline update live. Saved runs keep a scenario and keylog for comparison.”

**SCREEN:** Close the demo.

### 13:30 - Security boundary

**SCREEN:** Return to the dashboard.

**MAU:**  
“The boundary is deliberate. Admins manage accounts, classes, and the metric, but cannot read submissions, snapshots, paste events, or source code.”

**MAU:**  
“That is enforced with Row-Level Security and guarded database functions, not just hidden buttons.”

### 14:00 - Recap

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
- Let the interruption modal and the second tab-out land before explaining them.
- Use only Python and HTML in the recording.
- Do not say “caught cheating” or “proof.” Say “signals,” “evidence,” and “review aid.”
- If a label differs slightly, follow the visual intent instead of reading it word-for-word.
- Mau carries the exam-mode, key, grading, ICS, metric, and security explanations. Ella, CJ, and Laurence take the easier visual features.
