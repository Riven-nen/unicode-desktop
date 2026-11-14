# Supabase Schema Snapshot

Captured: 2026-11-14 (reconnaissance for the professor-dashboard phase)

- **Project URL:** https://ythiuchtlbfnvzcvgioa.supabase.co
- **Project ref:** `ythiuchtlbfnvzcvgioa`
- **Migrations applied:** `20261113165652` — `courses_and_enrollments`
- **Row counts:** every table currently has 0 rows; there are 0 auth users.

This file is a read-only record. Step 1 must be additive and must not edit the
migration above.

---

## Tables

### `public.profiles`
RLS: **enabled** · Rows: 0

| Column | Type | Null | Default / Check |
|---|---|---|---|
| `id` | uuid | no | PK |
| `email` | text | yes | — |
| `display_name` | text | yes | — |
| `role` | text | no | default `'student'`; check `role in ('student','professor')` |
| `created_at` | timestamptz | no | `now()` |

- PK: `id`
- FK: `id` → `auth.users(id)`
- **Note:** target shape calls for `full_name`; the table currently has
  `display_name`.

### `public.labs`
RLS: **enabled** · Rows: 0

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` (PK) |
| `title` | text | no | — |
| `description` | text | yes | — |
| `created_by` | uuid | yes | — |
| `created_at` | timestamptz | no | `now()` |
| `course_id` | uuid | yes | — (added by the `courses_and_enrollments` migration) |

- PK: `id`
- FKs: `created_by` → `auth.users(id)`; `course_id` → `courses(id)`

### `public.code_snapshots`
RLS: **enabled** · Rows: 0

| Column | Type | Null | Default / Check |
|---|---|---|---|
| `id` | uuid | no | PK (client generated) |
| `user_id` | uuid | no | — |
| `lab_id` | uuid | yes | — |
| `file_name` | text | no | — |
| `content` | text | no | — |
| `snapshot_type` | text | no | default `'auto'`; check in `auto, paste, manual, restore` |
| `version` | int4 | no | `0` |
| `char_count` | int4 | no | `0` |
| `line_count` | int4 | no | `0` |
| `language` | text | yes | — |
| `created_at` | timestamptz | no | `now()` |

- PK: `id`
- FKs: `user_id` → `auth.users(id)`; `lab_id` → `labs(id)`

### `public.paste_events`
RLS: **enabled** · Rows: 0

| Column | Type | Null | Default / Check |
|---|---|---|---|
| `id` | uuid | no | PK (client generated) |
| `snapshot_id` | uuid | yes | — |
| `user_id` | uuid | no | — |
| `lab_id` | uuid | yes | — |
| `file_name` | text | no | — |
| `pasted_text` | text | no | — |
| `pasted_chars` | int4 | no | `0` |
| `paste_mode` | text | yes | check in `single-line, multi-line` |
| `detected_via` | text | no | default `'onDidPaste'`; check in `onDidPaste, velocity` |
| `created_at` | timestamptz | no | `now()` |

- PK: `id`
- FKs: `user_id` → `auth.users(id)`; `lab_id` → `labs(id)`; `snapshot_id` → `code_snapshots(id)`
- **Note:** the student + file join keys (`user_id`, `file_name`) already exist.

### `public.courses`  *(legacy from the enrollment-folder iteration)*
RLS: **enabled** · Rows: 0

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` (PK) |
| `code` | text | no | — |
| `title` | text | no | — |
| `term` | text | yes | — |
| `professor_id` | uuid | no | — |
| `created_at` | timestamptz | no | `now()` |

- PK: `id`
- FK: `professor_id` → `auth.users(id)`
- **Note:** the Step 1 target introduces `classes` instead. `courses` is
  referenced by `labs.course_id` and `enrollments.course_id`.

