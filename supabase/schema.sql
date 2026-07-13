-- Agent Preflight Schema
-- Run this in your Supabase SQL editor to set up the database.

-- ============================================================
-- SCAN REPORTS
-- Stores completed scan results for persistence and history.
-- ============================================================
create table if not exists public.scan_reports (
  id            text primary key,
  repo_name     text not null,
  repo_url      text,
  branch        text,
  timestamp     bigint not null,
  duration      bigint not null,
  status        text not null check (status in ('complete', 'error', 'cancelled')),
  error         text,
  score_percentage real not null,
  total_checks  int not null default 0,
  passed_checks int not null default 0,
  failed_checks int not null default 0,
  warning_checks int not null default 0,
  raw_report    jsonb,
  user_id       uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

alter table public.scan_reports enable row level security;

-- Everyone can read their own reports or public (unowned) reports
create policy "Users can read their own scan reports"
  on public.scan_reports for select
  to authenticated
  using ( (select auth.uid()) = user_id );

-- Anonymous users can insert without a user_id
create policy "Anyone can insert scan reports"
  on public.scan_reports for insert
  to anon, authenticated
  with check ( true );

-- Only owners can delete
create policy "Users can delete their own reports"
  on public.scan_reports for delete
  to authenticated
  using ( (select auth.uid()) = user_id );

-- ============================================================
-- SCAN HISTORY
-- Lightweight metadata index for the history list.
-- ============================================================
create table if not exists public.scan_history (
  id            uuid primary key default gen_random_uuid(),
  report_id     text not null references public.scan_reports(id) on delete cascade,
  repo_name     text not null,
  score         real not null,
  status        text not null check (status in ('complete', 'error', 'cancelled')),
  timestamp     bigint not null,
  user_id       uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

alter table public.scan_history enable row level security;

create policy "Users can read their own scan history"
  on public.scan_history for select
  to authenticated
  using ( (select auth.uid()) = user_id );

create policy "Anyone can insert scan history"
  on public.scan_history for insert
  to anon, authenticated
  with check ( true );

create policy "Users can delete their own history"
  on public.scan_history for delete
  to authenticated
  using ( (select auth.uid()) = user_id );

-- ============================================================
-- USER SETTINGS
-- Per-user preferences persisted across sessions.
-- ============================================================
create table if not exists public.user_settings (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  theme         text not null default 'dark' check (theme in ('dark', 'light')),
  scan_on_open  boolean not null default false,
  updated_at    timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "Users can read their own settings"
  on public.user_settings for select
  to authenticated
  using ( (select auth.uid()) = user_id );

create policy "Users can upsert their own settings"
  on public.user_settings for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

create policy "Users can update their own settings"
  on public.user_settings for update
  to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_scan_reports_user_id on public.scan_reports(user_id);
create index if not exists idx_scan_reports_created_at on public.scan_reports(created_at desc);
create index if not exists idx_scan_history_user_id on public.scan_history(user_id);
create index if not exists idx_scan_history_timestamp on public.scan_history(timestamp desc);
