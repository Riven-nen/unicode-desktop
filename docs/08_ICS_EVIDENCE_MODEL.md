# ICS Evidence Model (v3 proposal)

**Status:** implemented in the current build. The shipped formula is ICS v3; the
v2 calculation is retained only as a fallback for submissions captured before
the authorship counters existed.

This note answers one question: if the Integrity Confidence Score is going to be
defended in a paper and used on real students, what should it actually compute?

## 1. What the evidence says

| Finding                                                                                                                                                                                               | Implication for ICS                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Keystroke-dynamics identification reaches roughly **10% equal-error rate** even on a clean benchmark (best detectors 9.6–10.2%) [1].                                                                  | Do not build a score on typing rhythm or "typing identity". Rhythm is a weak anomaly check, not authorship evidence. |
| Free writing has **shorter bursts, longer pauses, and more revisions** than transcription-like tasks [2].                                                                                             | Revisions are the useful signal. Pause length alone is not.                                                          |
| Tools that track copy/paste state that **physically retyping code from a reference is the one source they cannot detect** [3].                                                                        | A hand-copy from a second screen is inferable only from edit shape. The score must not claim certainty.              |
| Process-data research distinguishes submission-, snapshot-, and keystroke-level granularity [4].                                                                                                      | This app is snapshot-level. Formulas must degrade gracefully when only coarse data exists.                           |
| Detection tools are **indicators, not proof**: a 14-tool test found AI-text detectors "neither accurate nor reliable" [5], and contract-cheating guidance treats digital traces as corroboration [6]. | `flag` must mean "review this", never "guilty". Bands need confidence.                                               |

The design consequence is blunt: **no single signal is strong enough, and the
absence of a negative signal is not positive evidence.** The score has to combine
independent evidence and say when it does not have enough.

## 2. Why the current v2 formula still leaks

v2 is a weighted sum: `35·paste + 25·authorship + 20·focus + 20·compilation`.
Four structural problems remain:

1. **Free points.** A student who never pastes gets 35/35. A student who sits in
   the window gets 20/20. A submission with no test run gets 10/20. 65 of 100
   points are awarded for _not doing something_.
2. **No confidence.** A 100-character session and a 2,000-character session are
   scored by the same thresholds.
3. **Ratios at small n.** One correction in two bursts is "50% rework", which
   looks more authored than 40 corrections in 200 bursts.
4. **Quality mixed with integrity.** Judge0 pass rate measures whether code
   works, not who wrote it. A copier with working code outranks an honest
   student with a bug.

v2 fixed the worst of this (pauses neutral, line chunks, cap) but it is still a
sum of positive-looking terms. v3 replaces it with an evidence ledger.

## 3. The v3 model

### 3.1 Shape

```text
A = authored evidence       0..1   (positive)
P = novel-paste pressure    0..1   (negative)
T = transcription shape     0..1   (negative)
R = robotic rhythm          0..1   (negative, automation only)
W = away/resume pattern     0..1   (negative, alt-tab only)
S = cross-submission match  0..1   (negative, optional module)

E+ = A
E- = clamp(0.90·P + 0.80·T + 0.20·R + 0.30·W + 0.50·S, 0, 1)

score = 50 + 45·(E+ − E-)            → 5..95
```

The score starts at 50 because "no evidence" is not a pass. Every point above 50
must be earned by authored behaviour; every point below 50 must be caused by a
specific negative signal.

The values above are the shipped defaults. An administrator can adjust the base
score, the authored weight, the five negative weights, the score floor and
ceiling, the pass/review thresholds, the pass minimum characters, and the
minimum confidence from the admin console's **ICS metric** panel. Each recomputed
v3 row stores the applied `settings_version` and `settings_snapshot`. Re-applying
settings re-scores the stored evidence ledger without re-reading snapshots, so it
also works after snapshot retention.

### 3.2 Confidence

```text
C = 0 when inserted_chars < 120, otherwise
    min(1, inserted_chars / 300)
  × min(1, (inserts + fixes + reworks) / 30)
  × coverage
coverage = 1.0  ≥3 snapshots or ≥2 files
           0.6  one snapshot
           0.4  final content only
```

`C` does **not** move the score. It controls the band:

