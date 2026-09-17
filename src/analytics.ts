// ─────────────────────────────────────────────────────────────────────────────
// Council Yanga Analytics — lightweight, self-contained, GA-style event tracker
// Persists to localStorage (same pattern as the rest of the app's data layer).
// Any component can call trackEvent(...) — no props/threading required.
// ─────────────────────────────────────────────────────────────────────────────
import { projects, publicDocuments } from './data';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';

export type AnalyticsEventType =
  | 'page_view'            // a Public Portal tab was viewed (label = tab id)
  | 'project_view'         // a project detail card/modal was opened (label = project name)
  | 'project_search'       // project search box used (label = query)
  | 'filter_use'           // a filter dropdown was changed (label = filter name, meta.value)
  | 'map_marker_click'     // a project marker was clicked on the map (label = project name)
  | 'feedback_submitted'   // citizen feedback form completed (label = feedback type)
  | 'document_search'      // document search box used (label = query)
  | 'document_download'    // a public document was downloaded (label = document name)
  | 'announcement_click'   // an announcement was opened (label = announcement title)
  | 'language_change'      // language toggle used (label = language code)
  | 'login'                // login attempt (label = 'success' | 'failed')
  | 'signup';               // signup completed (label = role)

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  label?: string;
  meta?: Record<string, string | number>;
  ts: number;               // epoch ms
  date: string;              // YYYY-MM-DD
  sessionId: string;
  visitorId: string;
  isNewVisitor: boolean;
  device: 'mobile' | 'tablet' | 'desktop';
  lang: string;
  referrer: string;
}

const EVENTS_KEY = 'likoma_analytics_events_v1';
const VISITOR_KEY = 'likoma_analytics_visitor_id_v1';
const SESSION_KEY = 'likoma_analytics_session_id_v1';
const SESSION_START_KEY = 'likoma_analytics_session_start_v1';
const MAX_EVENTS = 6000;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity = new session

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function detectDevice(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < 640) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

function getOrCreateVisitorId(): { id: string; isNew: boolean } {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return { id: existing, isNew: false };
    const id = genId('V');
    localStorage.setItem(VISITOR_KEY, id);
    return { id, isNew: true };
  } catch {
    return { id: 'anonymous', isNew: true };
  }
}

function getOrCreateSessionId(): string {
  try {
    const lastStart = Number(sessionStorage.getItem(SESSION_START_KEY) || 0);
    const now = Date.now();
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id || now - lastStart > SESSION_TIMEOUT_MS) {
      id = genId('S');
      sessionStorage.setItem(SESSION_KEY, id);
    }
    sessionStorage.setItem(SESSION_START_KEY, String(now));
    return id;
  } catch {
    return genId('S');
  }
}

