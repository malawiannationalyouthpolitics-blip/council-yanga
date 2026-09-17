import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  projects as initialProjects,
  scheduledVisits as initialVisits,
  monitorSubmissions as initialSubmissions,
  sysNotifications as initialSysNotifs,
  feedback as initialFeedback,
  announcements as initialAnnouncements,
  monitors as initialMonitors,
  initialWardStatusPhotos,
  defaultUsers,
  type Project,
  type ScheduledVisit,
  type MonitorSubmission,
  type SysNotification,
  type Feedback,
  type User,
  type Monitor,
  type Announcement,
  type WardStatusPhoto,
  getStoredProjects,
  saveStoredProjects,
  getStoredMonitors,
  saveStoredMonitors,
  getStoredWardStatusPhotos,
  saveStoredWardStatusPhotos,
  getStoredUsers,
  saveStoredUsers,
} from '../data';

// ============================================================================
// DATA TRANSFORMERS (DB <-> Client)
// ============================================================================

export function dbToProject(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    initiativeName: row.initiative_name ?? undefined,
    initiativeComponent: row.initiative_component ?? undefined,
    itemType: row.item_type ?? (row.initiative_name ? 'Initiative' : 'Project'),
    projectType: row.project_type ?? 'CDF',
    component: row.component ?? 'Community Development Project',
    region: row.region ?? 'Northern',
    district: row.district ?? 'Likoma',
    beneficiaryType: row.beneficiary_type ?? 'District-Wide',
    description: row.description || '',
    objectives: row.objectives || '',
    sector: row.sector || '',
    constituency: row.constituency || 'Likoma Island',
    ward: row.ward || '',
    traditionalAuthority: row.traditional_authority || 'T/A Mwakhwere',
    location: row.location || '',
    gpsLat: String(row.gps_lat ?? ''),
    gpsLng: String(row.gps_lng ?? ''),
    beneficiaries: Number(row.beneficiaries ?? 0),
    budget: Number(row.budget ?? 0),
    disbursed: row.disbursed != null ? Number(row.disbursed) : undefined,
    fundsUsed: row.funds_used != null ? Number(row.funds_used) : undefined,
    fundingSource: row.funding_source || 'CDF 2025/2026',
    approvalDate: row.approval_date || '',
    startDate: row.start_date || '',
    expectedCompletion: row.expected_completion || '',
    actualCompletion: row.actual_completion || '',
    status: row.status || 'Proposed',
    progress: Number(row.progress ?? 0),
    implementingDept: row.implementing_dept || 'Likoma District Council',
    contractor: row.contractor || '',
    monitor: row.monitor_name || row.monitor_id || '',
    photos: Array.isArray(row.photos)
      ? row.photos
      : (typeof row.photos === 'string'
        ? (row.photos.startsWith('[') ? (() => { try { return JSON.parse(row.photos); } catch { return [row.photos]; } })() : [row.photos])
        : undefined),
    lastUpdated: (row.updated_at ? String(row.updated_at).slice(0, 10) : '') || new Date().toISOString().slice(0, 10),
    createdDate: (row.created_at ? String(row.created_at).slice(0, 10) : '') || new Date().toISOString().slice(0, 10),
  };
}

