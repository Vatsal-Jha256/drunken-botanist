-- Private owner notes for the embedded book reader.
-- Run after 0002_botanical_field_notes.sql.

create table if not exists public.book_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('bookmark', 'snippet')),
  page int check (page is null or page > 0),
  title text,
  snippet text,
  note text,
  created_at timestamptz default now()
);

create index if not exists book_notes_user_created_idx
  on public.book_notes (user_id, created_at desc);

create index if not exists book_notes_user_page_idx
  on public.book_notes (user_id, page);

alter table public.book_notes enable row level security;

drop policy if exists "own_rows_book_notes" on public.book_notes;

create policy "own_rows_book_notes" on public.book_notes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