export function getStoredAnalyticsEvents(): AnalyticsEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEvents(events: AnalyticsEvent[]) {
  try {
    const trimmed = events.length > MAX_EVENTS ? events.slice(events.length - MAX_EVENTS) : events;
    localStorage.setItem(EVENTS_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Failed to save analytics events', err);
  }
}

/** Record a single analytics event. Call this from any user-facing view. */
export function trackEvent(type: AnalyticsEventType, label?: string, meta?: Record<string, string | number>) {
  try {
    const { id: visitorId, isNew } = getOrCreateVisitorId();
    const sessionId = getOrCreateSessionId();
    const now = new Date();
    const event: AnalyticsEvent = {
      id: genId('E'),
      type,
      label,
      meta,
      ts: now.getTime(),
      date: now.toISOString().slice(0, 10),
      sessionId,
      visitorId,
      isNewVisitor: isNew,
      device: detectDevice(),
      lang: (typeof localStorage !== 'undefined' && localStorage.getItem('likoma_lang_v1')) || 'en',
      referrer: typeof document !== 'undefined' ? (document.referrer || 'direct') : 'direct',
    };
    const events = getStoredAnalyticsEvents();
    events.push(event);
    saveEvents(events);

    // Also log the event centrally so Admin > Analytics reflects real
    // traffic from every visitor's device, not just this browser's
    // localStorage. Fire-and-forget: analytics must never block or break
    // the UI, and Public Portal visitors are anonymous, so this relies on
    // the `analytics_events` table's public "insert-only" RLS policy.
    void sendEventToDb(event);
  } catch (err) {
    console.error('Analytics tracking failed', err);
  }
}

function sendEventToDb(event: AnalyticsEvent): void {
  if (!isSupabaseConfigured) return;
  supabase
    .from('analytics_events')
    .insert({
      id: event.id,
      type: event.type,
      label: event.label ?? null,
      meta: event.meta ?? null,
      ts: event.ts,
      event_date: event.date,
      session_id: event.sessionId,
      visitor_id: event.visitorId,
      is_new_visitor: event.isNewVisitor,
      device: event.device,
      lang: event.lang,
      referrer: event.referrer,
    })
    .then(({ error }) => {
      if (error) console.warn('Analytics: failed to sync event to Supabase', error.message);
    });
}

function dbRowToAnalyticsEvent(row: any): AnalyticsEvent {
  return {
    id: row.id,
    type: row.type,
    label: row.label ?? undefined,
    meta: row.meta ?? undefined,
    ts: Number(row.ts),
    date: row.event_date,
    sessionId: row.session_id,
    visitorId: row.visitor_id,
    isNewVisitor: Boolean(row.is_new_visitor),
    device: row.device || 'desktop',
    lang: row.lang || 'en',
    referrer: row.referrer || 'direct',
  };
}

/**
 * Fetch the shared analytics event log from Supabase (real traffic from
 * every visitor), for the Admin Analytics dashboard. Requires the caller to
 * be signed in as an admin — enforced server-side by RLS, so anyone else's
 * call simply returns an empty list rather than an error.
 */
export async function fetchAnalyticsEventsFromDb(limit = 10000): Promise<AnalyticsEvent[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('analytics_events')
      .select('*')
      .order('ts', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('Failed to fetch analytics events from Supabase:', error.message);
      return [];
    }
    return (data || []).map(dbRowToAnalyticsEvent).sort((a, b) => a.ts - b.ts);
  } catch (err) {
    console.error('Failed to fetch analytics events from Supabase:', err);
    return [];
  }
}

/** Admin-only: permanently delete every shared analytics event (RLS-enforced). */
export async function clearAnalyticsEventsInDb(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    // No-op WHERE that matches every row (avoids a bare unfiltered delete
    // being rejected by the client library).
    await supabase.from('analytics_events').delete().not('id', 'is', null);
  } catch (err) {
    console.error('Failed to clear analytics events in Supabase:', err);
  }
}

export function clearStoredAnalyticsEvents(): void {
  try {
    localStorage.removeItem(EVENTS_KEY);
  } catch (err) {
    console.error('Failed to clear analytics events', err);
  }
}

// ── Aggregation helpers (used by the Admin Analytics section) ──────────────

export function filterEventsByRange(events: AnalyticsEvent[], days: number): AnalyticsEvent[] {
  if (days <= 0) return events; // 0 = all time
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return events.filter(e => e.ts >= cutoff);
}

export interface VisitorStats {
  totalVisitors: number;
  newVisitors: number;
  returningVisitors: number;
  totalSessions: number;
  totalEvents: number;
  avgEventsPerSession: number;
}

export function getVisitorStats(events: AnalyticsEvent[]): VisitorStats {
  const visitorIds = new Set(events.map(e => e.visitorId));
  const sessionIds = new Set(events.map(e => e.sessionId));
  const newVisitorIds = new Set(events.filter(e => e.isNewVisitor).map(e => e.visitorId));
  return {
    totalVisitors: visitorIds.size,
    newVisitors: newVisitorIds.size,
    returningVisitors: Math.max(visitorIds.size - newVisitorIds.size, 0),
    totalSessions: sessionIds.size,
    totalEvents: events.length,
    avgEventsPerSession: sessionIds.size ? Math.round((events.length / sessionIds.size) * 10) / 10 : 0,
  };
}