export function projectToDb(p: Project): any {
  return {
    id: p.id,
    name: p.name,
    initiative_name: p.initiativeName ?? null,
    initiative_component: p.initiativeComponent ?? null,
    item_type: p.itemType ?? (p.initiativeName ? 'Initiative' : 'Project'),
    project_type: p.projectType ?? 'CDF',
    component: p.component ?? 'Community Development Project',
    region: p.region ?? 'Northern',
    district: p.district ?? 'Likoma',
    beneficiary_type: p.beneficiaryType ?? 'District-Wide',
    description: p.description,
    objectives: p.objectives,
    sector: p.sector,
    constituency: p.constituency,
    ward: p.ward,
    traditional_authority: p.traditionalAuthority,
    location: p.location,
    gps_lat: p.gpsLat ? parseFloat(p.gpsLat) : null,
    gps_lng: p.gpsLng ? parseFloat(p.gpsLng) : null,
    beneficiaries: p.beneficiaries,
    budget: p.budget,
    disbursed: p.disbursed ?? null,
    funds_used: p.fundsUsed ?? null,
    funding_source: p.fundingSource,
    approval_date: p.approvalDate || null,
    start_date: p.startDate || null,
    expected_completion: p.expectedCompletion || null,
    actual_completion: p.actualCompletion || null,
    status: p.status,
    progress: p.progress,
    implementing_dept: p.implementingDept,
    contractor: p.contractor,
    monitor_name: p.monitor,
    photos: p.photos && p.photos.length > 0 ? p.photos : null,
    updated_at: new Date().toISOString(),
  };
}

export function dbToVisit(row: any): ScheduledVisit {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name || '',
    monitorId: row.monitor_id,
    monitorName: row.monitor_name || '',
    date: row.visit_date || '',
    time: row.visit_time ? String(row.visit_time).slice(0, 5) : '09:00',
    ward: row.ward || '',
    notes: row.notes || '',
    status: row.status || 'Upcoming',
    acknowledgedAt: row.acknowledged_at || '',
    scheduledBy: row.scheduled_by || 'Admin',
    scheduledAt: row.scheduled_at ? String(row.scheduled_at).slice(0, 10) : '',
    rescheduledFrom: row.rescheduled_from || undefined,
  };
}

export function visitToDb(v: ScheduledVisit): any {
  return {
    id: v.id,
    project_id: v.projectId,
    project_name: v.projectName,
    monitor_id: v.monitorId,
    monitor_name: v.monitorName,
    visit_date: v.date,
    visit_time: v.time,
    ward: v.ward,
    notes: v.notes,
    status: v.status,
    acknowledged_at: v.acknowledgedAt || null,
    rescheduled_from: v.rescheduledFrom || null,
  };
}

export function dbToSubmission(row: any): MonitorSubmission {
  const photos = Array.isArray(row.submission_photos)
    ? row.submission_photos.map((sp: any) => sp.storage_path)
    : [];
  const receipts = Array.isArray(row.submission_receipts)
    ? row.submission_receipts.map((sr: any) => ({
        name: sr.file_name,
        size: sr.file_size,
        dataUrl: sr.storage_path,
      }))
    : [];

  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name || '',
    monitorId: row.monitor_id,
    monitorName: row.monitor_name || '',
    date: row.submitted_at ? String(row.submitted_at).slice(0, 10) : '',
    progress: Number(row.progress ?? 0),
    status: row.status || 'Pending Review',
    observation: row.observation || '',
    milestone: row.milestone || '',
    photoCount: Number(row.photo_count ?? (photos.length || 0)),
    gpsLat: String(row.gps_lat ?? ''),
    gpsLng: String(row.gps_lng ?? ''),
    adminNote: row.admin_note || '',
    reviewedAt: row.reviewed_at ? String(row.reviewed_at).slice(0, 10) : '',
    ward: row.ward,
    photos,
    fundsUsedReported: row.funds_used_reported != null ? Number(row.funds_used_reported) : undefined,
    receiptFiles: receipts.length > 0 ? receipts : undefined,
  };
}

export function submissionToDb(s: MonitorSubmission): any {
  return {
    id: s.id,
    project_id: s.projectId,
    project_name: s.projectName,
    monitor_id: s.monitorId,
    monitor_name: s.monitorName,
    progress: s.progress,
    status: s.status,
    observation: s.observation,
    milestone: s.milestone,
    photo_count: s.photoCount,
    gps_lat: s.gpsLat ? parseFloat(s.gpsLat) : null,
    gps_lng: s.gpsLng ? parseFloat(s.gpsLng) : null,
    funds_used_reported: s.fundsUsedReported ?? null,
    admin_note: s.adminNote || null,
    reviewed_at: s.reviewedAt ? new Date(s.reviewedAt).toISOString() : null,
    ward: s.ward || null,
  };
}

