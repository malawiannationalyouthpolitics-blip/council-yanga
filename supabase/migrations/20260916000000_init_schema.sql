-- ============================================================================
-- Council Yanga — Supabase Initial Schema & Security Policies
-- Migration: 20260916000000_init_schema.sql
-- ============================================================================

-- ============ ENUMS ============
create type user_role as enum ('admin', 'monitor');
create type project_status as enum (
  'Proposed','Assessed','Approved','Not Started','Ongoing',
  'Near Completion','Completed','Suspended','On Hold','Stalled'
);
create type monitor_status as enum ('Active', 'Inactive');
create type feedback_status as enum ('Received','Under Review','Verification Requested','Resolved','Rejected');
create type visit_status as enum ('Upcoming','Acknowledged','Completed','Missed','Rescheduled');
create type submission_status as enum ('Pending Review','Approved','Returned');
create type notification_type as enum ('completion','update','announcement','meeting','new_project');
create type sys_notification_type as enum (
  'visit_scheduled','visit_rescheduled','acknowledgement','missed_visit','submission',
  'submission_approved','submission_returned','project_progress_updated',
  'project_assigned','ward_assignment','general'
);
create type sys_notification_for as enum ('admin','monitor');

-- ============ MONITORS ============
create table if not exists monitors (
  id text primary key,               -- e.g. 'M001', 'M002'
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  phone text,
  email text not null unique,
  wards text not null,               -- covered ward(s)
  status monitor_status not null default 'Active',
  join_date date not null default current_date,
  last_active timestamptz
);

-- ============ PROFILES (extends auth.users) ============
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role user_role not null default 'admin',
  monitor_id text references monitors(id) on delete set null,
  photo_url text,
  join_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ============ PROJECTS ============