const TAB_LABELS: Record<string, string> = {
  overview: 'Overview', projects: 'Projects', map: 'Map',
  announcements: 'Announcements', feedback: 'Feedback', documents: 'Documents',
};

export function getTabViews(events: AnalyticsEvent[]): { tab: string; views: number }[] {
  const counts: Record<string, number> = {};
  events.filter(e => e.type === 'page_view').forEach(e => {
    const tab = TAB_LABELS[e.label || ''] || e.label || 'Overview';
    counts[tab] = (counts[tab] || 0) + 1;
  });
  return Object.entries(counts).map(([tab, views]) => ({ tab, views })).sort((a, b) => b.views - a.views);
}

export function getDeviceBreakdown(events: AnalyticsEvent[]): { name: string; value: number }[] {
  const counts: Record<string, number> = {};
  const seen = new Set<string>();
  events.forEach(e => {
    if (seen.has(e.sessionId)) return;
    seen.add(e.sessionId);
    const label = e.device.charAt(0).toUpperCase() + e.device.slice(1);
    counts[label] = (counts[label] || 0) + 1;
  });
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

export function getLanguageBreakdown(events: AnalyticsEvent[]): { name: string; value: number }[] {
  const counts: Record<string, number> = {};
  const seen = new Set<string>();
  events.forEach(e => {
    if (seen.has(e.sessionId)) return;
    seen.add(e.sessionId);
    const label = e.lang === 'ny' ? 'Chichewa' : 'English';
    counts[label] = (counts[label] || 0) + 1;
  });
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

export function getTrafficTrend(events: AnalyticsEvent[], days = 14): { date: string; visitors: number; events: number }[] {
  const dayMap: Record<string, { visitors: Set<string>; events: number }> = {};
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dayMap[d.toISOString().slice(0, 10)] = { visitors: new Set(), events: 0 };
  }
  events.forEach(e => {
    if (dayMap[e.date]) {
      dayMap[e.date].visitors.add(e.visitorId);
      dayMap[e.date].events += 1;
    }
  });
  return Object.entries(dayMap).map(([date, v]) => ({
    date: date.slice(5), // MM-DD
    visitors: v.visitors.size,
    events: v.events,
  }));
}

export function getTopItems(events: AnalyticsEvent[], type: AnalyticsEventType, limit = 5): { label: string; count: number }[] {
  const counts: Record<string, number> = {};
  events.filter(e => e.type === type && e.label).forEach(e => {
    counts[e.label!] = (counts[e.label!] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getTrafficSources(events: AnalyticsEvent[]): { name: string; value: number }[] {
  const counts: Record<string, number> = {};
  const seen = new Set<string>();
  events.forEach(e => {
    if (seen.has(e.sessionId)) return;
    seen.add(e.sessionId);
    let source = 'Direct';
    if (e.referrer && e.referrer !== 'direct') {
      try {
        const host = new URL(e.referrer).hostname.replace('www.', '');
        if (host.includes('facebook')) source = 'Facebook';
        else if (host.includes('whatsapp')) source = 'WhatsApp';
        else if (host.includes('google')) source = 'Google Search';
        else source = host;
      } catch {
        source = 'Referral';
      }
    }
    counts[source] = (counts[source] || 0) + 1;
  });
  return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function getFeedbackFunnel(events: AnalyticsEvent[]): { started: number; submitted: number; rate: number } {
  const started = events.filter(e => e.type === 'page_view' && e.label === 'feedback').length;
  const submitted = events.filter(e => e.type === 'feedback_submitted').length;
  const rate = started ? Math.round((submitted / started) * 1000) / 10 : 0;
  return { started, submitted, rate };
}

// ── Demo seed data ──────────────────────────────────────────────────────────
// Generates realistic-looking historical events over the past 30 days so the
// Admin Analytics section has something meaningful to show before real
// citizen traffic accumulates. Runs once — skipped if events already exist.
export function seedDemoAnalyticsEventsIfEmpty(): void {
  const existing = getStoredAnalyticsEvents();
  if (existing.length > 0) return;

  const tabs = ['overview', 'projects', 'map', 'announcements', 'feedback', 'documents'];
  const devices: AnalyticsEvent['device'][] = ['mobile', 'mobile', 'mobile', 'desktop', 'tablet'];
  const langs = ['en', 'en', 'en', 'ny'];
  const referrers = ['direct', 'direct', 'https://facebook.com', 'https://www.google.com', 'https://whatsapp.com'];
  const projectNames = projects.slice(0, 25).map(p => p.name);
  const docNames = publicDocuments.map(d => d.name);
  const feedbackTypes = ['Complaint', 'Suggestion', 'Question', 'Commendation'];

  const seeded: AnalyticsEvent[] = [];
  const numVisitors = 180;

  for (let v = 0; v < numVisitors; v++) {
    const visitorId = genId('V');
    const daysAgo = Math.floor(Math.random() * 30);
    const isReturning = Math.random() < 0.35;
    const sessionsForVisitor = isReturning ? 1 + Math.floor(Math.random() * 3) : 1;

    for (let s = 0; s < sessionsForVisitor; s++) {
      const sessionId = genId('S');
      const sessionDay = Math.max(0, daysAgo - s * Math.floor(Math.random() * 5));
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() - sessionDay);
      baseDate.setHours(7 + Math.floor(Math.random() * 13), Math.floor(Math.random() * 60));
      const device = devices[Math.floor(Math.random() * devices.length)];
      const lang = langs[Math.floor(Math.random() * langs.length)];
      const referrer = referrers[Math.floor(Math.random() * referrers.length)];
      const tabsThisSession = 1 + Math.floor(Math.random() * 4);
      let visitedFeedback = false;

      for (let t = 0; t < tabsThisSession; t++) {
        const tab = tabs[Math.floor(Math.random() * tabs.length)];
        const ts = baseDate.getTime() + t * (30000 + Math.random() * 90000);
        const dateStr = new Date(ts).toISOString().slice(0, 10);
        seeded.push({
          id: genId('E'), type: 'page_view', label: tab, ts, date: dateStr,
          sessionId, visitorId, isNewVisitor: s === 0 && !isReturning, device, lang, referrer,
        });
        if (tab === 'feedback') visitedFeedback = true;

        if (tab === 'projects' && Math.random() < 0.6) {
          const proj = projectNames[Math.floor(Math.random() * projectNames.length)];
          seeded.push({
            id: genId('E'), type: 'project_view', label: proj, ts: ts + 5000, date: dateStr,
            sessionId, visitorId, isNewVisitor: false, device, lang, referrer,
          });
        }
        if (tab === 'map' && Math.random() < 0.5) {
          const proj = projectNames[Math.floor(Math.random() * projectNames.length)];
          seeded.push({
            id: genId('E'), type: 'map_marker_click', label: proj, ts: ts + 4000, date: dateStr,
            sessionId, visitorId, isNewVisitor: false, device, lang, referrer,
          });
        }
        if (tab === 'documents' && Math.random() < 0.45) {
          const doc = docNames[Math.floor(Math.random() * docNames.length)];
          seeded.push({
            id: genId('E'), type: 'document_download', label: doc, ts: ts + 6000, date: dateStr,
            sessionId, visitorId, isNewVisitor: false, device, lang, referrer,
          });
        }
        if (tab === 'feedback' && Math.random() < 0.55) {
          const type = feedbackTypes[Math.floor(Math.random() * feedbackTypes.length)];
          seeded.push({
            id: genId('E'), type: 'feedback_submitted', label: type, ts: ts + 8000, date: dateStr,
            sessionId, visitorId, isNewVisitor: false, device, lang, referrer,
          });
        }
      }
    }
  }

  saveEvents(seeded.sort((a, b) => a.ts - b.ts));
}