export function dbToFeedback(row: any): Feedback {
  return {
    id: row.id,
    project: row.project_name_snapshot || 'General',
    projectId: row.project_id || '',
    type: row.type || 'General Feedback',
    citizen: row.citizen_name || 'Anonymous',
    contact: row.contact || '',
    date: row.submitted_at ? String(row.submitted_at).slice(0, 10) : '',
    message: row.message || '',
    status: row.status || 'Received',
    response: row.response || '',
    resolvedDate: row.resolved_at ? String(row.resolved_at).slice(0, 10) : '',
  };
}

export function feedbackToDb(fb: Feedback): any {
  return {
    id: fb.id,
    project_id: fb.projectId || null,
    project_name_snapshot: fb.project,
    type: fb.type,
    citizen_name: fb.citizen,
    contact: fb.contact,
    message: fb.message,
    status: fb.status,
    response: fb.response,
    resolved_at: fb.resolvedDate ? new Date(fb.resolvedDate).toISOString() : null,
  };
}

export function dbToAnnouncement(row: any): Announcement {
  return {
    id: row.id,
    title: row.title,
    date: row.created_at ? String(row.created_at).slice(0, 10) : '',
    category: row.category || 'General',
    body: row.body,
    published: Boolean(row.published),
    createdBy: 'Council Admin',
  };
}

export function announcementToDb(a: Announcement): any {
  return {
    id: a.id,
    title: a.title,
    category: a.category,
    body: a.body,
    published: a.published,
  };
}

export function dbToSysNotification(row: any): SysNotification {
  return {
    id: row.id,
    for: row.for_role || 'admin',
    monitorId: row.monitor_id,
    type: row.type || 'general',
    title: row.title,
    message: row.message,
    date: row.created_at ? String(row.created_at).slice(0, 10) : '',
    read: Boolean(row.read),
    visitId: row.visit_id,
    submissionId: row.submission_id,
    projectId: row.project_id,
  };
}

export function sysNotificationToDb(sn: SysNotification): any {
  return {
    id: sn.id,
    for_role: sn.for,
    monitor_id: sn.monitorId || null,
    type: sn.type,
    title: sn.title,
    message: sn.message,
    read: sn.read,
    visit_id: sn.visitId || null,
    submission_id: sn.submissionId || null,
    project_id: sn.projectId || null,
  };
}

export function dbToWardStatusPhoto(row: any): WardStatusPhoto {
  return {
    id: row.id,
    constituency: row.constituency,
    ward: row.ward,
    category: row.category,
    status: row.status,
    url: row.storage_path,
    caption: row.caption || '',
    projectId: row.project_id,
    projectName: row.project_name,
    monitor: row.monitor_name,
    date: row.visit_date,
    uploadedAt: row.uploaded_at ? String(row.uploaded_at) : new Date().toISOString(),
  };
}

export function wardStatusPhotoToDb(wsp: WardStatusPhoto): any {
  return {
    id: wsp.id,
    constituency: wsp.constituency,
    ward: wsp.ward,
    category: wsp.category,
    status: wsp.status,
    storage_path: wsp.url,
    caption: wsp.caption,
    project_id: wsp.projectId || null,
    project_name: wsp.projectName || null,
    monitor_name: wsp.monitor || null,
    visit_date: wsp.date || null,
  };
}

// Compute live monitor stats to avoid stale counter drift
export function computeMonitorStats(
  m: Monitor,
  allProjects: Project[],
  allSubmissions: MonitorSubmission[]
): Monitor {
  const assignedProjects = allProjects.filter(p => p.monitor === m.name || p.ward === m.wards).length;
  const subs = allSubmissions.filter(s => s.monitorId === m.id || s.monitorName === m.name);
  const submitted = subs.length;
  const approved = subs.filter(s => s.status === 'Approved').length;
  const returned = subs.filter(s => s.status === 'Returned').length;

  return {
    ...m,
    assignedProjects: assignedProjects || m.assignedProjects,
    submitted,
    approved,
    returned,
  };
}

