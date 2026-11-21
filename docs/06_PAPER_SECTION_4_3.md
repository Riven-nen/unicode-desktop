# 4.3 Implementation

## 4.3.1 Student Programming Environment

The student environment is a desktop application built with Electron, React, and
TypeScript. Monaco Editor provides the main code-editing surface. The
environment opens real files from the fixed workspace at
`Documents/Unicode Lab` and supports multi-file tabs, open/save/save-as, inline
rename, delete, editor themes, appearance and font settings, word wrap, minimap,
line numbers, a terminal panel, and a status bar.

The implemented editor features include syntax highlighting for Python, Java,
C/C++, JavaScript/TypeScript, and other supported file types. Python uses the
bundled Pyright language server for type-aware completion, hover,
go-to-definition, and type diagnostics; Java and C/C++ use Lezer outlines plus
syntax diagnostics and local `javac`/`gcc`/`g++` compiler checks when those
tools are installed. JavaScript and TypeScript use Monaco's bundled TypeScript
worker. The editor also shows an outline panel, a diagnostics count, and a
toolchain status indicator. Local **Run file** execution is available from the
terminal dock; Judge0 test-case runs are available when an endpoint is
configured.

The environment records selected authoring activity while students work on
their programs. This telemetry is described in Section 4.3.2. The student
workflow, editor features, and language support are catalogued in the
[feature master list](01_FEATURE_MASTER_LIST.md#5-editor-and-language-intelligence)
and the [technical overview](02_TECHNICAL_OVERVIEW.md#10-editor-and-language-intelligence).
The overall structure is summarized in the [system flow diagram](system-flow.png)
and the [Level 1 data flow diagram](data-flow.png). The platform and stack
requirements are listed in [Table 1](04_SYSTEM_REQUIREMENTS.md).

## 4.3.2 Authorship Telemetry

Authorship telemetry is recorded by the editor tracker as students write and
edit their programs. The records are queued locally before being written to
Supabase, so the capture path is not blocked by a slow or unavailable network.
The system records the following information:

- **Code snapshots.** An automatic snapshot is captured after 1.5 seconds of
  inactivity, with a minimum spacing of 10 seconds between automatic snapshots.
  Paste events, restores, and submissions force an immediate capture. Each
  snapshot stores the file content, version, snapshot type, character and line
  counts, language, and typing intervals.
- **Paste events.** Monaco's `onDidPaste` event records the pasted text and the
  exact range. A velocity heuristic also flags bursts of at least 120 inserted
  characters without a paste event, covering drag-and-drop, middle-click, and
  IME insertion. Each record stores the pasted text, character count, paste
  mode, and detection source. When the ICS is recomputed, pasted text that
  already appears in an earlier snapshot of the same submission is treated as
  an internal move and excluded from the paste term.
- **Typing timing.** The tracker stores intervals between content-change events
  when text is inserted. It does not save the actual keys pressed. Paste,
  undo/redo, and restore events are excluded, and intervals are clamped to
  20 ms–10 s with a cap of 800 intervals per snapshot.
- **Focus/activity.** The ICS focus signal is derived from snapshot timestamps:
  gaps of up to 2 minutes count as active time, and breaks longer than 30
  minutes are excluded from the session. The application does not record raw
  window focus/blur events. Separately, lightweight presence heartbeats update
  the professor's Live Lab with active, idle, or offline status; these are not a
  window-focus log.
- **Compilation/test activity.** Judge0 test-case results are stored in
  `code_runs`; the compilation term of the ICS uses the latest pass/fail result
  per test case, with a neutral value of 50 when no run exists. Local **Run
  file** attempts are not persisted as telemetry.
- **Manual snapshots and restores.** The snapshot data model still supports
  `manual` and `restore` types, but the student-facing history/restore browser
  was intentionally removed. Professors review the recorded history through the
  submission timeline and diff views.

These records let instructors examine the development process—code evolution,
paste behavior, typing rhythm, and test outcomes—rather than judging only the
final submitted code. The capture rules are documented in the
[tracking engine section](02_TECHNICAL_OVERVIEW.md#11-tracking-engine), and the
corresponding feature rows are in the
[telemetry section](01_FEATURE_MASTER_LIST.md#6-edit-tracking-snapshots-paste-analytics-and-typing-rhythm).

## 4.3.3 Backend and Data Storage

UniCode uses Supabase for authentication and managed PostgreSQL for persistent
storage. The clients communicate directly with Supabase using only the
publishable key; there is no custom application server. Authorization is
enforced in PostgreSQL through Row-Level Security (RLS) policies and
security-definer RPCs rather than being left to the client.

The main stored entities are user profiles and roles, classes, enrollments,
assignments, test cases, code snapshots, paste events, submissions, private and
released grades, ICS scores, comments and notifications, professor invite codes,
and Judge0 run records. Workspace source files remain on the student's local
disk; telemetry, submissions, grades, and review records are stored in
PostgreSQL. No separate object store is used.

RLS restricts students to their own submissions and private records, limits
professors to classes they teach, and gives administrators a separate
user/role/class management surface. The access rules and their regression
coverage are described in the
[technical overview](02_TECHNICAL_OVERVIEW.md#7-row-level-security-and-authorization)
and the [QA checklist](03_QA_CHECKLIST.md). The [Level 1 data flow diagram](data-flow.png)
shows the data stores and the RLS persistence boundary.

Offline editing is supported by local queues for snapshots, paste events, and
submissions. Queued records retry when connectivity or the session returns, and
submissions use an idempotent `client_token` so retries cannot create
duplicates. This behavior is unit-tested and documented in the
[offline section](02_TECHNICAL_OVERVIEW.md#16-realtime-and-offline-behavior);
a manual end-to-end offline demonstration is still recommended before the final
defense.

## 4.3.4 Professor Dashboard

The professor dashboard is implemented for the capstone scope. It provides
class and roster management with join codes; assignment and test-case
management; optional publish scheduling and due dates; submission lists; ICS
results; paste-event records; typing-rhythm heatmaps; snapshot history and diff
views; private grade storage and grade release; comment threads; class
analytics; CSV gradebook export; and the Live Lab presence view.

Through these views, instructors can inspect how a submission developed,
compare snapshots, review paste and typing evidence, inspect test-case results
when a Judge0 endpoint is configured, and release grades and feedback to
students. The separate admin web console handles users, roles, classes, and
professor invite codes and does not expose student code or submissions.

The dashboard and review views are documented in the
[professor review section](02_TECHNICAL_OVERVIEW.md#14-professor-review-views)
and the [feature master list](01_FEATURE_MASTER_LIST.md#10-professor-class-and-assignment-management).
The main status caveats are that Judge0 requires an external endpoint and the
ICS formula remains a review heuristic. A Windows installer has been built but
is unsigned, so SmartScreen may warn on first launch. The current verification
evidence is summarized in [Table 2 / Development Status](05_DEVELOPMENT_STATUS.md).
