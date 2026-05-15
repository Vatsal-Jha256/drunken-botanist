-- The Drunken Botanist — initial schema.
-- Run this once in the Supabase SQL Editor.

create table if not exists public.bar_inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  ingredient_name text not null,
  added_at timestamptz default now(),
  primary key (user_id, ingredient_name)
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  cocktail_id text not null,
  saved_at timestamptz default now(),
  primary key (user_id, cocktail_id)
);

create table if not exists public.tasting_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cocktail_id text not null,
  rating int check (rating between 1 and 5),
  note text,
  created_at timestamptz default now()
);

create index if not exists tasting_notes_user_cocktail_idx
  on public.tasting_notes (user_id, cocktail_id);

-- Naturalist's notebook — save field-guide (botanical) entries.
create table if not exists public.saved_botanicals (
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  saved_at timestamptz default now(),
  primary key (user_id, slug)
);

-- Row Level Security: users only see their own rows.
alter table public.bar_inventory    enable row level security;
alter table public.favorites        enable row level security;
alter table public.tasting_notes    enable row level security;
alter table public.saved_botanicals enable row level security;

drop policy if exists "own_rows_bar" on public.bar_inventory;
drop policy if exists "own_rows_fav" on public.favorites;
drop policy if exists "own_rows_notes" on public.tasting_notes;
drop policy if exists "own_rows_botanicals" on public.saved_botanicals;

create policy "own_rows_bar" on public.bar_inventory
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own_rows_fav" on public.favorites
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own_rows_notes" on public.tasting_notes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own_rows_botanicals" on public.saved_botanicals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