// ============================================================================
// DATA FETCHING & SYNCHRONIZATION API
// ============================================================================

export async function fetchAllInitialData() {
  if (!isSupabaseConfigured) {
    const localProjects = getStoredProjects();
    const localMonitors = getStoredMonitors();
    const localWardPhotos = getStoredWardStatusPhotos();
    const localUsers = getStoredUsers();

    return {
      projects: localProjects,
      visits: initialVisits,
      submissions: initialSubmissions,
      sysNotifs: initialSysNotifs,
      feedback: initialFeedback,
      announcements: initialAnnouncements,
      monitors: localMonitors,
      wardStatusPhotos: localWardPhotos,
      users: localUsers,
      isLive: false,
    };
  }

  try {
    const [
      { data: pData, error: pErr },
      { data: vData, error: vErr },
      { data: sData, error: sErr },
      { data: fbData, error: fbErr },
      { data: aData, error: aErr },
      { data: snData, error: snErr },
      { data: mData, error: mErr },
      { data: wspData, error: wspErr },
      { data: profData, error: profErr },
    ] = await Promise.all([
      supabase.from('projects').select('*').order('id'),
      supabase.from('scheduled_visits').select('*').order('visit_date', { ascending: false }),
      supabase.from('monitor_submissions').select('*, submission_photos(*), submission_receipts(*)').order('submitted_at', { ascending: false }),
      supabase.from('feedback').select('*').order('submitted_at', { ascending: false }),
      supabase.from('announcements').select('*').order('created_at', { ascending: false }),
      supabase.from('sys_notifications').select('*').order('created_at', { ascending: false }),
      supabase.from('monitors').select('*').order('id'),
      supabase.from('ward_status_photos').select('*').order('uploaded_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ]);

    // If tables are empty in a newly connected Supabase database, auto-seed with real initial CDF data!
    if (!pErr && (!pData || pData.length === 0)) {
      console.info('Supabase database connected and empty. Seeding initial Likoma CDF dataset...');
      await autoSeedSupabase();
      return fetchAllInitialData();
    }

    const projects: Project[] = pData && pData.length > 0 ? pData.map(dbToProject) : getStoredProjects();
    const visits: ScheduledVisit[] = vData && vData.length > 0 ? vData.map(dbToVisit) : initialVisits;
    const submissions: MonitorSubmission[] = sData && sData.length > 0 ? sData.map(dbToSubmission) : initialSubmissions;
    const feedback: Feedback[] = fbData && fbData.length > 0 ? fbData.map(dbToFeedback) : initialFeedback;
    const announcements: Announcement[] = aData && aData.length > 0 ? aData.map(dbToAnnouncement) : initialAnnouncements;
    const sysNotifs: SysNotification[] = snData && snData.length > 0 ? snData.map(dbToSysNotification) : initialSysNotifs;
    const wardStatusPhotos: WardStatusPhoto[] = wspData && wspData.length > 0 ? wspData.map(dbToWardStatusPhoto) : getStoredWardStatusPhotos();

    let monitors: Monitor[] = initialMonitors;
    if (mData && mData.length > 0) {
      monitors = mData.map((m: any) => ({
        id: m.id,
        name: m.name,
        phone: m.phone || '',
        email: m.email,
        wards: m.wards || '',
        assignedProjects: 0,
        submitted: 0,
        approved: 0,
        returned: 0,
        lastActive: m.last_active ? String(m.last_active).slice(0, 10) : '',
        status: m.status || 'Active',
        joinDate: m.join_date ? String(m.join_date).slice(0, 10) : '2026-01-15',
      }));
    }

    // Dynamic stats computation
    monitors = monitors.map(m => computeMonitorStats(m, projects, submissions));

    const users: User[] = profData && profData.length > 0
      ? profData.map((pr: any) => ({
          id: pr.id,
          name: pr.name,
          email: pr.email,
          password: '',
          role: pr.role || 'admin',
          monitorId: pr.monitor_id ?? undefined,
          joinDate: pr.join_date || '2026-01-01',
          photoUrl: pr.photo_url ?? undefined,
        }))
      : getStoredUsers();

    return {
      projects,
      visits,
      submissions,
      sysNotifs,
      feedback,
      announcements,
      monitors,
      wardStatusPhotos,
      users,
      isLive: true,
    };
  } catch (error) {
    console.warn('Error connecting to Supabase database, falling back to local state:', error);
    return {
      projects: getStoredProjects(),
      visits: initialVisits,
      submissions: initialSubmissions,
      sysNotifs: initialSysNotifs,
      feedback: initialFeedback,
      announcements: initialAnnouncements,
      monitors: getStoredMonitors(),
      wardStatusPhotos: getStoredWardStatusPhotos(),
      users: getStoredUsers(),
      isLive: false,
    };
  }
}

// ============================================================================
// MUTATIONS & REALTIME PERSISTENCE
// ============================================================================

/**
 * Columns that older databases may not have yet. supabase-js does NOT throw on
 * a PostgREST error — it resolves with `{ error }` — so a missing column used
 * to surface only as a silent 400 in the network tab while the app carried on
 * as if the write had succeeded. We now inspect the error, and if it is a
 * schema-cache miss (PGRST204) we drop the offending optional column and retry
 * once, so the write still lands on databases where the migration in
 * supabase/migrations/20260917100000_projects_photos.sql has not been applied.
 */
const OPTIONAL_PROJECT_COLUMNS = ['photos'] as const;

function isMissingColumnError(error: any): string | null {
  if (!error) return null;
  const haystack = `${error.code ?? ''} ${error.message ?? ''} ${error.details ?? ''}`;
  if (error.code !== 'PGRST204' && !/column .* does not exist|could not find the .* column/i.test(haystack)) {
    return null;
  }
  const hit = OPTIONAL_PROJECT_COLUMNS.find(col => new RegExp(`\\b${col}\\b`).test(haystack));
  return hit ?? null;
}

async function upsertProjectRows(rows: any[]): Promise<void> {
  let payload = rows;

  for (let attempt = 0; attempt <= OPTIONAL_PROJECT_COLUMNS.length; attempt++) {
    const { error } = await supabase
      .from('projects')
      .upsert(payload, { onConflict: 'id' });

    if (!error) return;

    const missing = isMissingColumnError(error);
    if (!missing) throw error;

    console.warn(
      `Supabase "projects" table has no "${missing}" column — retrying without it. ` +
      'Apply supabase/migrations/20260917100000_projects_photos.sql to persist this field.'
    );
    payload = payload.map(row => {
      const { [missing]: _dropped, ...rest } = row;
      return rest;
    });
  }
}

export async function upsertProjectInDb(p: Project): Promise<void> {
  saveStoredProjects(getStoredProjects().map(existing => existing.id === p.id ? p : existing));
  if (!isSupabaseConfigured) return;
  try {
    await upsertProjectRows([projectToDb(p)]);
  } catch (err) {
    console.error('Failed to upsert project in Supabase:', err);
    throw err;
  }
}

export async function insertVisitInDb(v: ScheduledVisit): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('scheduled_visits').insert(visitToDb(v));
  } catch (err) {
    console.error('Failed to insert visit in Supabase:', err);
  }
}

export async function updateVisitInDb(v: ScheduledVisit): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('scheduled_visits').update(visitToDb(v)).eq('id', v.id);
  } catch (err) {
    console.error('Failed to update visit in Supabase:', err);
  }
}

