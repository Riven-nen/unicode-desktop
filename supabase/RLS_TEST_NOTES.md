# Professor Dashboard — RLS Test Notes

Verified against project `ythiuchtlbfnvzcvgioa` after seeding the demo data.

## How to reproduce

Sign in to the app as the professor and as a student, or simulate in SQL:

```sql
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select id from public.profiles where email = 'professor@unicode.test'))::text,
  true
);
set local role authenticated;
-- run the view's query here
rollback;
```

Swap the email for `student1@unicode.test` / `student3@unicode.test` for the
student checks. `auth.uid()` reads the `sub` claim.

## Views and queries

### Classes grid — `fetchClasses`
Query: `classes` filtered by `professor_id = auth.uid()`, with enrollment and
assignment counts.

| Role | Expected | Verified |
|---|---|---|
| Professor | 2 classes (CS101, CS102) | 2 |
| Student (enrolled in both) | 2 classes, count queries must not fail | 2 |
| Student (not enrolled anywhere) | 0 classes | RLS returns 0 |

The embedded `enrollments(count)` / `assignments(count)` are also filtered by
RLS; the professor's `is_professor_of_class` policies make both counts
accurate.

### Assignment list — `fetchAssignments`
Query: `assignments` for the selected class, with `test_cases(id, is_hidden)`.

| Role | Expected | Verified |
|---|---|---|
| Professor | 3 CS101 + 2 CS102 (including the scheduled assignment) | 3 / 2 |
| Student1 (CS101 + CS102) | 3 + 1 visible; scheduled CS102 assignment hidden | 3 / 1 |
| Student3 (CS101 only) | 3 CS101, 0 CS102 | 3 / 0 |

The scheduled assignment has `publish_at` three days in the future. The
`assignments_select_class_members` policy also requires
`publish_at is null or publish_at <= now()` for students.

### Submission table — `fetchSubmissions`
Queries: `submissions` for an assignment with student profile, ICS, comment
count; then `code_snapshots` for those submissions and `paste_events` for
those snapshots.

| Role | Expected | Verified |
|---|---|---|
| Professor | 3 submissions for Fibonacci, 3 ICS rows, 2 pastes on student3, 3 comments | 3 / 3 / 2 / 3 |
| Student1 | 1 submission (own), 1 ICS row, 0 comments | 1 / 1 / 0 |
| Student3 | 1 submission (own), 1 ICS row, 3 comments (2 professor, 1 reply) | 1 / 1 / 3 |

Student queries for another student's snapshots/pastes return zero rows
because the class-scoped helpers only grant the professor access.

### Test cases / hidden cases
Query: `test_cases` for an assignment, including `is_hidden`.

| Role | Expected | Verified |
|---|---|---|
| Professor | All 9 cases across the four assignments (4 hidden) | 9 |
| Student1 | 5 visible cases (9 total − 4 hidden) | 5 |
| Student3 | 4 visible cases (CS101 only: 9 − 3 hidden − 2 CS102) | 4 |

The `test_cases_select_class_members` policy is:
`is_professor_of_class(class_of_assignment(assignment_id)) OR (is_hidden = false AND is_enrolled_in_class(...))`.

### Submission detail — `fetchSubmissionDetail`
Queries: submission + student + assignment/class + ICS, comments, snapshots,
paste events, test cases.

| Role | Expected | Verified |
|---|---|---|
| Professor | Full detail for all three submissions, including hidden test cases | OK |
| Student | Only their own submission; comments on it; no hidden tests | 1 own submission, 5 tests for student1 |

### Grade save and release — `save_submission_grade`, `set_submission_grade_release`
Private marks are stored in `submission_grades` (professor-only). The public
`submissions.grade` column is NULL until release, so it is safe against direct
API and Realtime reads.

| Role | Expected | Verified |
|---|---|---|
| Professor of the class | Save succeeds through the guarded RPC | `grade = 95` |
| Student | Cannot update a submission (no UPDATE policy) | `rows_with_grade_99 = 0` |
| Professor/anyone changing `assignment_id`, `student_id`, `final_snapshot_id`, `status`, `submitted_at` | Blocked by `guard_submission_grade_update` | Trigger raises |
| Professor reads `submission_grades` | Private mark is visible | 78 |
| Student reads `submission_grades` | 0 rows (RLS denies) | 0 |
| Student queries the base submission while a grade is private | `grade` is NULL | NULL |
| Student queries `student_submissions` | `grade` and `grade_released_at` are null | Masked |
| Student calls `set_submission_grade_release` | Denied: `Only the class professor can release grades.` | Denied |
| Professor releases a private grade | Public grade and release timestamp appear | Released, then hidden again |
| Professor calls `release_assignment_grades` | Every saved, unreleased grade moves at once | Returns count |

