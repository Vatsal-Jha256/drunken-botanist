-- Naturalist field notes for real-world botanical observations.
-- Run after 0001_init.sql.

create table if not exists public.botanical_field_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  observed_at date default current_date,
  location text,
  note text not null,
  created_at timestamptz default now()
);

create index if not exists botanical_field_notes_user_slug_idx
  on public.botanical_field_notes (user_id, slug);

create index if not exists botanical_field_notes_user_observed_idx
  on public.botanical_field_notes (user_id, observed_at desc);

alter table public.botanical_field_notes enable row level security;

drop policy if exists "own_rows_botanical_field_notes" on public.botanical_field_notes;

create policy "own_rows_botanical_field_notes" on public.botanical_field_notes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