export async function insertSubmissionInDb(s: MonitorSubmission): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('monitor_submissions').insert(submissionToDb(s));
    if (s.photos && s.photos.length > 0) {
      const photoRows = s.photos.map(p => ({
        submission_id: s.id,
        storage_path: p,
      }));
      await supabase.from('submission_photos').insert(photoRows);
    }
    if (s.receiptFiles && s.receiptFiles.length > 0) {
      const receiptRows = s.receiptFiles.map(r => ({
        submission_id: s.id,
        storage_path: r.dataUrl || r.name,
        file_name: r.name,
        file_size: r.size || '100 KB',
      }));
      await supabase.from('submission_receipts').insert(receiptRows);
    }
  } catch (err) {
    console.error('Failed to insert submission in Supabase:', err);
  }
}

export async function updateSubmissionInDb(s: MonitorSubmission): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('monitor_submissions').update(submissionToDb(s)).eq('id', s.id);
  } catch (err) {
    console.error('Failed to update submission in Supabase:', err);
  }
}

export async function insertFeedbackInDb(fb: Feedback): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('feedback').insert(feedbackToDb(fb));
  } catch (err) {
    console.error('Failed to insert feedback in Supabase:', err);
  }
}

export async function updateFeedbackInDb(fb: Feedback): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('feedback').update(feedbackToDb(fb)).eq('id', fb.id);
  } catch (err) {
    console.error('Failed to update feedback in Supabase:', err);
  }
}

