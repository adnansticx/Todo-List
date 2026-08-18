-- Shared realtime Todo List schema
-- Copy and paste this entire file into the Supabase SQL Editor and run it.
--
-- SECURITY TRADEOFF (anonymous shared links, no login):
-- This app uses capability URLs. A list ID is a hard-to-guess secret.
-- Anyone who has the URL /list/<id> can read and write that list.
-- That is the intended Google-Docs-with-a-link experience.
--
-- Row Level Security is enabled so the table is not open without policies.
-- Because there is no user login, policies allow the public `anon` role
-- to create lists and to read/write todos.
--
-- Unguessable list IDs (10-character random values) make it impractical
-- to find someone else's list by guessing. Anyone who has your Supabase
-- anon key (it ships in the frontend, which is normal) could still query
-- all rows if they inspect the app. That is the practical limit of
-- anonymous shared-link apps without a backend or login.
--
-- NEVER put the service_role key in the React app.

create table if not exists public.lists (
  id text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  list_id text not null references public.lists (id) on delete cascade,
  task text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint todos_task_length check (char_length(task) between 1 and 500)
);

create index if not exists todos_list_id_created_at_idx
  on public.todos (list_id, created_at);

alter table public.lists enable row level security;
alter table public.todos enable row level security;

drop policy if exists "Anyone can create a list" on public.lists;
create policy "Anyone can create a list"
  on public.lists
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Anyone can read a list by id" on public.lists;
create policy "Anyone can read a list by id"
  on public.lists
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can read todos" on public.todos;
create policy "Anyone can read todos"
  on public.todos
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can insert todos" on public.todos;
create policy "Anyone can insert todos"
  on public.todos
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.lists
      where lists.id = list_id
    )
  );

drop policy if exists "Anyone can update todos" on public.todos;
create policy "Anyone can update todos"
  on public.todos
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Anyone can delete todos" on public.todos;
create policy "Anyone can delete todos"
  on public.todos
  for delete
  to anon, authenticated
  using (true);

-- Realtime: INSERT, UPDATE, and DELETE events for the todos table.
-- FULL is required so DELETE events carry list_id, otherwise the
-- client's list_id filter drops them and deletes never sync.
alter table public.todos replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'todos'
  ) then
    execute 'alter publication supabase_realtime add table public.todos';
  end if;
end
$$;