| Condition                      | Band                        |
| ------------------------------ | --------------------------- |
| hard rule corroborated         | `flag`                      |
| `C < 0.30`                     | `review` — limited evidence |
| `score ≥ 80` and `chars < 300` | `review` — short submission |
| `score ≥ 80`                   | `pass`                      |
| `score ≥ 40`                   | `review`                    |
| otherwise                      | `flag`                      |

A short but perfectly authored snippet therefore cannot pass. Below 120
characters there is no confidence at all; between 120 and 299 characters the
best possible band is `review — short submission`. This removes the v2 "one
burst = 69" artefact and stops a few correct-looking lines from being treated as
proof of authorship.

The 300-character floor is deliberately not a time threshold. A student can sit
idle, and a fast typist can produce 300 characters quickly. The gate is evidence
volume: characters, operations, bursts, and snapshots.

### 3.3 Authored evidence `A`

Count evidence **per 100 inserted characters**, not per burst:

```text
weighted = 0.5·typo_fixes + 1.5·reworks + 1.5·revisits + 1.0·undo_redo
rate     = 100 · weighted / max(1, inserted_chars)
scored   = clamp(rate / 2.5, 0, 1)
cap      = 0.50  with fewer than two structural events
           0.75  with two
           1.00  with three or more
A        = min(scored, cap) × min(1, inserted_chars / 200)
```

- `typo_fix` = deletion of 1–3 characters, capped at five counted fixes.
- `rework` = deletion of 4–30 characters (rewriting real code).
- `revisit` = one excursion above the highest line reached so far. Typing
  several characters in that earlier line is the same excursion; returning to
  the working line ends it, and a later return is a second revisit.
- `structural event` = a rework, a revisit, or an undo/redo.
- Bulk edits (>30 chars), pastes, select-all deletes, whitespace-only deletes,
  and pre-typing starter clears are excluded.

Typo fixes are deliberately weak. A copyist can correct many typos without ever
revisiting or restructuring code; without a rework, revisit, or undo, authored
evidence is capped at 0.5 and cannot pass on its own.

A single return to an earlier line is also weak on purpose. It is cheap to
perform and very common in honest work, so one excursion cannot lift the cap at
all: a run whose only structural evidence is one revisit stays at `A ≤ 0.50`,
which caps the score at 72.5 and therefore cannot pass. Two independent
structural events raise the cap to 0.75; three raise it to 1.0. The `200`-char
volume factor scales the score down further, and the band gate blocks a pass
below 300 inserted characters. A 120-char snippet can therefore reach review but
never a confident pass, no matter how busy it looks.

Mid-line pauses are recorded but **not scored**, because a stall must not raise
the score.

### 3.4 Novel-paste pressure `P`

```text
ratio = novel_pasted_chars / max(1, inserted_chars + novel_pasted_chars)
P     = clamp((ratio − allowance) / (0.60 − allowance), 0, 1)
```

`allowance` is policy: 0.00 for a timed seatwork, 0.10 default, 0.15 for
open-book take-home. Only **novel** pasted text counts (v2 behaviour), so
moving your own code or pasting the provided starter is free.

### 3.5 Transcription shape `T`

```text
chunk_ratio  = chunk_chars / max(1, inserted_chars)
append_only  = clamp(1 − (reworks + undo) / (0.05·inserted_chars + 1), 0, 1)
T            = clamp(chunk_ratio × (0.70 + 0.30·append_only), 0, 1)
```

- A **chunk burst** starts at the line's first non-whitespace column after a
  pause, produces a complete line, and contains no correction.
- The ratio is character-weighted, so a stall that merely ends a burst cannot
  dilute it and raise the score.
- `append_only` saturates at a 5% rewrite rate. A copyist with zero rewrites
  scores 1; an honest editor with normal rework scores 0.
- `T` only applies above 120 inserted characters.

### 3.6 Robotic rhythm `R`

`R = 1` when all of these hold over ≥100 intervals:

- median interval < 25 ms, or
- coefficient of variation < 0.05, or
- sustained >15 characters/second for more than 30 s.

`R` is capped at 0.20 in `E-` and **never** triggers a flag by itself. It exists
to catch macros/scripts, not fast or slow students. IME and voice input can look
irregular; they must not be punished.

### 3.7 Away/resume `W`

