-- SPARK OS multi-tenancy hardening — additive on top of
-- 20260729000000_create_brokerage_suite.sql. Everything here uses
-- IF NOT EXISTS / DROP POLICY IF EXISTS / exception-guarded DDL so it's
-- safe to run whether or not that first migration already ran.
--
-- IMPORTANT — read before applying: this migration enables RLS on
-- `public.users` for the first time. The app's login flow
-- (src/App.jsx, `sb.from("users").select(...).eq("email",...)`) runs as
-- the authenticated user and MUST be able to read its own row, or every
-- login breaks the moment this ships. A "read/update own row" policy is
-- included below specifically to prevent that — do not remove it.

-- ── brokerages: pilot_seat_limit + active_seats ─────────────────────────
-- pilot_seat_limit replaces the earlier `seat_limit` column (same concept,
-- renamed to match the pilot-program naming used everywhere else in this
-- spec); active_seats becomes a real stored counter instead of a derived
-- COUNT(*) — every seat-changing code path (invite acceptance, revoke,
-- webhook provisioning) must now increment/decrement it explicitly. See
-- api/_lib/brokerage.js for where that's enforced.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='brokerages' and column_name='seat_limit')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='brokerages' and column_name='pilot_seat_limit') then
    alter table public.brokerages rename column seat_limit to pilot_seat_limit;
  end if;
end $$;

alter table public.brokerages
  add column if not exists pilot_seat_limit integer,
  add column if not exists active_seats integer not null default 0;

update public.brokerages set pilot_seat_limit = 10 where pilot_seat_limit is null;
alter table public.brokerages alter column pilot_seat_limit set not null;

-- Backfill active_seats from reality (count of users currently attached)
-- once, at migration time — after this, application code owns the counter.
update public.brokerages b
set active_seats = (select count(*) from public.users u where u.brokerage_id = b.id);

-- ── users: role + brokerage_id (idempotent — may already exist) ────────
alter table public.users
  add column if not exists role text not null default 'agent' check (role in ('agent', 'broker')),
  add column if not exists brokerage_id uuid;

