-- Run this in the Supabase SQL Editor for a project that already has the
-- lists and todos tables. Safe to run more than once.

alter table public.todos
  add column if not exists remind_at timestamptz;

create index if not exists todos_open_reminders_idx
  on public.todos (remind_at)
  where remind_at is not null and completed = false;
