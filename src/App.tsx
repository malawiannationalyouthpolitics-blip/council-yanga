import { useState, useEffect, useCallback } from 'react';
import PublicPortal from './views/PublicPortal';
import LoginPage from './views/LoginPage';
import AdminDashboard from './views/AdminDashboard';
import MonitorDashboard from './views/MonitorDashboard';
import PasswordRecoveryModal from './components/PasswordRecoveryModal';
import { Logo, ThreeDotsLoading } from './components/shared';
import { trackEvent, seedDemoAnalyticsEventsIfEmpty } from './analytics';
import {
  type Project,
  type ScheduledVisit,
  type MonitorSubmission,
  type SysNotification,
  type Feedback,
  type User,
  type Monitor,
  type Announcement,
  type WardStatusPhoto,
  getStoredUsers,
  saveStoredUsers,
} from './data';
import {
  fetchAllInitialData,
  upsertProjectInDb,
  upsertMonitorInDb,
  insertVisitInDb,
  updateVisitInDb,
  insertSubmissionInDb,
  updateSubmissionInDb,
  insertFeedbackInDb,
  updateFeedbackInDb,
  insertAnnouncementInDb,
  updateAnnouncementInDb,
  insertWardPhotoInDb,
  insertSysNotifInDb,
  updateSysNotifInDb,
  setupRealtimeSubscriptions,
  computeMonitorStats,
} from './lib/supabaseService';
import {
  loginWithSupabase,
  resetPasswordWithSupabase,
  logoutWithSupabase,
  provisionMonitorAccount,
  sendCredentialsEmail,
} from './lib/supabaseAuth';
import { isSupabaseConfigured, supabase } from './lib/supabaseClient';
import { CheckCircle2 } from 'lucide-react';

export type View = 'public' | 'login' | 'admin' | 'monitor';

