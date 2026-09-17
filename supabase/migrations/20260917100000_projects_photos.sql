-- ---------------------------------------------------------------------------
-- Fix: POST /rest/v1/projects returned 400 (PGRST204 - column not found).
--
-- The client transformer `projectToDb()` in src/lib/supabaseService.ts writes a
-- `photos` key, and `dbToProject()` reads one back, but the column was never
-- created in the initial schema. Every project insert/upsert therefore failed
-- schema validation at PostgREST before ever reaching the table.
--
-- Stored as jsonb (an array of storage URLs) so it round-trips cleanly with
-- supabase-js, which serialises JS string arrays to JSON rather than to a
-- Postgres text[] literal.
-- ---------------------------------------------------------------------------

alter table projects
  add column if not exists photos jsonb;

comment on column projects.photos is
  'Array of public storage URLs for project photos, e.g. ["https://.../project-documents/CY-2026-001/site.jpg"].';

-- Guard against non-array payloads sneaking in (objects, bare strings).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'projects_photos_is_array'
  ) then
    alter table projects
      add constraint projects_photos_is_array
      check (photos is null or jsonb_typeof(photos) = 'array');
  end if;
end $$;

-- Make sure PostgREST picks the new column up immediately instead of waiting
-- for its next schema-cache refresh.
notify pgrst, 'reload schema';
