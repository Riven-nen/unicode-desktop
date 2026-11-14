-- 20261114090300_classroom_rls.sql
--
-- Row-level security for the classroom schema. Uses ALTER POLICY for the
-- existing student policies (no DROP statements anywhere) and CREATE POLICY
-- for the new tables.
--
-- Access matrix:
--   profiles       own row + students a professor teaches
--   classes        enrolled students read; owning professor CRUD
--   enrollments    own rows; class professor manages
--   assignments    enrolled students read; owning professor CRUD
--   test_cases     enrolled students read; owning professor CRUD
--   submissions    own rows; class professor reads all
--   code_snapshots own rows; class professor reads submitted snapshots
--   paste_events   own rows; class professor reads pastes on submitted snapshots
--   ics_scores     own submission; class professor reads/inserts/updates
--   comments       own submission read; class professor reads/inserts

alter table public.classes enable row level security;
alter table public.enrollments enable row level security;
alter table public.assignments enable row level security;
alter table public.test_cases enable row level security;
alter table public.submissions enable row level security;
alter table public.ics_scores enable row level security;
alter table public.comments enable row level security;

-- Profiles: tighten the existing professor policy from "every professor sees
-- every profile" to "the professor sees students in their own classes".
alter policy "profiles_select_own_or_professor" on public.profiles
  using (id = auth.uid() or public.is_professor_of_student(id));

alter policy "profiles_select_own_or_professor" on public.profiles
  rename to "profiles_select_own_or_class_professor";

-- Classes --------------------------------------------------------------------
create policy "classes_select_enrolled_or_professor" on public.classes
  for select to authenticated
  using (professor_id = auth.uid() or public.is_enrolled_in_class(id));

create policy "classes_insert_professor_own" on public.classes
  for insert to authenticated
  with check (professor_id = auth.uid() and public.is_professor());

create policy "classes_update_professor_own" on public.classes
  for update to authenticated
  using (professor_id = auth.uid() and public.is_professor())
  with check (professor_id = auth.uid() and public.is_professor());

create policy "classes_delete_professor_own" on public.classes
  for delete to authenticated
  using (professor_id = auth.uid() and public.is_professor());

-- Enrollments ----------------------------------------------------------------
create policy "enrollments_select_own_or_class_professor" on public.enrollments
  for select to authenticated
  using (student_id = auth.uid() or public.is_professor_of_class(class_id));

create policy "enrollments_insert_class_professor" on public.enrollments
  for insert to authenticated
  with check (public.is_professor_of_class(class_id));

create policy "enrollments_delete_class_professor" on public.enrollments
  for delete to authenticated
  using (public.is_professor_of_class(class_id));

-- Assignments ----------------------------------------------------------------
create policy "assignments_select_class_members" on public.assignments
  for select to authenticated
  using (public.is_professor_of_class(class_id) or public.is_enrolled_in_class(class_id));

create policy "assignments_insert_class_professor" on public.assignments
  for insert to authenticated
  with check (public.is_professor_of_class(class_id));

create policy "assignments_update_class_professor" on public.assignments
  for update to authenticated
  using (public.is_professor_of_class(class_id))
  with check (public.is_professor_of_class(class_id));

create policy "assignments_delete_class_professor" on public.assignments
  for delete to authenticated
  using (public.is_professor_of_class(class_id));

-- Test cases -----------------------------------------------------------------
-- NOTE: students can read expected_stdout for their classes, per the spec.
-- This is fine for sample tests but would leak hidden judge cases.
create policy "test_cases_select_class_members" on public.test_cases
  for select to authenticated
  using (
    public.is_professor_of_class(public.class_of_assignment(assignment_id))
    or public.is_enrolled_in_class(public.class_of_assignment(assignment_id))
  );

create policy "test_cases_insert_class_professor" on public.test_cases
  for insert to authenticated
  with check (public.is_professor_of_class(public.class_of_assignment(assignment_id)));

create policy "test_cases_update_class_professor" on public.test_cases
  for update to authenticated
  using (public.is_professor_of_class(public.class_of_assignment(assignment_id)))
  with check (public.is_professor_of_class(public.class_of_assignment(assignment_id)));

create policy "test_cases_delete_class_professor" on public.test_cases
  for delete to authenticated
  using (public.is_professor_of_class(public.class_of_assignment(assignment_id)));

-- Submissions ----------------------------------------------------------------
create policy "submissions_select_own_or_class_professor" on public.submissions
  for select to authenticated
  using (student_id = auth.uid() or public.is_professor_of_submission(id));

-- A student may only point final_snapshot_id at one of their own snapshots.
create policy "submissions_insert_own" on public.submissions
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and (
      final_snapshot_id is null
      or exists (
        select 1
        from public.code_snapshots
        where code_snapshots.id = submissions.final_snapshot_id
          and code_snapshots.user_id = auth.uid()
      )
    )
  );

-- Existing snapshot policies: replace the global professor read with the
-- class-scoped helper. The insert policy additionally prevents attaching a
-- snapshot to another student's submission.
alter policy "snapshots_select_own_or_professor" on public.code_snapshots
  using (auth.uid() = user_id or public.is_professor_of_submission(submission_id));

alter policy "snapshots_select_own_or_professor" on public.code_snapshots
  rename to "snapshots_select_own_or_class_professor";

alter policy "snapshots_insert_own" on public.code_snapshots
  with check (
    auth.uid() = user_id
    and (submission_id is null or public.owns_submission(submission_id))
  );

-- Paste events: professor read is scoped through the paste's snapshot. The
-- insert policy prevents referencing another student's snapshot.
alter policy "pastes_select_own_or_professor" on public.paste_events
  using (auth.uid() = user_id or public.is_professor_of_snapshot(snapshot_id));

alter policy "pastes_select_own_or_professor" on public.paste_events
  rename to "pastes_select_own_or_class_professor";

alter policy "pastes_insert_own" on public.paste_events
  with check (
    auth.uid() = user_id
    and (
      snapshot_id is null
      or exists (
        select 1
        from public.code_snapshots
        where code_snapshots.id = paste_events.snapshot_id
          and code_snapshots.user_id = auth.uid()
      )
    )
  );

-- ICS scores -----------------------------------------------------------------
create policy "ics_scores_select_owner_or_class_professor" on public.ics_scores
  for select to authenticated
  using (
    public.owns_submission(submission_id)
    or public.is_professor_of_submission(submission_id)
  );

create policy "ics_scores_insert_owner_or_class_professor" on public.ics_scores
  for insert to authenticated
  with check (
    public.owns_submission(submission_id)
    or public.is_professor_of_submission(submission_id)
  );

-- Upsert support for the professor "Recompute" action.
create policy "ics_scores_update_class_professor" on public.ics_scores
  for update to authenticated
  using (public.is_professor_of_submission(submission_id))
  with check (public.is_professor_of_submission(submission_id));

-- Comments -------------------------------------------------------------------
create policy "comments_select_submission_owner_or_class_professor" on public.comments
  for select to authenticated
  using (
    public.owns_submission(submission_id)
    or public.is_professor_of_submission(submission_id)
  );

create policy "comments_insert_class_professor" on public.comments
  for insert to authenticated
  with check (
    professor_id = auth.uid()
    and public.is_professor_of_submission(submission_id)
  );