Requires window `blur`/`focus` and `visibilitychange` events:

```text
immediate_chunk = first burst after focus is a chunk, and starts within 2.5 s
W = clamp((immediate_chunks / max(1, returns)) · min(1, returns/3), 0, 1)
```

Only active with ≥3 returns. Alt-tabbing to documentation is normal, so `W` is
capped at 0.30 and needs `T` or `P` to produce a flag. A second monitor or a phone
never fires blur: `W = 0`, and that is stated in the limitations.

### 3.8 Similarity `S` (separate module)

`S = clamp((max_token_similarity − 0.75) / 0.25, 0, 1)` against other
submissions in the class. Keep it optional and show the matched pair. Shared
boilerplate must be normalized out. Group-work assignments disable `S`.

### 3.9 Tests are quality, not integrity

Judge0 pass rate should be shown as a separate **Quality** number. It does not
belong in `E+` or `E-`. If the paper needs a four-term display, keep the card and
label it "not counted in integrity", or use it only as a tie-breaker inside the
same band.

## 4. Hard rules

A hard rule changes the band only when corroborated by a second signal:

| Rule                                        | Result                                   |
| ------------------------------------------- | ---------------------------------------- |
| `P ≥ 0.8` and `A ≤ 0.2`                     | review floor; `P = 1` and `A = 0` → flag |
| `T ≥ 0.7` and `A ≤ 0.15` and inserted ≥ 120 | review floor                             |
| `T ≥ 0.7`, `A ≤ 0.15`, and `W ≥ 0.5`        | flag                                     |
| `S ≥ 0.9` and `P ≥ 0.5`                     | flag                                     |
| `R ≥ 0.8` alone                             | never flag; label "input anomaly"        |

"Review floor" means a single strong signal cannot produce a pass, but it also
cannot produce a flag on its own.

A single revisit is not enough to pass either. One excursion above the working
line leaves the authorship cap at 0.5, so the score cannot exceed 72.5 no matter
how long the session is. This is deliberate: moving up and changing a character
is cheap to do and common in honest work, so it is treated as weak evidence
until it repeats alongside a rework or an undo.

"Flag" always means "professor should look", not "student cheated".

## 5. Worked examples

| Scenario                                           | A    | P    | T    | W    | Score | Band                       |
| -------------------------------------------------- | ---- | ---- | ---- | ---- | ----- | -------------------------- |
| Authored 320 chars, 4 fixes, 2 reworks, 2 revisits | 1.00 | 0    | 0.10 | 0    | 95.0  | pass (C=1)                 |
| Authored 250 chars, perfect evidence               | 1.00 | 0    | 0    | 0    | 95.0  | review (short submission)  |
| Authored 300 chars, 4 fixes, 2 revisits only       | 0.67 | 0    | 0.10 | 0    | 76.4  | review                     |
| Short honest 100 chars, 1 fix                      | 0.10 | 0    | 0    | 0    | 54.5  | review (C=0)               |
| Hand-copy 160 chars, no fixes, 1 chunk             | 0    | 0    | 0.70 | 0    | 24.8  | review (floor)             |
| Paste 80% of final code                            | 0    | 1.00 | 0    | 0    | 9.5   | flag                       |
| Refactor with deletions/revisits                   | 1.00 | 0    | 0.05 | 0    | 93.2  | pass                       |
| IME/voice, many edits, irregular rhythm            | 0.90 | 0    | 0.10 | 0    | 86.9  | pass (R alone cannot flag) |
| Alt-tab → line chunk ×4                            | 0.10 | 0    | 0.60 | 0.80 | 22.1  | flag (T+W)                 |

## 6. Edge-case matrix

