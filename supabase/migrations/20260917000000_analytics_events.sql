-- ============================================================================
-- Council Yanga — Shared Analytics Events
-- Migration: 20260917000000_analytics_events.sql
--
-- Backs the Admin > Analytics section with real, cross-visitor data. Until
-- now `src/analytics.ts` only wrote events to the browser's own localStorage,
-- so the dashboard only ever showed the admin's own device — not real
-- Public Portal traffic (page/tab views, devices, traffic sources, most
-- viewed projects, etc.). This table lets every visitor's browser log
-- events centrally, and lets admins read the aggregate.
-- ============================================================================

create table if not exists analytics_events (
  id text primary key,               -- client-generated id, e.g. 'E-...'
  type text not null,                -- AnalyticsEventType, e.g. 'page_view'
  label text,
  meta jsonb,
  ts bigint not null,                -- epoch ms, client clock
  event_date date not null,          -- YYYY-MM-DD, client-local day bucket
  session_id text not null,
  visitor_id text not null,
  is_new_visitor boolean not null default false,
  device text,                       -- 'mobile' | 'tablet' | 'desktop'
  lang text,
  referrer text,
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_events_date on analytics_events (event_date);
create index if not exists idx_analytics_events_type on analytics_events (type);
create index if not exists idx_analytics_events_session on analytics_events (session_id);
create index if not exists idx_analytics_events_visitor on analytics_events (visitor_id);
create index if not exists idx_analytics_events_ts on analytics_events (ts desc);

alter table analytics_events enable row level security;

-- Public Portal visitors are anonymous — anyone (including unauthenticated
-- requests) can log an event, but events are write-only for them: no
-- select/update/delete policy is granted to non-admins, so a visitor can
-- never read back anyone else's analytics.
create policy "anyone can insert analytics events" on analytics_events
  for insert with check (true);

-- Only Council Administrators can read the aggregate for the dashboard.
create policy "admin read analytics events" on analytics_events
  for select using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Only Council Administrators can clear analytics data.
create policy "admin delete analytics events" on analytics_events
  for delete using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
