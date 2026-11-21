# Overall Summary: ICS v3 Evidence Ledger and Demo Run Tracker

**Date:** 2026-11-22

## Overall summary

Replaces the weighted-sum ICS with an **evidence ledger**. The score starts at 50
and only moves when there is evidence: authored behaviour raises it; novel paste,
transcription shape, robotic rhythm, and away/resume patterns lower it.
Confidence gates the band, so a short or thin session is held at review instead
of passing.

The student demo now uses the same v3 rules, gains a **scenario input**, a
**Track** button, and a local run log. Labelled runs (score, band, confidence,
evidence values, raw counts) survive restarts and can be exported as JSON.

This supersedes the v2 authorship changelog entry
([2026-11-22-ics-authorship.md](2026-11-22-ics-authorship.md)).

## Why

Two problems remained after v2:

1. **Free points.** 35 for no paste + 20 for being in the window + 10 for no test
   run meant a hand-copy had a floor near 65. The only discriminating term was
   worth 25 points and could still award partial credit.
2. **No confidence.** A 100-character session and a 2,000-character session used
   the same thresholds, so short sessions produced volatile scores.

The research notes and edge-case matrix are in
[08_ICS_EVIDENCE_MODEL.md](../08_ICS_EVIDENCE_MODEL.md).

## Evidence base

The design follows five findings from the literature. Numbered citations are in
the References section.

1. **Typing rhythm is a weak identity signal.** Killourhy and Maxion evaluated 14
   anomaly detectors on 51 typists and reported equal-error rates between 9.6%
   and 10.2% for the best detectors [1]. A later academic-integrity study using a
   modified TypeNet architecture reports 74.98–85.72% accuracy in
   condition-specific settings but only 52.24–80.54% in condition-agnostic
   settings [2]. The ICS therefore uses rhythm only as an automation check, never
   as authorship evidence.
2. **Revision behaviour separates authoring from transcription.** Kundu et al.
   note that free writing typically involves shorter bursts, longer pauses, and
   more revisions than transcription-like tasks [2]. The authored-evidence term
   counts corrections, revisits, and mid-line hesitation; pause length itself is
   not scored.
3. **Hand-retyping is a known blind spot.** McDonald et al. state that a student
   physically typing code from a reference is the one source their IDE-based
   paste tracker cannot detect [3]. The ICS can only infer this from edit shape,
   which is why a single transcription signal holds at review rather than
   flagging.
4. **Process-data granularity limits what can be claimed.** Ihantola et al.
   distinguish submission-, snapshot-, and keystroke-level data [4]. This system
   is snapshot-level, so the formula degrades to a labelled v2 fallback when the
   counters are missing and the paper does not claim keystroke-level fidelity.
5. **Detection tools are indicators, not verdicts.** A large test of 14
   AI-text detectors concluded that they are "neither accurate nor reliable"
   [5], and contract-cheating guidance treats digital traces as evidence to
   corroborate, not as proof [6]. Bands therefore mean "review this", and a flag
   requires corroboration.

## What changed

### Scoring

```text
A  = authored evidence      (fixes, reworks, revisits, undo)
P  = novel-paste pressure
T  = transcription shape    (line chunks + append-only)
R  = robotic rhythm         (automation only)
W  = away/resume pattern
S  = cross-submission similarity (reserved)

A  = min(clamp(100·(0.5·fixes + 1.5·reworks + 1.5·revisits + 1.0·undo)
          / chars / 2.5, 0, 1), cap) × min(1, chars/200)
cap = 0.50 (<2 structural events), 0.75 (2), 1.00 (3+)

E− = 0.90·P + 0.80·T + 0.20·R + 0.30·W + 0.50·S   (clamped)
score = clamp(50 + 45·(A − E−), 5, 95)

confidence = 0 when chars < 120, otherwise
             min(1, chars/300) × min(1, (inserts+fixes+reworks)/30) × coverage
```

- `A` is measured per 100 inserted characters. Typo fixes (1–3 chars, capped at
  five) are weak; rewrites (4–30 chars) and revisits carry more signal. One
  revisit is one excursion above the working line, not one per keystroke, and a
  single excursion cannot lift the 0.5 cap because moving up and changing a
  character is cheap and common in honest work. Short sessions are scaled down
  by `chars/200`, so a 120-char snippet cannot reach a confident pass. Mid-line
  pauses are recorded but not scored, so a stall cannot raise the score.
- `T` is the character-weighted line-chunk share (`chunk_chars / inserted_chars`)
  amplified by an append-only factor; append-only never penalises on its own. A
  stall that ends a burst cannot dilute the ratio.
- `R` fires only for ≥100 intervals with median <25 ms or coefficient of
  variation <0.05. It can never flag alone.
- `W` uses blur/return counters, capped at 0.30 in `E−` and requiring
  transcription or paste corroboration to flag.

Band: hard rules for dominant paste and transcription; `confidence < 0.30` →
review; score ≥80 → pass; ≥40 → review; otherwise flag.

