-- Demo data seed for team@usesparkai.app's brokerage — luxury real estate
-- deals for testing BrokerDashboard / SparkHUD / the broker-copilot with
-- realistic numbers instead of an empty pipeline.
--
-- This is a DATA seed, not a schema change — using the migrations pipeline
-- for it anyway because it's the only write path against the remote DB
-- available in this environment (ad-hoc `supabase db query` is blocked by
-- this project's Network Restrictions; `supabase db push` goes through the
-- Management API instead and works). Guarded so it's safe either way:
--   1. Looks up the user by email and REQUIRES role='broker' with a
--      non-null brokerage_id — raises and aborts the whole migration
--      (nothing gets inserted) if that user doesn't exist or isn't a
--      provisioned broker, rather than guessing or inserting orphaned rows.
--   2. Only seeds if that brokerage has zero deals already, so re-running
--      `db push` (or applying this on another environment that already has
--      real data) is a no-op instead of duplicating rows.
do $$
declare
  target_user_id uuid;
  target_brokerage_id uuid;
  existing_deal_count integer;
begin
  select id, brokerage_id into target_user_id, target_brokerage_id
  from public.users
  where email = 'team@usesparkai.app';

  if target_user_id is null then
    raise exception 'No user found with email team@usesparkai.app — seed aborted, nothing inserted.';
  end if;

  if target_brokerage_id is null then
    raise exception 'User team@usesparkai.app has no brokerage_id (role is not an active broker yet) — seed aborted, nothing inserted.';
  end if;

  select count(*) into existing_deal_count from public.deals where brokerage_id = target_brokerage_id;
  if existing_deal_count > 0 then
    raise notice 'Brokerage % already has % deal(s) — skipping seed to avoid duplicating data.', target_brokerage_id, existing_deal_count;
    return;
  end if;

  raise notice 'Seeding luxury demo deals for user % / brokerage %', target_user_id, target_brokerage_id;

  insert into public.deals
    (brokerage_id, agent_id, client_name, address, stage, status, deal_volume, gci, probability, closing_date, war_room_active, last_activity_at)
  values
    -- Active, healthy pipeline
    (target_brokerage_id, target_user_id, 'Whitfield Family Trust', '145 Ocean Drive, Miami Beach, FL', 'contract', 'on_track', 8_250_000, 206_250, 85, current_date + interval '18 days', true,  now() - interval '1 day'),
    (target_brokerage_id, target_user_id, 'Marcus & Elena Voss',    '900 North Crescent Dr, Beverly Hills, CA', 'active',   'on_track', 12_500_000, 312_500, 65, current_date + interval '45 days', true,  now() - interval '2 days'),
    (target_brokerage_id, target_user_id, 'Kensington Holdings LLC','1 Central Park West, Manhattan, NY', 'contract', 'on_track', 15_800_000, 395_000, 90, current_date + interval '12 days', false, now() - interval '1 day'),
    (target_brokerage_id, target_user_id, 'Dr. Priya Nakamura',     '77 Gray Head Ln, East Hampton, NY', 'active',   'on_track', 6_900_000, 172_500, 60, current_date + interval '60 days', false, now() - interval '4 days'),
    (target_brokerage_id, target_user_id, 'The Alden Group',        '42 Ridge Rd, Aspen, CO', 'prospect', 'on_track', 9_400_000, 235_000, 35, current_date + interval '90 days', false, now() - interval '6 days'),

    -- At-risk / stalled — the Intervention Feed's real reason to exist
    (target_brokerage_id, target_user_id, 'Bennett-Oyelaran Estate','2200 Sunset Plaza Dr, Los Angeles, CA', 'active', 'at_risk', 5_600_000, 140_000, 30, current_date + interval '20 days', true,  now() - interval '9 days'),
    (target_brokerage_id, target_user_id, 'Whitmore International', '1 Billionaires Row, Manhattan, NY', 'active', 'stalled', 22_000_000, 550_000, 20, current_date + interval '75 days', true,  now() - interval '14 days'),
    (target_brokerage_id, target_user_id, 'Castellano Vineyard Trust','8500 Sonoma Hwy, Sonoma, CA', 'contract', 'at_risk', 4_100_000, 102_500, 45, current_date + interval '10 days', false, now() - interval '11 days'),

    -- Recently closed — historical GCI so aggregates aren't all "pending"
    (target_brokerage_id, target_user_id, 'Harrington Family',      '55 Bellagio Rd, Bel Air, CA', 'closed', 'on_track', 18_750_000, 468_750, 100, current_date - interval '5 days', false, now() - interval '5 days'),
    (target_brokerage_id, target_user_id, 'Soo-Jin & David Park',   '310 Worth Ave, Palm Beach, FL', 'closed', 'on_track', 7_300_000, 182_500, 100, current_date - interval '22 days', false, now() - interval '22 days');

  insert into public.war_room_deals
    (brokerage_id, user_id, deal_name, negotiation_stage, details)
  select
    target_brokerage_id, target_user_id, d.client_name,
    case d.status when 'on_track' then 'countered' else 'open' end,
    jsonb_build_object('deal_volume', d.deal_volume, 'address', d.address)
  from public.deals d
  where d.brokerage_id = target_brokerage_id and d.war_room_active = true;

  raise notice 'Seed complete: % deals, % active War Room negotiations.',
    (select count(*) from public.deals where brokerage_id = target_brokerage_id),
    (select count(*) from public.war_room_deals where brokerage_id = target_brokerage_id);
end $$;
