-- 20261115090000_class_year_and_section.sql
--
-- Class metadata for the professor's class list and edit modal. Both fields
-- are optional free text so existing classes keep working.

alter table public.classes
  add column if not exists year_section text;

alter table public.classes
  add column if not exists academic_year text;