### Telemetry

- `code_snapshots.edit_stats` gains `immediateChunks`.
- `code_snapshots.focus_stats` stores `{ blurs, returns, awayMs }`.
- `useCodeTracker` listens to `blur`, `focus`, and `visibilitychange`; the first
  edit within 2.5 s of returning marks the burst, and a line chunk in that burst
  becomes `immediateChunks`.

### Storage

`recompute_ics` now stores:

- `ics_scores.confidence`
- `ics_scores.evidence` (authored, paste, transcription, rhythm, away,
  similarity, e_plus, e_minus)
- `ics_scores.band_reason`
- `ics_scores.model` (`v3`, or `v2` for legacy submissions without counters)

The legacy term columns remain populated as projections for analytics; they no
longer sum to `ics`.

### UI

- Professor panel: evidence ledger, confidence bar, band reason, model tag, and a
  separate "quality only" Judge0 figure. Legacy rows still render the v2 bars.
- Student demo: v3 gauge and ledger, plus a recording workflow. Name a scenario,
  press **Start recording**, type/paste, then **Stop & save**. The demo samples
  score and evidence twice a second, plots the score timeline, and stores the
  timeline with the run. Runs are stored under `unicode.icsDemoRuns.v1` in local
  storage; nothing is sent to the server.
- Keylog: change events, raw keydown/keyup, cursor/selection moves, focus/blur,
  and copy/cut/paste. Saved runs keep the last 1,000 events; **Copy keylog**
  exports the current session.

### Recording timeline

- Score, band, confidence, evidence values, and counts are sampled every 500 ms
  while recording and once more on stop.
- The run stores `timeline`, `startedAt`, and `durationMs`, so a score jump can
  be located in time and matched to the key events around it.
- Mid-line pauses are no longer scored and transcription is character-weighted,
  so a stall cannot raise the score. This was observed in testing: stalling could
  dilute the pause-denominator and add hesitation credit, moving a run from ~60
  to ~90.

## Calibration note (2026-11-22, after first tracked runs)

Three demo runs exposed a calibration flaw. A single return to an earlier line
was counted for **every subsequent keystroke**, and one such revisit unlocked the
0.5 cap immediately:

| Run                             | Chars | Fixes | Reworks | Revisits | Old result | Cause                          |
| ------------------------------- | ----- | ----- | ------- | -------- | ---------- | ------------------------------ |
| "second monitor copying" (a)    | 197   | 4     | 0       | 2        | 87.9 pass  | one revisit unlocked the cap   |
| "normal html"                   | 143   | 7     | 1       | 23       | 95.0 pass  | revisits counted per keystroke |
| "second monitor copying" (b)    | 416   | 7     | 0       | 0        | 60.8 review| (unchanged)                    |

Moving up and editing an earlier line is cheap to perform and very common among
honest coders, so it is weak evidence and easy to game. The revised rule:

- one revisit = one excursion above the working line (typing five characters in
  that line is still one revisit);
- fewer than two structural events leaves the cap at 0.5 (max score 72.5);
- two events raise the cap to 0.75, three to 1.0;
- `A` is multiplied by `min(1, chars/200)`.

With the new rule the 197-char run falls to review (~76) and the HTML run stays a
narrow pass (~82) because it also contains a rework and several distinct
excursions. The 416-char copy stays at review (~61). Re-record runs after
updating the build to see the new numbers; saved runs keep their original score.

## Expected effect

| Scenario                             | v3 result                                      |
| ------------------------------------ | ---------------------------------------------- |
| Normal authored 300+ chars, with reworks   | pass, confidence ≈ 100%                        |
| 300 chars, typo fixes + one revisit only  | review — one excursion cannot lift the cap     |
| Hand-copied indented block, no fixes | review (transcription pattern)                 |
| Refocus → immediate line chunks ×3+  | flag (transcription + away)                    |
| Dominant novel paste                 | flag                                           |
| Short session (<120 chars)           | review — no confidence                         |
| Refactor with deletions/revisits     | pass                                           |
| IME/voice with irregular rhythm      | authored behaviour decides; rhythm cannot flag |

## Rollout

1. Apply `20261122120000_ics_evidence.sql` before running the new build. The
   tracker sends `focus_stats`, and inserts fail if the column is missing.
2. Existing submissions without `edit_stats` keep the v2 score (`model = 'v2'`)
   until a professor recomputes; the fallback keeps them scoreable.
3. `S` is wired through the model but `recompute_ics` sets it to zero; the
   similarity panel remains a separate module.
4. Calibration against labelled sessions is still open.

## Limitations

- Client telemetry is forgeable. ICS is advisory, never sole evidence.
- A physical second monitor or phone does not fire blur; `W = 0`.
- A careful typist who writes complete lines with no corrections and no
  revisits can look like a transcriber. The single-signal floor is review, not
  flag.
- Per-student typing identity is not used. Keystroke-dynamics benchmarks are not
  accurate enough for disciplinary decisions [1][2].

## References

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
