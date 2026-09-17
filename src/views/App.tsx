import { useState, useEffect } from 'react';
import PublicPortal from './views/PublicPortal';
import LoginPage from './views/LoginPage';
import SignupPage from './views/SignupPage';
import AdminDashboard from './views/AdminDashboard';
import MonitorDashboard from './views/MonitorDashboard';
import { Logo, ThreeDotsLoading } from './components/shared';
import { trackEvent, seedDemoAnalyticsEventsIfEmpty } from './analytics';
import {
  projects as initialProjects,
  scheduledVisits as initialVisits,
  monitorSubmissions as initialSubmissions,
  sysNotifications as initialSysNotifs,
  feedback as initialFeedback,
  announcements as initialAnnouncements,
  defaultUsers,
  monitors as initialMonitors,
  type Project,
  type ScheduledVisit,
  type MonitorSubmission,
  type SysNotification,
  type Feedback,
  type User,
  type Monitor,
  type Announcement,
  type WardStatusPhoto,
  getStoredWardStatusPhotos,
  saveStoredWardStatusPhotos,
  getStoredProjects,
  saveStoredProjects,
  getStoredUsers,
  saveStoredUsers,
  getStoredMonitors,
  saveStoredMonitors,
} from './data';

export type View = 'public' | 'login' | 'signup' | 'admin' | 'monitor';

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
        <p className="text-white/80 text-sm font-semibold tracking-widest uppercase" style={{ fontFamily: 'Outfit, sans-serif' }}>
          {/* COUNCIL YANGA */}
        </p>
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
  useEffect(() => { seedDemoAnalyticsEventsIfEmpty(); }, []);
  const [view, setView] = useState<View>('public');
  const [authStatus, setAuthStatus] = useState<string | null>(null);

  // User auth state
  const [users, setUsers] = useState<User[]>(() => getStoredUsers());
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Shared monitor list (kept in sync so admin changes are visible to login)
  const [sharedMonitors, setSharedMonitors] = useState<Monitor[]>(() => getStoredMonitors());

  const handleUpdateUsers = (action: User[] | ((prev: User[]) => User[])) => {
    setUsers(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      saveStoredUsers(next);
      return next;
    });
  };

  const handleUpdateMonitors = (action: Monitor[] | ((prev: Monitor[]) => Monitor[])) => {
    setSharedMonitors(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      saveStoredMonitors(next);
      return next;
    });
  };

  // Shared project/visit/submission/notif state
  const [sharedProjects, setSharedProjects] = useState<Project[]>(() => getStoredProjects());
  const [sharedVisits, setSharedVisits] = useState<ScheduledVisit[]>(initialVisits);
  const [sharedSubmissions, setSharedSubmissions] = useState<MonitorSubmission[]>(initialSubmissions);
  const [sharedSysNotifs, setSharedSysNotifs] = useState<SysNotification[]>(initialSysNotifs);
  const [sharedFeedback, setSharedFeedback] = useState<Feedback[]>(initialFeedback);
  const [sharedAnnouncements, setSharedAnnouncements] = useState<Announcement[]>(initialAnnouncements);
  const [sharedWardStatusPhotos, setSharedWardStatusPhotos] = useState<WardStatusPhoto[]>(() => getStoredWardStatusPhotos());

  const handleUpdateProjects = (action: Project[] | ((prev: Project[]) => Project[])) => {
    setSharedProjects(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      saveStoredProjects(next);
      return next;
    });
  };

  const handleUpdateWardStatusPhotos = (action: WardStatusPhoto[] | ((prev: WardStatusPhoto[]) => WardStatusPhoto[])) => {
    setSharedWardStatusPhotos(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      saveStoredWardStatusPhotos(next);
      return next;
    });
  };

  function handleLogin(email: string, password: string): string | null {
    let user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) { trackEvent('login', 'failed'); return 'Invalid email or password.'; }
    trackEvent('login', 'success', { role: user.role });
    // If monitor has no monitorId yet, try to find their Monitor record by email
    if (user.role === 'monitor' && !user.monitorId) {
      const matched = sharedMonitors.find(m => m.email.toLowerCase() === email.toLowerCase());
      if (matched) {
        const updated = { ...user, monitorId: matched.id };
        handleUpdateUsers(prev => prev.map(u => u.id === user!.id ? updated : u));
        user = updated;
      }
    }
    const loggedIn = user;
    setAuthStatus('Signing in...');
    setTimeout(() => {
      setCurrentUser(loggedIn);
      setView(loggedIn.role === 'admin' ? 'admin' : 'monitor');
      setAuthStatus(null);
    }, 650);
    return null;
  }

  function handleSignup(newUser: User): string | null {
    if (newUser.role === 'monitor') {
      return 'Monitors cannot sign up. Field monitor accounts are created and provisioned directly by the Council Administrator, who will send your login credentials via email.';
    }
    if (users.find(u => u.email.toLowerCase() === newUser.email.toLowerCase())) {
      return 'An account with this email already exists.';
    }
    const preparedUser = { ...newUser };
    trackEvent('signup', newUser.role);
    setAuthStatus('Account created. Preparing login...');
    setTimeout(() => {
      handleUpdateUsers(prev => [...prev, preparedUser]);
      // Redirect to login so they sign in with their new credentials
      setView('login');
      setAuthStatus(null);
    }, 700);
    return null;
  }

  function handleResetPassword(email: string, newPassword: string): string | null {
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return 'No account found with that email address.';
    handleUpdateUsers(prev => prev.map(u => u.id === user.id ? { ...u, password: newPassword } : u));
    return null;
  }

  function handleLogout() {
    setAuthStatus('Signing out...');
    setTimeout(() => {
      setCurrentUser(null);
      setView('public');
      setAuthStatus(null);
    }, 650);
  }

  if (booting) return <SplashScreen onDone={() => setBooting(false)} />;

  return (
    <>
      {authStatus && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#145a32] text-white"
        >
          <div className="flex flex-col items-center gap-3">
            <ThreeDotsLoading dotColor="bg-white" size="w-2.5 h-2.5" />
            <p className="text-xs font-semibold tracking-wider text-white/95 uppercase" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {authStatus}
            </p>
          </div>
        </div>
      )}

      {view === 'login' && (
        <LoginPage
          onLogin={handleLogin}
          onSignup={() => setView('signup')}
          onBack={() => setView('public')}
          onResetPassword={handleResetPassword}
        />
      )}

      {view === 'signup' && (
        <SignupPage
          onSignup={handleSignup}
          onBack={() => setView('login')}
        />
      )}

      {view === 'admin' && (
        <AdminDashboard
          onLogout={handleLogout}
          sharedProjects={sharedProjects}
          setSharedProjects={handleUpdateProjects}
          visits={sharedVisits}
          setVisits={setSharedVisits}
          submissions={sharedSubmissions}
          setSubmissions={setSharedSubmissions}
          sysNotifs={sharedSysNotifs}
          setSysNotifs={setSharedSysNotifs}
          sharedFeedback={sharedFeedback}
          setSharedFeedback={setSharedFeedback}
          users={users}
          setUsers={handleUpdateUsers}
          sharedMonitors={sharedMonitors}
          setSharedMonitors={handleUpdateMonitors}
          sharedAnnouncements={sharedAnnouncements}
          setSharedAnnouncements={setSharedAnnouncements}
          sharedWardStatusPhotos={sharedWardStatusPhotos}
          setSharedWardStatusPhotos={handleUpdateWardStatusPhotos}
        />
      )}

      {view === 'monitor' && (
        <MonitorDashboard
          onLogout={handleLogout}
          monitorId={currentUser?.monitorId || 'M001'}
          monitorName={currentUser?.name || 'Monitor'}
          sharedProjects={sharedProjects}
          visits={sharedVisits}
          setVisits={setSharedVisits}
          submissions={sharedSubmissions}
          setSubmissions={setSharedSubmissions}
          sysNotifs={sharedSysNotifs}
          setSysNotifs={setSharedSysNotifs}
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
          setSharedFeedback={setSharedFeedback}
          setSysNotifs={setSharedSysNotifs}
          sharedAnnouncements={sharedAnnouncements}
          sharedWardStatusPhotos={sharedWardStatusPhotos}
        />
      )}
    </>
  );
}