do $$
begin
  alter table public.users
    add constraint users_brokerage_id_fkey foreign key (brokerage_id)
    references public.brokerages(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

-- Defense in depth: RLS policies below let a broker UPDATE a teammate's
-- row, and let a user update their own row — neither should be able to
-- hand themselves/someone else `role='broker'` or move a user into a
-- different brokerage_id outside the sanctioned seat-provisioning API
-- (api/brokerage/team.js), which uses the service role and is exempt from
-- this trigger. This is what actually makes "strictly within scope" strict,
-- since column-level RLS doesn't exist in Postgres.
create or replace function public.prevent_role_and_brokerage_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.role is distinct from old.role or new.brokerage_id is distinct from old.brokerage_id then
    raise exception 'role and brokerage_id can only be changed via the service-role brokerage API';
  end if;
  return new;
end;
$$;

drop trigger if exists users_prevent_escalation on public.users;
create trigger users_prevent_escalation
  before update on public.users
  for each row
  execute function public.prevent_role_and_brokerage_escalation();

-- ── SECURITY DEFINER helpers ─────────────────────────────────────────────
-- A policy on `users` that queries `users` to check the caller's own role
-- recurses (RLS re-evaluates on the inner query too). SECURITY DEFINER
-- functions run as their owner (the migration role, which owns the table
-- and isn't subject to RLS on it unless FORCE ROW LEVEL SECURITY is set,
-- which it isn't here) — the standard, documented way around this.
create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.current_user_brokerage_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select brokerage_id from public.users where id = auth.uid();
$$;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_brokerage_id() to authenticated;

-- ── war_room_deals / client_dossiers / deal_negotiator_logs ────────────
-- None of these existed before this migration — the app's prior "deal"
-- concept was per-agent localStorage (see ClientPanel.jsx) plus the
-- brokerage-scoped `deals` table added in the prior migration. These three
-- are the organization-wide telemetry tables this spec asks for
-- specifically, kept intentionally lean (add columns as real features land
-- rather than guessing a business shape that isn't specified yet).
create table if not exists public.war_room_deals (
  id uuid primary key default gen_random_uuid(),
  brokerage_id uuid not null references public.brokerages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  deal_name text,
  negotiation_stage text not null default 'open' check (negotiation_stage in ('open', 'countered', 'accepted', 'rejected', 'closed')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.client_dossiers (
  id uuid primary key default gen_random_uuid(),
  brokerage_id uuid not null references public.brokerages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  client_name text,
  notes text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.deal_negotiator_logs (
  id uuid primary key default gen_random_uuid(),
  brokerage_id uuid not null references public.brokerages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  war_room_deal_id uuid references public.war_room_deals(id) on delete set null,
  log_entry text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists war_room_deals_updated_at on public.war_room_deals;
create trigger war_room_deals_updated_at before update on public.war_room_deals
  for each row execute function public.set_updated_at();

drop trigger if exists client_dossiers_updated_at on public.client_dossiers;
create trigger client_dossiers_updated_at before update on public.client_dossiers
  for each row execute function public.set_updated_at();

create index if not exists war_room_deals_brokerage_id_idx on public.war_room_deals (brokerage_id);
create index if not exists war_room_deals_user_id_idx on public.war_room_deals (user_id);
create index if not exists client_dossiers_brokerage_id_idx on public.client_dossiers (brokerage_id);
create index if not exists client_dossiers_user_id_idx on public.client_dossiers (user_id);
create index if not exists deal_negotiator_logs_brokerage_id_idx on public.deal_negotiator_logs (brokerage_id);
create index if not exists deal_negotiator_logs_user_id_idx on public.deal_negotiator_logs (user_id);

-- ── atomic seat counter RPCs ─────────────────────────────────────────────
-- active_seats is now a stored column (see above) — these do the
-- increment/decrement as a single atomic UPDATE instead of the calling
-- code doing SELECT-then-UPDATE, which would race under concurrent
-- invite-accepts/revokes. Called from api/_lib/brokerage.js via
-- supabase.rpc(...) using the service-role client, so these are
-- SECURITY DEFINER purely for consistency with the other helpers here,
-- not because client-side callers are expected to invoke them directly.
create or replace function public.increment_active_seats(target_brokerage_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.brokerages set active_seats = active_seats + 1 where id = target_brokerage_id;
$$;

create or replace function public.decrement_active_seats(target_brokerage_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.brokerages set active_seats = greatest(0, active_seats - 1) where id = target_brokerage_id;
$$;

-- ── ENABLE RLS ───────────────────────────────────────────────────────────
alter table public.brokerages enable row level security;
alter table public.users enable row level security;
alter table public.war_room_deals enable row level security;
alter table public.client_dossiers enable row level security;
alter table public.deal_negotiator_logs enable row level security;

-- ── users policies ───────────────────────────────────────────────────────
-- Required for login/self-service to keep working (see warning at top).
drop policy if exists "users can view own row" on public.users;
create policy "users can view own row" on public.users
  for select
  using (id = auth.uid());

drop policy if exists "users can update own row" on public.users;
create policy "users can update own row" on public.users
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Brokers can view every user row in their own brokerage (agent activity /
-- team roster) — uses the SECURITY DEFINER helper, not a subquery on
-- `users` directly, to avoid RLS recursion.
drop policy if exists "brokers view brokerage members" on public.users;
create policy "brokers view brokerage members" on public.users
  for select
  using (
    public.current_user_role() = 'broker'
    and brokerage_id = public.current_user_brokerage_id()
  );

-- Brokers can update seat allocations / profile metadata for members of
-- their own brokerage (the `users_prevent_escalation` trigger above still
-- blocks a broker from changing role/brokerage_id through this policy —
-- "strictly within scope" is enforced by both the RLS predicate AND the
-- trigger, not RLS alone).
drop policy if exists "brokers update brokerage members" on public.users;
create policy "brokers update brokerage members" on public.users
  for update
  using (
    public.current_user_role() = 'broker'
    and brokerage_id = public.current_user_brokerage_id()
  )
  with check (
    public.current_user_role() = 'broker'
    and brokerage_id = public.current_user_brokerage_id()
  );

-- ── brokerages policies ──────────────────────────────────────────────────
drop policy if exists "brokerage members can view their brokerage" on public.brokerages;
create policy "brokerage members can view their brokerage" on public.brokerages
  for select
  using (id = public.current_user_brokerage_id());

-- ── war_room_deals / client_dossiers / deal_negotiator_logs policies ───
-- Agents: full CRUD, but only ever on rows they own.
-- Brokers: read-only across their whole brokerage (org-wide visibility,
-- not a replacement for agent ownership of their own records).
do $$
declare
  t text;
begin
  foreach t in array array['war_room_deals', 'client_dossiers', 'deal_negotiator_logs']
  loop
    execute format('drop policy if exists "agents manage own rows" on public.%I', t);
    execute format($p$
      create policy "agents manage own rows" on public.%I
        for all
        using (user_id = auth.uid())
        with check (user_id = auth.uid())
    $p$, t);

    execute format('drop policy if exists "brokers view brokerage rows" on public.%I', t);
    execute format($p$
      create policy "brokers view brokerage rows" on public.%I
        for select
        using (
          public.current_user_role() = 'broker'
          and brokerage_id = public.current_user_brokerage_id()
        )
    $p$, t);
  end loop;
end $$;
