-- Adds the one field the Team Deals & Commission Ledger needs that `deals`
-- didn't have: each deal's agent commission split, as a percentage of GCI.
-- Additive/defaulted (70%, a common standard split) so existing rows and
-- every prior query against `deals` keep working unchanged. Commission
-- *payout* itself is deliberately not a stored column — it's derived
-- (gci * commission_split_pct / 100) wherever it's displayed or summed, so
-- it can never drift out of sync with gci/commission_split_pct the way a
-- stored, manually-updated payout column could.
alter table public.deals
  add column if not exists commission_split_pct numeric not null default 70 check (commission_split_pct >= 0 and commission_split_pct <= 100);
