-- 20261114090800_assignment_file_names.sql
--
-- Assignments now carry the workspace file name students should open
-- (e.g. "fibonacci.py"). Nullable for existing rows; the app derives a
-- sensible fallback when it is missing.

alter table public.assignments
  add column if not exists file_name text;
