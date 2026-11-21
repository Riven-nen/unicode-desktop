-- 20261123093000_exam_mode_ics.sql
--
-- Seatworks block paste. Paste therefore cannot be evidence for or against a
-- student in exam mode. Wrap the v3 recompute, preserve the remaining evidence
-- score, and mark the row so the review UI can show Paste as N/A.

alter table public.ics_scores
  add column if not exists exam_mode boolean not null default false;

alter function public.recompute_ics(uuid) rename to recompute_ics_base;

create or replace function public.recompute_ics(target_submission uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_ics_base(target_submission);

  if exists (
    select 1
    from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    where s.id = target_submission and a.kind = 'seatwork'
  ) then
    update public.ics_scores
    set exam_mode = true,
        evidence = jsonb_set(coalesce(evidence, '{}'::jsonb), '{paste}', '0'::jsonb, true),
        band_reason = concat_ws(
          ' ',
          band_reason,
          'Exam mode: paste is blocked and treated as N/A.'
        )
    where submission_id = target_submission;
  end if;
end;
$$;

revoke all on function public.recompute_ics(uuid) from public, anon;
grant execute on function public.recompute_ics(uuid) to authenticated, service_role;
revoke all on function public.recompute_ics_base(uuid) from public, anon, authenticated;
grant execute on function public.recompute_ics_base(uuid) to service_role;
