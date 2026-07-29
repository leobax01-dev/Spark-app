-- Adds the two fields Spark's executive brain needs that `deals` didn't
-- have yet: a close probability (0-100) for "at-risk" scoring beyond just
-- the existing `status` enum, and an expected closing_date for pipeline
-- timing questions ("what closes this month"). Additive, nullable/defaulted
-- so existing rows and the earlier broker-copilot endpoint keep working.
alter table public.deals
  add column if not exists probability integer not null default 50 check (probability >= 0 and probability <= 100),
  add column if not exists closing_date date;

create index if not exists deals_closing_date_idx on public.deals (closing_date);
