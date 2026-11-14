-- 20261114090600_grading_hidden_tests_and_comment_threads.sql
--
-- Step 2 schema additions:
--   * grade fields on submissions + a professor-only UPDATE policy
--   * hidden test cases (students never see is_hidden = true)
--   * comment threading via a nullable self-reference
--
-- Additive only; ALTER POLICY is used for the existing test-case policy so
-- there are no DROP statements.

-- Grading --------------------------------------------------------------------
alter table public.submissions
  add column if not exists grade numeric,
  add column if not exists graded_at timestamptz,
  add column if not exists graded_by uuid references public.profiles (id) on delete set null;

-- Row-level: only the class professor may update a submission. Students have
-- no UPDATE policy, so every student UPDATE is denied by RLS.
create policy "submissions_update_grading_class_professor" on public.submissions
  for update to authenticated
  using (public.is_professor_of_submission(id))
  with check (public.is_professor_of_submission(id));

-- Column-level: RLS is row-level, so a guard trigger keeps the professor's
-- update confined to grade/graded_at/graded_by. (status changes are a
-- separate workflow and would need a follow-up migration.)
create or replace function public.guard_submission_grade_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- auth.uid() is null for service-role migrations and seeding.
  if auth.uid() is not null then
    if new.assignment_id is distinct from old.assignment_id
      or new.student_id is distinct from old.student_id
      or new.final_snapshot_id is distinct from old.final_snapshot_id
      or new.status is distinct from old.status
      or new.submitted_at is distinct from old.submitted_at then
      raise exception 'Only grade, graded_at and graded_by may be updated';
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'guard_submission_grade_update'
      and tgrelid = 'public.submissions'::regclass
  ) then
    create trigger guard_submission_grade_update
      before update on public.submissions
      for each row execute function public.guard_submission_grade_update();
  end if;
end $$;

revoke execute on function public.guard_submission_grade_update() from public, anon, authenticated;

-- Hidden test cases -----------------------------------------------------------
alter table public.test_cases
  add column if not exists is_hidden boolean not null default false;

-- Professors see every case; students only see visible ones. The assignment
-- class check still applies to both branches.
alter policy "test_cases_select_class_members" on public.test_cases
  using (
    public.is_professor_of_class(public.class_of_assignment(assignment_id))
    or (
      is_hidden = false
      and public.is_enrolled_in_class(public.class_of_assignment(assignment_id))
    )
  );

-- Comment threading ----------------------------------------------------------
alter table public.comments
  add column if not exists parent_id uuid references public.comments (id) on delete cascade;

create index if not exists comments_parent_idx on public.comments (parent_id);

-- A reply must target another comment on the same submission.
alter policy "comments_insert_class_professor" on public.comments
  with check (
    professor_id = auth.uid()
    and public.is_professor_of_submission(submission_id)
    and (
      parent_id is null
      or exists (
        select 1
        from public.comments parent
        where parent.id = comments.parent_id
          and parent.submission_id = comments.submission_id
      )
    )
  );

-- ICS column semantics -------------------------------------------------------
-- The four *_term columns store weighted contributions on a 0-100 scale, so
-- ics = paste_term + cadence_term + focus_term + compilation_term.
comment on column public.ics_scores.paste_term is
  'Weighted paste contribution: 100 * 0.35 * (1 - P), P = pasted chars / inserted chars';
comment on column public.ics_scores.cadence_term is
  'Weighted cadence contribution: 100 * 0.25 * C, C normalized to [0,1]';
comment on column public.ics_scores.focus_term is
  'Weighted focus contribution: 100 * 0.20 * F, F normalized to [0,1]';
comment on column public.ics_scores.compilation_term is
  'Weighted compilation contribution: 100 * 0.20 * K, K normalized to [0,1]';
comment on column public.ics_scores.ics is
  'ICS = paste_term + cadence_term + focus_term + compilation_term (0-100)';