`student_submissions` remains a masked view for the student assignment list and
feedback panel, but the private value never enters the public table.

### Inline comments — `insertComment` (professor or student reply)
Insert: comment with `author_id = auth.uid()`. Professors may start or reply in
threads on submissions in their class; students may reply only inside a thread
on their own submission.

| Role | Expected |
|---|---|
| Professor | Insert succeeds (top-level or reply) |
| Student top-level comment | Denied (students need `parent_id`) |
| Student reply on their own submission | Insert succeeds |
| Student reply on another student's submission | Denied |
| Professor or student replying across submissions | Denied by the `parent_id` check |

### Student feedback modal — `fetchStudentFeedback`
Queries: the student's own submissions, `student_submissions` for released
grades, then `comments` for those submission IDs. The author is derived from
`author_id`: anything not written by the student is the professor's feedback
(profiles of professors are not readable by students).

| Role | Expected | Verified |
|---|---|---|
| Student3 | 3 comments on their flagged submission (2 professor, 1 student reply) | 3 |
| Student1 | 0 comments (none on their submission) | 0 |
| Professor | Not used by the modal | — |

The modal now includes a composer for replies to professor comments.

### Student submission — `submit_assignment`
`SECURITY DEFINER` RPC. It verifies enrollment, creates the submission, attaches
the student's unsubmitted snapshots for the workspace file, and points
`final_snapshot_id` at the newest one (inserting the live editor content when
nothing has synced yet). The grade guard trigger is bypassed inside the
function with a transaction-local GUC, so students still cannot update
`final_snapshot_id` directly.

The optional `client_token` makes retries idempotent: a second call from the
same student with the same token returns the original submission instead of
creating a duplicate.

| Role / action | Expected | Verified |
|---|---|---|
| Student3 submits Fibonacci (`CS101/fibonacci.py`) | Submission created; pending snapshot attached; final snapshot matches submitted content | Created, attached, and cleaned up |
| Student3 submits a CS102 assignment | RPC denies: `You are not enrolled in this class.` | Denied |
| Further submissions | Each creates a new submission and attaches only newly captured snapshots | New submission per call |

### Judge0 execution history — `code_runs`
Students insert their own custom runs (`submission_id` null). Professors insert
test-case runs against a submission in their class. Reads are own-row or
class-professor; runs are immutable.

| Role / action | Expected | Verified |
|---|---|---|
| Student3 runs a file | Row stored with `user_id = auth.uid()`, no test case | Stored and removed |
| Professor runs test cases | Rows stored with `submission_id`, `snapshot_id`, `test_case_id`, `passed` | Stored 3 rows |
| Professor reads history | Class-scoped execution history appears in the submission detail | 3 rows |
| Student reads another student's runs | Denied by RLS | policy scope |

### ICS recomputation — `recompute_ics`
`SECURITY DEFINER` RPC restricted to the professor of the submission's class.
It computes P/C/F/K, upserts `ics_scores`, and supports a bulk assignment
variant. K uses the newest Judge0 result per test case; neutral 50 when no
test-case run exists.

| Role / action | Expected | Verified |
|---|---|---|
| Professor recomputes student3's submission | Row updated with new terms and band | `40.44` flag |
| Professor reruns after test-case results | Compilation term reflects pass ratio | 1/3 → `6.67` |
| Student calls the RPC | Denied: `You do not teach the class for this submission.` | Denied by helper |
| Bulk recompute assignment | Returns count 3; each row rescored | 3 |

### Lifecycle, drafts, and bulk roster
| Action | Expected | Verified |
|---|---|---|
| Archive/restore class | Professor can archive; students stop seeing the class | UI archive badge + restore |
| Archive/restore assignment | Archived assignment hidden from student query; professor can restore | UI restore + student query |
| Draft assignment | `published = false` is invisible to students | Student query returned 0 |
| Scheduled assignment | `publish_at` in the future is invisible to students but visible to the professor | Professor 1 row, student 0 rows |
| Due date | Stored and shown in professor/student views | Due date round-trip |
| Bulk roster RPC | Reports added / already enrolled / not found per email | Already enrolled + not found |
| Delete class/assignment | Professor-only, cascades owned rows; student files untouched | UI confirmation + policy |

### Professor CRUD — classes, assignments, test cases, roster
Verified with a real professor session, using temporary rows that were
deleted afterward. Final seed counts were restored (2 classes, 5
assignments, 9 test cases, 5 enrollments).

