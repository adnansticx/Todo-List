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
  remind_at timestamptz,
  created_at timestamptz not null default now(),
  constraint todos_task_length check (char_length(task) between 1 and 500)
);

-- Existing projects already have the table, so create-if-not-exists will not
-- add the column. This alter is safe to run more than once.
alter table public.todos
  add column if not exists remind_at timestamptz;

create index if not exists todos_open_reminders_idx
  on public.todos (remind_at)
  where remind_at is not null and completed = false;

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


-- Lets a phone or laptop receive a reminder after Chrome is closed.
-- Safe to run more than once in the Supabase SQL Editor.

alter table public.todos
  add column if not exists remind_at timestamptz;

create index if not exists todos_open_reminders_idx
  on public.todos (remind_at)
  where remind_at is not null and completed = false;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  origin text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscription_lists (
  subscription_id uuid not null references public.push_subscriptions (id) on delete cascade,
  list_id text not null,
  primary key (subscription_id, list_id)
);

create index if not exists push_subscription_lists_list_id_idx
  on public.push_subscription_lists (list_id);

create table if not exists public.reminder_deliveries (
  todo_id uuid not null,
  remind_at timestamptz not null,
  sent_at timestamptz not null default now(),
  primary key (todo_id, remind_at)
);

alter table public.push_subscriptions enable row level security;
alter table public.push_subscription_lists enable row level security;
alter table public.reminder_deliveries enable row level security;

create or replace function public.register_push_device(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_list_id text,
  p_origin text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
begin
  if p_endpoint is null
    or length(p_endpoint) > 2048
    or p_endpoint !~ '^https://'
    or p_p256dh is null
    or length(p_p256dh) < 8
    or length(p_p256dh) > 200
    or p_auth is null
    or length(p_auth) < 8
    or length(p_auth) > 200
    or p_list_id is null
    or p_list_id !~ '^[a-z0-9]{8,64}$'
    or p_origin is null
    or (
      p_origin !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?$'
      and p_origin !~ '^http://(localhost|127[.]0[.]0[.]1)(:[0-9]+)?$'
    )
  then
    raise exception 'invalid push registration';
  end if;

  insert into public.push_subscriptions (endpoint, p256dh, auth, origin)
  values (p_endpoint, p_p256dh, p_auth, p_origin)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        origin = excluded.origin,
        updated_at = now()
  returning id into sid;

  insert into public.push_subscription_lists (subscription_id, list_id)
  values (sid, p_list_id)
  on conflict do nothing;
end;
$$;

revoke all on function public.register_push_device(text, text, text, text, text) from public;
grant execute on function public.register_push_device(text, text, text, text, text) to anon, authenticated;

