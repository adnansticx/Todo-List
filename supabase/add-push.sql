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
