-- 20261118150001_two_way_comments.sql
--
-- Two-way feedback:
--   * comments now record their author (professor or student), not just a
--     professor
--   * students may reply inside threads on their own submission
--
-- Existing rows are preserved by renaming professor_id; the FK is renamed too
-- so PostgREST embeds can use comments_author_id_fkey.

alter table public.comments rename column professor_id to author_id;
alter table public.comments rename constraint comments_professor_id_fkey to comments_author_id_fkey;

comment on column public.comments.author_id is
  'Author of the comment: the class professor or the submitting student.';

-- Professors keep the existing rules, expressed against the new column.
alter policy "comments_insert_class_professor" on public.comments
  with check (
    author_id = auth.uid()
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

-- Students can reply, but only inside a thread on their own submission. They
-- cannot start a new thread or comment on someone else's work.
create policy "comments_insert_submission_owner_reply" on public.comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.owns_submission(submission_id)
    and parent_id is not null
    and exists (
      select 1
      from public.comments parent
      where parent.id = comments.parent_id
        and parent.submission_id = comments.submission_id
    )
  );