### `public.enrollments`  *(legacy from the enrollment-folder iteration)*
RLS: **enabled** · Rows: 0

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` (PK) |
| `course_id` | uuid | no | — |
| `student_id` | uuid | no | — |
| `created_at` | timestamptz | no | `now()` |

- PK: `id` (not a composite PK)
- Unique: `(course_id, student_id)`
- FKs: `course_id` → `courses(id)`; `student_id` → `auth.users(id)`
- **Note:** the target shape wants `enrollments(class_id, student_id)` with a
  composite PK. The existing table is empty, so it can be reshaped without
  data loss, but that is not strictly additive — it needs a decision.

---

## Policies (15)

All policies target the `authenticated` role.

| Table | Policy | Command | USING / WITH CHECK |
|---|---|---|---|
| `profiles` | `profiles_select_own_or_professor` | SELECT | `id = auth.uid() OR is_professor()` |
| `profiles` | `profiles_update_own` | UPDATE | using: `id = auth.uid()`; check: `id = auth.uid()` |
| `labs` | `labs_select_authenticated` | SELECT | `true` |
| `labs` | `labs_insert_professor` | INSERT | check: `is_professor()` |
| `labs` | `labs_delete_professor` | DELETE | `is_professor()` |
| `code_snapshots` | `snapshots_insert_own` | INSERT | check: `auth.uid() = user_id` |
| `code_snapshots` | `snapshots_select_own_or_professor` | SELECT | `auth.uid() = user_id OR is_professor()` |
| `paste_events` | `pastes_insert_own` | INSERT | check: `auth.uid() = user_id` |
| `paste_events` | `pastes_select_own_or_professor` | SELECT | `auth.uid() = user_id OR is_professor()` |
| `courses` | `courses_select_enrolled_or_professor` | SELECT | `professor_id = auth.uid() OR is_professor() OR EXISTS (enrollment for auth.uid())` |
| `courses` | `courses_insert_professor_own` | INSERT | check: `professor_id = auth.uid() AND is_professor()` |
| `courses` | `courses_update_professor_own` | UPDATE | using/check: `professor_id = auth.uid()` |
| `courses` | `courses_delete_professor_own` | DELETE | `professor_id = auth.uid()` |
| `enrollments` | `enrollments_select_own_or_course_professor` | SELECT | `student_id = auth.uid() OR is_course_professor(course_id) OR is_professor()` |
| `enrollments` | `enrollments_insert_course_professor` | INSERT | check: `is_course_professor(course_id)` |

⚠️ **Security gap:** `profiles_update_own` lets any signed-in user update
their own row, including `role`. A student can currently promote themselves to
`professor`. Step 1 must close this (column privileges or a guard trigger).

---

## Indexes

- `profiles_pkey (id)`
- `labs_pkey (id)`, `labs_course_idx (course_id)`
- `code_snapshots_pkey (id)`, `code_snapshots_user_file_idx (user_id, file_name, created_at DESC)`, `code_snapshots_lab_idx (lab_id, created_at DESC)`
- `paste_events_pkey (id)`, `paste_events_user_idx (user_id, created_at DESC)`, `paste_events_snapshot_idx (snapshot_id)`, `paste_events_text_trgm_idx` (GIN on `pasted_text` with `gin_trgm_ops`)
- `courses_pkey (id)`, `courses_professor_idx (professor_id)`
- `enrollments_pkey (id)`, `enrollments_course_id_student_id_key (course_id, student_id)`, `enrollments_student_idx (student_id)`

---

## Functions

| Function | Arguments | Security | Volatility |
|---|---|---|---|
| `handle_new_user()` | — | DEFINER | volatile (trigger) |
| `is_professor()` | — | DEFINER | stable |
| `is_course_professor(target uuid)` | uuid | DEFINER | stable |

`pg_trgm` is installed in the `public` schema and contributes its own helper
functions (not listed above).

---

## Triggers

| Schema | Table | Trigger | Timing / Event | Function |
|---|---|---|---|---|
| `auth` | `users` | `on_auth_user_created` | AFTER INSERT | `handle_new_user()` |

---

## Deltas against the Step 1 target

| Target requirement | Current state | Step 1 action |
|---|---|---|
| `profiles.full_name` | table has `display_name` | add `full_name` (additive), backfill from `display_name` |
| `classes` | does not exist (legacy `courses` exists) | create `classes` |
| `enrollments(class_id, student_id)` composite PK | exists as `id` PK + `course_id` + unique pair | reshape or replace; needs a decision because the Step 1 target reuses the name |
| `assignments`, `test_cases`, `submissions`, `ics_scores`, `comments` | do not exist | create |
| `code_snapshots.submission_id` | absent | add nullable column |
| `paste_events` student/file join key | `user_id` + `file_name` already present | no change needed |
| `is_professor_of_class(uuid)` | absent | create |
| professor RLS scoped per class | current professor policies use global `is_professor()` | tighten with class-scoped helpers |
| users cannot change `role` | currently possible via `profiles_update_own` | add guard (trigger or column privileges) |

---

## Student renderer references to remove in Step 3

### `TimelineRail` / `DiffViewer`

| File | Reference |
|---|---|
| `src/renderer/src/App.tsx` | imports both (lines 23, 31); renders `<TimelineRail>` (line 735) and `<DiffViewer>` (line 774); owns `activeFileSnapshots`, `diffId`, and diff/restore callbacks |
| `src/renderer/src/components/TimelineRail.tsx` | component itself (rail, Snapshot button, sync indicator) |
| `src/renderer/src/components/DiffViewer.tsx` | component itself (diff modal) |

### Manual "Snapshot" entry points

| File | Reference |
|---|---|
| `src/renderer/src/components/TimelineRail.tsx` | `onSnapshotNow` prop and the `<Camera /> Snapshot` button (line 61) |
| `src/renderer/src/components/MenuBar.tsx` | `onSaveSnapshot` prop and the "Save Snapshot" File-menu item (line 99) |
| `src/renderer/src/App.tsx` | "Save Snapshot" quick-open command (line 425), `onSaveSnapshot` menu prop (line 603), `onSnapshotNow` (line 744) |
| `src/renderer/src/hooks/useCodeTracker.ts` | `captureManualSnapshot` API and `snapshotsByFile` state (capture pipeline — keep; only the UI entry points are removed) |

Related but not an entry point: `StatusBar` receives `snapshotCount` from
`App.tsx` (line 769).