create table if not exists projects (
  id text primary key,               -- e.g. 'CY-2026-001'
  name text not null,
  initiative_name text,
  initiative_component text,
  item_type text check (item_type in ('Project','Initiative')),
  project_type text,                 -- 'CDF' | 'Other Projects/Initiative'
  component text,
  region text,
  district text,
  beneficiary_type text,
  description text not null,
  objectives text not null,
  sector text not null,
  constituency text not null,
  ward text not null,
  traditional_authority text,
  location text,
  gps_lat numeric,
  gps_lng numeric,
  beneficiaries integer default 0,
  budget numeric not null default 0,
  disbursed numeric default 0,
  funds_used numeric default 0,
  funding_source text,
  approval_date date,
  start_date date,
  expected_completion date,
  actual_completion date,
  status project_status not null default 'Proposed',
  progress smallint not null default 0 check (progress between 0 and 100),
  implementing_dept text,
  contractor text,
  monitor_id text references monitors(id) on delete set null,
  monitor_name text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_status on projects (status);
create index if not exists idx_projects_ward on projects (ward);
create index if not exists idx_projects_district on projects (district);

-- ============ SCHEDULED VISITS ============
create table if not exists scheduled_visits (
  id text primary key,               -- e.g. 'V-015'
  project_id text not null references projects(id) on delete cascade,
  project_name text,
  monitor_id text not null references monitors(id) on delete cascade,
  monitor_name text,
  visit_date date not null,
  visit_time time,
  ward text,
  notes text,
  status visit_status not null default 'Upcoming',
  acknowledged_at timestamptz,
  scheduled_by uuid references auth.users(id),
  scheduled_at timestamptz not null default now(),
  rescheduled_from date
);

-- ============ MONITOR SUBMISSIONS ============
create table if not exists monitor_submissions (
  id text primary key,               -- e.g. 'SUB-012'
  project_id text not null references projects(id) on delete cascade,
  project_name text,
  monitor_id text not null references monitors(id) on delete cascade,
  monitor_name text,
  submitted_at timestamptz not null default now(),
  progress smallint not null check (progress between 0 and 100),
  status submission_status not null default 'Pending Review',
  observation text,
  milestone text,
  photo_count integer default 0,
  gps_lat numeric,
  gps_lng numeric,
  funds_used_reported numeric,
  admin_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  ward text
);

-- photos & receipts as their own tables
create table if not exists submission_photos (
  id uuid primary key default gen_random_uuid(),
  submission_id text not null references monitor_submissions(id) on delete cascade,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

create table if not exists submission_receipts (
  id uuid primary key default gen_random_uuid(),
  submission_id text not null references monitor_submissions(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_size text,
  created_at timestamptz not null default now()
);

-- ============ FEEDBACK (public citizen feedback) ============
create table if not exists feedback (
  id text primary key,               -- e.g. 'FB-001'
  project_id text references projects(id) on delete set null,
  project_name_snapshot text,        -- for feedback with no linked project ('General')
  type text not null,
  citizen_name text,
  contact text,
  message text not null,
  status feedback_status not null default 'Received',
  response text,
  submitted_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ============ ANNOUNCEMENTS ============
create table if not exists announcements (
  id text primary key,               -- e.g. 'AN-001'
  title text not null,
  category text,
  body text not null,
  published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============ AUDIT LOGS ============
create table if not exists audit_logs (
  id bigserial primary key,
  actor uuid references auth.users(id) on delete set null,
  actor_label text,                  -- denormalized snapshot e.g. 'Council Admin' or 'Monitor: James Phiri'
  action text not null,
  old_value text,
  new_value text,
  target text,
  created_at timestamptz not null default now()
);

-- ============ APP NOTIFICATIONS (public bell) ============
create table if not exists app_notifications (
  id text primary key,
  title text not null,
  message text not null,
  type notification_type not null,
  project_id text references projects(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============ SYSTEM NOTIFICATIONS (admin/monitor) ============
create table if not exists sys_notifications (
  id text primary key,
  for_role sys_notification_for not null,
  monitor_id text references monitors(id) on delete set null,
  type sys_notification_type not null,
  title text not null,
  message text not null,
  read boolean not null default false,
  visit_id text references scheduled_visits(id) on delete cascade,
  submission_id text references monitor_submissions(id) on delete cascade,
  project_id text references projects(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============ WARD STATUS PHOTOS ============
create table if not exists ward_status_photos (
  id text primary key,
  constituency text not null,
  ward text not null,
  category text not null check (category in ('Project','Initiative')),
  status text not null,
  storage_path text not null,        -- Supabase Storage path or asset URL
  caption text,
  project_id text references projects(id) on delete set null,
  project_name text,
  monitor_name text,
  visit_date text,
  uploaded_at timestamptz not null default now()
);

-- ============ PUBLIC DOCUMENTS ============
create table if not exists project_documents (
  id text primary key,               -- e.g. 'DOC-001'
  project_id text references projects(id) on delete cascade,
  name text not null,
  type text,
  storage_path text not null,
  file_size text,
  uploaded_at timestamptz not null default now()
);

-- ============ FINANCIALS (singleton row) ============
create table if not exists financial_settings (
  id boolean primary key default true check (id),
  cdf_year text not null default '2025/2026',
  total_allocation numeric not null default 52500000,
  total_approved numeric not null default 52500000,
  total_disbursed numeric not null default 42000000,
  total_expenditure numeric not null default 36500000,
  source text default 'National Budget / CDF Allocation',
  last_updated date default current_date
);

-- ============ DERIVED MONITOR STATS VIEW ============
create or replace view monitor_stats as
select
  m.id as monitor_id,
  m.name,
  m.email,
  m.phone,
  m.wards,
  m.status,
  m.join_date,
  m.last_active,
  count(distinct p.id) filter (where p.monitor_id = m.id) as assigned_projects,
  count(s.id) as submitted,
  count(s.id) filter (where s.status = 'Approved') as approved,
  count(s.id) filter (where s.status = 'Returned') as returned
from monitors m
left join projects p on p.monitor_id = m.id
left join monitor_submissions s on s.monitor_id = m.id
group by m.id, m.name, m.email, m.phone, m.wards, m.status, m.join_date, m.last_active;

-- ============ TRIGGER FOR NEW AUTH USERS ============
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role, monitor_id, join_date)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'admin'),
    new.raw_user_meta_data->>'monitor_id',
    current_date
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ ROW LEVEL SECURITY POLICIES ============
alter table projects enable row level security;
alter table monitors enable row level security;
alter table monitor_submissions enable row level security;
alter table submission_photos enable row level security;
alter table submission_receipts enable row level security;
alter table scheduled_visits enable row level security;
alter table feedback enable row level security;
alter table announcements enable row level security;
alter table sys_notifications enable row level security;
alter table app_notifications enable row level security;
alter table profiles enable row level security;
alter table ward_status_photos enable row level security;
alter table project_documents enable row level security;
alter table audit_logs enable row level security;
alter table financial_settings enable row level security;

-- PROFILES
create policy "profiles public read" on profiles for select using (true);
create policy "profiles user update own" on profiles for update using (auth.uid() = id);

-- PROJECTS: Public can read, Admins can write
create policy "public read projects" on projects for select using (true);
create policy "admin write projects" on projects for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- MONITORS: Public can view monitors; Admins can manage
create policy "public read monitors" on monitors for select using (true);
create policy "admin write monitors" on monitors for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- ANNOUNCEMENTS: Public reads published; Admins manage all
create policy "public read published announcements" on announcements
  for select using (published = true or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "admin write announcements" on announcements for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- APP NOTIFICATIONS: Public read
create policy "public read app_notifications" on app_notifications for select using (true);
create policy "admin write app_notifications" on app_notifications for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- FEEDBACK: Anyone can insert, Public can read, Admins can update/resolve
create policy "anyone can insert feedback" on feedback for insert with check (true);
create policy "public read feedback" on feedback for select using (true);
create policy "admin manage feedback" on feedback for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- MONITOR SUBMISSIONS: Monitor can create/view own, Admins can review all
create policy "submissions select" on monitor_submissions for select
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    or monitor_id = (select monitor_id from profiles where id = auth.uid())
    or status = 'Approved' -- public can view approved submissions for transparency
  );

create policy "monitor insert submissions" on monitor_submissions for insert
  with check (
    monitor_id = (select monitor_id from profiles where id = auth.uid())
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "admin update submissions" on monitor_submissions for update
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    or monitor_id = (select monitor_id from profiles where id = auth.uid())
  );

-- SUBMISSION PHOTOS & RECEIPTS
create policy "public read submission photos" on submission_photos for select using (true);
create policy "auth insert submission photos" on submission_photos for insert with check (auth.role() = 'authenticated');
create policy "public read submission receipts" on submission_receipts for select using (true);
create policy "auth insert submission receipts" on submission_receipts for insert with check (auth.role() = 'authenticated');

-- SCHEDULED VISITS
create policy "visits select" on scheduled_visits for select
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    or monitor_id = (select monitor_id from profiles where id = auth.uid())
  );

create policy "admin manage visits" on scheduled_visits for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "monitor acknowledge visits" on scheduled_visits for update
  using (monitor_id = (select monitor_id from profiles where id = auth.uid()));

-- SYSTEM NOTIFICATIONS
create policy "sys_notifications select" on sys_notifications for select
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    or monitor_id = (select monitor_id from profiles where id = auth.uid())
  );

create policy "sys_notifications write" on sys_notifications for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    or monitor_id = (select monitor_id from profiles where id = auth.uid())
  );

-- WARD STATUS PHOTOS & DOCUMENTS: Public can view, Authenticated/Admin can upload
create policy "public read ward photos" on ward_status_photos for select using (true);
create policy "auth write ward photos" on ward_status_photos for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "public read documents" on project_documents for select using (true);
create policy "admin write documents" on project_documents for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- AUDIT LOGS
create policy "admin read audit logs" on audit_logs for select
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "auth insert audit logs" on audit_logs for insert with check (auth.role() = 'authenticated');

-- FINANCIAL SETTINGS
create policy "public read financials" on financial_settings for select using (true);
create policy "admin update financials" on financial_settings for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- ============ STORAGE BUCKET SETUP ============
-- Storage buckets to create in Supabase:
-- 'ward-photos' (public)
-- 'project-documents' (public)
-- 'submission-photos' (authenticated/public read)
-- 'submission-receipts' (authenticated)
insert into storage.buckets (id, name, public)
values
  ('ward-photos', 'ward-photos', true),
  ('project-documents', 'project-documents', true),
  ('submission-photos', 'submission-photos', true),
  ('submission-receipts', 'submission-receipts', false)
on conflict (id) do nothing;

create policy "public read ward-photos bucket"
  on storage.objects for select
  using (bucket_id in ('ward-photos', 'project-documents', 'submission-photos'));

create policy "auth upload objects"
  on storage.objects for insert
  with check (bucket_id in ('ward-photos', 'project-documents', 'submission-photos', 'submission-receipts') and auth.role() = 'authenticated');

create policy "auth update objects"
  on storage.objects for update
  using (bucket_id in ('ward-photos', 'project-documents', 'submission-photos', 'submission-receipts') and auth.role() = 'authenticated');
