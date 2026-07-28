-- SPARK_OS task log — replaces writing .md files to SPARK_OS/02-Tasks/,
-- which is unwritable in production (Vercel functions run on a read-only
-- filesystem). Written and read exclusively by api/_lib/tasks.js via the
-- Supabase service-role key, never by anon/authenticated clients directly.

create table if not exists public.spark_os_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  owner text not null,               -- e.g. "CFO_Agent"
  agent_slug text not null,          -- e.g. "cfo"
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High')),
  status text not null default 'Pending' check (status in ('Pending', 'Needs_Approval', 'Completed')),
  source text not null default 'command-center',
  directive text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists spark_os_tasks_status_idx on public.spark_os_tasks (status);
create index if not exists spark_os_tasks_created_at_idx on public.spark_os_tasks (created_at desc);

create or replace function public.spark_os_tasks_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists spark_os_tasks_updated_at on public.spark_os_tasks;
create trigger spark_os_tasks_updated_at
  before update on public.spark_os_tasks
  for each row
  execute function public.spark_os_tasks_set_updated_at();

-- RLS enabled with no policies: only the service-role key (used server-side
-- in api/_lib/tasks.js) can read/write this table. It bypasses RLS
-- entirely, so anon/authenticated clients are correctly locked out by
-- default rather than needing an explicit deny policy.
alter table public.spark_os_tasks enable row level security;