| Edge case                              | Handling                                                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Second monitor / phone, no blur event  | No `W`. Only `T` and `A` apply. Stated as an explicit limitation.                                                                 |
| Alt-tab to docs, then type             | `W` capped at 0.30; needs `T`/`P` corroboration.                                                                                  |
| Copying own earlier code               | Novel-paste exclusion; reuse is not paste.                                                                                        |
| Starter file / template                | Excluded from authorship; bulk deletes ignored.                                                                                   |
| Autocomplete, snippets, auto-indent    | Use `onDidType` for typed characters and `onDidChangeModelContent` for structural edits; exclude single-change inserts >30 chars. |
| IME / voice input                      | Rhythm not scored; `R` cannot flag alone.                                                                                         |
| Accessibility / slow typing            | Speed is never positive or negative evidence.                                                                                     |
| Non-native speaker / long thinking     | Pauses neutral; only resume behaviour counts.                                                                                     |
| Refactoring / renaming                 | Revisits and deletions are positive evidence.                                                                                     |
| Pair programming / group work          | Assignment policy disables `A` penalty and `S`; display "collaboration allowed".                                                  |
| Timed seatwork                         | Paste allowance 0; rhythm weight raised slightly; blur weight raised.                                                             |
| Take-home / open book                  | Paste allowance 0.15; `W` weight lowered.                                                                                         |
| Very short submission (<300 chars)     | `<120` → review (no confidence); `120–299` → review (short submission), never pass.                                               |
| Multi-file submission                  | Aggregate counts; cap each file's contribution so one large file cannot dominate.                                                 |
| Offline / clock skew                   | Server clamps timestamps; queued events keep monotonic ordering.                                                                  |
| Snapshot gaps (app closed)             | Gaps >30 min start a new session; no focus penalty.                                                                               |
| Legacy submissions without counters    | Fall back to v2 interval estimate; label "legacy evidence".                                                                       |
| Deliberate fake corrections            | One revisit or a few typos cannot pass: the cap stays at 0.5 until two structural events. `T`/`P` need corroboration to flag.     |
| AI-generated code pasted in            | Same as paste: `P` high, `A` low.                                                                                                 |
| AI-generated code typed by hand        | `T` may fire; not distinguishable from a fast author. Review, not proof.                                                          |
| Student deletes everything and retypes | Bulk delete excluded; retyping is `A` evidence.                                                                                   |
| Browser devtools / app tampering       | Client telemetry is forgeable; ICS is advisory, never sole evidence.                                                              |

## 7. Validation plan

Without calibration this is still a heuristic. Minimum plan:

1. **Synthetic personas** — honest-fast, honest-slow, pause-heavy, refactorer,
   paste-heavy, hand-copy, IME/voice. Assert expected bands.
2. **Volunteer sessions** — a small labelled set with consent: 10 honest, 10
   hand-copied, 10 copied-pasted. Compute ROC/AUC and pick thresholds for
   **FPR ≤ 5%** on honest sessions.
3. **Ablation** — report each signal's contribution; drop signals that do not
   improve AUC.
4. **Term-long monitoring** — track review/flag rates per class and appeals.
   False positives matter more than false negatives for a review aid.
5. **Do not** train a per-student typing fingerprint. The literature's ~10% EER
   is not good enough for disciplinary evidence, and it fails for accessibility
   and device changes.

Target: ≥70% of hand-copy sessions reach review, ≤5% of honest sessions do.

## 8. Migration path

Implemented in this build:

- `src/renderer/src/lib/icsEvidence.ts` — the ledger, confidence, and band rules.
- `src/renderer/src/lib/authorship.ts` — fixes, revisits, hesitation, line
  chunks, and immediate chunks after a refocus.
- `code_snapshots.focus_stats` — blur/return counters from the tracker.
- `recompute_ics` — v3 scoring in
  `supabase/migrations/20261122120000_ics_evidence.sql`, with `confidence`,
  `evidence`, `band_reason`, and `model` stored on `ics_scores`.
- Professor panel — evidence ledger and confidence; legacy v2 rows still render
  the old term bars.
- Student demo — v3 scoring, a scenario input, and a **Track** button that keeps
  labelled runs in local storage with a copyable JSON export.

Still open:

1. `S` is wired through the model but `recompute_ics` sets it to zero; the
   similarity panel remains a separate module.
2. `ics_policy` is derived from `assignments.kind` (seatwork = no paste
   allowance, take-home = 10%). A full per-assignment policy editor is not
   built.
3. Calibration against labelled sessions (§7) has not been run yet.

## 9. What not to do

- Do not score typing speed or consistency.
- Do not give points for "no paste", "in the window", or "no test run".
- Do not let a single signal flag a student.
- Do not treat Judge0 results as integrity evidence.
- Do not present the score as proof, or hide the confidence.
- Do not use per-student typing identity.

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