function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600);
    const t2 = setTimeout(() => setPhase('out'), 2200);
    const t3 = setTimeout(onDone, 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center"
      style={{
        background: '#145a32',
        opacity: phase === 'out' ? 0 : 1,
        transition: phase === 'out' ? 'opacity 0.5s ease' : phase === 'in' ? 'opacity 0.6s ease' : 'none',
      }}
    >
      <div
        style={{
          transform: phase === 'in' ? 'scale(0.75) translateY(20px)' : 'scale(1) translateY(0)',
          opacity: phase === 'in' ? 0 : 1,
          transition: 'transform 0.6s cubic-bezier(0.34,1.56,0.64,1), opacity 0.6s ease',
        }}
        className="flex flex-col items-center gap-6"
      >
        <Logo className="h-40 brightness-0 invert" />
        {/* Animated dot bar */}
        <div className="flex items-center gap-2 mt-2">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-white/40"
              style={{
                animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); background: white; }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [isLiveDb, setIsLiveDb] = useState(false);
  const [view, setView] = useState<View>('public');
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  // True when the current session is only a local/demo login (see
  // loginWithSupabase's isLocalOnly) — no real Supabase Auth session exists,
  // so backend writes gated on a real admin identity will fail.
  const [isLocalOnlySession, setIsLocalOnlySession] = useState(false);
  const [showPasswordRecovery, setShowPasswordRecovery] = useState(false);

  // User auth state
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Core Data States
  const [sharedProjects, setSharedProjects] = useState<Project[]>([]);
  const [sharedMonitors, setSharedMonitors] = useState<Monitor[]>([]);
  const [sharedVisits, setSharedVisits] = useState<ScheduledVisit[]>([]);
  const [sharedSubmissions, setSharedSubmissions] = useState<MonitorSubmission[]>([]);
  const [sharedSysNotifs, setSharedSysNotifs] = useState<SysNotification[]>([]);
  const [sharedFeedback, setSharedFeedback] = useState<Feedback[]>([]);
  const [sharedAnnouncements, setSharedAnnouncements] = useState<Announcement[]>([]);
  const [sharedWardStatusPhotos, setSharedWardStatusPhotos] = useState<WardStatusPhoto[]>([]);

  // Initial Load & Seeding from Supabase
  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const data = await fetchAllInitialData();
      setSharedProjects(data.projects);
      setSharedMonitors(data.monitors);
      setSharedVisits(data.visits);
      const notesToRemove = [
        'Report accepted. Good documentation.',
        'Good report. Continue monitoring km 5–8 section.',
        'Good report. Continue monitoring km 5–8 section',
        'Insufficient photo documentation. Please resubmit with at least 4 photos showing all damaged sections clearly.',
        'Insufficient photo documentation. Please resubmit with at least 4 photos showing all damaged sections clearly',
        'Excellent documentation. Continue monitoring roofing phase.',
        'Excellent documentation. Continue monitoring roofing phase',
      ];
      const cleanSubmissions = (data.submissions || []).map(s =>
        notesToRemove.some(n => s.adminNote?.trim() === n.trim()) ? { ...s, adminNote: '' } : s
      );
      setSharedSubmissions(cleanSubmissions);
      setSharedSysNotifs(data.sysNotifs);
      setSharedFeedback(data.feedback);
      setSharedAnnouncements(data.announcements);
      setSharedWardStatusPhotos(data.wardStatusPhotos);
      setUsers(data.users);
      setIsLiveDb(data.isLive);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    seedDemoAnalyticsEventsIfEmpty();
    loadData();
  }, [loadData]);

  // Catch "forgot password" email links landing back on the app.
  //
  // Supabase's client redirects here with recovery tokens in the URL hash
  // (implicit flow — the default outside of @supabase/ssr) and, once it
  // parses them, establishes a short-lived session and fires a
  // `PASSWORD_RECOVERY` auth event. We listen for that event and show the
  // "set new password" modal on top of whatever view is currently active.
  //
  // As a fallback for the moment before the listener is attached (the
  // client can process the URL during its own initialization, which can
  // race the subscription below), we also check the URL hash directly.
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setShowPasswordRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowPasswordRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Realtime Subscriptions (Phase 5 - Step 17)
  useEffect(() => {
    if (!isLiveDb) return;

    const unsubscribe = setupRealtimeSubscriptions({
      onProjectChange: updatedProj => {
        setSharedProjects(prev => {
          const exists = prev.some(p => p.id === updatedProj.id);
          return exists ? prev.map(p => (p.id === updatedProj.id ? updatedProj : p)) : [updatedProj, ...prev];
        });
      },
      onVisitChange: updatedVisit => {
        setSharedVisits(prev => {
          const exists = prev.some(v => v.id === updatedVisit.id);
          return exists ? prev.map(v => (v.id === updatedVisit.id ? updatedVisit : v)) : [updatedVisit, ...prev];
        });
      },
      onSubmissionChange: updatedSub => {
        setSharedSubmissions(prev => {
          const exists = prev.some(s => s.id === updatedSub.id);
          return exists ? prev.map(s => (s.id === updatedSub.id ? updatedSub : s)) : [updatedSub, ...prev];
        });
      },
      onFeedbackChange: updatedFb => {
        setSharedFeedback(prev => {
          const exists = prev.some(f => f.id === updatedFb.id);
          return exists ? prev.map(f => (f.id === updatedFb.id ? updatedFb : f)) : [updatedFb, ...prev];
        });
      },
      onAnnouncementChange: updatedA => {
        setSharedAnnouncements(prev => {
          const exists = prev.some(a => a.id === updatedA.id);
          return exists ? prev.map(a => (a.id === updatedA.id ? updatedA : a)) : [updatedA, ...prev];
        });
      },
      onSysNotifChange: updatedSn => {
        setSharedSysNotifs(prev => {
          const exists = prev.some(sn => sn.id === updatedSn.id);
          return exists ? prev.map(sn => (sn.id === updatedSn.id ? updatedSn : sn)) : [updatedSn, ...prev];
        });
      },
      onWardPhotoChange: updatedPhoto => {
        setSharedWardStatusPhotos(prev => {
          const exists = prev.some(w => w.id === updatedPhoto.id);
          return exists ? prev.map(w => (w.id === updatedPhoto.id ? updatedPhoto : w)) : [updatedPhoto, ...prev];
        });
      },
    });

    return () => {
      unsubscribe();
    };
  }, [isLiveDb]);

  // Recalculate monitor statistics when projects or submissions update
  useEffect(() => {
    if (sharedMonitors.length > 0) {
      setSharedMonitors(prev => prev.map(m => computeMonitorStats(m, sharedProjects, sharedSubmissions)));
    }
  }, [sharedProjects, sharedSubmissions]);

  // --------------------------------------------------------------------------
  // STATE WRAPPERS WITH SUPABASE PERSISTENCE
  // --------------------------------------------------------------------------

  const handleUpdateProjects = (action: Project[] | ((prev: Project[]) => Project[])): Promise<void> => {
    // Captured outside the state updater so we can await persistence
    // to Supabase before any dependent writes (e.g. ward_status_photos
    // rows that reference this project) are attempted.
    let toPersist: Project[] = [];
    setSharedProjects(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      // Persist any altered/added projects to Supabase
      toPersist = next.filter(p => {
        const oldP = prev.find(o => o.id === p.id);
        return !oldP || JSON.stringify(oldP) !== JSON.stringify(p);
      });
      return next;
    });
    // Persist sequentially and await completion so callers can rely on
    // the project row existing in Supabase before writing dependent rows.
    return toPersist.reduce(
      (chain, p) => chain.then(() => upsertProjectInDb(p)).catch(err => {
        // Keep the chain alive so one bad row cannot strand the rest, but make
        // the failure loud — this used to fail silently as a bare 400.
        console.error(`Project "${p.id}" could not be saved to Supabase:`, err);
      }),
      Promise.resolve()
    );
  };

  const handleUpdateMonitors = (action: Monitor[] | ((prev: Monitor[]) => Monitor[])) => {
    setSharedMonitors(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      next.forEach(m => {
        const oldM = prev.find(o => o.id === m.id);
        if (!oldM || JSON.stringify(oldM) !== JSON.stringify(m)) {
          upsertMonitorInDb(m);
        }
      });
      return next;
    });
  };

  const handleUpdateVisits = (action: ScheduledVisit[] | ((prev: ScheduledVisit[]) => ScheduledVisit[])) => {
    setSharedVisits(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      next.forEach(v => {
        const oldV = prev.find(o => o.id === v.id);
        if (!oldV) {
          insertVisitInDb(v);
        } else if (JSON.stringify(oldV) !== JSON.stringify(v)) {
          updateVisitInDb(v);
        }
      });
      return next;
    });
  };

  const handleUpdateSubmissions = (action: MonitorSubmission[] | ((prev: MonitorSubmission[]) => MonitorSubmission[])) => {
    setSharedSubmissions(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      next.forEach(s => {
        const oldS = prev.find(o => o.id === s.id);
        if (!oldS) {
          insertSubmissionInDb(s);
        } else if (JSON.stringify(oldS) !== JSON.stringify(s)) {
          updateSubmissionInDb(s);
        }
      });
      return next;
    });
  };

  const handleUpdateFeedback = (action: Feedback[] | ((prev: Feedback[]) => Feedback[])) => {
    setSharedFeedback(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      next.forEach(fb => {
        const oldFb = prev.find(o => o.id === fb.id);
        if (!oldFb) {
          insertFeedbackInDb(fb);
        } else if (JSON.stringify(oldFb) !== JSON.stringify(fb)) {
          updateFeedbackInDb(fb);
        }
      });
      return next;
    });
  };

  const handleUpdateAnnouncements = (action: Announcement[] | ((prev: Announcement[]) => Announcement[])) => {
    setSharedAnnouncements(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      next.forEach(a => {
        const oldA = prev.find(o => o.id === a.id);
        if (!oldA) {
          insertAnnouncementInDb(a);
        } else if (JSON.stringify(oldA) !== JSON.stringify(a)) {
          updateAnnouncementInDb(a);
        }
      });
      return next;
    });
  };

  const handleUpdateWardStatusPhotos = (action: WardStatusPhoto[] | ((prev: WardStatusPhoto[]) => WardStatusPhoto[])) => {
    setSharedWardStatusPhotos(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      next.forEach(w => {
        const oldW = prev.find(o => o.id === w.id);
        if (!oldW) {
          insertWardPhotoInDb(w);
        }
      });
      return next;
    });
  };

  const handleUpdateSysNotifs = (action: SysNotification[] | ((prev: SysNotification[]) => SysNotification[])) => {
    setSharedSysNotifs(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      next.forEach(sn => {
        const oldSn = prev.find(o => o.id === sn.id);
        if (!oldSn) {
          insertSysNotifInDb(sn);
        } else if (JSON.stringify(oldSn) !== JSON.stringify(sn)) {
          updateSysNotifInDb(sn);
        }
      });
      return next;
    });
  };

  const handleUpdateUsers = (action: User[] | ((prev: User[]) => User[])) => {
    setUsers(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      saveStoredUsers(next);
      return next;
    });
  };

  // Creates/resets a monitor's real Supabase Auth login via the
  // service-role Edge Function (see lib/supabaseAuth.ts). Falls back to a
  // no-op when Supabase isn't configured, since local mode already logs
  // monitors in against the `users` array above.
  const provisionMonitor = async (params: {
    action: 'create' | 'reset-password';
    monitorId: string;
    name: string;
    email: string;
    password: string;
  }) => provisionMonitorAccount(params);

  // Actually sends the "here's your login" email (Resend, via the
  // send-credentials-email Edge Function). This is what was missing before —
  // provisionMonitor above only ever touched Supabase Auth; nothing emailed
  // the password anywhere. Falls back to `skipped: true` when Supabase isn't
  // configured, since there's no server-side function to call in local mode.
  const sendMonitorCredentialsEmail = async (params: {
    monitorName: string;
    monitorEmail: string;
    password: string;
    wards?: string;
    isResend?: boolean;
  }) => sendCredentialsEmail(params);

  // Awaitable monitor persistence, used right before provisioning a
  // monitor's login so the `monitors` row is guaranteed to exist in
  // Supabase first (see AdminDashboard's saveMonitor/handleSendCredentials).
  const persistMonitor = async (m: Monitor) => {
    await upsertMonitorInDb(m);
  };

  // --------------------------------------------------------------------------
  // AUTHENTICATION (Phase 3)
  // --------------------------------------------------------------------------

  async function handleLogin(email: string, password: string): Promise<string | null> {
    const { user, error, isLocalOnly } = await loginWithSupabase(email, password);
    if (error || !user) {
      trackEvent('login', 'failed');
      return error || 'Invalid email or password.';
    }

    trackEvent('login', 'success', { role: user.role });
    setIsLocalOnlySession(Boolean(isLocalOnly));

    // Link monitorId if missing
    let loggedIn = user;
    if (user.role === 'monitor' && !user.monitorId) {
      const matched = sharedMonitors.find(m => m.email.toLowerCase() === email.toLowerCase());
      if (matched) {
        loggedIn = { ...user, monitorId: matched.id };
      }
    }

    setAuthStatus('Signing in...');
    setTimeout(() => {
      setCurrentUser(loggedIn);
      setView(loggedIn.role === 'admin' ? 'admin' : 'monitor');
      setAuthStatus(null);
    }, 450);

    return null;
  }

  // Public admin self-signup has been intentionally removed. Admin accounts
  // are created by hand in the Supabase dashboard (Authentication > Users),
  // and "Enable email signups" should be turned off in the project's Auth
  // settings so the public `supabase.auth.signUp` endpoint is blocked too —
  // removing this UI alone doesn't stop someone calling the API directly.

  async function handleResetPassword(email: string, newPassword: string): Promise<string | null> {
    const { success, error } = await resetPasswordWithSupabase(email, newPassword);
    if (!success) {
      return error || 'Failed to send password reset.';
    }
    return null;
  }

  function handlePasswordRecoveryDone() {
    setShowPasswordRecovery(false);
    // Strip the recovery tokens out of the URL so a refresh doesn't
    // re-trigger the modal, and land the user on the normal login form.
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setCurrentUser(null);
    setView('login');
  }

  async function handleLogout() {
    setAuthStatus('Signing out...');
    await logoutWithSupabase();
    setTimeout(() => {
      setCurrentUser(null);
      setView('public');
      setAuthStatus(null);
    }, 450);
  }

  if (booting) return <SplashScreen onDone={() => setBooting(false)} />;

  return (
    <>
      {authStatus && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#145a32] text-white">
          <div className="flex flex-col items-center gap-3">
            <ThreeDotsLoading dotColor="bg-white" size="w-2.5 h-2.5" />
            <p className="text-xs font-semibold tracking-wider text-white/95 uppercase" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {authStatus}
            </p>
          </div>
        </div>
      )}

      {dataLoading && !booting && (
        <div className="fixed inset-0 z-[998] flex flex-col items-center justify-center bg-white/80 backdrop-blur-xs">
          <div className="flex flex-col items-center gap-3">
            <ThreeDotsLoading dotColor="bg-[#145a32]" size="w-3 h-3" />
            <p className="text-xs font-medium text-gray-600" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Loading Council Yanga records…
            </p>
          </div>
        </div>
      )}

      {showPasswordRecovery && (
        <PasswordRecoveryModal onDone={handlePasswordRecoveryDone} />
      )}

      {view === 'login' && (
        <LoginPage
          onLogin={handleLogin}
          onBack={() => setView('public')}
          onResetPassword={handleResetPassword}
        />
      )}

      {view === 'admin' && (
        <AdminDashboard
          onLogout={handleLogout}
          sharedProjects={sharedProjects}
          setSharedProjects={handleUpdateProjects as any}
          visits={sharedVisits}
          setVisits={handleUpdateVisits as any}
          submissions={sharedSubmissions}
          setSubmissions={handleUpdateSubmissions as any}
          sysNotifs={sharedSysNotifs}
          setSysNotifs={handleUpdateSysNotifs as any}
          sharedFeedback={sharedFeedback}
          setSharedFeedback={handleUpdateFeedback as any}
          users={users}
          setUsers={handleUpdateUsers}
          sharedMonitors={sharedMonitors}
          setSharedMonitors={handleUpdateMonitors}
          persistMonitor={persistMonitor}
          sharedAnnouncements={sharedAnnouncements}
          setSharedAnnouncements={handleUpdateAnnouncements as any}
          sharedWardStatusPhotos={sharedWardStatusPhotos}
          setSharedWardStatusPhotos={handleUpdateWardStatusPhotos}
          provisionMonitor={provisionMonitor}
          sendMonitorCredentialsEmail={sendMonitorCredentialsEmail}
          isLiveDb={isLiveDb}
          isLocalOnlySession={isLocalOnlySession}
        />
      )}

      {view === 'monitor' && (
        <MonitorDashboard
          onLogout={handleLogout}
          monitorId={currentUser?.monitorId || 'M001'}
          monitorName={currentUser?.name || 'Monitor'}
          sharedProjects={sharedProjects}
          visits={sharedVisits}
          setVisits={handleUpdateVisits as any}
          submissions={sharedSubmissions}
          setSubmissions={handleUpdateSubmissions as any}
          sysNotifs={sharedSysNotifs}
          setSysNotifs={handleUpdateSysNotifs as any}
          sharedMonitors={sharedMonitors}
        />
      )}

      {view === 'public' && (
        <PublicPortal
          onLoginClick={() => setView('login')}
          sharedProjects={sharedProjects}
          sharedMonitors={sharedMonitors}
          sharedSubmissions={sharedSubmissions}
          users={users}
          setSharedFeedback={handleUpdateFeedback as any}
          setSysNotifs={handleUpdateSysNotifs as any}
          sharedAnnouncements={sharedAnnouncements}
          sharedWardStatusPhotos={sharedWardStatusPhotos}
        />
      )}
    </>
  );
}
