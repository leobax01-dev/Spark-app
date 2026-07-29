-- Brokerage Command Suite — multi-seat B2B schema.
--
-- Extends the existing single-user `users` table with `role` and
-- `brokerage_id` (both nullable/defaulted, so existing rows and app code
-- keep working unchanged), and adds three new tables: `brokerages` (the
-- org itself, tier + seat_limit), `brokerage_invites` (one-time tokens for
-- agent onboarding), and `deals` (the shared pipeline the Broker Dashboard
-- aggregates over — this app previously only had per-agent client/deal
-- data in localStorage + agent_data_sync, nothing relational or
-- cross-agent, so a real `deals` table is new).
--
-- RLS on `deals` and `brokerages` is *not* service-role-only like
-- spark_os_tasks — BrokerDashboard.jsx and BrokerTeamSettings.jsx query
-- these directly from the browser with the authenticated user's session,
-- so real per-row policies are required to stop one brokerage from ever
-- reading another's data.

-- ── users: add role + brokerage_id ──────────────────────────────────────
alter table public.users
  add column if not exists role text not null default 'agent' check (role in ('agent', 'broker')),
  add column if not exists brokerage_id uuid;

-- ── brokerages ───────────────────────────────────────────────────────────
create table if not exists public.brokerages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier text not null default 'boutique' check (tier in ('boutique', 'growth', 'enterprise')),
  seat_limit integer not null default 10,
  owner_user_id uuid references public.users(id),
  stripe_customer_id text,
  stripe_subscription_id text,
  billing_status text not null default 'active' check (billing_status in ('active', 'past_due', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users
  add constraint users_brokerage_id_fkey foreign key (brokerage_id)
  references public.brokerages(id) on delete set null;

create or replace function public.brokerages_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists brokerages_updated_at on public.brokerages;
create trigger brokerages_updated_at
  before update on public.brokerages
  for each row
  execute function public.brokerages_set_updated_at();

-- ── brokerage_invites — single-use agent onboarding tokens ─────────────
create table if not exists public.brokerage_invites (
  id uuid primary key default gen_random_uuid(),
  brokerage_id uuid not null references public.brokerages(id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  used_by uuid references public.users(id),
  used_at timestamptz
);

-- ── deals — the shared pipeline BrokerDashboard aggregates over ────────
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  brokerage_id uuid not null references public.brokerages(id) on delete cascade,
  agent_id uuid not null references public.users(id),
  client_name text,
  address text,
  stage text not null default 'active' check (stage in ('prospect', 'active', 'contract', 'closed')),
  status text not null default 'on_track' check (status in ('on_track', 'stalled', 'at_risk')),
  deal_volume numeric not null default 0,
  gci numeric not null default 0,
  war_room_active boolean not null default false,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists deals_updated_at on public.deals;
create trigger deals_updated_at
  before update on public.deals
  for each row
  execute function public.brokerages_set_updated_at();

create index if not exists deals_brokerage_id_idx on public.deals (brokerage_id);
create index if not exists deals_agent_id_idx on public.deals (agent_id);
create index if not exists users_brokerage_id_idx on public.users (brokerage_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.brokerages enable row level security;
alter table public.deals enable row level security;
alter table public.brokerage_invites enable row level security;

-- Members (broker or agent) can read their own brokerage row.
drop policy if exists "brokerage members can view their brokerage" on public.brokerages;
create policy "brokerage members can view their brokerage" on public.brokerages
  for select
  using (id in (select brokerage_id from public.users where id = auth.uid()));

-- Brokers see every deal in their brokerage; agents see only their own.
-- (No INSERT/UPDATE/DELETE policies — writes go through service-role API
-- routes only, same posture as spark_os_tasks.)
drop policy if exists "brokers view brokerage deals" on public.deals;
create policy "brokers view brokerage deals" on public.deals
  for select
  using (
    brokerage_id in (
      select brokerage_id from public.users
      where id = auth.uid() and role = 'broker'
    )
  );

drop policy if exists "agents view own deals" on public.deals;
create policy "agents view own deals" on public.deals
  for select
  using (agent_id = auth.uid());

-- Invites are never readable by anon/authenticated clients directly —
-- acceptance goes through api/brokerage/accept-invite.js (service role),
-- which is the only thing that should ever look up a token.
