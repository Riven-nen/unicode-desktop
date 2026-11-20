-- 20261114091600_assignment_auto_tests.sql
--
-- Professors choose whether an assignment exposes Judge0 auto tests to
-- students. Off means students still get the local terminal and can submit,
-- but no test-case tab or Run tests button.

alter table public.assignments
  add column if not exists auto_test_enabled boolean not null default true;