export async function insertAnnouncementInDb(a: Announcement): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('announcements').insert(announcementToDb(a));
  } catch (err) {
    console.error('Failed to insert announcement in Supabase:', err);
  }
}

export async function updateAnnouncementInDb(a: Announcement): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('announcements').update(announcementToDb(a)).eq('id', a.id);
  } catch (err) {
    console.error('Failed to update announcement in Supabase:', err);
  }
}

export async function insertSysNotifInDb(sn: SysNotification): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('sys_notifications').insert(sysNotificationToDb(sn));
  } catch (err) {
    console.error('Failed to insert sys_notification in Supabase:', err);
  }
}

export async function updateSysNotifInDb(sn: SysNotification): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('sys_notifications').update(sysNotificationToDb(sn)).eq('id', sn.id);
  } catch (err) {
    console.error('Failed to update sys_notification in Supabase:', err);
  }
}

export async function insertWardPhotoInDb(wsp: WardStatusPhoto): Promise<void> {
  saveStoredWardStatusPhotos([wsp, ...getStoredWardStatusPhotos()]);
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('ward_status_photos').insert(wardStatusPhotoToDb(wsp));
  } catch (err) {
    console.error('Failed to insert ward photo in Supabase:', err);
  }
}

export async function upsertMonitorInDb(m: Monitor): Promise<void> {
  saveStoredMonitors(getStoredMonitors().map(existing => existing.id === m.id ? m : existing));
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('monitors').upsert({
      id: m.id,
      name: m.name,
      phone: m.phone,
      email: m.email,
      wards: m.wards,
      status: m.status,
      join_date: m.joinDate,
      last_active: m.lastActive ? new Date(m.lastActive).toISOString() : new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to upsert monitor in Supabase:', err);
  }
}

// ============================================================================
// SUPABASE STORAGE HELPER
// ============================================================================

export async function uploadToSupabaseStorage(
  bucket: 'ward-photos' | 'submission-photos' | 'submission-receipts' | 'project-documents' | 'project-photos',
  file: File,
  customPath?: string
): Promise<string> {
  if (!isSupabaseConfigured) {
    // Return base64 or object URL fallback in offline mode
    return URL.createObjectURL(file);
  }

  try {
    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = customPath || `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const { data, error } = await supabase.storage.from(bucket).upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return publicUrlData.publicUrl;
  } catch (err) {
    console.warn(`Storage upload to ${bucket} failed, falling back to local URL:`, err);
    return URL.createObjectURL(file);
  }
}

// ============================================================================
// AUTOMATIC SEEDING ON INITIAL LIVE DB SETUP
// ============================================================================

export async function autoSeedSupabase(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    // 1. Monitors
    const monitorRows = initialMonitors.map(m => ({
      id: m.id,
      name: m.name,
      phone: m.phone,
      email: m.email,
      wards: m.wards,
      status: m.status,
      join_date: m.joinDate,
    }));
    await supabase.from('monitors').upsert(monitorRows);

    // 2. Projects
    const projectRows = initialProjects.map(projectToDb);
    await upsertProjectRows(projectRows);

    // 3. Visits
    const visitRows = initialVisits.map(visitToDb);
    await supabase.from('scheduled_visits').upsert(visitRows);

    // 4. Submissions
    for (const sub of initialSubmissions) {
      await supabase.from('monitor_submissions').upsert(submissionToDb(sub));
    }

    // 5. Feedback
    const fbRows = initialFeedback.map(feedbackToDb);
    await supabase.from('feedback').upsert(fbRows);

    // 6. Announcements
    const aRows = initialAnnouncements.map(announcementToDb);
    await supabase.from('announcements').upsert(aRows);

    // 7. Ward photos
    const wspRows = initialWardStatusPhotos.map(wardStatusPhotoToDb);
    await supabase.from('ward_status_photos').upsert(wspRows);

    // 8. Sys Notifications
    const snRows = initialSysNotifs.map(sysNotificationToDb);
    await supabase.from('sys_notifications').upsert(snRows);

    return true;
  } catch (err) {
    console.error('Error during autoSeedSupabase:', err);
    return false;
  }
}

// ============================================================================
// REALTIME SUBSCRIPTIONS (Step 17)
// ============================================================================

export function setupRealtimeSubscriptions(callbacks: {
  onProjectChange?: (project: Project) => void;
  onVisitChange?: (visit: ScheduledVisit) => void;
  onSubmissionChange?: (submission: MonitorSubmission) => void;
  onFeedbackChange?: (feedback: Feedback) => void;
  onAnnouncementChange?: (announcement: Announcement) => void;
  onSysNotifChange?: (notif: SysNotification) => void;
  onWardPhotoChange?: (photo: WardStatusPhoto) => void;
}) {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel('council-yanga-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, payload => {
      if (payload.new && callbacks.onProjectChange) {
        callbacks.onProjectChange(dbToProject(payload.new));
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_visits' }, payload => {
      if (payload.new && callbacks.onVisitChange) {
        callbacks.onVisitChange(dbToVisit(payload.new));
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'monitor_submissions' }, payload => {
      if (payload.new && callbacks.onSubmissionChange) {
        callbacks.onSubmissionChange(dbToSubmission(payload.new));
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback' }, payload => {
      if (payload.new && callbacks.onFeedbackChange) {
        callbacks.onFeedbackChange(dbToFeedback(payload.new));
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, payload => {
      if (payload.new && callbacks.onAnnouncementChange) {
        callbacks.onAnnouncementChange(dbToAnnouncement(payload.new));
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sys_notifications' }, payload => {
      if (payload.new && callbacks.onSysNotifChange) {
        callbacks.onSysNotifChange(dbToSysNotification(payload.new));
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ward_status_photos' }, payload => {
      if (payload.new && callbacks.onWardPhotoChange) {
        callbacks.onWardPhotoChange(dbToWardStatusPhoto(payload.new));
      }
    })
    .subscribe();

  // Back/forward cache handling.
  //
  // When a tab is frozen into the bfcache the browser tears the WebSocket down
  // and logs "Page entered Back-Forward Cache". On restore, supabase-js is
  // holding a dead socket and realtime updates stop arriving with no visible
  // error. Disconnect deliberately before freeze and reconnect on restore.
  const handlePageHide = (e: PageTransitionEvent) => {
    if (e.persisted) supabase.realtime.disconnect();
  };
  const handlePageShow = (e: PageTransitionEvent) => {
    if (e.persisted) {
      supabase.realtime.connect();
      channel.subscribe();
    }
  };

  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('pageshow', handlePageShow);

  return () => {
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('pageshow', handlePageShow);
    supabase.removeChannel(channel);
  };
}
