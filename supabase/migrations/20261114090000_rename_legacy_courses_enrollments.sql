-- 20261114090000_rename_legacy_courses_enrollments.sql
--
-- The enrollment-folder iteration created `courses` and `enrollments`.
-- Both are empty. Rename them out of the way so the professor-dashboard
-- schema can own the `enrollments` name and introduce `classes`.
--
-- This is a rename of empty tables. Nothing is dropped, truncated, or deleted.
-- The tables and their indexes remain available as `*_legacy` for review.

alter table if exists public.courses rename to courses_legacy;
alter table if exists public.enrollments rename to enrollments_legacy;

-- Index names are schema-wide. Renaming the tables does not rename their
-- indexes, so the new `enrollments` primary key would collide with
-- `enrollments_pkey` without this step.
alter index if exists public.courses_pkey rename to courses_legacy_pkey;
alter index if exists public.courses_professor_idx rename to courses_legacy_professor_idx;
alter index if exists public.enrollments_pkey rename to enrollments_legacy_pkey;
alter index if exists public.enrollments_course_id_student_id_key
  rename to enrollments_legacy_course_student_key;
alter index if exists public.enrollments_student_idx rename to enrollments_legacy_student_idx;

-- `is_course_professor` is a SQL function whose body names `courses`. Keep it
-- valid immediately after the rename by pointing at the renamed table; the
-- helpers migration redefines it against `classes`. This is option (b) from
-- the Step 1 decisions: update after the rename, no DROP FUNCTION.
create or replace function public.is_course_professor(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.courses_legacy
    where courses_legacy.id = target and courses_legacy.professor_id = auth.uid()
  );
$$;
