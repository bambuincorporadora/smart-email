-- Supabase schema for Smart Mail
-- Stores user linkage to Microsoft, cached email metadata, and preferences.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  microsoft_oid text not null unique,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  lookback_days integer not null default 2,
  vip_senders text[] not null default array[]::text[],
  urgent_keywords text[] not null default array[]::text[],
  prompt_high text default '',
  prompt_medium text default '',
  prompt_low text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.preferences
  add column if not exists prompt_high text default '';

alter table public.preferences
  add column if not exists prompt_medium text default '';

alter table public.preferences
  add column if not exists prompt_low text default '';

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'preferences_set_updated_at'
  ) then
    create trigger preferences_set_updated_at
    before update on public.preferences
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id text not null,
  from_address text,
  from_name text,
  subject text,
  summary text,
  priority text check (priority in ('high', 'medium', 'low')),
  action_needed boolean not null default false,
  suggested_action text,
  implicit_deadline text,
  categories jsonb not null default '[]'::jsonb,
  received_at timestamptz,
  is_read boolean,
  is_seen boolean not null default false,
  is_resolved boolean not null default false,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, message_id)
);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'email_messages_set_updated_at'
  ) then
    create trigger email_messages_set_updated_at
    before update on public.email_messages
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

create index if not exists idx_email_messages_user_priority
  on public.email_messages (user_id, priority);

create index if not exists idx_email_messages_received_at
  on public.email_messages (received_at desc);

create table if not exists public.sync_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  delta_token text,
  last_synced_at timestamptz default now()
);
