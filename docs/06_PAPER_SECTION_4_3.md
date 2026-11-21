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
  counts, language, typing intervals, and authorship counters.
- **Authorship counters.** Each snapshot carries a delta of edit behaviour:
  insertions and deletions, undo/redo, insertions made above the current line
  (revisits), pauses and where typing resumed after them, line-chunk bursts, and
  line chunks typed immediately after the window regained focus. These counters
  drive the v3 authored-evidence and transcription terms. A pause is never
  penalised on its own; only the resume behaviour is scored.
- **Window focus.** Blur, focus, and visibility changes are counted per
  snapshot as `focus_stats` (blurs, returns, away time). Returning to the window
  and immediately typing a complete line is corroborating evidence, capped so it
  cannot flag a student alone.
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
  20 ms–10 s with a cap of 800 intervals per snapshot. These intervals feed the
  typing-rhythm heatmap; the scored authorship term uses the separate counters
  above.
- **Focus/activity.** The focus signal is derived from window blur/return events
  and snapshot timestamps. A gap of up to 5 minutes counts as active work, and
  breaks longer than 30 minutes are excluded from the session. The application
  does not record raw window focus/blur history beyond these counters.
  Separately, lightweight presence heartbeats update the professor's Live Lab
  with active, idle, or offline status; these are not a window-focus log.
- **Compilation/test activity.** Judge0 test-case results are stored in
  `code_runs` and reported as a separate quality figure. They are not counted in
  the integrity score, because a passing test does not establish authorship.
  Local **Run file** attempts are not persisted as telemetry.
- **Manual snapshots and restores.** The snapshot data model still supports
  `manual` and `restore` types, but the student-facing history/restore browser
  was intentionally removed. Professors review the recorded history through the
  submission timeline and diff views.

These records let instructors examine the development process—code evolution,
paste behavior, authorship evidence, and test outcomes—rather than judging only
the final submitted code. The capture rules are documented in the
[tracking engine section](02_TECHNICAL_OVERVIEW.md#11-tracking-engine), and the
corresponding feature rows are in the
[telemetry section](01_FEATURE_MASTER_LIST.md#6-edit-tracking-snapshots-paste-analytics-and-typing-rhythm).

### Methodology basis for the ICS

The ICS is an evidence ledger rather than a weighted sum of positive terms. The
design follows five findings from the literature:

1. Keystroke-dynamics identification is not accurate enough to serve as
   authorship evidence: the best of 14 benchmark detectors reached a 9.6–10.2%
   equal-error rate [1], and an academic-integrity study using a modified
   TypeNet reports 74.98–85.72% accuracy only in condition-specific settings,
   falling to 52.24–80.54% when conditions vary [2].
2. Free writing differs from transcription-like typing in its revision
   behaviour—shorter bursts, longer pauses, and more corrections [2]. The score
   therefore uses corrections, reworks, and revisits, not pause length. Revisits
   are counted per excursion above the working line, not per keystroke, and a
   single excursion is deliberately too weak to carry a pass: moving up and
   editing an earlier line is both easy to imitate and common among honest
   coders, so it only helps after it repeats alongside a rework or an undo.
3. Hand-retyping from a reference is a known blind spot for IDE-based paste
   trackers [3]. The system can only infer it from edit shape, so one
   transcription signal holds a submission at review rather than flagging it.
4. Programming-process data has submission-, snapshot-, and keystroke-level
   granularity [4]. This implementation is snapshot-level and falls back to a
   labelled v2 estimate when the counters are unavailable.
5. Detection tools are indicators, not verdicts: a 14-tool evaluation found
   AI-text detectors "neither accurate nor reliable" [5], and contract-cheating
   guidance treats digital traces as corroboration, not proof [6]. A `flag` is
   therefore a request for review.

The score starts at 50 and moves only with evidence; confidence gates the band so
a short session cannot pass, and authored evidence is scaled by session volume so
a 120-character snippet can reach review but not a confident pass. Judge0 results
are reported separately as quality.

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

## References cited in 4.3.2

1. Killourhy, K. S., & Maxion, R. A. (2009). Comparing anomaly detectors for
   keystroke dynamics. In _Proceedings of the 39th Annual IEEE/IFIP
   International Conference on Dependable Systems and Networks (DSN 2009)_
   (pp. 125–134). IEEE Computer Society.
   https://www.cs.cmu.edu/~maxion/pubs/KillourhyMaxion09.pdf
2. Kundu, D., Mehta, A., Kumar, R., Lal, N., Anand, A., Singh, A., & Shah, R. R.
   (2024). Keystroke dynamics against academic dishonesty in the age of LLMs.
   _IEEE International Joint Conference on Biometrics (IJCB 2024)_.
   https://arxiv.org/abs/2406.15335
3. McDonald, J., Robertson, S., & Peruma, A. (2025). PasteTrace: A single source
   plagiarism detection tool for introductory programming courses.
   _arXiv:2506.17355_. https://arxiv.org/abs/2506.17355
4. Ihantola, P., Vihavainen, A., Ahadi, A., Butler, M., Börstler, J., Edwards,
   S. H., Isohanni, E., Korhonen, A., Petersen, A., Rivers, K., Rubio, M. Á.,
   Sheard, J., Skupas, B., Spacco, J., Szabo, C., & Toll, D. (2015). Educational
   data mining and learning analytics in programming: Literature review and case
   studies. In _Proceedings of the 2015 ITiCSE on Working Group Reports_
   (ITiCSE-WGR '15, pp. 41–63). ACM. https://doi.org/10.1145/2858796.2858798
5. Weber-Wulff, D., Anohina-Naumeca, A., Bjelobaba, S., Foltýnek, T.,
   Guerrero-Dib, J., Popoola, O., Šigut, P., & Waddington, L. (2023). Testing of
   detection tools for AI-generated text. _International Journal for Educational
   Integrity, 19_(26). https://doi.org/10.1007/s40979-023-00146-z
6. Tertiary Education Quality and Standards Agency. (2026). _Substantiating
   contract cheating: A guide for investigators_.
   https://www.teqsa.gov.au/sites/default/files/2026-05/substantiating-contract-cheating-guide-for-investigators.pdf