| Action | Policy | Verified |
|---|---|---|
| Create class | `classes_insert_professor_own` (`professor_id = auth.uid() AND is_professor()`) | Created + updated |
| Edit class | `classes_update_professor_own` | Renamed successfully |
| Create/edit assignment | `assignments_*_class_professor` | Created + updated |
| Create test case | `test_cases_insert_class_professor` | Created |
| Toggle hidden | `test_cases_update_class_professor` | `is_hidden` changed |
| Delete test case | `test_cases_delete_class_professor` | Cleaned up |
| Read roster | `enrollments_select_own_or_class_professor` + profiles policy | 3 students with names/emails |
| Add student by email | `add_student_to_class` SECURITY DEFINER RPC (checks `is_professor_of_class`) | Added; class size 3 |
| Student calls the RPC | RPC ownership check | `You do not teach this class.` |
| Remove student | `enrollments_delete_class_professor` | Removed in cleanup |

The RPC exists because profiles RLS deliberately hides students who are not
yet in the professor's classes; the definer function performs the email
lookup only after verifying class ownership.

## Join codes

| Role / action | Expected | Verified |
|---|---|---|
| Student3 joins CS102 with the class code | Enrollment created; class appears for the student | UI + database verified; enrollment removed after test |
| Student3 uses an invalid code | `That join code is not valid for an active class.` | Denied |
| Student3 calls `rotate_class_join_code` | `You do not teach this class.` | Denied |
| Professor rotates a class code | New code returned; old code stops working | RPC verified inside a rolled-back transaction |
| Professor creates a class without a code | Default join code generated | Verified |

## Admin role

| Role / action | Expected | Verified |
|---|---|---|
| Admin reads profiles | Sees every profile (5 in seed) | 5 rows |
| Student reads profiles | Sees only self/class professor | 1 row for student3 |
| Admin reads classes | Sees every class (2) | 2 rows |
| Student reads classes | Sees only enrollments (1) | 1 row |
| Admin changes own role | `You cannot change your own role.` | Denied |
| Student calls `admin_set_role` | `Only an admin can change roles.` | Denied |
| Admin demotes a professor who owns classes | `Reassign or delete their classes...` | Denied |

Admins do not have policies for submissions, snapshots, paste events, or code.

## Professor invites

| Role / action | Expected | Verified |
|---|---|---|
| Admin creates an invite | Returns a `PROF-XXXX-XXXX` code with expiry and max uses | Created |
| Student calls `admin_create_professor_invite` | `Only an admin can create professor invites.` | Denied |
| Student reads `professor_invites` | 0 rows | 0 |
| Student calls `admin_revoke_professor_invite` | `Only an admin can revoke professor invites.` | Denied |
| Student redeems a valid code (lowercase works) | Role becomes `professor`; use count increments | Promoted |
| Same code after its single use | `That professor invite has reached its usage limit.` | Denied |
| Revoked code | `That professor invite has been revoked.` | Denied |
| Code with `expires_at` in the past | `That professor invite has expired.` | Denied |
| Invalid code | `That professor invite code is not valid.` | Denied |

`redeem_professor_invite` locks the invite row while checking status and updating
the use count, then sets the `app.professor_invite` transaction-local flag so the
profile role trigger accepts only this promotion path. The desktop shows
**Redeem invite** on the student dashboard and reloads the profile role after a
successful redemption.

## Professor insight views

| Role / action | Expected | Verified |
|---|---|---|
| Professor reads `code_snapshots.typing_intervals` for a class submission | Interval array present | 40 samples |
| Professor calls `professor_paste_matches` | Class-scoped matches with student names and `similarity` | 1 match |
| Student calls `professor_paste_matches` | `You do not teach the class for this submission.` | Denied |
| Student calls `touch_student_presence` | Upserts only their own row | Accepted |
| Professor reads `student_presence` | Sees only students enrolled in their classes | 1 row |
| Student reads another student's presence | 0 rows | 0 |
| Invalid presence status | `Unknown presence status.` | Denied |

The Live Lab subscribes to `student_presence` through Realtime. A row is shown
as offline client-side after 90 seconds without a heartbeat. Paste similarity
is limited to the target submission's class and excludes the submission's own
student.

## Realtime

Supabase Realtime applies RLS to `postgres_changes`. A student3 subscription to
`comments` received only the comment inserted on their own submission, not the
one inserted on student1's submission (both inserted with the service role,
then cleaned up).

## Diagnostics

The migration history and policies were inspected with the Supabase MCP. The
only advisor warnings left are:
- `pg_trgm` installed in `public` (pre-existing)
- 9 `SECURITY DEFINER` helpers executable by `authenticated` (required for
  RLS policy evaluation; `anon` execution is revoked)

Both are documented in the Step 1 report.
