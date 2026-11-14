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
| Professor | 3 CS101 + 1 CS102 | 3 / 1 |
| Student1 (CS101 + CS102) | 3 + 1 | 3 / 1 |
| Student3 (CS101 only) | 3 CS101, 0 CS102 | 3 / 0 |

### Submission table — `fetchSubmissions`
Queries: `submissions` for an assignment with student profile, ICS, comment
count; then `code_snapshots` for those submissions and `paste_events` for
those snapshots.

| Role | Expected | Verified |
|---|---|---|
| Professor | 3 submissions for Fibonacci, 3 ICS rows, 2 pastes on student3, 2 comments | 3 / 3 / 2 / 2 |
| Student1 | 1 submission (own), 1 ICS row, 0 comments | 1 / 1 / 0 |
| Student3 | 1 submission (own), 1 ICS row, 2 comments | 1 / 1 / 2 |

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

### Grade save — `saveGrade`
Update: `grade`, `graded_at`, `graded_by` on a submission.

| Role | Expected | Verified |
|---|---|---|
| Professor of the class | Update succeeds | `grade = 95` inside a rolled-back transaction |
| Student | 0 rows updated (no UPDATE policy) | `rows_with_grade_99 = 0` |
| Professor/anyone changing `assignment_id`, `student_id`, `final_snapshot_id`, `status`, `submitted_at` | Blocked by `guard_submission_grade_update` | Trigger raises |

### Inline comments — `insertComment`
Insert: comment with `professor_id = auth.uid()`, submission in the
professor's class, optional `parent_id` on the same submission.

| Role | Expected |
|---|---|
| Professor | Insert succeeds |
| Student | Insert denied (no INSERT policy for students) |
| Professor replying across submissions | Denied by the `parent_id` check |

### Student feedback modal — `fetchStudentFeedback`
Queries: the student's own submissions, then `comments` for those
submission IDs (read-only).

| Role | Expected | Verified |
|---|---|---|
| Student3 | 2 comments on their flagged submission | 2 |
| Student1 | 0 comments (none on their submission) | 0 |
| Professor | Not used by the modal | — |

Students cannot insert comments; the modal has no composer.

### Professor CRUD — classes, assignments, test cases, roster
Verified with a real professor session, using temporary rows that were
deleted afterward. Final seed counts were restored (2 classes, 4
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

## Diagnostics

The migration history and policies were inspected with the Supabase MCP. The
only advisor warnings left are:
- `pg_trgm` installed in `public` (pre-existing)
- 9 `SECURITY DEFINER` helpers executable by `authenticated` (required for
  RLS policy evaluation; `anon` execution is revoked)

Both are documented in the Step 1 report.
