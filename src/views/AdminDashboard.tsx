import React, { useState, useCallback, useRef, useEffect, useMemo, type ReactNode } from 'react';
import {
  LayoutDashboard, FolderKanban, Users, MessageSquare, BarChart2,
  ScrollText, Megaphone, LogOut, Menu, X, Plus, Search, ChevronDown, ChevronLeft, ChevronRight,
  Edit2, Trash2, CheckCircle, AlertCircle, FileText, Download,
  Eye, Bell, RefreshCw, XCircle, Mail, Phone, Calendar,
  Send, Clock, AlertTriangle, CalendarCheck, TrendingUp, UserCheck,
  Activity, Wallet, LayoutGrid, CalendarX, Contact, CheckCircle2, CircleUserRound,
  Layers, Banknote, Camera, UploadCloud, Image as ImageIcon, Maximize2,
  ClipboardCheck, Timer, Save, SlidersHorizontal, MapPin,
  Receipt, Paperclip, KeyRound, Copy, Check, Lock, ShieldCheck, EyeOff,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LabelList, CartesianGrid,
} from 'recharts';
import {
  auditLogs,
  activityData,
  Project, Monitor, Announcement, Feedback, User,
  ScheduledVisit, MonitorSubmission, SysNotification,
  SECTORS, WARDS, CONSTITUENCIES, IMPLEMENTING_DEPTS,
  PROJECT_TYPES, CDF_COMPONENTS, INITIATIVE_COMPONENTS, COMMUNITY_DEVELOPMENT_SECTORS, REGIONS, DISTRICTS,
  BENEFICIARY_TYPES, getProjectBeneficiaryType, getProjectDisbursed, getProjectUtilised, getProjectBalance,
  getBeneficiaryTypeForInitiativeComponent, getProjectInitiativeComponent,
  isInitiative, isProject,
  formatMK, exportToCSV, exportToExcel, exportToPDF,
  WardStatusPhoto, initialWardStatusPhotos, saveStoredWardStatusPhotos,
} from '@/data';
import { uploadToSupabaseStorage } from '@/lib/supabaseService';
import {
  getDistrictsForRegion,
  getRegionForDistrict,
  getConstituenciesForDistrict,
  getWardsForConstituency,
  getWardsForDistrict,
} from '@/administrativeData';
import { Logo, StatusBadge, ProgressBar, CheckIcon, CategoryBadge, DisbursedAndBalanceKpiCard } from '@/components/shared';
import {
  AnalyticsEvent, getStoredAnalyticsEvents, clearStoredAnalyticsEvents, seedDemoAnalyticsEventsIfEmpty,
  filterEventsByRange, getVisitorStats, getTabViews, getDeviceBreakdown, getLanguageBreakdown,
  getTrafficTrend, getTopItems, getTrafficSources, getFeedbackFunnel,
  fetchAnalyticsEventsFromDb, clearAnalyticsEventsInDb,
} from '@/analytics';

// ── Props ─────────────────────────────────────────────────────────────────────
interface AdminDashboardProps {
  onLogout: () => void;
  sharedProjects: Project[];
  setSharedProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  visits: ScheduledVisit[];
  setVisits: React.Dispatch<React.SetStateAction<ScheduledVisit[]>>;
  submissions: MonitorSubmission[];
  setSubmissions: React.Dispatch<React.SetStateAction<MonitorSubmission[]>>;
  sysNotifs: SysNotification[];
  setSysNotifs: React.Dispatch<React.SetStateAction<SysNotification[]>>;
  sharedFeedback: Feedback[];
  setSharedFeedback: React.Dispatch<React.SetStateAction<Feedback[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  sharedMonitors: Monitor[];
  setSharedMonitors: React.Dispatch<React.SetStateAction<Monitor[]>>;
  sharedAnnouncements: Announcement[];
  setSharedAnnouncements: React.Dispatch<React.SetStateAction<Announcement[]>>;
  sharedWardStatusPhotos?: WardStatusPhoto[];
  setSharedWardStatusPhotos?: (action: WardStatusPhoto[] | ((prev: WardStatusPhoto[]) => WardStatusPhoto[])) => void;
  provisionMonitor?: (params: {
    action: 'create' | 'reset-password';
    monitorId: string;
    name: string;
    email: string;
    password: string;
  }) => Promise<{ success: boolean; error: string | null }>;
  // Actually dispatches the "here's your login" email (Resend, via the
  // send-credentials-email Edge Function). `skipped: true` means Supabase
  // isn't configured (local/offline mode) so no server-side function exists
  // to call — the caller should tell the admin to share credentials manually.
  sendMonitorCredentialsEmail?: (params: {
    monitorName: string;
    monitorEmail: string;
    password: string;
    wards?: string;
    isResend?: boolean;
  }) => Promise<{ success: boolean; error: string | null; skipped?: boolean }>;
  // Persists a monitor row directly to Supabase and, unlike setSharedMonitors,
  // can be awaited — used to guarantee the `monitors` row exists in the
  // database before provisioning that monitor's login, since the login's
  // `profiles` row has a foreign-key reference to it.
  persistMonitor?: (m: Monitor) => Promise<void>;
  isLocalOnlySession?: boolean;
  isLiveDb?: boolean;
}

// ── Toast ────────────────────────────────────────────────────────────────────
interface Toast { id: number; message: string; type: 'success' | 'error' | 'info' }
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3800);
  }, []);
  return { toasts, show };
}
function ToastContainer({ toasts }: { toasts: Toast[] }) {
  const bg = { success: 'bg-green-700', error: 'bg-red-600', info: 'bg-blue-600' };
  return (
    <div className="fixed top-4 right-4 z-[200] space-y-2 max-w-xs w-full pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`${bg[t.type]} text-white text-sm px-4 py-3 rounded-xl shadow-lg`}>{t.message}</div>
      ))}
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, size = 'md' }: { title: string; onClose: () => void; children: React.ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const maxW = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-2xl';
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-2.5 sm:p-4 pt-3 sm:pt-8 overflow-y-auto">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxW} mb-10`}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
          <h2 className="text-base sm:text-lg font-bold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"><X size={20} /></button>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>{children}</div>;
}
const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#145a32] focus:border-[#145a32] disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-200';

// ── Downward Select Dropdown (always pops downwards) ───────────────────────────
function DownwardSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: readonly string[] | string[];
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative">
      <label className={`block text-xs font-semibold mb-1 ${disabled ? 'text-gray-400' : 'text-gray-600'}`}>{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen(!open); setSearch(''); } }}
        className={`w-full flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#145a32] focus:border-[#145a32] ${
          disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' : 'bg-white'
        }`}
      >
        <span className={value ? (disabled ? 'text-gray-400 truncate' : 'text-gray-900 truncate font-medium') : 'text-gray-400 truncate'}>
          {value || placeholder}
        </span>
        <ChevronDown size={14} className={`ml-2 transition-transform duration-200 flex-shrink-0 ${disabled ? 'text-gray-300' : 'text-gray-400'} ${open ? 'rotate-180' : ''}`} />
      </button>

      {required && !disabled && (
        <input
          type="text"
          value={value}
          required
          onChange={() => {}}
          className="sr-only"
          tabIndex={-1}
        />
      )}

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
          {options.length > 8 && (
            <div className="p-1.5 border-b border-gray-100 bg-gray-50 flex items-center gap-1.5">
              <Search size={13} className="text-gray-400 ml-1 flex-shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder={`Search ${label.replace('*', '').trim()}...`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full text-xs bg-transparent border-none focus:outline-none px-1 py-1 text-gray-800"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 mr-1 text-xs">✕</button>
              )}
            </div>
          )}
          <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-[#f0fdf4] hover:text-[#145a32] text-gray-400 italic"
            >
              {placeholder}
            </button>
            {filtered.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-[#f0fdf4] hover:text-[#145a32] flex items-center justify-between ${
                  value === opt ? 'bg-[#f0fdf4] text-[#145a32] font-bold' : 'text-gray-700'
                }`}
              >
                <span>{opt}</span>
                {value === opt && <CheckCircle2 size={13} className="text-[#145a32]" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-xs text-center text-gray-400">No matching options</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Project Modal ─────────────────────────────────────────────────────────────
type PF = Omit<Project, 'id' | 'createdDate' | 'lastUpdated'>;
function emptyPF(): PF {
  return {
    name: '',
    initiativeName: '',
    initiativeComponent: '',
    projectType: 'CDF',
    component: 'Community Development Project',
    region: '',
    district: '',
    description: '',
    objectives: '',
    sector: 'Agriculture & Environment',
    constituency: '',
    ward: '',
    traditionalAuthority: '',
    location: '',
    gpsLat: '',
    gpsLng: '',
    beneficiaries: 0,
    budget: 5000000000,
    fundingSource: 'CDF 2025/2026',
    approvalDate: '',
    startDate: '',
    expectedCompletion: '',
    actualCompletion: '',
    status: 'Proposed',
    progress: 0,
    implementingDept: '',
    contractor: '',
    monitor: '',
    disbursed: undefined,
    fundsUsed: undefined,
    photos: [],
  };
}

function ProjectModal({ initial, initialAddType, onSave, onClose, monitorList }: {
  initial?: Project; initialAddType?: 'New Initiative' | 'New Project'; onSave: (p: Project) => void; onClose: () => void; monitorList: Monitor[];
}) {
  const [addType, setAddType] = useState<'New Initiative' | 'New Project' | ''>(
    initial
      ? (isInitiative(initial) ? 'New Initiative' : 'New Project')
      : (initialAddType || '')
  );

  const isGeneralFieldDisabled = !addType;
  const isProjectSpecificDisabled = !addType || addType === 'New Initiative';
  const isInitiativeFieldDisabled = !addType || addType === 'New Project';

  const [form, setForm] = useState<PF>(initial ? {
    name: initial.name,
    initiativeName: initial.initiativeName ?? '',
    initiativeComponent: initial.initiativeComponent ?? '',
    projectType: initial.projectType ?? 'CDF',
    component: initial.component ?? 'Community Development Project',
    region: initial.region ?? '',
    district: initial.district ?? '',
    description: initial.description,
    objectives: initial.objectives,
    sector: initial.sector || 'Agriculture & Environment',
    constituency: initial.constituency ?? '',
    ward: initial.ward ?? '',
    traditionalAuthority: initial.traditionalAuthority,
    location: initial.location,
    gpsLat: initial.gpsLat,
    gpsLng: initial.gpsLng,
    beneficiaries: initial.beneficiaries,
    budget: 5000000000,
    fundingSource: initial.fundingSource,
    approvalDate: initial.approvalDate,
    startDate: initial.startDate,
    expectedCompletion: initial.expectedCompletion,
    actualCompletion: initial.actualCompletion,
    status: initial.status,
    progress: initial.progress,
    implementingDept: initial.implementingDept,
    contractor: initial.contractor,
    monitor: initial.monitor,
    disbursed: initial.disbursed,
    fundsUsed: initial.fundsUsed,
    beneficiaryType: initial.beneficiaryType ?? '',
    photos: initial.photos ? [...initial.photos] : [],
  } : emptyPF());

  const descWordCount = useMemo(() => {
    const text = (form.description || '').trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  }, [form.description]);
  const isDescOverLimit = descWordCount > 28;

  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState('');

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoUploadError('');
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setPhotoUploading(true);
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          setPhotoUploadError('Please select valid image files (PNG, JPG, WEBP).');
          continue;
        }
        try {
          const photoUrl = await uploadToSupabaseStorage('project-photos', file);
          setForm(f => ({ ...f, photos: [...(f.photos || []), photoUrl] }));
        } catch {
          const reader = new FileReader();
          reader.onload = ev => {
            if (typeof ev.target?.result === 'string') {
              setForm(f => ({ ...f, photos: [...(f.photos || []), ev.target!.result as string] }));
            }
          };
          reader.readAsDataURL(file);
        }
      }
    } finally {
      setPhotoUploading(false);
      e.target.value = '';
    }
  };

  const handleAddPhotoUrl = () => {
    if (!photoUrlInput.trim()) return;
    setForm(f => ({ ...f, photos: [...(f.photos || []), photoUrlInput.trim()] }));
    setPhotoUrlInput('');
  };

  const handleRemovePhoto = (idx: number) => {
    setForm(f => ({ ...f, photos: (f.photos || []).filter((_, i) => i !== idx) }));
  };

  const s = (k: keyof PF, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  // When admin selects Community Development Project in Project Component, automatically populate Sector
  const handleComponentChange = (comp: string) => {
    if (comp === 'Community Development Project') {
      const isCurrentValid = COMMUNITY_DEVELOPMENT_SECTORS.includes(form.sector as (typeof COMMUNITY_DEVELOPMENT_SECTORS)[number]);
      setForm(f => ({
        ...f,
        component: comp,
        sector: isCurrentValid ? f.sector : COMMUNITY_DEVELOPMENT_SECTORS[0],
      }));
    } else {
      setForm(f => ({ ...f, component: comp }));
    }
  };

  const availableSectors = form.component === 'Community Development Project'
    ? COMMUNITY_DEVELOPMENT_SECTORS
    : SECTORS;

  // Hierarchical cascading options for administrative filtering
  const districtOptions = form.region
    ? getDistrictsForRegion(form.region)
    : DISTRICTS;

  const constituencyOptions = form.district
    ? getConstituenciesForDistrict(form.district)
    : CONSTITUENCIES;

  const wardOptions = form.constituency
    ? getWardsForConstituency(form.constituency, form.district)
    : form.district
      ? getWardsForDistrict(form.district)
      : WARDS;

  const handleRegionChange = (reg: string) => {
    const validDists = getDistrictsForRegion(reg);
    const keepDist = form.district && validDists.includes(form.district);
    const nextDist = keepDist ? form.district : '';

    const validConsts = nextDist ? getConstituenciesForDistrict(nextDist) : CONSTITUENCIES;
    const keepConst = nextDist && form.constituency && validConsts.includes(form.constituency);
    const nextConst = keepConst ? form.constituency : '';

    const validWards = nextConst
      ? getWardsForConstituency(nextConst, nextDist)
      : nextDist
        ? getWardsForDistrict(nextDist)
        : WARDS;
    const keepWard = nextDist && form.ward && validWards.includes(form.ward);

    setForm(f => ({
      ...f,
      region: reg,
      district: nextDist,
      constituency: nextConst,
      ward: keepWard ? f.ward : '',
    }));
  };

  const handleDistrictChange = (dist: string) => {
    const inferredRegion = getRegionForDistrict(dist) || form.region;
    const validConsts = getConstituenciesForDistrict(dist);
    const keepConst = form.constituency && validConsts.includes(form.constituency);
    const nextConst = keepConst ? form.constituency : '';
    const validWards = nextConst
      ? getWardsForConstituency(nextConst, dist)
      : getWardsForDistrict(dist);
    const keepWard = form.ward && validWards.includes(form.ward);

    setForm(f => ({
      ...f,
      region: inferredRegion,
      district: dist,
      constituency: nextConst,
      ward: keepWard ? f.ward : '',
    }));
  };

  const handleConstituencyChange = (c: string) => {
    const validWards = getWardsForConstituency(c, form.district);
    const keepWard = form.ward && validWards.includes(form.ward);

    setForm(f => ({
      ...f,
      constituency: c,
      ward: keepWard ? f.ward : '',
    }));
  };

  const handleInitiativeComponentChange = (val: string) => {
    let inferredBeneficiary = form.beneficiaryType;
    if (val === 'Youth Enterprise fund') inferredBeneficiary = 'Youth Entrepreneurs';
    else if (val === 'School Bursaries') inferredBeneficiary = 'Students';
    else if (val === 'Women Economic Empowerment') inferredBeneficiary = 'Women Entrepreneurs';
    else if (val === 'Sports Development Fund' || val === 'Creative Arts & Innovation') inferredBeneficiary = 'Sports, creative arts & Innovation';

    setForm(f => ({
      ...f,
      initiativeComponent: val,
      beneficiaryType: inferredBeneficiary || f.beneficiaryType,
    }));
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!addType && !initial) return;
    if (isDescOverLimit) return;
    const today = new Date().toISOString().slice(0, 10);
    const isInit = addType === 'New Initiative' || (!addType && initial ? isInitiative(initial) : false);
    const finalName = isInit
      ? (form.initiativeName || form.name || 'New Initiative')
      : (form.name || form.initiativeName || 'New Project');
    const finalComponent = isInit
      ? (form.initiativeComponent || form.component || 'Youth Enterprise fund')
      : (form.component || 'Community Development Project');
    const finalBeneficiaryType = form.beneficiaryType || (
      isInit
        ? (finalComponent ? getBeneficiaryTypeForInitiativeComponent(finalComponent) : 'Youth Entrepreneurs')
        : 'District-Wide'
    );

    onSave({
      ...form,
      budget: 5000000000,
      disbursed: form.disbursed !== undefined && form.disbursed !== null && !isNaN(Number(form.disbursed)) ? Number(form.disbursed) : undefined,
      fundsUsed: form.fundsUsed !== undefined && form.fundsUsed !== null && !isNaN(Number(form.fundsUsed)) ? Number(form.fundsUsed) : undefined,
      itemType: isInit ? 'Initiative' : 'Project',
      name: finalName,
      initiativeName: isInit ? finalName : '',
      initiativeComponent: isInit ? finalComponent : '',
      component: finalComponent,
      beneficiaryType: finalBeneficiaryType,
      id: initial?.id ?? '',
      createdDate: initial?.createdDate ?? today,
      lastUpdated: today,
    });
  }

  return (
    <Modal
      title={
        initial
          ? (isInitiative(initial) ? 'Edit Initiative' : 'Edit Project')
          : (addType === 'New Initiative' ? 'Add New Initiative' : addType === 'New Project' ? 'Add New Project' : 'Add New Project/Initiative')
      }
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={submit} className="space-y-4 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* On top of Project Component: What do you want to add? */}
          <div className="sm:col-span-2">
            <Fld label="What do you want to add? *">
              <select
                required
                className={`${inp} font-semibold ${!addType ? 'text-gray-600 bg-amber-50/50 border-amber-300' : 'text-gray-900 bg-white border-[#145a32]'}`}
                value={addType}
                onChange={e => setAddType(e.target.value as 'New Initiative' | 'New Project' | '')}
              >
                <option value="">Select either New Initiative or New Project</option>
                <option value="New Initiative">New Initiative</option>
                <option value="New Project">New Project</option>
              </select>
            </Fld>
          </div>

          {/* Project Component * */}
          <Fld label="Project Component *">
            <select
              required={addType === 'New Project'}
              disabled={isProjectSpecificDisabled}
              className={inp}
              value={form.component || 'Community Development Project'}
              onChange={e => handleComponentChange(e.target.value)}
            >
              {CDF_COMPONENTS.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </Fld>

          <Fld label="Project Type / Initiative *">
            <select
              required={!!addType}
              disabled={isGeneralFieldDisabled}
              className={inp}
              value={form.projectType || 'CDF'}
              onChange={e => s('projectType', e.target.value)}
            >
              {PROJECT_TYPES.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </Fld>

          {/* Project Name * */}
          <Fld label="Project Name *">
            <input
              required={addType === 'New Project'}
              disabled={isProjectSpecificDisabled}
              className={inp}
              value={form.name}
              onChange={e => s('name', e.target.value)}
              placeholder="Health Post Construction or Road Rehabilitation"
            />
          </Fld>

          {/* Initiative Name * */}
          <Fld label="Initiative Name *">
            <input
              required={addType === 'New Initiative'}
              disabled={isInitiativeFieldDisabled}
              className={inp}
              value={form.initiativeName ?? ''}
              onChange={e => s('initiativeName', e.target.value)}
              placeholder="Youth Skills Development or Secondary Bursary Scheme"
            />
          </Fld>

          {/* Initiative Component * */}
          <Fld label="Initiative Component *">
            <select
              required={addType === 'New Initiative'}
              disabled={isInitiativeFieldDisabled}
              className={inp}
              value={form.initiativeComponent ?? ''}
              onChange={e => handleInitiativeComponentChange(e.target.value)}
            >
              <option value="">Select Initiative Component</option>
              {INITIATIVE_COMPONENTS.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </Fld>

          <Fld label="Sector *">
            <select
              required={!!addType}
              disabled={isGeneralFieldDisabled}
              className={inp}
              value={form.sector}
              onChange={e => s('sector', e.target.value)}
            >
              <option value="">Select sector</option>
              {availableSectors.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </Fld>

          {/* Choose Region Dropdown (opens downwards, defaults to Select region) */}
          <DownwardSelect
            label="Choose Region *"
            value={form.region ?? ''}
            placeholder="Select region"
            options={REGIONS}
            onChange={handleRegionChange}
            required={!!addType}
            disabled={isGeneralFieldDisabled}
          />

          {/* District Dropdown (opens downwards, defaults to Select district, filtered by selected region) */}
          <DownwardSelect
            label="District *"
            value={form.district ?? ''}
            placeholder={
              form.region
                ? `Select district (${districtOptions.length} available in ${form.region} Region)`
                : "Select district"
            }
            options={districtOptions}
            onChange={handleDistrictChange}
            required={!!addType}
            disabled={isGeneralFieldDisabled}
          />

          {/* Constituency Dropdown (opens downwards, defaults to Select constituency) */}
          <DownwardSelect
            label="Constituency *"
            value={form.constituency ?? ''}
            placeholder={form.district ? `Select constituency (${constituencyOptions.length} available)` : "Select constituency"}
            options={constituencyOptions}
            onChange={handleConstituencyChange}
            required={!!addType}
            disabled={isGeneralFieldDisabled}
          />

          {/* Ward Dropdown (opens downwards, defaults to Select ward) */}
          <DownwardSelect
            label="Ward *"
            value={form.ward ?? ''}
            placeholder={
              form.constituency
                ? `Select ward (${wardOptions.length} available)`
                : form.district
                  ? `Select ward (${wardOptions.length} available in district)`
                  : "Select ward"
            }
            options={wardOptions}
            onChange={val => s('ward', val)}
            required={!!addType}
            disabled={isGeneralFieldDisabled}
          />
        </div>

        <Fld label="Description">
          <textarea
            rows={2}
            disabled={isGeneralFieldDisabled}
            className={`${inp} ${isDescOverLimit ? 'border-amber-400 focus:ring-amber-500 bg-amber-50/20' : ''}`}
            value={form.description}
            onChange={e => s('description', e.target.value)}
          />
          {isDescOverLimit && (
            <div className="mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2 shadow-xs">
              <AlertTriangle size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold text-amber-950">You have exceeded words limit.</span>
              </div>
            </div>
          )}
        </Fld>
        <Fld label="Objectives"><textarea rows={2} disabled={isGeneralFieldDisabled} className={inp} value={form.objectives} onChange={e => s('objectives', e.target.value)} /></Fld>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Fld label="Traditional Authority"><input disabled={isGeneralFieldDisabled} className={inp} value={form.traditionalAuthority} onChange={e => s('traditionalAuthority', e.target.value)} placeholder="T/A Zulu" /></Fld>
          <Fld label="Location"><input disabled={isGeneralFieldDisabled} className={inp} value={form.location} onChange={e => s('location', e.target.value)} /></Fld>
          <Fld label="GPS Latitude"><input disabled={isGeneralFieldDisabled} className={inp} value={form.gpsLat} onChange={e => s('gpsLat', e.target.value)} placeholder="-13.xxxx" /></Fld>
          <Fld label="GPS Longitude"><input disabled={isGeneralFieldDisabled} className={inp} value={form.gpsLng} onChange={e => s('gpsLng', e.target.value)} placeholder="33.xxxx" /></Fld>
          <Fld label="Beneficiaries"><input type="number" min={0} disabled={isGeneralFieldDisabled} className={inp} value={form.beneficiaries || ''} onChange={e => s('beneficiaries', Number(e.target.value))} /></Fld>
          <Fld label="Beneficiary Type">
            <select disabled={isGeneralFieldDisabled} className={inp} value={form.beneficiaryType ?? ''} onChange={e => s('beneficiaryType', e.target.value)}>
              <option value="">Select beneficiary type (optional)</option>
              {BENEFICIARY_TYPES.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </Fld>
          <Fld label="Total Funds Allocation">
            <input
              type="text"
              readOnly
              disabled={isGeneralFieldDisabled}
              className={`${inp} bg-gray-50 text-gray-700 font-semibold cursor-not-allowed`}
              value="5,000,000,000.00"
            />
          </Fld>
          <Fld label="Total Funds Disbursed">
            <input
              type="number"
              min={0}
              step={50000}
              disabled={isGeneralFieldDisabled}
              className={inp}
              value={form.disbursed ?? ''}
              onChange={e => s('disbursed', e.target.value === '' ? undefined : Number(e.target.value))}
              placeholder="3500000"
            />
          </Fld>
          <Fld label="Total Funds Used (MK)">
            <input
              type="number"
              min={0}
              step={10000}
              disabled={isGeneralFieldDisabled}
              className={inp}
              value={form.fundsUsed ?? ''}
              onChange={e => s('fundsUsed', e.target.value === '' ? undefined : Number(e.target.value))}
              placeholder="1850000 (updated from monitor reports & receipts)"
            />
          </Fld>
          <Fld label="Total Balance Remaining">
            <input
              type="text"
              readOnly
              disabled={isGeneralFieldDisabled}
              className={`${inp} bg-gray-50 text-gray-800 font-semibold cursor-not-allowed`}
              value={(() => {
                const disbursedVal = form.disbursed !== undefined && !isNaN(Number(form.disbursed))
                  ? Number(form.disbursed)
                  : (initial ? getProjectDisbursed(initial) : 0);
                const usedVal = form.fundsUsed !== undefined && !isNaN(Number(form.fundsUsed))
                  ? Number(form.fundsUsed)
                  : (initial ? getProjectUtilised(initial) : 0);
                return formatMK(disbursedVal - usedVal);
              })()}
            />
          </Fld>
          <Fld label="Funding Source"><input disabled={isGeneralFieldDisabled} className={inp} value={form.fundingSource} onChange={e => s('fundingSource', e.target.value)} /></Fld>
          <Fld label="Status">
            <select disabled={isGeneralFieldDisabled} className={inp} value={form.status} onChange={e => s('status', e.target.value as Project['status'])}>
              {['Proposed','Assessed','Approved','Not Started','Ongoing','Near Completion','Completed','Suspended','On Hold','Stalled'].map(x => <option key={x}>{x}</option>)}
            </select>
          </Fld>
          <Fld label="Progress (%)"><input type="number" min={0} max={100} disabled={isProjectSpecificDisabled} className={inp} value={form.progress} onChange={e => s('progress', Number(e.target.value))} /></Fld>
          <Fld label="Contractor"><input disabled={isProjectSpecificDisabled} className={inp} value={form.contractor} onChange={e => s('contractor', e.target.value)} /></Fld>
          <Fld label="Assigned Monitor">
            <select disabled={isGeneralFieldDisabled} className={inp} value={form.monitor} onChange={e => s('monitor', e.target.value)}>
              <option value="">Select monitor</option>
              {monitorList.filter(m => m.status === 'Active').map(m => <option key={m.id}>{m.name}</option>)}
            </select>
          </Fld>
          <Fld label="Approval Date"><input type="date" disabled={isGeneralFieldDisabled} className={inp} value={form.approvalDate} onChange={e => s('approvalDate', e.target.value)} /></Fld>
          <Fld label="Start Date"><input type="date" disabled={isProjectSpecificDisabled} className={inp} value={form.startDate} onChange={e => s('startDate', e.target.value)} /></Fld>
          <Fld label="Expected Completion"><input type="date" disabled={isProjectSpecificDisabled} className={inp} value={form.expectedCompletion} onChange={e => s('expectedCompletion', e.target.value)} /></Fld>

          {/* Project/Initiative Site Photos & Images */}
          <div className="sm:col-span-2 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Camera size={14} className="text-[#145a32]" />
                <span>{addType === 'New Initiative' || (initial && isInitiative(initial)) ? 'Initiative' : 'Project'} Site Photos & Progress Gallery</span>
              </label>
              <span className="text-[11px] text-gray-500 font-medium">
                {(form.photos?.length || 0)} photo{(form.photos?.length || 0) === 1 ? '' : 's'} attached
              </span>
            </div>

            {photoUploadError && (
              <p className="text-xs text-red-600 mb-2">{photoUploadError}</p>
            )}

            {/* Photo thumbnails grid */}
            {form.photos && form.photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
                {form.photos.map((ph, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-video">
                    <img src={ph} alt={`Site photo ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1.5 right-1.5 bg-black/70 hover:bg-red-600 text-white p-1 rounded-full opacity-90 hover:opacity-100 transition-all cursor-pointer"
                      title="Remove photo"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload or Add URL Controls */}
            <div className="flex flex-col sm:flex-row gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-gray-200 hover:border-[#145a32] rounded-xl text-xs font-semibold text-gray-600 hover:text-[#145a32] bg-gray-50 hover:bg-green-50/50 cursor-pointer transition-colors">
                <UploadCloud size={15} />
                <span>{photoUploading ? 'Uploading...' : 'Upload Site Photos'}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={photoUploading}
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>

              <div className="flex-1 flex gap-1.5">
                <input
                  type="url"
                  placeholder="Or paste image URL (https://...)"
                  value={photoUrlInput}
                  onChange={e => setPhotoUrlInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPhotoUrl(); } }}
                  className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#145a32]"
                />
                <button
                  type="button"
                  onClick={handleAddPhotoUrl}
                  disabled={!photoUrlInput.trim()}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button
            type="submit"
            disabled={!addType}
            className="px-5 py-2 rounded-lg text-sm bg-[#145a32] text-white font-semibold hover:bg-[#0f4424] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {initial ? 'Save Changes' : (addType === 'New Initiative' ? 'Add Initiative' : addType === 'New Project' ? 'Add Project' : 'Add New Project/Initiative')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Monitor Modal ─────────────────────────────────────────────────────────────
function MonitorModal({
  initial,
  existingUser,
  onSave,
  onClose,
}: {
  initial?: Monitor;
  existingUser?: User;
  onSave: (m: Monitor, credentials?: { password?: string; sendEmail: boolean }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [wards, setWards] = useState(initial?.wards ?? '');
  const [status, setStatus] = useState<Monitor['status']>(initial?.status ?? 'Active');

  // Password & email credentials
  const [password, setPassword] = useState(() => {
    if (existingUser?.password) return existingUser.password;
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    return `Monitor@${randomDigits}`;
  });
  const [showPassword, setShowPassword] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [resetCredentials, setResetCredentials] = useState(false);

  function generateNewPassword() {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const words = ['Likoma', 'Monitor', 'Field', 'Council', 'Tracker'];
    const chosenWord = words[Math.floor(Math.random() * words.length)];
    setPassword(`${chosenWord}#${randomDigits}`);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const today = new Date().toISOString().slice(0, 10);
    const monitorData: Monitor = {
      id: initial?.id ?? `M${String(Date.now()).slice(-3)}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      wards: wards.trim(),
      assignedProjects: initial?.assignedProjects ?? 0,
      submitted: initial?.submitted ?? 0,
      approved: initial?.approved ?? 0,
      returned: initial?.returned ?? 0,
      lastActive: today,
      status: initial ? status : 'Active',
      joinDate: initial?.joinDate ?? today,
    };

    if (!initial) {
      onSave(monitorData, { password: password.trim(), sendEmail });
    } else if (resetCredentials) {
      onSave(monitorData, { password: password.trim(), sendEmail });
    } else {
      onSave(monitorData);
    }
  }

  return (
    <Modal title={initial ? `Edit Monitor: ${initial.name}` : 'Add New Field Monitor'} onClose={onClose} size="md">
      <form onSubmit={submit} className="space-y-4">
        <Fld label="Full Name *">
          <input
            required
            className={inp}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="your name"
          />
        </Fld>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Fld label="Email Address (Login Username) *">
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                required
                type="email"
                className={`${inp} pl-8`}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="monitor@councilyanga.mw"
              />
            </div>
          </Fld>
          <Fld label="Phone Number">
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className={`${inp} pl-8`}
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+265 8xx xxx xxx"
              />
            </div>
          </Fld>
        </div>

        <div>
          <DownwardSelect
            label="Assigned Ward"
            value={wards}
            placeholder="Select assigned ward"
            options={['All Wards', ...WARDS]}
            onChange={val => {
              if (!val) {
                setWards('');
              } else if (val === 'All Wards') {
                setWards('All Wards');
              } else {
                setWards(val);
              }
            }}
          />
          {wards && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-gray-500 font-medium">Selected:</span>
              {Array.from(new Set(wards.split(',').map(s => s.trim()).filter(Boolean))).map(w => (
                <span
                  key={w}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700"
                >
                  {w}
                  <button
                    type="button"
                    onClick={() => {
                      const list = wards.split(',').map(s => s.trim()).filter(Boolean).filter(item => item !== w);
                      setWards(list.join(', '));
                    }}
                    className="text-gray-400 hover:text-red-600 cursor-pointer ml-0.5"
                    title={`Remove ${w}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {initial && (
          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700 select-none">
              <input
                type="checkbox"
                checked={resetCredentials}
                onChange={e => setResetCredentials(e.target.checked)}
                className="w-4 h-4 rounded text-[#145a32] focus:ring-[#145a32]"
              />
              <span>Reset & email new login credentials to this monitor</span>
            </label>
          </div>
        )}

        {/* Credentials & Email Box */}
        {(!initial || resetCredentials) && (
          <div className="bg-[#145a32] text-white rounded-xl p-3.5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound size={13} className="text-white" /> Field Monitor Credentials
              </span>
              <button
                type="button"
                onClick={generateNewPassword}
                className="text-[11px] text-white/90 hover:text-white hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={11} className="text-white" /> Generate New
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-white mb-1">Temporary Login Password *</label>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-white text-[#145a32] placeholder-gray-400 border border-white rounded-lg px-3 py-2 text-xs font-mono pr-9 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#145a32] hover:text-[#0f4424] cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={14} className="text-[#145a32]" /> : <Eye size={14} className="text-[#145a32]" />}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-white/85 mt-1">This password will be dispatched to the monitor&#39;s email address.</p>
            </div>

            <div className="pt-1 border-t border-white/20 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-white select-none">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={e => setSendEmail(e.target.checked)}
                  className="w-4 h-4 rounded text-[#145a32] focus:ring-white bg-white accent-[#145a32]"
                />
                <span className="text-white">Send login credentials to monitor via email</span>
              </label>

              <button
                type="button"
                onClick={() => setShowEmailPreview(v => !v)}
                className="text-[11px] font-semibold text-white/90 hover:text-white hover:underline cursor-pointer"
              >
                {showEmailPreview ? 'Hide Preview' : 'Preview Email'}
              </button>
            </div>

            {showEmailPreview && (
              <div className="bg-white rounded-lg p-3 text-xs text-gray-700 font-sans space-y-1.5 shadow-sm">
                <p><strong className="text-gray-900">To:</strong> {email || 'monitor@councilyanga.mw'}</p>
                <p><strong className="text-gray-900">Subject:</strong> Likoma District Council - Your Field Monitor Login Credentials</p>
                <div className="pt-2 border-t border-gray-100 text-gray-700 leading-relaxed space-y-1">
                  <p>Dear {name || 'Field Monitor'},</p>
                  <p>You have been registered as an official Field Monitor for Likoma District Council on the Council Yanga CDF Tracking Portal.</p>
                  <p>Below are your credentials to log in:</p>
                  <p className="pl-2 font-mono text-[11px] bg-gray-50 py-1 border-l-2 border-[#145a32] text-gray-800">
                    Email: {email || 'your-email'}<br />
                    Password: {password}<br />
                    Assigned Ward(s): {wards || 'All Wards'}
                  </p>
                  <p>Please keep these credentials confidential.</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl text-sm bg-[#145a32] text-white font-semibold hover:bg-[#0f4424] flex items-center gap-2 shadow-sm"
          >
            <Mail size={14} />
            {initial ? 'Save Changes' : 'Add Monitor & Email Credentials'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Send Credentials Modal ──────────────────────────────────────────────────
function SendCredentialsModal({
  monitor,
  existingUser,
  onSend,
  onClose,
}: {
  monitor: Monitor;
  existingUser?: User;
  onSend: (m: Monitor, password: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [password, setPassword] = useState(
    () => existingUser?.password || `Monitor@${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [showPass, setShowPass] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  function generateNewPassword() {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const words = ['Likoma', 'Monitor', 'Field', 'Council', 'Tracker'];
    const chosenWord = words[Math.floor(Math.random() * words.length)];
    setPassword(`${chosenWord}#${randomDigits}`);
  }

  async function handleSendSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    // Actually wait for the real send (Supabase Auth sync + Resend email)
    // instead of a fake setTimeout that always "succeeded" — onSend
    // (handleSendCredentials) drives the real result via the
    // CredentialSentModal / toast that opens after this closes.
    await onSend(monitor, password);
    setSending(false);
  }

  return (
    <Modal title={`Send Login Credentials: ${monitor.name}`} onClose={onClose} size="md">
      <form onSubmit={handleSendSubmit} className="space-y-4">
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-2.5">
          <Mail size={16} className="text-[#145a32] mt-0.5 flex-shrink-0" />
          <div className="leading-relaxed">
            Send official login credentials to <span className="font-semibold text-gray-900">{monitor.name}</span> at{' '}
            <span className="font-semibold text-[#145a32] underline">{monitor.email}</span>. If this monitor does not have an active user account, one will be created automatically.
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
            <span className="text-gray-400 block mb-0.5">Field Monitor</span>
            <span className="font-semibold text-gray-900">{monitor.name}</span>
          </div>
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
            <span className="text-gray-400 block mb-0.5">Assigned Wards</span>
            <span className="font-semibold text-gray-900">{monitor.wards || 'All Wards'}</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-gray-700">Account Password</label>
            <button
              type="button"
              onClick={generateNewPassword}
              className="text-[11px] text-[#145a32] hover:underline font-semibold flex items-center gap-1"
            >
              <RefreshCw size={11} /> Generate New
            </button>
          </div>
          <div className="relative">
            <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              required
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={`${inp} pl-8 pr-9 font-mono`}
              placeholder="Enter password"
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">This password will be updated in the system and emailed to the monitor.</p>
        </div>

        {/* Email Preview */}
        <div className="border border-emerald-200 rounded-xl overflow-hidden text-xs bg-white">
          <div className="bg-emerald-50 px-3.5 py-2.5 border-b border-emerald-100 flex items-center justify-between">
            <span className="font-semibold text-[#145a32] flex items-center gap-1.5">
              <Mail size={13} /> Email Notification to be Sent
            </span>
            <button
              type="button"
              onClick={() => setShowPreview(v => !v)}
              className="text-[11px] text-[#145a32] hover:underline"
            >
              {showPreview ? 'Hide' : 'Show'}
            </button>
          </div>
          {showPreview && (
            <div className="p-3.5 space-y-2 text-gray-600 font-sans leading-relaxed">
              <p><strong className="text-gray-700">To:</strong> {monitor.email}</p>
              <p><strong className="text-gray-700">Subject:</strong> Likoma District Council - Your Field Monitor Login Credentials</p>
              <div className="pt-2 border-t border-gray-100 text-gray-700 space-y-1.5">
                <p>Dear {monitor.name},</p>
                <p>Here are your official login credentials for the Likoma District Council tracking portal:</p>
                <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 font-mono text-[11px] space-y-1 text-gray-800">
                  <p><strong>Username / Email:</strong> {monitor.email}</p>
                  <p><strong>Password:</strong> {password}</p>
                  <p><strong>Assigned Ward(s):</strong> {monitor.wards || 'All Wards'}</p>
                </div>
                <p className="text-xs text-gray-500">Please sign in to view your field inspection visits and submit verification reports.</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={sending}
            className="px-5 py-2 rounded-xl text-sm bg-[#145a32] text-white font-semibold hover:bg-[#0f4424] flex items-center gap-2 shadow-sm disabled:opacity-70"
          >
            {sending ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Sending Email...</span>
              </>
            ) : (
              <>
                <Send size={14} />
                <span>Dispatch Credentials via Email</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Credential Sent Modal ───────────────────────────────────────────────────
function CredentialSentModal({
  data,
  onClose,
  onResend,
}: {
  data: {
    monitorName: string;
    monitorEmail: string;
    password: string;
    wards: string;
    timestamp: string;
    isResend?: boolean;
    emailSent: boolean;
    emailError?: string | null;
  };
  onClose: () => void;
  onResend: () => void | Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const [resending, setResending] = useState(false);
  // Tracks the outcome of a resend the admin triggered from this modal, so
  // the button label can say "Resent!" / "Failed" right after — separate
  // from `data.emailSent`, which reflects the original send and is what
  // drives the banner/badge above.
  const [resendOutcome, setResendOutcome] = useState<'success' | 'failed' | null>(null);

  function handleCopy() {
    navigator.clipboard.writeText(`Council Yanga Field Monitor Credentials\nPortal: Council Yanga\nEmail: ${data.monitorEmail}\nPassword: ${data.password}\nAssigned Wards: ${data.wards || 'All Wards'}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleResendClick() {
    setResending(true);
    setResendOutcome(null);
    // Waits on the real result (Supabase Auth sync + Resend email) via
    // onResend/handleSendCredentials — no more automatic "Resent!" claimed
    // regardless of what actually happened. The parent re-renders `data`
    // with the fresh emailSent/emailError right after this resolves.
    await onResend();
    setResending(false);
  }

  // Once `data` refreshes after a resend, mirror its outcome onto the button
  // for a few seconds, then let the button return to its resting label.
  const lastEmailSentRef = useRef(data.emailSent);
  useEffect(() => {
    if (lastEmailSentRef.current === data.emailSent) return;
    lastEmailSentRef.current = data.emailSent;
    setResendOutcome(data.emailSent ? 'success' : 'failed');
    if (data.emailSent) {
      const t = setTimeout(() => setResendOutcome(null), 3000);
      return () => clearTimeout(t);
    }
  }, [data.emailSent]);

  const emailFailed = !data.emailSent;

  return (
    <Modal title={data.isResend ? 'Login Credentials Dispatched' : 'Monitor Registered & Credentials Sent'} onClose={onClose} size="md">
      <div className="space-y-4">
        {emailFailed ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
              <Mail size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Account Saved — Email Not Sent</h3>
              <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                The account for <span className="font-semibold text-gray-900">{data.monitorName}</span> is ready, but the credentials
                email to <span className="font-semibold text-gray-900">{data.monitorEmail}</span> could not be delivered
                {data.emailError ? <>: <span className="font-mono text-[11px]">{data.emailError}</span></> : '.'} Copy the details
                below and share them with the monitor directly, or try resending.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-[#145a32] text-white flex items-center justify-center flex-shrink-0 mt-0.5">
              <Mail size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Email Dispatched Successfully</h3>
              <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                Login credentials for <span className="font-semibold text-gray-900">{data.monitorName}</span> have been sent to{' '}
                <span className="font-semibold text-[#145a32] underline">{data.monitorEmail}</span> at {data.timestamp}.
              </p>
            </div>
          </div>
        )}

        {/* Credentials Card */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Account Credentials</span>
            {emailFailed ? (
              <span className="text-[11px] font-semibold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                Not Sent
              </span>
            ) : (
              <span className="text-[11px] font-semibold bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 size={11} /> Sent via Email
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <span className="text-gray-400 block mb-0.5">Monitor Name</span>
              <span className="font-semibold text-gray-900">{data.monitorName}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <span className="text-gray-400 block mb-0.5">Assigned Wards</span>
              <span className="font-semibold text-gray-900">{data.wards || 'All Wards'}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <span className="text-gray-400 block mb-0.5">Login Email</span>
              <span className="font-semibold text-[#145a32] font-mono break-all">{data.monitorEmail}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-gray-200 flex items-center justify-between">
              <div>
                <span className="text-gray-400 block mb-0.5">Password</span>
                <span className="font-mono font-bold text-gray-900">{data.password}</span>
              </div>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="text-xs font-semibold text-[#145a32] hover:text-[#0f4424] flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 hover:bg-emerald-50 transition"
            >
              {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Login Details'}</span>
            </button>
            <button
              type="button"
              onClick={handleResendClick}
              disabled={resending}
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
            >
              <RefreshCw size={13} className={resending ? 'animate-spin' : ''} />
              <span>
                {resending ? 'Resending...' : resendOutcome === 'success' ? 'Resent!' : resendOutcome === 'failed' ? 'Failed — retry' : 'Resend Email'}
              </span>
            </button>
          </div>
        </div>

        {/* Email Preview */}
        <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
          <div className="bg-gray-100 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
            <span className="font-semibold text-gray-700">Email Notification Summary</span>
            <span className="text-gray-400">Likoma District Council Mailer</span>
          </div>
          <div className="p-3 bg-white space-y-1 text-gray-600 leading-relaxed font-sans">
            <p><strong className="text-gray-700">Subject:</strong> Likoma District Council - Your Field Monitor Login Credentials</p>
            <p><strong className="text-gray-700">To:</strong> {data.monitorEmail}</p>
            <div className="mt-2 pt-2 border-t border-gray-100 text-gray-700 space-y-1.5">
              <p>Dear {data.monitorName},</p>
              <p>You have been registered as an official Field Monitor for Likoma District Council on the Council Yanga CDF Tracking Portal.</p>
              <p>Please log in using your registered email and the temporary password: <span className="font-mono font-bold bg-green-50 px-1.5 py-0.5 rounded border border-green-200">{data.password}</span>.</p>
              <p>Your assigned ward(s): <span className="font-semibold">{data.wards || 'All Wards'}</span>.</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl text-sm bg-[#145a32] text-white font-semibold hover:bg-[#0f4424] transition shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Announcement Modal ────────────────────────────────────────────────────────
function AnnouncementModal({ initial, onSave, onClose }: {
  initial?: Announcement; onSave: (a: Announcement) => void; onClose: () => void;
}) {
  const CATS = ['New Projects', 'Project Completion', 'Progress Update', 'Community Meeting', 'CDF Notice', 'General'];
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'New Projects');
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [body, setBody] = useState(initial?.body ?? '');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ id: initial?.id ?? `AN-${String(Date.now()).slice(-4)}`, title, category, date, body, published: initial?.published ?? true, createdBy: initial?.createdBy ?? 'Admin' });
  }

  return (
    <Modal title={initial ? 'Edit Announcement' : 'New Announcement'} onClose={onClose} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Fld label="Title *"><input required className={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="Announcement title" /></Fld>
        <div className="grid grid-cols-2 gap-4">
          <Fld label="Category"><select className={inp} value={category} onChange={e => setCategory(e.target.value)}>{CATS.map(c => <option key={c}>{c}</option>)}</select></Fld>
          <Fld label="Date"><input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} /></Fld>
        </div>
        <Fld label="Body *"><textarea required rows={5} className={inp} value={body} onChange={e => setBody(e.target.value)} placeholder="Announcement content..." /></Fld>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button type="submit" className="px-5 py-2 rounded-lg text-sm bg-[#145a32] text-white font-semibold hover:bg-[#0f4424]">{initial ? 'Save Changes' : 'Publish'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Schedule Visit Modal ──────────────────────────────────────────────────────
function ScheduleVisitModal({ onSave, onClose, monitorList, projectList, prefill }: {
  onSave: (data: { monitorId: string; monitorName: string; projectId: string; projectName: string; date: string; time: string; notes: string; ward: string }) => void;
  onClose: () => void;
  monitorList: Monitor[];
  projectList: Project[];
  prefill?: ScheduledVisit;
}) {
  const [monitorId, setMonitorId] = useState(prefill?.monitorId ?? '');
  const [projectId, setProjectId] = useState(prefill?.projectId ?? '');
  const [date, setDate] = useState(prefill ? '' : '');
  const [time, setTime] = useState('09:00');
  const [notes, setNotes] = useState(prefill?.notes ?? '');

  const selectedMonitor = monitorList.find(m => m.id === monitorId);
  const availableProjects = projectId
    ? projectList
    : monitorId && selectedMonitor
    ? projectList.filter(p => p.monitor === selectedMonitor.name)
    : projectList;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const project = projectList.find(p => p.id === projectId)!;
    const monitor = monitorList.find(m => m.id === monitorId)!;
    onSave({ monitorId, monitorName: monitor.name, projectId, projectName: project.name, date, time, notes, ward: project.ward });
  }

  return (
    <Modal title={prefill ? 'Re-schedule Visit' : 'Schedule Monitor Visit'} onClose={onClose} size="sm">
      <form onSubmit={submit} className="space-y-4">
        {prefill && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
            <span className="font-semibold">Re-scheduling:</span> {prefill.projectName} - Original date was {prefill.date}
          </div>
        )}
        <Fld label="Monitor *">
          <select required className={inp} value={monitorId} onChange={e => { setMonitorId(e.target.value); setProjectId(''); }}>
            <option value="">Select monitor</option>
            {monitorList.filter(m => m.status === 'Active').map(m => <option key={m.id} value={m.id}>{m.name} ({m.wards})</option>)}
          </select>
        </Fld>
        <Fld label="Project *">
          <select required className={inp} value={projectId} onChange={e => setProjectId(e.target.value)}>
            <option value="">Select project</option>
            {availableProjects.map(p => <option key={p.id} value={p.id}>{p.name} - {p.ward}</option>)}
          </select>
        </Fld>
        <div className="grid grid-cols-2 gap-3">
          <Fld label="Visit Date *"><input required type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} /></Fld>
          <Fld label="Visit Time *"><input required type="time" className={inp} value={time} onChange={e => setTime(e.target.value)} /></Fld>
        </div>
        <Fld label="Instructions / Notes">
          <textarea rows={3} className={inp} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What to inspect, what to bring, special instructions..." />
        </Fld>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button type="submit" className="px-5 py-2 rounded-lg text-sm bg-[#145a32] text-white font-semibold hover:bg-[#0f4424]">{prefill ? 'Re-schedule & Notify Monitor' : 'Schedule & Notify Monitor'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Submission Review Modal ───────────────────────────────────────────────────
function SubmissionReviewModal({ sub, action, project, onConfirm, onClose }: {
  sub: MonitorSubmission;
  action: 'approve' | 'return';
  project?: Project;
  onConfirm: (note: string, progress?: number, confirmedFundsUsed?: number) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState(sub.progress);

  const initialFunds = project?.fundsUsed !== undefined
    ? project.fundsUsed
    : (sub.fundsUsedReported !== undefined ? sub.fundsUsedReported : (project ? getProjectUtilised(project) : 0));

  const [fundsUsedInput, setFundsUsedInput] = useState<string>(
    initialFunds !== undefined ? String(initialFunds) : ''
  );

  const isApprove = action === 'approve';
  const disbursed = project ? getProjectDisbursed(project) : 0;
  const currentUtilised = project ? getProjectUtilised(project) : 0;
  const parsedFunds = fundsUsedInput !== '' && !isNaN(Number(fundsUsedInput)) ? Number(fundsUsedInput) : currentUtilised;
  const calculatedBalance = disbursed - parsedFunds;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (action === 'return' && !note.trim()) return;
    const finalFunds = isApprove && fundsUsedInput !== '' && !isNaN(Number(fundsUsedInput))
      ? Number(fundsUsedInput)
      : undefined;
    onConfirm(note, isApprove ? progress : undefined, finalFunds);
  }

  return (
    <Modal title={isApprove ? 'Approve Report & Update Project Finances' : 'Return Report for Correction'} onClose={onClose} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-900">{sub.projectName}</p>
              <p className="text-xs text-gray-500">{sub.monitorName} / {sub.date} / {sub.progress}% progress reported</p>
            </div>
            {project && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-[#145a32] text-white">
                {project.ward}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">{sub.observation}</p>

          {/* Monitor Reported Financial Expenditure */}
          {sub.fundsUsedReported !== undefined && (
            <div className="mt-2 bg-white border border-gray-200 rounded-lg p-2.5 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Monitor Reported Expenditure</p>
                <p className="text-xs font-bold text-gray-900">{formatMK(sub.fundsUsedReported)}</p>
              </div>
              <span className="text-[10px] text-white bg-[#145a32] px-2.5 py-0.5 rounded font-medium">
                Receipts Attached for Verification
              </span>
            </div>
          )}

          {/* Attached Receipts & Expenditure Documents */}
          {sub.receiptFiles && sub.receiptFiles.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5 flex items-center gap-1.5">
                <Paperclip size={12} className="text-[#145a32]" />
                <span>Attached Receipts & Expenditure Documents</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sub.receiptFiles.map((rf, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileText size={14} className="text-[#145a32] flex-shrink-0" />
                      <span className="font-medium text-gray-800 truncate" title={rf.name}>{rf.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {rf.size && <span className="text-[10px] text-gray-400">({rf.size})</span>}
                      {rf.dataUrl && (
                        <a
                          href={rf.dataUrl}
                          download={rf.name}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-gray-500 hover:text-[#145a32] hover:bg-green-50 rounded"
                          title="View / Download receipt"
                        >
                          <Download size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Site Photos */}
          {sub.photos && sub.photos.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Site Photos</p>
              <div className="flex flex-wrap gap-1.5">
                {sub.photos.map((photo, idx) => (
                  <a key={idx} href={photo} target="_blank" rel="noreferrer" className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 hover:opacity-90 transition-opacity border border-gray-200">
                    <img src={photo} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {progress === 100 && isApprove && (
            <div className="bg-[#145a32] text-white rounded-lg p-2.5 mt-2">
              <p className="text-xs font-medium text-white">100% progress detected &mdash; approving this report will automatically mark the project as <span className="underline font-bold">Completed</span>.</p>
            </div>
          )}
        </div>

        {isApprove && (
          <div className="space-y-3">
            {/* Progress Slider */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-700">Confirmed Project Progress Percentage</label>
                <span className="text-xs font-bold text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200">{progress}%</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={e => setProgress(Number(e.target.value))}
                  className="flex-1 accent-[#145a32] cursor-pointer"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={e => setProgress(Math.max(0, Math.min(100, Number(e.target.value))))}
                  className="w-16 px-2 py-1 text-xs border border-gray-200 rounded-lg text-center font-bold text-gray-700 bg-white"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-gray-500">Quick set:</span>
                {[25, 50, 75, 100].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setProgress(val)}
                    className="text-[10px] px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>

            {/* Admin Update of Funds Used & Ward Remaining Balance */}
            <div className="bg-[#145a32] text-white rounded-xl p-3.5 space-y-3">
              <div>
                <div className="text-xs font-bold text-white uppercase tracking-wide">
                  Update Ward Funds Used & Balance Remaining
                </div>
                <p className="text-xs text-white/90 mt-0.5">
                  Verify the attached receipts and documentation to update all funds used by this project. The system will update the ward on the balance remaining from the funds disbursed at the start.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white border border-gray-200 rounded-lg p-2.5 text-gray-900">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase">Total Funds Disbursed</p>
                  <p className="text-xs font-bold text-gray-900 mt-0.5">{formatMK(disbursed)}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-2.5 text-gray-900">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase">Current Funds Used</p>
                  <p className="text-xs font-bold text-gray-900 mt-0.5">{formatMK(currentUtilised)}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-2.5 text-gray-900">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase">New Ward Balance</p>
                  <p className="text-xs font-bold text-emerald-700 mt-0.5">{formatMK(calculatedBalance)}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">
                  Total Funds Used
                </label>
                <input
                  type="number"
                  min={0}
                  step={10000}
                  value={fundsUsedInput}
                  onChange={e => setFundsUsedInput(e.target.value)}
                  className={`${inp} bg-white text-gray-900`}
                />
              </div>
            </div>
          </div>
        )}

        <Fld label={`Admin Note ${action === 'return' ? '* (required)' : ''}`}>
          <textarea
            required={action === 'return'}
            rows={2}
            className={inp}
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </Fld>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 cursor-pointer">Cancel</button>
          <button type="submit" className={`px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${isApprove ? 'bg-[#145a32] hover:bg-[#0f4424] text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}`}>
            {isApprove ? 'Approve & Update Ward Balance' : 'Return for Correction'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <div className="flex items-start gap-3 mb-5"><AlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={22} /><p className="text-sm text-gray-700">{message}</p></div>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700">Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ── Ward Status Photo Modal ──────────────────────────────────────────────────
function WardStatusPhotoModal({
  initial,
  onSave,
  onClose,
  projects,
  defaultWard,
  defaultStatus,
  defaultCategory,
  defaultProjectId,
}: {
  initial?: WardStatusPhoto;
  onSave: (photo: WardStatusPhoto) => void;
  onClose: () => void;
  projects: Project[];
  defaultWard?: string;
  defaultStatus?: string;
  defaultCategory?: 'Project' | 'Initiative';
  defaultProjectId?: string;
}) {
  const targetDefaultProj = defaultProjectId ? projects.find(p => p.id === defaultProjectId) : null;

  // Constituencies maintained as inside new project or initiative in projects
  const availableConstituencies = useMemo(() => {
    const list = [...CONSTITUENCIES];
    const likomaIdx = list.indexOf('Likoma Island');
    if (likomaIdx > -1) {
      list.splice(likomaIdx, 1);
      list.unshift('Likoma Island');
    }
    if (initial?.constituency && !list.includes(initial.constituency)) {
      list.push(initial.constituency);
    }
    return list;
  }, [initial?.constituency]);

  const [constituency, setConstituency] = useState(
    initial?.constituency || targetDefaultProj?.constituency || 'Likoma Island'
  );

  // Wards maintained as inside new project or initiative in projects
  const availableWards = useMemo(() => {
    const list = constituency ? getWardsForConstituency(constituency) : WARDS;
    const res = list && list.length > 0 ? [...list] : [...WARDS];
    if (initial?.ward && !res.includes(initial.ward)) {
      res.unshift(initial.ward);
    }
    return res;
  }, [constituency, initial?.ward]);

  const [ward, setWard] = useState(
    initial?.ward || targetDefaultProj?.ward || defaultWard || availableWards[0] || 'Likoma North Ward'
  );
  const [category, setCategory] = useState<'Project' | 'Initiative'>(
    initial?.category || (targetDefaultProj ? (isInitiative(targetDefaultProj) ? 'Initiative' : 'Project') : (defaultCategory || 'Project'))
  );
  const [status, setStatus] = useState(
    initial?.status || targetDefaultProj?.status || defaultStatus || 'Ongoing'
  );
  const [projectId, setProjectId] = useState(
    initial?.projectId || defaultProjectId || ''
  );
  const [url, setUrl] = useState(initial?.url || '');
  const [caption, setCaption] = useState(initial?.caption || '');
  const [monitor, setMonitor] = useState(initial?.monitor || 'District Monitoring Officer');
  const [date, setDate] = useState(initial?.date || new Date().toISOString().split('T')[0]);
  const [uploadMode, setUploadMode] = useState<'upload' | 'url'>(initial?.url?.startsWith('data:') ? 'upload' : 'upload');
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // When constituency changes, update ward from available wards
  const handleConstituencyChange = (c: string) => {
    setConstituency(c);
    const nextWards = c ? getWardsForConstituency(c) : WARDS;
    if (nextWards && nextWards.length > 0) {
      if (!nextWards.includes(ward)) {
        setWard(nextWards[0]);
      }
    }
  };

  // Projects filtered by current ward and category
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchWard = !ward ||
        p.ward?.toLowerCase() === ward.toLowerCase() ||
        p.ward?.toLowerCase().includes(ward.toLowerCase().replace(/\s*ward/i, '')) ||
        ward.toLowerCase().includes(p.ward?.toLowerCase().replace(/\s*ward/i, ''));
      const isInit = isInitiative(p);
      const matchCat = category === 'Initiative' ? isInit : !isInit;
      return matchWard && matchCat;
    });
  }, [projects, ward, category]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFileError('Please select a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setFileError('Image is larger than 8MB. Please select a smaller image.');
      return;
    }

    uploadToSupabaseStorage('ward-photos', file)
      .then(storageUrl => {
        setUrl(storageUrl);
      })
      .catch(() => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setUrl(reader.result);
          }
        };
        reader.onerror = () => {
          setFileError('Failed to read image file. Please try again.');
        };
        reader.readAsDataURL(file);
      });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setFileError('Please upload an image or provide a valid image URL.');
      return;
    }
    if (!caption.trim()) {
      setFileError('Please provide a caption describing this status photo.');
      return;
    }

    let selectedProjectName = '';
    if (projectId) {
      const found = projects.find(p => p.id === projectId);
      if (found) {
        selectedProjectName = found.initiativeName || found.name;
      }
    }

    const item: WardStatusPhoto = {
      id: initial?.id || `wsp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      ward,
      constituency,
      category,
      status,
      projectId: projectId || undefined,
      projectName: selectedProjectName || undefined,
      url: url.trim(),
      caption: caption.trim(),
      monitor: monitor.trim() || 'Ward Monitor',
      date: date || new Date().toISOString().split('T')[0],
      uploadedAt: initial?.uploadedAt || new Date().toISOString(),
    };

    onSave(item);
  };

  return (
    <Modal
      title={initial ? 'Update Projects Status' : 'Upload Photo'}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Photo Upload Box */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5 flex-nowrap w-full">
            <label className="text-xs font-semibold text-gray-700 whitespace-nowrap shrink-0">
              Ward Tracking Photo *
            </label>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs shrink-0 flex-nowrap">
              <button
                type="button"
                onClick={() => setUploadMode('upload')}
                className={`whitespace-nowrap px-2.5 py-1 sm:py-0.5 rounded-lg text-[11px] sm:text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                  uploadMode === 'upload' ? 'bg-[#145a32] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('url')}
                className={`whitespace-nowrap px-2.5 py-1 sm:py-0.5 rounded-lg text-[11px] sm:text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                  uploadMode === 'url' ? 'bg-[#145a32] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Paste URL
              </button>
            </div>
          </div>

          {uploadMode === 'upload' ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {url ? (
                <div className="relative rounded-xl border border-gray-200 bg-gray-50 overflow-hidden group">
                  <img
                    src={url}
                    alt="Status Preview"
                    className="w-full h-48 sm:h-56 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white text-gray-800 text-xs font-semibold rounded-lg shadow-md hover:bg-gray-100 cursor-pointer"
                    >
                      Change Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => setUrl('')}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg shadow-md hover:bg-red-700 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 hover:border-[#145a32] rounded-xl p-6 text-center cursor-pointer transition-colors bg-gray-50/60 hover:bg-gray-50"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#145a32] flex items-center justify-center mx-auto mb-2">
                    <UploadCloud size={24} />
                  </div>
                  <p className="text-sm font-semibold text-gray-800">
                    Click to select or drag & drop status photo
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Supports PNG, JPG, JPEG, WEBP (recommended max 8MB)
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <input
                type="url"
                className={inp}
                placeholder="https://example.com/field-photo.jpg"
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
              {url && (
                <div className="mt-2 rounded-xl border border-gray-200 overflow-hidden h-36 bg-gray-100">
                  <img
                    src={url}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={() => setFileError('Could not load image from URL. Please check the address.')}
                  />
                </div>
              )}
            </div>
          )}

          {fileError && <p className="text-xs text-red-600 mt-1 font-medium">{fileError}</p>}
        </div>

        {/* Location & Category Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Fld label="Constituency *">
            <select
              className={inp}
              value={constituency}
              onChange={e => handleConstituencyChange(e.target.value)}
            >
              {availableConstituencies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Fld>

          <Fld label="Ward *">
            <select
              className={inp}
              value={ward}
              onChange={e => setWard(e.target.value)}
            >
              {availableWards.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </Fld>

          <Fld label="Category *">
            <select
              className={inp}
              value={category}
              onChange={e => setCategory(e.target.value as 'Project' | 'Initiative')}
            >
              <option value="Project">Project</option>
              <option value="Initiative">Initiative</option>
            </select>
          </Fld>
        </div>

        {/* Tracking Status */}
        <Fld label="Tracking Status (Stage) *">
          <select
            className={inp}
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="Proposed">Proposed</option>
            <option value="Assessed">Assessed</option>
            <option value="Ongoing">Ongoing</option>
            <option value="Near Completion">Near Completion</option>
            <option value="Completed">Completed</option>
            <option value="Suspended">Suspended</option>
          </select>
        </Fld>

        {/* Caption */}
        <Fld label="Caption / Status Description *">
          <textarea
            required
            rows={2}
            className={inp}
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Field inspection of foundation works for the solar-powered community cold storage"
          />
        </Fld>

        {/* Monitor & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Fld label="Monitor / Inspector Name">
            <input
              type="text"
              className={inp}
              value={monitor}
              onChange={e => setMonitor(e.target.value)}
              placeholder="Kondwani Chirwa (Ward Monitor)"
            />
          </Fld>

          <Fld label="Observation / Capture Date *">
            <input
              type="date"
              required
              className={inp}
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </Fld>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-lg text-sm text-white font-semibold bg-[#145a32] hover:bg-[#0f4424] cursor-pointer shadow-sm"
          >
            {initial ? 'Save Changes' : 'Upload Photo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Ward Photo Lightbox Modal ────────────────────────────────────────────────
function WardPhotoLightboxModal({
  photo,
  onClose,
  onEdit,
}: {
  photo: WardStatusPhoto;
  onClose: () => void;
  onEdit: (photo: WardStatusPhoto) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative bg-black flex items-center justify-center max-h-[60vh] overflow-hidden">
          <img
            src={photo.url}
            alt={photo.caption}
            className="w-full h-auto max-h-[60vh] object-contain"
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.src.includes('photo-1590486803833')) {
                target.src = 'https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?auto=format&fit=crop&w=1000&q=80';
              }
            }}
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className="text-xs font-semibold px-2.5 py-0.5 text-white whitespace-nowrap"
              style={{
                background: '#145a32',
                borderRadius: '0.2rem',
              }}
            >
              {photo.status}
            </span>
            <span
              className="text-xs font-semibold px-2.5 py-0.5 text-white whitespace-nowrap"
              style={{
                background: '#145a32',
                borderRadius: '0.2rem',
              }}
            >
              {photo.ward}
            </span>
            <CategoryBadge category={photo.category} />
            {photo.projectName && (
              <span className="text-xs font-medium px-2 py-0.5 bg-blue-50 text-blue-800 rounded truncate max-w-xs">
                Linked: {photo.projectName}
              </span>
            )}
          </div>

          <p className="text-sm font-semibold text-gray-900 mb-2 leading-snug">
            {photo.caption}
          </p>

          <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100 mt-3">
            <span className="font-medium text-gray-700">{photo.ward}</span>
            <span>Captured: {photo.date}</span>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => {
                onClose();
                onEdit(photo);
              }}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#145a32] text-white hover:bg-[#0f4424] cursor-pointer"
            >
              Change Picture / Edit Details
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function MiniStat({ label, value, sub, icon }: { label: string; value: string | number; accent?: string; sub?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-1.5 p-4 shadow-sm" style={{ background: '#016630', borderRadius: '0.2rem', minHeight: '108px' }}>
      {icon && <div className="text-white flex items-center justify-center">{icon}</div>}
      <p className="text-xl font-black text-white leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>{value}</p>
      <p className="text-[11px] font-semibold text-white/90 leading-tight">{label}</p>
      {sub && <p className="text-[10px] text-white/75">{sub}</p>}
    </div>
  );
}

const PCOLORS = ['#16a34a', '#2563eb', '#d97706', '#0891b2', '#dc2626', '#7c3aed', '#db2777'];
const CHART_COLORS = ['#16a34a', '#2563eb', '#d97706', '#0891b2', '#dc2626', '#7c3aed', '#db2777'];

const SECTOR_COLORS: Record<string, string> = {
  Roads: '#16a34a',
  'Roads and Bridges': '#16a34a',
  Education: '#2563eb',
  Agriculture: '#d97706',
  'Agriculture and Irrigation Projects': '#d97706',
  Energy: '#7c3aed',
  Health: '#dc2626',
  'Health and Nutrition': '#dc2626',
  'Water & Sanitation': '#0891b2',
  'Water and Sanitation': '#0891b2',
  'Community Infrastructure': '#9ca3af',
  'Court Rooms': '#6366f1',
  'Continuing projects transferred from the other center': '#059669',
  'Projects from other sectors': '#e11d48',
  'Agriculture & Environment': '#d97706',
};

const BENEFICIARY_ORDER = [
  'District-Wide',
  'Women Entrepreneurs',
  'Students',
  'Youth Entrepreneurs',
  'Sports, creative arts & Innovation',
] as const;

const BENEFICIARY_COLORS: Record<string, string> = {
  'District-Wide': '#16a34a',
  'Women Entrepreneurs': '#ec4899',
  'Students': '#2563eb',
  'Youth Entrepreneurs': '#f97316',
  'Sports, creative arts & Innovation': '#8b5cf6',
};

// Donut chart outside value callout label with elbow leader lines
function renderDonutCalloutLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, value } = props;
  if (!value || value === 0) return null;

  const RADIAN = Math.PI / 180;
  const sx = cx + (outerRadius + 2) * Math.cos(-midAngle * RADIAN);
  const sy = cy + (outerRadius + 2) * Math.sin(-midAngle * RADIAN);

  const mx = cx + (outerRadius + 7) * Math.cos(-midAngle * RADIAN);
  const my = cy + (outerRadius + 7) * Math.sin(-midAngle * RADIAN);

  const isRight = Math.cos(-midAngle * RADIAN) >= 0;
  const ex = mx + (isRight ? 7 : -7);
  const ey = my;
  const textAnchor = isRight ? 'start' : 'end';

  return (
    <g>
      <path
        d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
        stroke="#94a3b8"
        strokeWidth={1.2}
        fill="none"
      />
      <text
        x={ex + (isRight ? 3 : -3)}
        y={ey}
        textAnchor={textAnchor}
        dominantBaseline="central"
        fill="#334155"
        fontSize={10.5}
        fontWeight={700}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </text>
    </g>
  );
}

// Beneficiaries Distribution Callout Label: displays figure + percentage on the same line
function renderBeneficiaryDonutCalloutLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, value, percent } = props;
  if (!value || value === 0) return null;

  const RADIAN = Math.PI / 180;
  const sx = cx + (outerRadius + 2) * Math.cos(-midAngle * RADIAN);
  const sy = cy + (outerRadius + 2) * Math.sin(-midAngle * RADIAN);

  const mx = cx + (outerRadius + 7) * Math.cos(-midAngle * RADIAN);
  const my = cy + (outerRadius + 7) * Math.sin(-midAngle * RADIAN);

  const isRight = Math.cos(-midAngle * RADIAN) >= 0;
  const ex = mx + (isRight ? 7 : -7);
  const ey = my;
  const textAnchor = isRight ? 'start' : 'end';

  const pct = typeof percent === 'number'
    ? `${(percent * 100).toFixed(1).replace(/\.0$/, '')}%`
    : '';
  const valStr = typeof value === 'number' ? value.toLocaleString() : String(value);

  return (
    <g>
      <path
        d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
        stroke="#94a3b8"
        strokeWidth={1.2}
        fill="none"
      />
      <text
        x={ex + (isRight ? 3 : -3)}
        y={ey}
        textAnchor={textAnchor}
        dominantBaseline="central"
        fill="#334155"
        fontSize={10.5}
        fontWeight={700}
      >
        {valStr}
        {pct && (
          <tspan fill="#64748b" fontSize={9.5} fontWeight={500}>
            {` (${pct})`}
          </tspan>
        )}
      </text>
    </g>
  );
}

// Top Bar Label for Constituency Funds Disbursed vs Utilised grouped bar chart
function renderFundsBarTopLabel(props: any, color: string) {
  const { x, y, width, value } = props;
  if (value === undefined || value === null || value === 0) return null;
  const label = value >= 10_000_000
    ? `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`
    : value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`
    : `${Math.round(value / 1_000)}k`;
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      fill={color}
      textAnchor="middle"
      fontSize={10}
      fontWeight={600}
    >
      {label}
    </text>
  );
}

function ConstituencyFundsTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  if (!data) return null;
  return (
    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100 text-xs min-w-[210px]">
      <p className="font-bold text-gray-900 border-b border-gray-100 pb-1">{data.ward || data.constituency}</p>
      <p className="text-[10px] text-gray-400 mb-2 mt-0.5">{data.constituency ? `${data.constituency} Constituency` : 'Likoma Island Constituency'}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-blue-700 font-medium">
            <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" />
            Amount Disbursed:
          </span>
          <span className="font-bold text-gray-900">{formatMK(data.disbursed)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-emerald-800 font-medium">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#016630] inline-block" />
            Amount Utilised:
          </span>
          <span className="font-bold text-gray-900">{formatMK(data.utilised)}</span>
        </div>
        <div className="pt-1.5 mt-1 border-t border-gray-100 flex items-center justify-between text-gray-500">
          <span>Total Projects:</span>
          <span className="font-medium text-gray-700">{data.projectCount} projects</span>
        </div>
      </div>
    </div>
  );
}

// White Inside Bar Label for Projects by Ward bar chart
function renderWardBarInsideLabel(props: any) {
  const { x, y, width, height, value } = props;
  if (value === undefined || value === null || value === 0 || height < 12) return null;
  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={10.5}
      fontWeight={700}
    >
      {value}
    </text>
  );
}

// Multi-line X-Axis Tick for Ward Bar Charts (prevents overlapping on mobile & tablet)
function renderWardXAxisTick(props: any) {
  const { x, y, payload } = props;
  if (!payload || payload.value === undefined || payload.value === null) return null;
  const rawText = String(payload.value).replace(/\s*Ward\s*$/gi, '').trim();
  const words = rawText.split(' ');
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        textAnchor="middle"
        fill="#475569"
        fontSize={10}
        fontWeight={600}
      >
        {words.length > 1 ? (
          <>
            <tspan x={0} dy={10}>{words[0]}</tspan>
            <tspan x={0} dy={12}>{words.slice(1).join(' ')}</tspan>
          </>
        ) : (
          <tspan x={0} dy={10}>{rawText}</tspan>
        )}
      </text>
    </g>
  );
}

function VisitStatusPill({ status }: { status: ScheduledVisit['status'] }) {
  const bg: Record<string, string> = {
    Upcoming: '#d97706',
    Acknowledged: '#2563eb',
    Completed: '#016630',
    Missed: '#dc2626',
    Rescheduled: '#7c3aed',
  };
  return <span className="text-xs font-semibold px-2.5 py-0.5 text-white" style={{ background: bg[status] ?? '#6b7280', borderRadius: '0.2rem' }}>{status}</span>;
}

function SubStatusPill({ status }: { status: MonitorSubmission['status'] }) {
  const bg: Record<string, string> = {
    'Pending Review': '#d97706',
    'Approved': '#016630',
    'Returned': '#dc2626',
  };
  return <span className="text-xs font-semibold px-2.5 py-0.5 text-white whitespace-nowrap" style={{ background: bg[status] ?? '#6b7280', borderRadius: '0.2rem' }}>{status}</span>;
}

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'wardPhotos', label: 'Update Projects Status', icon: Camera },
  { id: 'monitors', label: 'Monitors', icon: Users },
  { id: 'schedule', label: 'Schedule Visits', icon: Calendar },
  { id: 'monitorReports', label: 'Monitor Reports', icon: Send },
  { id: 'feedback', label: 'Citizen Feedback', icon: MessageSquare },
  { id: 'analytics', label: 'Analytics', icon: Activity },
  { id: 'reports', label: 'Reports', icon: BarChart2 },
  { id: 'audit', label: 'Audit Trail', icon: ScrollText },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
] as const;

type Section = typeof NAV[number]['id'];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminDashboard({
  onLogout, sharedProjects, setSharedProjects,
  visits, setVisits, submissions, setSubmissions,
  sysNotifs, setSysNotifs,
  sharedFeedback, setSharedFeedback,
  users, setUsers,
  sharedMonitors, setSharedMonitors,
  sharedAnnouncements, setSharedAnnouncements,
  sharedWardStatusPhotos, setSharedWardStatusPhotos,
  provisionMonitor, sendMonitorCredentialsEmail, persistMonitor, isLiveDb, isLocalOnlySession,
}: AdminDashboardProps) {
  const [section, setSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dismissedLocalOnlyBanner, setDismissedLocalOnlyBanner] = useState(false);
  const { toasts, show } = useToast();

  // ── Analytics ──────────────────────────────────────────────────────────
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEvent[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState<7 | 14 | 30 | 0>(30);
  const refreshAnalytics = useCallback(async () => {
    if (isLiveDb) {
      // Real, cross-visitor data: every Public Portal visitor's browser logs
      // events to the shared `analytics_events` table (see src/analytics.ts),
      // so this reflects actual traffic, devices, sources, etc. — not just
      // whatever happened in the admin's own browser.
      setAnalyticsLoading(true);
      try {
        const dbEvents = await fetchAnalyticsEventsFromDb();
        setAnalyticsEvents(dbEvents);
      } finally {
        setAnalyticsLoading(false);
      }
    } else {
      // Offline/local mode: no shared backend to read from, so fall back to
      // this device's own localStorage, seeded with illustrative demo data.
      seedDemoAnalyticsEventsIfEmpty();
      setAnalyticsEvents(getStoredAnalyticsEvents());
    }
  }, [isLiveDb]);
  useEffect(() => { refreshAnalytics(); }, [refreshAnalytics]);
  // Keep the dashboard reasonably current without the admin needing to
  // manually hit Refresh every time.
  useEffect(() => {
    if (!isLiveDb) return;
    const t = setInterval(() => { refreshAnalytics(); }, 60000);
    return () => clearInterval(t);
  }, [isLiveDb, refreshAnalytics]);
  async function handleClearAnalytics() {
    clearStoredAnalyticsEvents();
    if (isLiveDb) await clearAnalyticsEventsInDb();
    setAnalyticsEvents([]);
    show('Analytics data cleared.', 'info');
  }
  const rangedEvents = useMemo(() => filterEventsByRange(analyticsEvents, analyticsRange), [analyticsEvents, analyticsRange]);
  const visitorStats = useMemo(() => getVisitorStats(rangedEvents), [rangedEvents]);
  const tabViews = useMemo(() => getTabViews(rangedEvents), [rangedEvents]);
  const deviceBreakdown = useMemo(() => getDeviceBreakdown(rangedEvents), [rangedEvents]);
  const languageBreakdown = useMemo(() => getLanguageBreakdown(rangedEvents), [rangedEvents]);
  const trafficTrend = useMemo(() => getTrafficTrend(rangedEvents, analyticsRange || 30), [rangedEvents, analyticsRange]);
  const trafficSources = useMemo(() => getTrafficSources(rangedEvents), [rangedEvents]);
  const topProjectsViewed = useMemo(() => getTopItems(rangedEvents, 'project_view', 6), [rangedEvents]);
  const topDocuments = useMemo(() => getTopItems(rangedEvents, 'document_download', 6), [rangedEvents]);
  const feedbackFunnel = useMemo(() => getFeedbackFunnel(rangedEvents), [rangedEvents]);

  const [analyticsExportMenu, setAnalyticsExportMenu] = useState(false);
  const analyticsExportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (analyticsExportRef.current && !analyticsExportRef.current.contains(e.target as Node)) {
        setAnalyticsExportMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function doExportAnalyticsCSV() {
    if (!rangedEvents.length) {
      show('No analytics data to export for this period.', 'info');
      return;
    }
    const rangeLabel = analyticsRange === 0 ? 'All' : `${analyticsRange}D`;
    const rows = rangedEvents.map(e => ({
      'Event ID': e.id,
      'Date': e.date,
      'Timestamp': new Date(e.ts).toISOString(),
      'Event Type': e.type,
      'Label / Page': e.label || '',
      'Device': e.device || 'desktop',
      'Language': e.lang === 'ny' ? 'Chichewa' : 'English',
      'Visitor ID': e.visitorId,
      'Session ID': e.sessionId,
      'Visitor Type': e.isNewVisitor ? 'New' : 'Returning',
      'Referrer': e.referrer || 'direct',
    }));
    exportToCSV(rows, `CouncilYanga_Analytics_${rangeLabel}`);
    show('Analytics CSV downloaded.');
  }

  function doExportAnalyticsExcel() {
    if (!rangedEvents.length) {
      show('No analytics data to export for this period.', 'info');
      return;
    }
    const rangeLabel = analyticsRange === 0 ? 'All' : `${analyticsRange}D`;
    const rows = rangedEvents.map(e => ({
      'Event ID': e.id,
      'Date': e.date,
      'Event Type': e.type,
      'Label / Page': e.label || '',
      'Device': e.device || 'desktop',
      'Language': e.lang === 'ny' ? 'Chichewa' : 'English',
      'Visitor ID': e.visitorId,
      'Session ID': e.sessionId,
    }));
    exportToExcel(rows, `CouncilYanga_Analytics_${rangeLabel}`);
    show('Analytics Excel downloaded.');
  }

  function doExportAnalyticsPDF() {
    const rangeLabel = analyticsRange === 0 ? 'All-Time' : `Past ${analyticsRange} Days`;
    const cards = [
      {
        label: 'Total Visitors',
        value: visitorStats.totalVisitors,
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      },
      {
        label: 'New Visitors',
        value: visitorStats.newVisitors,
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x2="22" y1="11" x2="16" y2="11"/></svg>',
      },
      {
        label: 'Returning',
        value: visitorStats.returningVisitors,
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>',
      },
      {
        label: 'Sessions',
        value: visitorStats.totalSessions,
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
      },
      {
        label: 'Avg Events/Session',
        value: visitorStats.avgEventsPerSession,
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
      },
    ];

    const kpiHtml = `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:20px;">
      ${cards.map(c => `
        <div style="background:#016630;border-radius:0.2rem;min-height:108px;padding:12px 8px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-sizing:border-box;">
          <div style="color:#ffffff;display:flex;align-items:center;justify-content:center;margin-bottom:6px;">${c.icon}</div>
          <div style="font-size:20px;font-weight:900;color:#ffffff;line-height:1;margin-bottom:4px;font-family:Outfit,Arial,sans-serif;">${c.value}</div>
          <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.9);line-height:1.2;">${c.label}</div>
        </div>
      `).join('')}
    </div>`;
    const headers = ['Date', 'Event Type', 'Item / Page', 'Device', 'Language', 'Visitor ID'];
    const rows = rangedEvents.slice(0, 150).map(e => [
      e.date,
      e.type,
      e.label || '-',
      e.device || 'desktop',
      e.lang === 'ny' ? 'Chichewa' : 'English',
      e.visitorId.slice(0, 10),
    ]);
    exportToPDF(`Council Yanga - Portal Citizen Analytics Report (${rangeLabel})`, headers, rows, kpiHtml);
    show('Analytics PDF report opened.', 'info');
  }

  const localMonitors = sharedMonitors;
  const setLocalMonitors = setSharedMonitors;
  const localAnnouncements = sharedAnnouncements;
  const setLocalAnnouncements = setSharedAnnouncements;
  const localFeedback = sharedFeedback;
  const setLocalFeedback = setSharedFeedback;
  const localWardPhotos = sharedWardStatusPhotos ?? initialWardStatusPhotos;
  const [monitorPopup, setMonitorPopup] = useState<{ name: string; email: string; wards: string } | null>(null);

  // Admin notification bell
  const adminNotifs = sysNotifs.filter(n => n.for === 'admin');
  const adminUnread = adminNotifs.filter(n => !n.read).length;
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  type Modal =
    | { kind: 'new-project'; defaultType?: 'New Initiative' | 'New Project' }
    | { kind: 'edit-project'; project: Project }
    | { kind: 'view-project'; project: Project }
    | { kind: 'upload-ward-photo'; initialPhoto?: WardStatusPhoto; defaultWard?: string; defaultStatus?: string; defaultCategory?: 'Project' | 'Initiative'; defaultProjectId?: string }
    | { kind: 'view-ward-photo'; photo: WardStatusPhoto }
    | { kind: 'add-monitor' }
    | { kind: 'edit-monitor'; monitor: Monitor }
    | { kind: 'new-announcement' }
    | { kind: 'edit-announcement'; announcement: Announcement }
    | { kind: 'schedule-visit' }
    | { kind: 'reschedule-visit'; visit: ScheduledVisit }
    | { kind: 'review-submission'; submission: MonitorSubmission; action: 'approve' | 'return' }
    | { kind: 'send-credentials'; monitor: Monitor }
    | { kind: 'confirm'; message: string; action: () => void };

  const [modal, setModal] = useState<Modal | null>(null);
  const [credentialSent, setCredentialSent] = useState<{
    monitorName: string;
    monitorEmail: string;
    password: string;
    wards: string;
    timestamp: string;
    isResend?: boolean;
    // Real outcome of the send-credentials-email call — the modal uses this
    // to show an honest "email failed" state instead of always claiming
    // success (which is what it used to do, unconditionally).
    emailSent: boolean;
    emailError?: string | null;
  } | null>(null);

  const [projSearch, setProjSearch] = useState('');
  const [projStatus, setProjStatus] = useState('All');
  const [projComponent, setProjComponent] = useState('All Components');
  const [dashboardComponent, setDashboardComponent] = useState('All Components');
  const [monSearch, setMonSearch] = useState('');
  const [fbFilter, setFbFilter] = useState('All');
  const [auditSearch, setAuditSearch] = useState('');
  const [visitFilter, setVisitFilter] = useState('All');
  const [subFilter, setSubFilter] = useState('All');
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [photoLightbox, setPhotoLightbox] = useState<string | null>(null);

  // Ward Status Photos state
  const [wardPhotoSearch, setWardPhotoSearch] = useState('');
  const [wardPhotoConstituency, setWardPhotoConstituency] = useState('All');
  const [wardPhotoWard, setWardPhotoWard] = useState('All');
  const [wardPhotoCategory, setWardPhotoCategory] = useState<'All' | 'Project' | 'Initiative'>('All');
  const [wardPhotoStatus, setWardPhotoStatus] = useState('All');
  const [wardPhotoDesktopSlide, setWardPhotoDesktopSlide] = useState(0);
  const [wardPhotoMobileSlide, setWardPhotoMobileSlide] = useState(0);
  const [wardStatusSubTab, setWardStatusSubTab] = useState<'progress' | 'photos'>('progress');
  const [editingWardProgress, setEditingWardProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    setWardPhotoDesktopSlide(0);
    setWardPhotoMobileSlide(0);
  }, [wardPhotoSearch, wardPhotoConstituency, wardPhotoWard, wardPhotoCategory, wardPhotoStatus]);

  // Constituencies maintained as inside new project or initiative in projects
  const wardPhotoConstituencyOptions = useMemo(() => {
    const list = [...CONSTITUENCIES];
    const likomaIdx = list.indexOf('Likoma Island');
    if (likomaIdx > -1) {
      list.splice(likomaIdx, 1);
      list.unshift('Likoma Island');
    }
    localWardPhotos.forEach(p => {
      if (p.constituency && !list.includes(p.constituency)) {
        list.push(p.constituency);
      }
    });
    return list;
  }, [localWardPhotos]);

  // Wards maintained as inside new project or initiative in projects
  const wardPhotoWardOptions = useMemo(() => {
    if (wardPhotoConstituency && wardPhotoConstituency !== 'All') {
      const list = getWardsForConstituency(wardPhotoConstituency);
      const res = list && list.length > 0 ? [...list] : [];
      localWardPhotos.forEach(p => {
        if (p.ward && !res.includes(p.ward)) {
          if (
            p.constituency === wardPhotoConstituency ||
            (wardPhotoConstituency === 'Likoma Island' &&
              (p.constituency === 'Chizumulu Island' ||
                p.ward.toLowerCase().includes('chizumulu') ||
                p.ward.toLowerCase().includes('likoma')))
          ) {
            res.push(p.ward);
          }
        }
      });
      return res.length > 0 ? res : [...WARDS];
    }
    const all = [...WARDS];
    localWardPhotos.forEach(p => {
      if (p.ward && !all.includes(p.ward)) {
        all.push(p.ward);
      }
    });
    return all;
  }, [wardPhotoConstituency, localWardPhotos]);

  const saveWardStatusPhoto = (photo: WardStatusPhoto) => {
    if (setSharedWardStatusPhotos) {
      setSharedWardStatusPhotos(prev => {
        const existing = prev.some(p => p.id === photo.id);
        const updated = existing
          ? prev.map(p => p.id === photo.id ? photo : p)
          : [photo, ...prev];
        saveStoredWardStatusPhotos(updated);
        return updated;
      });
    }

    // Synchronize photo into associated project's photos array
    const photoUrl = photo.url || photo.photoUrl;
    if (photo.projectId && photoUrl) {
      setSharedProjects(prev => prev.map(proj => {
        if (proj.id === photo.projectId) {
          const existingPhotos = proj.photos || [];
          if (!existingPhotos.includes(photoUrl)) {
            return {
              ...proj,
              photos: [photoUrl, ...existingPhotos],
              lastUpdated: new Date().toISOString().slice(0, 10),
            };
          }
        }
        return proj;
      }));
    }

    setModal(null);
    show('Ward tracking status photo saved successfully!');
  };

  const deleteWardStatusPhoto = (id: string) => {
    setModal({
      kind: 'confirm',
      message: 'Are you sure you want to delete this ward status photo? It will be removed from the tracking carousels on the public portal.',
      action: () => {
        if (setSharedWardStatusPhotos) {
          setSharedWardStatusPhotos(prev => {
            const updated = prev.filter(p => p.id !== id);
            saveStoredWardStatusPhotos(updated);
            return updated;
          });
        }
        setModal(null);
        show('Ward status photo deleted.');
      }
    });
  };

  function saveEditedNote(subId: string) {
    const today = new Date().toISOString().slice(0, 10);
    setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, adminNote: editNoteText, reviewedAt: today } : s));
    setEditNoteId(null);
    setEditNoteText('');
    show('Admin note updated.');
  }

  const dashboardFilteredProjects = React.useMemo(() => {
    if (dashboardComponent === 'All Components' || dashboardComponent === 'All Project Components' || dashboardComponent === 'All') {
      return sharedProjects;
    }
    return sharedProjects.filter(p =>
      p.component === dashboardComponent ||
      p.initiativeComponent === dashboardComponent ||
      (isInitiative(p) && getProjectInitiativeComponent(p) === dashboardComponent)
    );
  }, [sharedProjects, dashboardComponent]);

  const projectItems = dashboardFilteredProjects.filter(p => !isInitiative(p));
  const initiativeItems = dashboardFilteredProjects.filter(p => isInitiative(p));
  const totalProjectsCount = projectItems.length;
  const totalInitiativesCount = initiativeItems.length;
  const completed = dashboardFilteredProjects.filter(p => p.status === 'Completed').length;
  const ongoing = dashboardFilteredProjects.filter(p => ['Ongoing', 'Near Completion'].includes(p.status)).length;
  const totalBudget = dashboardFilteredProjects.reduce((s, p) => s + p.budget, 0);
  const totalBeneficiaries = dashboardFilteredProjects.reduce((s, p) => s + p.beneficiaries, 0);
  const totalFundsDisbursed = dashboardFilteredProjects.reduce((s, p) => s + getProjectDisbursed(p), 0);
  const totalAggregatedBalance = dashboardFilteredProjects.reduce((s, p) => s + getProjectBalance(p), 0);
  const unresolved = localFeedback.filter(f => f.status !== 'Resolved' && f.status !== 'Rejected').length;
  const pendingReports = submissions.filter(s => s.status === 'Pending Review').length;
  const approvedReports = submissions.filter(s => s.status === 'Approved').length;
  const returnedReports = submissions.filter(s => s.status === 'Returned').length;
  const missedVisits = visits.filter(v => v.status === 'Missed').length;

  // Dynamic Projects by Ward Data
  const activeWardsWithProjects = Array.from(new Set(dashboardFilteredProjects.map(p => p.ward))).filter(Boolean);
  const dynamicWardData = (activeWardsWithProjects.length > 0 ? activeWardsWithProjects : WARDS).map(ward => {
    const wardProjects = dashboardFilteredProjects.filter(p => p.ward === ward);
    return {
      ward: ward.replace('Chizumulu ', 'Chiz. ').replace('Likoma ', 'Lik. ').replace(' Ward', ''),
      total: wardProjects.length,
      ongoing: wardProjects.filter(p => ['Ongoing', 'Near Completion'].includes(p.status)).length,
      completed: wardProjects.filter(p => p.status === 'Completed').length,
      notStarted: wardProjects.filter(p => ['Not Started', 'Approved', 'Assessed', 'Proposed'].includes(p.status)).length,
    };
  });

  // Dynamic Projects by Sector Data
  const dynamicSectorData = React.useMemo(() => {
    const map: Record<string, number> = {};
    dashboardFilteredProjects.forEach(p => {
      if (p.sector) {
        map[p.sector] = (map[p.sector] || 0) + 1;
      }
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [dashboardFilteredProjects]);
  const totalSectorProjects = dynamicSectorData.reduce((s, d) => s + d.value, 0);

  // Dynamic Beneficiaries Distribution Data
  const dynamicBeneficiaryDistribution = React.useMemo(() => {
    const map: Record<string, number> = {};
    dashboardFilteredProjects.forEach(p => {
      const type = getProjectBeneficiaryType(p);
      map[type] = (map[type] || 0) + (p.beneficiaries || 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0)
      .sort((a, b) => {
        const idxA = (BENEFICIARY_ORDER as readonly string[]).indexOf(a.name);
        const idxB = (BENEFICIARY_ORDER as readonly string[]).indexOf(b.name);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return b.value - a.value;
      });
  }, [dashboardFilteredProjects]);
  const totalBeneficiariesInDistribution = dynamicBeneficiaryDistribution.reduce((acc, curr) => acc + curr.value, 0);

  // Dynamic Funds Disbursed vs Utilised by Ward within Likoma Island Constituency
  const constituencyFundsData = React.useMemo(() => {
    const LIKOMA_WARD_ORDER = [
      'Likoma North Ward',
      'Likoma South Ward',
      'Chizumulu North Ward',
      'Chizumulu South Ward',
    ];

    const wardMap: Record<string, {
      ward: string;
      wardShort: string;
      constituency: string;
      constituencyShort: string;
      disbursed: number;
      utilised: number;
      budget: number;
      projectCount: number;
    }> = {};

    // Initialize with standard Likoma Island wards
    LIKOMA_WARD_ORDER.forEach(w => {
      const short = w.replace(/\s*Ward\s*/gi, '').trim();
      wardMap[w] = {
        ward: w,
        wardShort: short,
        constituency: 'Likoma Island',
        constituencyShort: short,
        disbursed: 0,
        utilised: 0,
        budget: 0,
        projectCount: 0,
      };
    });

    dashboardFilteredProjects.forEach(p => {
      const wardName = p.ward || 'Likoma North Ward';
      if (!wardMap[wardName]) {
        const short = wardName.replace(/\s*Ward\s*/gi, '').trim();
        wardMap[wardName] = {
          ward: wardName,
          wardShort: short,
          constituency: p.constituency || 'Likoma Island',
          constituencyShort: short,
          disbursed: 0,
          utilised: 0,
          budget: 0,
          projectCount: 0,
        };
      }

      const item = wardMap[wardName];
      item.disbursed += getProjectDisbursed(p);
      item.utilised += getProjectUtilised(p);
      item.budget += (p.budget || 0);
      item.projectCount += 1;
    });

    return Object.values(wardMap)
      .filter(w => w.disbursed > 0 || w.utilised > 0 || w.projectCount > 0)
      .sort((a, b) => {
        const idxA = LIKOMA_WARD_ORDER.indexOf(a.ward);
        const idxB = LIKOMA_WARD_ORDER.indexOf(b.ward);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return b.disbursed - a.disbursed;
      });
  }, [dashboardFilteredProjects]);

  // Project CRUD
  function saveProject(p: Project) {
    const today = new Date().toISOString().slice(0, 10);
    const isInit = isInitiative(p);
    let targetId = p.id;
    let finalPhotos = p.photos && p.photos.length > 0 ? [...p.photos] : [];

    if (sharedProjects.find(x => x.id === p.id)) {
      setSharedProjects(prev => prev.map(x => x.id === p.id ? { ...p, lastUpdated: today } : x));
      show(`${isInit ? 'Initiative' : 'Project'} "${p.name}" updated.`);
    } else {
      const prefix = isInit ? 'CY-INIT' : 'CY-2026';
      const newId = `${prefix}-${String(sharedProjects.length + 1).padStart(3, '0')}`;
      targetId = newId;
      if (finalPhotos.length === 0) {
        finalPhotos = [
          isInit
            ? 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=1000&q=80'
            : 'https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?auto=format&fit=crop&w=1000&q=80'
        ];
      }
      setSharedProjects(prev => [{ ...p, id: newId, photos: finalPhotos, createdDate: today, lastUpdated: today }, ...prev]);
      show(`${isInit ? 'Initiative' : 'Project'} "${p.name}" added.`);
    }

    // Synchronize to Ward Status Photos & Gallery so it immediately appears and can be edited
    if (setSharedWardStatusPhotos) {
      const photosToSync = finalPhotos.length > 0
        ? finalPhotos
        : [
            isInit
              ? 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=1000&q=80'
              : 'https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?auto=format&fit=crop&w=1000&q=80'
          ];

      setSharedWardStatusPhotos(prev => {
        let nextList = [...prev];
        photosToSync.forEach((imgUrl, idx) => {
          const existingIdx = nextList.findIndex(
            wp => (wp.projectId === targetId || wp.projectId === p.id) && (wp.url === imgUrl || wp.photoUrl === imgUrl)
          );
          if (existingIdx !== -1) {
            nextList[existingIdx] = {
              ...nextList[existingIdx],
              projectId: targetId,
              projectName: p.initiativeName || p.name,
              ward: p.ward,
              constituency: p.constituency || 'Likoma Island',
              status: p.status,
              category: isInit ? 'Initiative' : 'Project',
              date: today,
            };
          } else {
            const newPhoto: WardStatusPhoto = {
              id: `WSP-${targetId}-${idx + 1}-${Date.now()}`,
              ward: p.ward,
              constituency: p.constituency || 'Likoma Island',
              category: isInit ? 'Initiative' : 'Project',
              status: p.status,
              url: imgUrl,
              photoUrl: imgUrl,
              caption: `${isInit ? 'Initiative' : 'Project'} site status: ${p.initiativeName || p.name} (${p.status})`,
              projectId: targetId,
              projectName: p.initiativeName || p.name,
              monitor: p.monitor || 'District Monitoring Officer',
              date: today,
              uploadedAt: new Date().toISOString(),
              isCurrentStatus: true,
            };
            nextList = [newPhoto, ...nextList];
          }
        });
        saveStoredWardStatusPhotos(nextList);
        return nextList;
      });
    }

    setModal(null);
  }

  function deleteProject(id: string) {
    const p = sharedProjects.find(x => x.id === id);
    setModal({ kind: 'confirm', message: `Delete project "${p?.name}"? This cannot be undone.`, action: () => {
      setSharedProjects(prev => prev.filter(x => x.id !== id));
      show('Project deleted.', 'info');
      setModal(null);
    }});
  }

  // Actually sends the credentials email (Resend, via the
  // send-credentials-email Edge Function) and normalizes the result into the
  // shape `credentialSent` wants. In local/offline mode (no Supabase) there's
  // no server-side function to call, so this reports `emailSent: false` with
  // no error — the modal then tells the admin to share credentials manually
  // instead of falsely claiming an email went out.
  async function dispatchCredentialsEmail(params: {
    monitorName: string;
    monitorEmail: string;
    password: string;
    wards?: string;
    isResend?: boolean;
  }): Promise<{ emailSent: boolean; emailError?: string | null }> {
    const result = await sendMonitorCredentialsEmail?.(params);
    if (!result) return { emailSent: false, emailError: 'Email sending is not configured.' };
    if (result.skipped) {
      return { emailSent: false, emailError: 'Running in offline/local mode — no email server is connected, so nothing was sent.' };
    }
    return { emailSent: result.success, emailError: result.success ? null : result.error };
  }

  // Monitor CRUD
  async function saveMonitor(m: Monitor, credentials?: { password?: string; sendEmail: boolean }) {
    const existing = localMonitors.find(x => x.id === m.id);
    if (existing) {
      setLocalMonitors(prev => prev.map(x => x.id === m.id ? m : x));
      setUsers(prev => prev.map(u => {
        if (u.monitorId === m.id || u.email.toLowerCase() === existing.email.toLowerCase()) {
          return {
            ...u,
            name: m.name,
            email: m.email,
            ...(credentials?.password ? { password: credentials.password } : {}),
          };
        }
        return u;
      }));

      if (credentials?.password && credentials.sendEmail) {
        // Make sure the (possibly just-edited) monitor row is actually in
        // Supabase before touching their login — see persistMonitor above.
        await persistMonitor?.(m);
        // Actually reset the monitor's real Supabase Auth password (service
        // role, via the provision-monitor Edge Function) — not just the
        // local mock user record.
        const result = await provisionMonitor?.({
          action: 'reset-password',
          monitorId: m.id,
          name: m.name,
          email: m.email,
          password: credentials.password,
        });

        if (result && !result.success) {
          show(`Monitor "${m.name}" updated, but login credentials failed to sync: ${result.error}`, 'error');
        } else {
          const { emailSent, emailError } = await dispatchCredentialsEmail({
            monitorName: m.name,
            monitorEmail: m.email,
            password: credentials.password,
            wards: m.wards,
            isResend: true,
          });
          setCredentialSent({
            monitorName: m.name,
            monitorEmail: m.email,
            password: credentials.password,
            wards: m.wards,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isResend: true,
            emailSent,
            emailError,
          });
          show(
            emailSent
              ? `Monitor "${m.name}" updated. New login credentials emailed to ${m.email}.`
              : `Monitor "${m.name}" updated, but the credentials email could not be sent${emailError ? `: ${emailError}` : '.'}`,
            emailSent ? 'success' : 'error'
          );
        }
      } else {
        show(`Monitor "${m.name}" updated.`);
      }
    } else {
      setLocalMonitors(prev => [...prev, m]);
      const pwd = credentials?.password || `Monitor@${Math.floor(1000 + Math.random() * 9000)}`;
      const newUser: User = {
        id: `U-${m.id}`,
        name: m.name,
        email: m.email.trim().toLowerCase(),
        password: pwd,
        role: 'monitor',
        monitorId: m.id,
        joinDate: m.joinDate || new Date().toISOString().slice(0, 10),
      };
      setUsers(prev => [...prev.filter(u => u.email.toLowerCase() !== newUser.email.toLowerCase()), newUser]);

      // Persist the new monitor row to Supabase FIRST, and wait for it to
      // land, before provisioning their login. `setLocalMonitors` above also
      // eventually triggers a save (via setSharedMonitors in App.tsx), but
      // that happens as an unawaited side effect of a state update and can
      // race with the Edge Function call below. The monitor's login
      // (`profiles.monitor_id`) has a foreign-key reference to this row, so
      // if it hasn't been written yet, provisioning fails outright.
      await persistMonitor?.(m);

      // Create the monitor's real Supabase Auth login (service role, via
      // the provision-monitor Edge Function). Without this the monitor
      // would only exist in the local mock `users` array and could never
      // actually sign in once the app is running against a live database.
      const result = await provisionMonitor?.({
        action: 'create',
        monitorId: m.id,
        name: m.name,
        email: m.email,
        password: pwd,
      });

      if (result && !result.success) {
        show(`Monitor "${m.name}" added, but their login account could not be created: ${result.error}`, 'error');
      } else if (credentials?.sendEmail !== false) {
        const { emailSent, emailError } = await dispatchCredentialsEmail({
          monitorName: m.name,
          monitorEmail: m.email,
          password: pwd,
          wards: m.wards,
          isResend: false,
        });
        setCredentialSent({
          monitorName: m.name,
          monitorEmail: m.email,
          password: pwd,
          wards: m.wards,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isResend: false,
          emailSent,
          emailError,
        });
        show(
          emailSent
            ? `Monitor "${m.name}" added. Login credentials sent to ${m.email}!`
            : `Monitor "${m.name}" added, but the credentials email could not be sent${emailError ? `: ${emailError}` : '.'} You can copy the password from the next screen.`,
          emailSent ? 'success' : 'error'
        );
      } else {
        show(`Monitor "${m.name}" added.`);
      }

      setMonitorPopup({ name: m.name, email: m.email, wards: m.wards });
      setTimeout(() => setMonitorPopup(null), 10000);
    }
    setModal(null);
  }

  async function handleSendCredentials(m: Monitor, password: string) {
    setUsers(prev => {
      const exists = prev.find(u => u.monitorId === m.id || u.email.toLowerCase() === m.email.toLowerCase());
      if (exists) {
        return prev.map(u => u.id === exists.id ? { ...u, password, email: m.email, name: m.name } : u);
      } else {
        const newUser: User = {
          id: `U-${m.id}`,
          name: m.name,
          email: m.email.trim().toLowerCase(),
          password,
          role: 'monitor',
          monitorId: m.id,
          joinDate: m.joinDate,
        };
        return [...prev, newUser];
      }
    });

    // Make sure the monitor row exists in Supabase before touching auth —
    // same FK-ordering reason as in saveMonitor above.
    await persistMonitor?.(m);

    // Sync the real Supabase Auth password too — falls back to "create" if
    // this monitor somehow doesn't have an auth account yet.
    const result = await provisionMonitor?.({
      action: 'reset-password',
      monitorId: m.id,
      name: m.name,
      email: m.email,
      password,
    });
    const fallback = result && !result.success
      ? await provisionMonitor?.({ action: 'create', monitorId: m.id, name: m.name, email: m.email, password })
      : undefined;
    const finalResult = fallback ?? result;

    if (finalResult && !finalResult.success) {
      show(`Could not sync login credentials for ${m.email}: ${finalResult.error}`, 'error');
      setModal(null);
      return;
    }

    const { emailSent, emailError } = await dispatchCredentialsEmail({
      monitorName: m.name,
      monitorEmail: m.email,
      password,
      wards: m.wards,
      isResend: true,
    });
    setCredentialSent({
      monitorName: m.name,
      monitorEmail: m.email,
      password,
      wards: m.wards,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isResend: true,
      emailSent,
      emailError,
    });
    show(
      emailSent ? `Login credentials dispatched to ${m.email}.` : `Password updated, but the email could not be sent${emailError ? `: ${emailError}` : '.'}`,
      emailSent ? 'success' : 'error'
    );
    setModal(null);
  }

  function toggleMonitorStatus(m: Monitor) {
    const action = m.status === 'Active' ? 'Deactivate' : 'Reactivate';
    setModal({ kind: 'confirm', message: `${action} monitor "${m.name}"?`, action: () => {
      setLocalMonitors(prev => prev.map(x => x.id === m.id ? { ...x, status: x.status === 'Active' ? 'Inactive' : 'Active' } : x));
      show(`Monitor ${m.status === 'Active' ? 'deactivated' : 'reactivated'}.`, 'info');
      setModal(null);
    }});
  }

  // Announcement CRUD
  function saveAnnouncement(a: Announcement) {
    if (localAnnouncements.find(x => x.id === a.id)) {
      setLocalAnnouncements(prev => prev.map(x => x.id === a.id ? a : x));
      show('Announcement updated.');
    } else {
      setLocalAnnouncements(prev => [a, ...prev]);
      show(`Announcement published.`);
      if (a.published) {
        setSysNotifs(prev => [{
          id: `SN-${Date.now()}`,
          type: 'submission' as const,
          title: 'Announcement Published',
          message: `"${a.title}" is now visible on the public portal.`,
          date: new Date().toISOString().slice(0, 10),
          read: false,
          for: 'admin' as const,
        }, ...prev]);
      }
    }
    setModal(null);
  }

  function togglePublished(a: Announcement) {
    setModal({ kind: 'confirm', message: `${a.published ? 'Unpublish' : 'Republish'} "${a.title}"?`, action: () => {
      setLocalAnnouncements(prev => prev.map(x => x.id === a.id ? { ...x, published: !x.published } : x));
      show(`Announcement ${a.published ? 'unpublished' : 'republished'}.`, 'info');
      setModal(null);
    }});
  }

  // Feedback
  function resolveFb(id: string) {
    setLocalFeedback(prev => prev.map(f => f.id === id ? { ...f, status: 'Resolved', resolvedDate: new Date().toISOString().slice(0, 10) } : f));
    show('Feedback marked Resolved.');
  }
  function reviewFb(id: string) {
    setLocalFeedback(prev => prev.map(f => f.id === id ? { ...f, status: 'Under Review' } : f));
    show('Feedback moved to Under Review.', 'info');
  }
  function verifyFb(id: string) {
    setLocalFeedback(prev => prev.map(f => f.id === id ? { ...f, status: 'Verification Requested' } : f));
    show('Verification request sent.', 'info');
  }

  // Schedule Visit
  function scheduleVisit(data: { monitorId: string; monitorName: string; projectId: string; projectName: string; date: string; time: string; notes: string; ward: string }) {
    const today = new Date().toISOString().slice(0, 10);
    const newId = `V-${String(Date.now()).slice(-4)}`;
    const newVisit: ScheduledVisit = {
      id: newId, ...data,
      status: 'Upcoming', acknowledgedAt: '', scheduledBy: 'Admin', scheduledAt: today,
    };
    setVisits(prev => [newVisit, ...prev]);
    // Notify monitor
    setSysNotifs(prev => [{
      id: `SN-${Date.now()}`, for: 'monitor', monitorId: data.monitorId,
      type: 'visit_scheduled', title: 'New Site Visit Scheduled',
      message: `Admin scheduled a site visit to "${data.projectName}" on ${data.date} at ${data.time}. Please acknowledge.`,
      date: today, read: false, visitId: newId, projectId: data.projectId,
    }, ...prev]);
    show(`Visit scheduled for ${data.monitorName} on ${data.date}.`);
    setModal(null);
  }

  // Re-schedule Visit
  function rescheduleVisit(oldVisit: ScheduledVisit, data: { monitorId: string; monitorName: string; projectId: string; projectName: string; date: string; time: string; notes: string; ward: string }) {
    const today = new Date().toISOString().slice(0, 10);
    const newId = `V-${String(Date.now()).slice(-4)}`;
    // Mark old as rescheduled
    setVisits(prev => prev.map(v => v.id === oldVisit.id ? { ...v, status: 'Rescheduled' } : v));
    // Create new visit
    const newVisit: ScheduledVisit = {
      id: newId, ...data,
      status: 'Upcoming', acknowledgedAt: '', scheduledBy: 'Admin', scheduledAt: today,
      rescheduledFrom: oldVisit.date,
    };
    setVisits(prev => [newVisit, ...prev]);
    // Notify monitor
    setSysNotifs(prev => [{
      id: `SN-${Date.now()}`, for: 'monitor', monitorId: data.monitorId,
      type: 'visit_rescheduled', title: 'Visit Re-scheduled',
      message: `Admin re-scheduled your missed visit to "${data.projectName}". New date: ${data.date} at ${data.time}. Please acknowledge.`,
      date: today, read: false, visitId: newId, projectId: data.projectId,
    }, ...prev]);
    show(`Visit re-scheduled for ${data.date}. Monitor notified.`);
    setModal(null);
  }

  // Approve Submission
  function approveSubmission(sub: MonitorSubmission, note: string, updatedProgress?: number, confirmedFundsUsed?: number) {
    const today = new Date().toISOString().slice(0, 10);
    setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'Approved', adminNote: note, reviewedAt: today } : s));
    const progToSet = typeof updatedProgress === 'number' ? updatedProgress : sub.progress;
    const isCompleted = progToSet === 100;

    setSharedProjects(prev => prev.map(p => {
      if (p.id === sub.projectId || p.name.toLowerCase() === sub.projectName.toLowerCase()) {
        const nextFundsUsed = typeof confirmedFundsUsed === 'number'
          ? confirmedFundsUsed
          : (p.fundsUsed !== undefined ? p.fundsUsed : (sub.fundsUsedReported !== undefined ? sub.fundsUsedReported : undefined));
        const existingPhotos = p.photos || [];
        const reportPhotos = sub.photos || [];
        const mergedPhotos = Array.from(new Set([...existingPhotos, ...reportPhotos]));
        return {
          ...p,
          progress: progToSet,
          status: isCompleted ? 'Completed' : (progToSet >= 80 ? 'Near Completion' : (progToSet > 0 ? 'Ongoing' : p.status)),
          actualCompletion: isCompleted ? today : p.actualCompletion,
          fundsUsed: nextFundsUsed,
          photos: mergedPhotos.length > 0 ? mergedPhotos : p.photos,
          lastUpdated: today,
        };
      }
      return p;
    }));

    // Notify monitor
    setSysNotifs(prev => [{
      id: `SN-${Date.now()}`, for: 'monitor', monitorId: sub.monitorId,
      type: 'submission_approved', title: 'Report Approved & Finances Updated',
      message: `Your field report ${sub.id} for "${sub.projectName}" has been approved. Project progress is set to ${progToSet}%${typeof confirmedFundsUsed === 'number' ? ` and verified funds used updated to ${formatMK(confirmedFundsUsed)}` : ''}.`,
      date: today, read: false, submissionId: sub.id, projectId: sub.projectId,
    }, ...prev]);
    show(`Report approved, progress set to ${progToSet}%${typeof confirmedFundsUsed === 'number' ? ` and verified ward expenditure updated` : ''}. Monitor notified.`);
    setModal(null);
  }

  // Save Ward Project Progress
  function saveWardProjectProgress(project: Project, newProgress: number, report?: MonitorSubmission) {
    const today = new Date().toISOString().slice(0, 10);
    const isCompleted = newProgress === 100;
    const newStatus = isCompleted ? 'Completed' : (newProgress >= 80 ? 'Near Completion' : (newProgress > 0 ? 'Ongoing' : project.status));

    setSharedProjects(prev => prev.map(p => p.id === project.id ? {
      ...p,
      progress: newProgress,
      status: newStatus,
      actualCompletion: isCompleted ? today : p.actualCompletion,
      lastUpdated: today,
    } : p));

    // Find monitor to notify
    const monitor = localMonitors.find(m =>
      (project.monitor && m.name.toLowerCase() === project.monitor.toLowerCase()) ||
      (project.ward && m.wards?.toLowerCase().includes(project.ward.toLowerCase()))
    );

    const monitorId = report?.monitorId || monitor?.id;
    if (monitorId) {
      setSysNotifs(prev => [{
        id: `SN-${Date.now()}`,
        for: 'monitor',
        monitorId,
        type: 'project_progress_updated',
        title: 'Project Progress Updated',
        message: `Admin updated progress of "${project.name}" (${project.ward}) to ${newProgress}%${report ? ` following approved report ${report.id}` : ''}.`,
        date: today,
        read: false,
        projectId: project.id,
      }, ...prev]);
    }

    show(`Progress for "${project.name}" updated to ${newProgress}%. Monitor notified.`);
  }

  // Return Submission
  function returnSubmission(sub: MonitorSubmission, note: string) {
    const today = new Date().toISOString().slice(0, 10);
    setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'Returned', adminNote: note, reviewedAt: today } : s));
    setSysNotifs(prev => [{
      id: `SN-${Date.now()}`, for: 'monitor', monitorId: sub.monitorId,
      type: 'submission_returned', title: 'Report Returned for Correction',
      message: `Your field report ${sub.id} for "${sub.projectName}" was returned. Admin note: ${note}`,
      date: today, read: false, submissionId: sub.id, projectId: sub.projectId,
    }, ...prev]);
    show('Report returned for correction.', 'info');
    setModal(null);
  }

  // Exports
  function doCSV() {
    exportToCSV(sharedProjects.map(p => ({
      'Project ID': p.id, 'Project Name': p.name, Sector: p.sector,
      Constituency: p.constituency, Ward: p.ward, Status: p.status,
      'Progress (%)': p.progress, 'Budget (MK)': p.budget, Beneficiaries: p.beneficiaries,
      Monitor: p.monitor, 'Expected Completion': p.expectedCompletion,
    })), 'CouncilYanga_Projects');
    show('CSV downloaded.');
  }
  function doExcel() {
    exportToExcel(sharedProjects.map(p => ({
      'Project ID': p.id, 'Project Name': p.name, Sector: p.sector,
      Ward: p.ward, Status: p.status, 'Progress (%)': p.progress,
      'Budget (MK)': p.budget, Beneficiaries: p.beneficiaries, Monitor: p.monitor,
    })), 'CouncilYanga_Projects');
    show('Excel file downloaded.');
  }
  function doPDF() {
    const benef = sharedProjects.reduce((s,p)=>s+p.beneficiaries,0);
    const comp = sharedProjects.filter(p=>p.status==='Completed').length;
    const ong = sharedProjects.filter(p=>p.status==='Ongoing').length;
    const cards = [
      {
        label: 'Total Projects',
        value: sharedProjects.length,
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><path d="M8 10v4"/><path d="M12 10v2"/><path d="M16 10v6"/></svg>',
      },
      {
        label: 'Completed Projects',
        value: comp,
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
      },
      {
        label: 'Ongoing Projects',
        value: ong,
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
      },
      {
        label: 'Total Funds Allocation',
        value: 'MK 5BN',
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>',
      },
      {
        label: 'Beneficiaries',
        value: benef.toLocaleString(),
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      },
      {
        label: 'Active Monitors',
        value: localMonitors.filter(m=>m.status==='Active').length,
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>',
      },
      {
        label: 'Pending Feedback',
        value: localFeedback.filter(f=>f.status!=='Resolved'&&f.status!=='Rejected').length,
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
      },
      {
        label: 'Announcements',
        value: localAnnouncements.filter(a=>a.published).length,
        icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
      },
    ];
    const kpiHtml = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;">
      ${cards.map(c => `
        <div style="background:#016630;border-radius:0.2rem;min-height:108px;padding:12px 8px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-sizing:border-box;">
          <div style="color:#ffffff;display:flex;align-items:center;justify-content:center;margin-bottom:6px;">${c.icon}</div>
          <div style="font-size:20px;font-weight:900;color:#ffffff;line-height:1;margin-bottom:4px;font-family:Outfit,Arial,sans-serif;">${c.value}</div>
          <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.9);line-height:1.2;">${c.label}</div>
        </div>
      `).join('')}
    </div>`;
    const headers = ['ID','Project Name','Sector','Ward','Status','Progress','Budget','Beneficiaries'];
    const rows = sharedProjects.map(p => {
      const prog = p.status==='Completed'?100:p.status==='Not Started'||p.status==='Proposed'?0:p.progress;
      return [p.id,p.name,p.sector,p.ward,p.status,`${prog}%`,formatMK(p.budget),p.beneficiaries.toLocaleString()];
    });
    exportToPDF('Council Yanga - CDF Projects Report 2025/2026', headers, rows, kpiHtml);
    show('PDF opened in print preview.', 'info');
  }

  function nav(s: Section) { setSection(s); setSidebarOpen(false); }

  const filteredProjects = sharedProjects.filter(p => {
    const s = projSearch.toLowerCase();
    const matchSearch = !s || p.name.toLowerCase().includes(s) || p.id.toLowerCase().includes(s);
    const matchStatus = projStatus === 'All' || p.status === projStatus;
    const matchComponent =
      projComponent === 'All Components' ||
      projComponent === 'All Project Components' ||
      projComponent === 'All' ||
      p.component === projComponent ||
      p.initiativeComponent === projComponent ||
      (isInitiative(p) && getProjectInitiativeComponent(p) === projComponent);
    return matchSearch && matchStatus && matchComponent;
  });
  const filteredMonitors = localMonitors.filter(m =>
    m.name.toLowerCase().includes(monSearch.toLowerCase()) ||
    m.email.toLowerCase().includes(monSearch.toLowerCase()) ||
    m.wards.toLowerCase().includes(monSearch.toLowerCase())
  );
  const filteredFeedback = localFeedback.filter(f => fbFilter === 'All' || f.status === fbFilter);
  const filteredAudit = auditLogs.filter(a =>
    a.user.toLowerCase().includes(auditSearch.toLowerCase()) ||
    a.target.toLowerCase().includes(auditSearch.toLowerCase()) ||
    a.action.toLowerCase().includes(auditSearch.toLowerCase())
  );
  const filteredVisits = visitFilter === 'All' ? visits : visits.filter(v => v.status === visitFilter);
  const filteredSubmissions = subFilter === 'All' ? submissions : submissions.filter(s => s.status === subFilter);

  function FbPill({ status }: { status: string }) {
    const bg: Record<string, string> = {
      Received: '#2563eb', 'Under Review': '#d97706',
      'Verification Requested': '#7c3aed', Resolved: '#016630', Rejected: '#dc2626',
    };
    return <span className="text-xs font-semibold px-2.5 py-0.5 text-white whitespace-nowrap" style={{ background: bg[status] ?? '#6b7280', borderRadius: '0.2rem' }}>{status}</span>;
  }

  function Sidebar() {
    return (
      <div className="flex flex-col h-full bg-[#145a32] text-white w-56">
        <div className="px-4 py-5 border-b border-white/10">
          <Logo className="h-14 brightness-0 invert flex-shrink-0" />
          <p className="text-xs text-white/60 mt-2">Admin Dashboard</p>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => nav(id)} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${section === id ? 'bg-white/15 font-semibold' : 'hover:bg-white/10 text-white/80'}`}>
              <Icon size={16} />
              {label}
              {id === 'feedback' && unresolved > 0 && <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{unresolved}</span>}
              {id === 'monitorReports' && pendingReports > 0 && <span className="ml-auto bg-amber-400 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{pendingReports}</span>}
              {id === 'schedule' && missedVisits > 0 && <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{missedVisits}</span>}
            </button>
          ))}
        </nav>
        <button onClick={onLogout} className="flex items-center gap-3 px-4 py-3 text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors border-t border-white/10">
          <LogOut size={16} /> Logout
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f0fdf4]">
      <aside className="hidden md:flex flex-col h-screen sticky top-0 flex-shrink-0"><Sidebar /></aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative h-full w-56 flex flex-col"><Sidebar /></div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Header */}
        <header className="bg-[#016630] lg:bg-white border-b border-[#015226] lg:border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0 transition-colors">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-white lg:text-gray-500 p-1 rounded-lg hover:bg-white/10 lg:hover:bg-gray-100 transition-colors"><Menu size={20} /></button>
            <h1 className="text-base font-bold text-white lg:text-gray-900 hidden sm:block" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {NAV.find(n => n.id === section)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Admin notification bell */}
            <div className="relative" ref={notifRef}>
              <button onClick={() => setNotifOpen(v => !v)} className="relative p-1.5 rounded-lg hover:bg-white/10 lg:hover:bg-gray-100 text-white lg:text-gray-500 transition-colors" title="Notifications">
                <Bell size={18} />
                {adminUnread > 0 && <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{adminUnread}</span>}
              </button>
              {notifOpen && (
                <>
                  {/* Mobile backdrop */}
                  <div
                    className="fixed inset-0 bg-black/25 z-40 sm:hidden"
                    onClick={() => setNotifOpen(false)}
                    onMouseDown={() => setNotifOpen(false)}
                  />
                  <div className="fixed inset-x-3.5 top-14 max-w-sm mx-auto sm:mx-0 sm:inset-x-auto sm:absolute sm:right-0 sm:top-10 sm:w-80 bg-white rounded-2xl shadow-2xl sm:shadow-xl border border-gray-100 z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <span className="font-semibold text-gray-900 text-sm">Admin Notifications</span>
                      {adminUnread > 0 && (
                        <button onClick={() => setSysNotifs(prev => prev.map(n => n.for === 'admin' ? { ...n, read: true } : n))} className="text-xs text-[#145a32] font-semibold hover:underline">Mark all read</button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {adminNotifs.length === 0 && <div className="py-8 text-center text-gray-400 text-sm">No notifications</div>}
                      {adminNotifs.map(n => {
                        const icon = n.type === 'missed_visit' ? <AlertTriangle size={13} className="text-red-500" /> : n.type === 'acknowledgement' ? <CalendarCheck size={13} className="text-blue-500" /> : <Send size={13} className="text-[#145a32]" />;
                        return (
                          <div key={n.id} onClick={() => setSysNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))} className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-50 ${!n.read ? 'bg-amber-50/60' : ''}`}>
                            <div className="flex-shrink-0 mt-0.5">{icon}</div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs leading-snug mb-0.5 ${!n.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{n.title}</p>
                              <p className="text-xs text-gray-500 leading-snug">{n.message}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{n.date}</p>
                            </div>
                            {!n.read && <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />}
                          </div>
                        );
                      })}
                    </div>
                    {missedVisits > 0 && (
                      <div className="p-3 border-t border-gray-100">
                        <button onClick={() => { nav('schedule'); setNotifOpen(false); }} className="w-full text-xs text-[#145a32] font-semibold text-center hover:underline">
                          View {missedVisits} missed visit{missedVisits > 1 ? 's' : ''} → Re-schedule
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <CircleUserRound size={28} className="text-white lg:text-[#145a32]" />
              <span className="hidden sm:inline text-sm font-medium text-white lg:text-gray-700">Admin</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">

          {isLiveDb && isLocalOnlySession && !dismissedLocalOnlyBanner && (
            <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3">
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-amber-600" />
              <div className="flex-1 text-sm">
                <p className="font-semibold">You're signed in with local demo credentials, not a real admin account.</p>
                <p className="text-amber-800 mt-0.5">
                  No Supabase Auth account exists for this email, so changes that require a real admin session
                  — adding monitors, saving projects, managing feedback, etc. — will fail even though you're
                  connected to the live database. Ask a project owner to create a real admin account for you in
                  Supabase (Authentication → Add user), then log out and back in with those credentials.
                </p>
              </div>
              <button onClick={() => setDismissedLocalOnlyBanner(true)} className="flex-shrink-0 text-amber-500 hover:text-amber-700"><X size={16} /></button>
            </div>
          )}

          {/* DASHBOARD */}
          {section === 'dashboard' && (
            <div className="max-w-6xl mx-auto space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Dashboard Overview</h2>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <h3 className="text-xs sm:text-sm md:text-base font-bold text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontFamily: 'Outfit, sans-serif' }}>Metrics Summary for Projects and Initiatives</h3>
                <div className="flex items-center gap-2 self-start sm:self-auto w-full sm:w-auto min-w-0">
                  <span className="text-xs font-semibold text-gray-500 whitespace-nowrap shrink-0">Components:</span>
                  <div className="relative flex-1 sm:flex-initial min-w-0 max-w-full">
                    <select
                      className="appearance-none border border-gray-200 rounded-xl pl-3 pr-8 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#145a32] bg-white text-gray-800 font-medium cursor-pointer w-full max-w-full truncate"
                      value={dashboardComponent}
                      onChange={e => setDashboardComponent(e.target.value)}
                    >
                      {['All Components', ...CDF_COMPONENTS, ...INITIATIVE_COMPONENTS].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniStat label="Total Projects" value={totalProjectsCount} icon={<FolderKanban size={26} />} />
                <MiniStat label="Total Initiatives" value={totalInitiativesCount} icon={<Layers size={26} />} />
                <MiniStat label="Completed Projects" value={completed} icon={<CheckCircle2 size={26} />} />
                <MiniStat label="Ongoing Projects" value={ongoing} icon={<Activity size={26} />} />
                <MiniStat label="Total Funds Allocation" value="MK 5BN" icon={<Wallet size={26} />} />
                <MiniStat label="Beneficiaries" value={totalBeneficiaries.toLocaleString()} icon={<Users size={26} />} />
                <MiniStat label="Sectors" value={dynamicSectorData.length} icon={<LayoutGrid size={26} />} />
                <DisbursedAndBalanceKpiCard
                  disbursedValue={formatMK(totalFundsDisbursed)}
                  balanceValue={formatMK(totalAggregatedBalance)}
                  disbursedLabel="Total Funds Disbursed"
                  balanceLabel="Total Aggregated Balance"
                  minHeight="108px"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <MiniStat label="Active Monitors" value={localMonitors.filter(m => m.status === 'Active').length} icon={<UserCheck size={26} />} />
                <MiniStat label="Pending Reports" value={pendingReports} icon={<FileText size={26} />} />
                <MiniStat label="Missed Visits" value={missedVisits} icon={<CalendarX size={26} />} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Projects by Ward */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Projects by Ward</p>
                  {dynamicWardData.every(d => d.total === 0) ? (
                    <p className="text-sm text-gray-400 text-center py-10">No projects recorded yet.</p>
                  ) : (
                    <div className="w-full overflow-hidden">
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height={224}>
                          <BarChart data={dynamicWardData} margin={{ top: 8, right: 10, left: -18, bottom: 20 }}>
                            <XAxis
                              dataKey="ward"
                              tick={renderWardXAxisTick}
                              interval={0}
                              height={38}
                              tickLine={false}
                            />
                            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="ongoing" name="Ongoing" fill="#2563eb" radius={[4, 4, 0, 0]}>
                              <LabelList dataKey="ongoing" content={renderWardBarInsideLabel} />
                            </Bar>
                            <Bar dataKey="completed" name="Completed" fill="#16a34a" radius={[4, 4, 0, 0]}>
                              <LabelList dataKey="completed" content={renderWardBarInsideLabel} />
                            </Bar>
                            <Bar dataKey="notStarted" name="Not Started" fill="#9ca3af" radius={[4, 4, 0, 0]}>
                              <LabelList dataKey="notStarted" content={renderWardBarInsideLabel} />
                            </Bar>
                            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Projects by Sector */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Projects by Sector</p>
                  {dynamicSectorData.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-10">No sector data recorded yet.</p>
                  ) : (
                    <div className="flex flex-col items-center justify-start w-full min-w-0">
                      <div className="w-full h-56 sm:h-64 relative shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                            <Pie
                              data={dynamicSectorData}
                              cx="50%" cy="50%"
                              innerRadius={44}
                              outerRadius={68}
                              dataKey="value"
                              nameKey="name"
                              isAnimationActive={false}
                              labelLine={false}
                              label={renderDonutCalloutLabel}
                            >
                              {dynamicSectorData.map((entry, i) => (
                                <Cell key={i} fill={SECTOR_COLORS[entry.name] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Center total */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="text-center">
                            <p className="text-lg sm:text-xl font-bold text-slate-700 tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
                              {totalSectorProjects}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="w-full min-w-0 flex flex-row flex-nowrap justify-start items-center gap-2.5 sm:gap-4 mt-2 sm:mt-3 overflow-x-auto px-1 py-1 scroll-smooth">
                        {dynamicSectorData.map((s, i) => (
                          <div
                            key={s.name}
                            className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap shrink-0"
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: SECTOR_COLORS[s.name] ?? CHART_COLORS[i % CHART_COLORS.length] }}
                            />
                            <span
                              className="text-[11px] sm:text-xs text-gray-700 font-medium whitespace-nowrap"
                              title={s.name}
                            >
                              {s.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Beneficiaries Distribution */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Beneficiaries Distribution</p>
                      <p className="text-xs text-gray-400">Total estimated reach across target groups</p>
                    </div>
                  </div>
                  {dynamicBeneficiaryDistribution.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-10">No beneficiaries data recorded yet.</p>
                  ) : (
                    <div className="flex flex-col items-center justify-start w-full min-w-0">
                      <div className="w-full h-56 sm:h-64 relative shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                            <Pie
                              data={dynamicBeneficiaryDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={44}
                              outerRadius={68}
                              dataKey="value"
                              nameKey="name"
                              isAnimationActive={false}
                              labelLine={false}
                              label={renderBeneficiaryDonutCalloutLabel}
                            >
                              {dynamicBeneficiaryDistribution.map((entry, i) => (
                                <Cell
                                  key={`b-cell-${i}`}
                                  fill={BENEFICIARY_COLORS[entry.name] ?? CHART_COLORS[i % CHART_COLORS.length]}
                                />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="text-center">
                            <p className="text-lg sm:text-xl font-bold text-slate-700 tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
                              {(totalBeneficiariesInDistribution > 0 ? totalBeneficiariesInDistribution : totalBeneficiaries).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="w-full min-w-0 flex flex-row flex-nowrap justify-start items-center gap-2.5 sm:gap-4 mt-2 sm:mt-3 overflow-x-auto px-1 py-1 scroll-smooth">
                        {dynamicBeneficiaryDistribution.map((b) => {
                          const color = BENEFICIARY_COLORS[b.name] ?? CHART_COLORS[0];
                          return (
                            <div
                              key={b.name}
                              className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap shrink-0"
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ background: color }}
                              />
                              <span
                                className="text-[11px] sm:text-xs text-gray-700 font-medium whitespace-nowrap"
                                title={b.name}
                              >
                                {b.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Funds Disbursed vs Utilised by Ward */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Funds Disbursed vs Utilised by Ward</p>
                      <p className="text-xs text-gray-400">Comparison of funds disbursed against funds utilised across wards in Likoma Island Constituency</p>
                    </div>
                  </div>
                  {constituencyFundsData.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-10">No financial data available.</p>
                  ) : (
                    <div className="w-full overflow-hidden">
                      <div className="flex justify-center">
                        <div className="h-56 w-full">
                          <ResponsiveContainer width="100%" height={224}>
                            <BarChart
                              data={constituencyFundsData}
                              margin={{ top: 24, right: 10, left: -14, bottom: 16 }}
                              barGap={6}
                              barCategoryGap="12%"
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis
                                dataKey="wardShort"
                                tick={renderWardXAxisTick}
                                interval={0}
                                height={38}
                                axisLine={{ stroke: '#cbd5e1' }}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{ fontSize: 10, fill: '#64748b' }}
                                tickFormatter={v => v === 0 ? '0' : v >= 1000000 ? `${Math.round(v / 1000000)}M` : `${Math.round(v / 1000)}k`}
                                axisLine={{ stroke: '#cbd5e1' }}
                                tickLine={false}
                              />
                              <Tooltip content={<ConstituencyFundsTooltip />} />
                              <Bar
                                dataKey="disbursed"
                                name="Amount Disbursed"
                                fill="#2563eb"
                                radius={[3, 3, 0, 0]}
                                maxBarSize={44}
                                minPointSize={(val: any) => (!val || Number(val) <= 0 ? 0 : 28)}
                              >
                                <LabelList
                                  dataKey="disbursed"
                                  content={(props: any) => renderFundsBarTopLabel(props, '#1d4ed8')}
                                />
                              </Bar>
                              <Bar
                                dataKey="utilised"
                                name="Amount Utilised"
                                fill="#016630"
                                radius={[3, 3, 0, 0]}
                                maxBarSize={44}
                                minPointSize={(val: any) => (!val || Number(val) <= 0 ? 0 : 28)}
                              >
                                <LabelList
                                  dataKey="utilised"
                                  content={(props: any) => renderFundsBarTopLabel(props, '#016630')}
                                />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Legend below the graph */}
                      <div className="flex items-center justify-center gap-6 mt-3 pt-2.5 border-t border-gray-100">
                        <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                          <span className="w-2.5 h-2.5 rounded-xs bg-[#2563eb] inline-block" />
                          <span>Amount Disbursed</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                          <span className="w-2.5 h-2.5 rounded-xs bg-[#016630] inline-block" />
                          <span>Amount Utilised</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* Monitor Activity Trend (commented out)
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Monitor Activity Trend</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={activityData} margin={{ left: -20 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="updates" stroke="#145a32" strokeWidth={2} dot={false} name="Updates" />
                      <Line type="monotone" dataKey="visits" stroke="#00cc00" strokeWidth={2} dot={false} name="Site Visits" />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              */}
              {/* Completed projects list */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Completed Projects</p>
                {sharedProjects.filter(p => p.status === 'Completed').length === 0
                  ? <p className="text-sm text-gray-400">No completed projects yet.</p>
                  : <div className="space-y-2">{sharedProjects.filter(p => p.status === 'Completed').map(p => (
                    <div key={p.id} className="flex items-center gap-3 py-2 border-b border-gray-50">
                      <CheckIcon size={16} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.id} / {p.ward} / {p.actualCompletion || 'Completion date not set'}</p>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                  ))}</div>
                }
              </div>
            </div>
          )}

          {/* PROJECTS */}
          {section === 'projects' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Projects & Initiatives</h2>
                  <p className="text-sm text-gray-500">{totalProjectsCount} projects / {totalInitiativesCount} initiatives / {completed} completed / {ongoing} ongoing</p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                  <button
                    onClick={() => setModal({ kind: 'new-project', defaultType: 'New Project' })}
                    className="flex items-center gap-1.5 bg-[#145a32] text-white px-3.5 py-2 rounded-xl text-sm font-semibold hover:bg-[#0f4424] transition-colors shadow-xs cursor-pointer"
                  >
                    <Plus size={15} /> Add New Project
                  </button>
                  <button
                    onClick={() => setModal({ kind: 'new-project', defaultType: 'New Initiative' })}
                    className="flex items-center gap-1.5 bg-white border border-[#145a32] text-[#145a32] hover:bg-green-50/70 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors shadow-xs cursor-pointer"
                  >
                    <Plus size={15} /> Add New Initiative
                  </button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <div className="relative flex-1 min-w-0">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#145a32]" placeholder="Search by name or ID..." value={projSearch} onChange={e => setProjSearch(e.target.value)} />
                </div>
                <div className="relative w-full sm:w-auto min-w-0 max-w-full">
                  <select
                    className="appearance-none border border-gray-200 rounded-xl pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#145a32] bg-white text-gray-800 font-medium cursor-pointer w-full max-w-full truncate"
                    value={projComponent}
                    onChange={e => setProjComponent(e.target.value)}
                  >
                    {['All Components', ...CDF_COMPONENTS, ...INITIATIVE_COMPONENTS].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                <div className="relative w-full sm:w-auto min-w-0 max-w-full">
                  <select className="appearance-none border border-gray-200 rounded-xl pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#145a32] bg-white text-gray-800 font-medium cursor-pointer w-full max-w-full truncate" value={projStatus} onChange={e => setProjStatus(e.target.value)}>
                    {['All','Ongoing','Completed','Not Started','Near Completion','Approved','Assessed','Proposed','Suspended'].map(s => <option key={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div className="hidden md:block bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="min-w-max w-full text-sm">
                  <thead><tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-100">
                    {['ID','Project Name','Sector','Ward','Status','Progress','Budget','Actions'].map(h => <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {filteredProjects.map(p => {
                      const prog = p.status==='Completed'?100:p.status==='Not Started'||p.status==='Proposed'||p.status==='Assessed'?0:p.status==='Near Completion'?Math.max(p.progress,80):p.progress;
                      return (
                        <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{p.id}</td>
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{p.name}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{p.sector}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{p.ward}</td>
                          <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={p.status} /></td>
                          <td className="px-4 py-3 w-36"><div className="flex items-center gap-1.5"><ProgressBar value={prog} /><span className="text-xs text-gray-500 whitespace-nowrap">{prog}%</span></div></td>
                          <td className="px-4 py-3 text-gray-700 text-xs whitespace-nowrap">{formatMK(p.budget)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <button onClick={() => setModal({ kind: 'view-project', project: p })} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Eye size={14} /></button>
                              <button onClick={() => setModal({ kind: 'edit-project', project: p })} className="p-1.5 text-gray-400 hover:text-[#145a32] hover:bg-green-50 rounded-lg"><Edit2 size={14} /></button>
                              <button onClick={() => deleteProject(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                {filteredProjects.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No projects match your filters.</div>}
              </div>
              <div className="md:hidden space-y-3">
                {filteredProjects.map(p => {
                  const prog = p.status==='Completed'?100:p.status==='Not Started'||p.status==='Proposed'||p.status==='Assessed'?0:p.progress;
                  return (
                    <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div><p className="font-semibold text-gray-900 text-sm">{p.name}</p><p className="text-xs text-gray-400 font-mono">{p.id} / {p.sector}</p></div>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="flex items-center gap-1.5 mb-2"><ProgressBar value={prog} /><span className="text-xs text-gray-500">{prog}%</span></div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">{formatMK(p.budget)}</span>
                        <div className="flex gap-3">
                          <button onClick={() => setModal({ kind: 'edit-project', project: p })} className="text-xs text-[#145a32] font-semibold">Edit</button>
                          <button onClick={() => deleteProject(p.id)} className="text-xs text-red-500 font-semibold">Delete</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* WARD STATUS PHOTOS */}
          {section === 'wardPhotos' && (
            <div className="max-w-6xl mx-auto">
              <div className="mb-5 space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-gray-900 leading-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    Update Projects Status
                  </h2>
                  {wardStatusSubTab === 'photos' && (
                    <button
                      onClick={() => setModal({ kind: 'upload-ward-photo' })}
                      className="flex items-center gap-1.5 sm:gap-2 bg-[#145a32] text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold hover:bg-[#0f4424] shrink-0 whitespace-nowrap cursor-pointer shadow-xs transition-colors active:scale-[0.99]"
                    >
                      <Plus size={16} className="shrink-0" />
                      <span className="whitespace-nowrap">Upload Photo</span>
                    </button>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-gray-500">
                  Update progress percentages of projects or initiatives in wards after receiving and approving reports from monitors of that ward, or manage ward tracking status photos.
                </p>
              </div>

              {/* Sub-tab Navigation */}
              <div className="flex items-center gap-2 border-b border-gray-200 mb-5 overflow-x-auto no-scrollbar scrollbar-none pb-1">
                <button
                  type="button"
                  onClick={() => setWardStatusSubTab('progress')}
                  className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
                    wardStatusSubTab === 'progress'
                      ? 'border-[#145a32] text-[#145a32]'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <SlidersHorizontal size={15} className="shrink-0" />
                  <span className="whitespace-nowrap">Ward Projects & Initiatives Progress</span>
                  <span
                    className="text-[11px] px-2 py-0.5 text-white font-bold whitespace-nowrap shrink-0"
                    style={{ borderRadius: '0.2rem', backgroundColor: '#145a32' }}
                  >
                    {sharedProjects.filter(p => submissions.some(s => s.status === 'Approved' && (s.projectId === p.id || s.projectName.toLowerCase() === p.name.toLowerCase() || (p.ward && s.ward === p.ward)))).length} Verified
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setWardStatusSubTab('photos')}
                  className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
                    wardStatusSubTab === 'photos'
                      ? 'border-[#145a32] text-[#145a32]'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Camera size={15} className="shrink-0" />
                  <span className="whitespace-nowrap">Ward Status Photos & Gallery</span>
                  <span
                    className="text-[11px] px-2 py-0.5 text-white font-bold whitespace-nowrap shrink-0"
                    style={{ borderRadius: '0.2rem', backgroundColor: '#145a32' }}
                  >
                    {localWardPhotos.length} Photos
                  </span>
                </button>
              </div>

              {/* Filters & Search Toolbar */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 shadow-xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {/* Search */}
                  <div className="relative lg:col-span-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                    <input
                      type="text"
                      placeholder="Search photo, project, caption..."
                      value={wardPhotoSearch}
                      onChange={e => setWardPhotoSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#145a32]"
                    />
                  </div>

                  {/* Constituency */}
                  <div>
                    <select
                      value={wardPhotoConstituency}
                      onChange={e => {
                        setWardPhotoConstituency(e.target.value);
                        setWardPhotoWard('All');
                      }}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#145a32] bg-white"
                    >
                      <option value="All">All Constituencies</option>
                      {wardPhotoConstituencyOptions.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Ward */}
                  <div>
                    <select
                      value={wardPhotoWard}
                      onChange={e => setWardPhotoWard(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#145a32] bg-white"
                    >
                      <option value="All">All Wards</option>
                      {wardPhotoWardOptions.map(w => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>

                  {/* Category */}
                  <div>
                    <select
                      value={wardPhotoCategory}
                      onChange={e => setWardPhotoCategory(e.target.value as 'All' | 'Project' | 'Initiative')}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#145a32] bg-white"
                    >
                      <option value="All">All Categories</option>
                      <option value="Project">Project</option>
                      <option value="Initiative">Initiative</option>
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <select
                      value={wardPhotoStatus}
                      onChange={e => setWardPhotoStatus(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#145a32] bg-white"
                    >
                      <option value="All">All Tracking Statuses</option>
                      <option value="Proposed">Proposed</option>
                      <option value="Assessed">Assessed</option>
                      <option value="Ongoing">Ongoing</option>
                      <option value="Near Completion">Near Completion</option>
                      <option value="Completed">Completed</option>
                      <option value="Suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                {/* Quick Status Pill Filters & Reset */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-gray-500 mr-1">Quick Status:</span>
                    {['All', 'Proposed', 'Assessed', 'Ongoing', 'Near Completion', 'Completed'].map(st => (
                      <button
                        key={st}
                        onClick={() => setWardPhotoStatus(st)}
                        className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium transition-colors cursor-pointer ${
                          wardPhotoStatus === st
                            ? 'bg-[#145a32] text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  {(wardPhotoSearch || wardPhotoConstituency !== 'All' || wardPhotoWard !== 'All' || wardPhotoCategory !== 'All' || wardPhotoStatus !== 'All') && (
                    <button
                      onClick={() => {
                        setWardPhotoSearch('');
                        setWardPhotoConstituency('All');
                        setWardPhotoWard('All');
                        setWardPhotoCategory('All');
                        setWardPhotoStatus('All');
                      }}
                      className="text-xs text-[#145a32] font-semibold hover:underline cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              </div>

              {/* SECTION: WARD PROJECTS & INITIATIVES PROGRESS TRACKER */}
              {wardStatusSubTab === 'progress' && (
                <div className="space-y-4">
                  {/* Info Banner */}
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Ward Field Progress Management</h3>
                      <p className="text-xs text-gray-500">
                        Progress percentages can be updated after receiving and approving verified inspection reports from a monitor of that ward.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs flex-nowrap shrink-0 overflow-x-auto">
                      <span className="px-2.5 py-1 rounded-lg bg-white text-gray-700 font-semibold border border-gray-200 shadow-2xs flex items-center gap-1.5 whitespace-nowrap shrink-0">
                        <CheckCircle size={13} className="text-[#145a32] shrink-0" />
                        Approved Reports: {submissions.filter(s => s.status === 'Approved').length}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-white text-gray-700 font-semibold border border-gray-200 shadow-2xs flex items-center gap-1.5 whitespace-nowrap shrink-0">
                        <Clock size={13} className="text-gray-400 shrink-0" />
                        Pending Review: {submissions.filter(s => s.status === 'Pending Review').length}
                      </span>
                    </div>
                  </div>

                  {/* Project Cards Grid */}
                  {(() => {
                    const projectsToDisplay = sharedProjects.filter(item => {
                      const matchSearch = !wardPhotoSearch ||
                        item.name?.toLowerCase().includes(wardPhotoSearch.toLowerCase()) ||
                        item.id?.toLowerCase().includes(wardPhotoSearch.toLowerCase()) ||
                        item.ward?.toLowerCase().includes(wardPhotoSearch.toLowerCase()) ||
                        item.sector?.toLowerCase().includes(wardPhotoSearch.toLowerCase());
                      const matchConstituency = wardPhotoConstituency === 'All' ||
                        item.constituency?.toLowerCase() === wardPhotoConstituency.toLowerCase() ||
                        (wardPhotoConstituency === 'Likoma Island' && (item.constituency === 'Chizumulu Island' || item.constituency === 'Likoma Island'));
                      const matchWard = wardPhotoWard === 'All' ||
                        item.ward?.toLowerCase() === wardPhotoWard.toLowerCase() ||
                        (item.ward && wardPhotoWard && (
                          item.ward.toLowerCase().includes(wardPhotoWard.toLowerCase().replace(/\s*ward/i, '')) ||
                          wardPhotoWard.toLowerCase().includes(item.ward.toLowerCase().replace(/\s*ward/i, ''))
                        ));
                      const matchCategory = wardPhotoCategory === 'All' ||
                        (wardPhotoCategory === 'Initiative' ? isInitiative(item) : !isInitiative(item));
                      const matchStatus = wardPhotoStatus === 'All' ||
                        item.status?.toLowerCase() === wardPhotoStatus.toLowerCase();
                      return matchSearch && matchConstituency && matchWard && matchCategory && matchStatus;
                    });

                    if (projectsToDisplay.length === 0) {
                      return (
                        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-500 text-sm">
                          <AlertCircle size={28} className="mx-auto text-gray-400 mb-2" />
                          <p className="font-semibold text-gray-700">No projects or initiatives match the selected criteria.</p>
                          <p className="text-xs text-gray-400 mt-1">Try resetting your search query or filters above.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {projectsToDisplay.map(p => {
                          const isInit = isInitiative(p);
                          const projSubs = submissions.filter(s =>
                            s.projectId === p.id ||
                            s.projectName.toLowerCase() === p.name.toLowerCase() ||
                            (p.ward && s.ward === p.ward)
                          );
                          const approvedSub = projSubs.find(s => s.status === 'Approved');
                          const pendingSub = projSubs.find(s => s.status === 'Pending Review');
                          const hasApprovedReport = !!approvedSub;
                          const curProg = editingWardProgress[p.id] ?? p.progress;

                          // Collect all photos associated with this project / initiative
                          const projectPhotos: string[] = Array.from(new Set([
                            ...(p.photos || []),
                            ...localWardPhotos
                              .filter(wp => wp.projectId === p.id || (wp.projectName && p.name && wp.projectName.toLowerCase() === p.name.toLowerCase()))
                              .map(wp => wp.url || wp.photoUrl || '')
                              .filter(Boolean),
                            ...(approvedSub?.photos || []),
                            ...projSubs
                              .filter(s => s.status === 'Approved' && s.photos)
                              .flatMap(s => s.photos || [])
                          ])).filter(Boolean);

                          return (
                            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs flex flex-col justify-between gap-3 transition-all hover:shadow-md">
                              <div>
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isInit ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                      {isInit ? 'Initiative' : 'Project'}
                                    </span>
                                    <span className="text-[11px] font-semibold text-gray-500">{p.id}</span>
                                    <span className="text-[11px] text-gray-400">{p.sector}</span>
                                  </div>
                                  <StatusBadge status={p.status} />
                                </div>

                                <h4 className="text-sm font-bold text-gray-900 leading-snug mb-1">{p.name}</h4>
                                <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-3 flex-wrap">
                                  <MapPin size={12} className="text-gray-400 shrink-0" />
                                  <span>{p.ward} ({p.constituency})</span>
                                  <span>Monitor: <strong className="text-gray-700">{p.monitor || 'Unassigned'}</strong></span>
                                </p>

                                {/* Current Progress Bar */}
                                <div className="space-y-1 mb-3">
                                  <div className="flex justify-between text-xs font-semibold">
                                    <span className="text-gray-600">Current Progress</span>
                                    <span className="text-[#145a32]">{p.progress}%</span>
                                  </div>
                                  <ProgressBar value={p.progress} />
                                </div>

                                {/* Project Site & Milestone Photos Gallery */}
                                <div className="bg-gray-50/80 border border-gray-100 rounded-xl p-3 mb-3">
                                  <div className="flex items-center justify-between gap-1 mb-2">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                                      <Camera size={13} className="text-[#145a32]" />
                                      <span>{isInit ? 'Initiative' : 'Project'} Site Photos</span>
                                      <span className="text-[10px] font-normal text-gray-500 bg-white px-1.5 py-0.5 rounded-full border border-gray-200">
                                        {projectPhotos.length}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setModal({
                                          kind: 'upload-ward-photo',
                                          defaultWard: p.ward,
                                          defaultStatus: p.status,
                                          defaultCategory: isInit ? 'Initiative' : 'Project',
                                          defaultProjectId: p.id,
                                        })}
                                        className="flex items-center gap-1 text-[11px] font-semibold text-[#145a32] hover:text-[#0f4424] bg-white hover:bg-green-50/60 px-2 py-1 rounded-lg border border-green-200 transition-colors cursor-pointer"
                                        title="Upload new status photo"
                                      >
                                        <UploadCloud size={12} />
                                        <span>Add Photo</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setModal({ kind: 'edit-project', project: p })}
                                        className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 px-2 py-1 rounded-lg border border-gray-200 transition-colors cursor-pointer"
                                        title="Manage project and all photos"
                                      >
                                        <Edit2 size={11} />
                                        <span>Manage</span>
                                      </button>
                                    </div>
                                  </div>

                                  {projectPhotos.length > 0 ? (
                                    <div className="grid grid-cols-4 gap-2">
                                      {projectPhotos.slice(0, 4).map((photoUrl, idx) => {
                                        const matchingPhoto = localWardPhotos.find(wp => (wp.url === photoUrl || wp.photoUrl === photoUrl) && wp.projectId === p.id) || {
                                          id: `view-${p.id}-${idx}`,
                                          ward: p.ward,
                                          constituency: p.constituency || 'Likoma Island',
                                          photoUrl: photoUrl,
                                          url: photoUrl,
                                          caption: `${isInit ? 'Initiative' : 'Project'} photo: ${p.name}`,
                                          status: p.status,
                                          category: isInit ? 'Initiative' as const : 'Project' as const,
                                          projectId: p.id,
                                          projectName: p.name,
                                          uploadedAt: p.lastUpdated || '2026-03-01',
                                          date: p.lastUpdated || '2026-03-01',
                                        };

                                        return (
                                          <div
                                            key={idx}
                                            onClick={() => setModal({ kind: 'view-ward-photo', photo: matchingPhoto })}
                                            className="relative group aspect-video rounded-lg overflow-hidden border border-gray-200 bg-gray-100 cursor-pointer shadow-2xs hover:opacity-95"
                                            title="Click to view full photo details"
                                          >
                                            <img src={photoUrl} alt={`${p.name} photo ${idx + 1}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                            {idx === 3 && projectPhotos.length > 4 && (
                                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-bold">
                                                +{projectPhotos.length - 3}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-[11px] text-gray-400 italic py-1">
                                      No site photos uploaded yet. Click &quot;Add Photo&quot; to upload verified milestone photos.
                                    </p>
                                  )}
                                </div>

                                {/* Report & Progress Control Section */}
                                {hasApprovedReport ? (
                                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs space-y-2.5">
                                    <div className="flex items-center justify-between gap-1 flex-wrap text-gray-700">
                                      <span className="font-semibold flex items-center gap-1 text-gray-700">
                                        <CheckCircle size={14} className="text-[#145a32]" />
                                        Approved Report
                                      </span>
                                      <span className="text-[11px] text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                                        {approvedSub.progress}% reported by {approvedSub.monitorName}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 italic bg-white p-2 rounded-lg border border-gray-200">
                                      "{approvedSub.observation}"
                                    </p>

                                    {/* Interactive Progress Adjustment */}
                                    <div className="bg-white rounded-lg p-3 border border-gray-200 space-y-2">
                                      <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                                        <span>Adjust Progress Percentage:</span>
                                        <span className="text-gray-700 font-bold text-sm bg-gray-50 px-2 py-0.5 rounded border border-gray-200">{curProg}%</span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <input
                                          type="range"
                                          min={0}
                                          max={100}
                                          value={curProg}
                                          onChange={e => setEditingWardProgress(prev => ({ ...prev, [p.id]: Number(e.target.value) }))}
                                          className="flex-1 accent-[#145a32] cursor-pointer"
                                        />
                                        <input
                                          type="number"
                                          min={0}
                                          max={100}
                                          value={curProg}
                                          onChange={e => setEditingWardProgress(prev => ({ ...prev, [p.id]: Math.max(0, Math.min(100, Number(e.target.value))) }))}
                                          className="w-16 px-2 py-1 text-xs border border-gray-200 rounded text-center font-bold text-gray-700"
                                        />
                                      </div>
                                      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 pt-1">
                                        <div className="flex items-center gap-1 flex-wrap justify-center xl:justify-start">
                                          <span className="text-[10px] text-gray-500">Quick set:</span>
                                          {[25, 50, 75, 100].map(val => (
                                            <button
                                              key={val}
                                              type="button"
                                              onClick={() => setEditingWardProgress(prev => ({ ...prev, [p.id]: val }))}
                                              className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 cursor-pointer transition-colors"
                                            >
                                              {val}%
                                            </button>
                                          ))}
                                        </div>
                                        <div className="flex justify-center xl:justify-end w-full xl:w-auto">
                                          <button
                                            type="button"
                                            onClick={() => saveWardProjectProgress(p, curProg, approvedSub)}
                                            className="px-3.5 py-1.5 bg-[#145a32] hover:bg-[#0f4424] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                                          >
                                            <Save size={13} className="text-white" />
                                            <span className="text-white">Save Progress</span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ) : pendingSub ? (
                                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs space-y-2">
                                    <div className="flex items-center justify-between gap-1 flex-wrap text-gray-700">
                                      <span className="font-semibold flex items-center gap-1">
                                        <Clock size={14} className="text-[#145a32]" />
                                        Pending Monitor Report
                                      </span>
                                      <span className="text-[11px] text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                                        {pendingSub.progress}% reported
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-gray-500">
                                      Submitted by monitor <strong className="text-gray-700">{pendingSub.monitorName}</strong> on {pendingSub.date}. Review and approve this report to confirm and apply the progress percentage.
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => setModal({ kind: 'review-submission', submission: pendingSub, action: 'approve' })}
                                      className="w-full py-1.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                                    >
                                      <CheckCircle size={13} className="text-[#145a32]" />
                                      <span>Review & Approve Report ({pendingSub.progress}%)</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs space-y-2">
                                    <div className="flex items-center justify-between gap-1 flex-wrap text-gray-700">
                                      <span className="font-semibold flex items-center gap-1">
                                        <AlertCircle size={14} className="text-gray-400" />
                                        Awaiting Ward Monitor Field Report
                                      </span>
                                      <span className="text-[11px] text-gray-500">{p.ward}</span>
                                    </div>
                                    <p className="text-[11px] text-gray-500">
                                      Progress percentage can be modified after receiving and approving a field verification report from the monitor of this ward.
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setModal({
                                          kind: 'schedule-visit',
                                        });
                                      }}
                                      className="w-full py-1.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                                    >
                                      <CalendarCheck size={13} className="text-[#145a32]" />
                                      <span>Schedule Ward Field Inspection</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Photo Cards Carousel */}
              {wardStatusSubTab === 'photos' && (() => {
                const photosToDisplay = localWardPhotos.filter(item => {
                  const matchSearch = !wardPhotoSearch ||
                    item.caption?.toLowerCase().includes(wardPhotoSearch.toLowerCase()) ||
                    item.projectName?.toLowerCase().includes(wardPhotoSearch.toLowerCase()) ||
                    item.ward?.toLowerCase().includes(wardPhotoSearch.toLowerCase());
                  const matchConstituency = wardPhotoConstituency === 'All' ||
                    item.constituency?.toLowerCase() === wardPhotoConstituency.toLowerCase() ||
                    (wardPhotoConstituency === 'Likoma Island' && (item.constituency === 'Chizumulu Island' || item.constituency === 'Likoma Island'));
                  const matchWard = wardPhotoWard === 'All' ||
                    item.ward?.toLowerCase() === wardPhotoWard.toLowerCase() ||
                    (item.ward && wardPhotoWard && (
                      item.ward.toLowerCase().includes(wardPhotoWard.toLowerCase().replace(/\s*ward/i, '')) ||
                      wardPhotoWard.toLowerCase().includes(item.ward.toLowerCase().replace(/\s*ward/i, ''))
                    ));
                  const matchCategory = wardPhotoCategory === 'All' || item.category === wardPhotoCategory;
                  const matchStatus = wardPhotoStatus === 'All' || item.status === wardPhotoStatus;
                  return matchSearch && matchConstituency && matchWard && matchCategory && matchStatus;
                });

                if (photosToDisplay.length === 0) {
                  return (
                    <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-xs">
                      <div className="w-14 h-14 rounded-full bg-emerald-50 text-[#145a32] flex items-center justify-center mx-auto mb-3">
                        <ImageIcon size={28} />
                      </div>
                      <h3 className="text-base font-bold text-gray-800 mb-1">No Status Photos Found</h3>
                      <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
                        No tracking status photos match your active search or filters. Try adjusting your filters or upload a new photo.
                      </p>
                      <button
                        onClick={() => setModal({
                          kind: 'upload-ward-photo',
                          defaultWard: wardPhotoWard !== 'All' ? wardPhotoWard : undefined,
                          defaultStatus: wardPhotoStatus !== 'All' ? wardPhotoStatus : undefined,
                          defaultCategory: wardPhotoCategory !== 'All' ? wardPhotoCategory : undefined,
                        })}
                        className="inline-flex items-center gap-2 bg-[#145a32] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#0f4424] cursor-pointer"
                      >
                        <Plus size={15} /> Upload Photo
                      </button>
                    </div>
                  );
                }

                // Desktop: 2 slides in a row; Mobile/Tablet: 1 slide in a row centered
                const desktopSlides: WardStatusPhoto[][] = [];
                for (let i = 0; i < photosToDisplay.length; i += 2) {
                  desktopSlides.push(photosToDisplay.slice(i, i + 2));
                }
                const mobileSlides: WardStatusPhoto[][] = photosToDisplay.map(p => [p]);

                const prevSlide = () => {
                  setWardPhotoDesktopSlide(s => (s - 1 + desktopSlides.length) % (desktopSlides.length || 1));
                  setWardPhotoMobileSlide(s => (s - 1 + mobileSlides.length) % (mobileSlides.length || 1));
                };

                const nextSlide = () => {
                  setWardPhotoDesktopSlide(s => (s + 1) % (desktopSlides.length || 1));
                  setWardPhotoMobileSlide(s => (s + 1) % (mobileSlides.length || 1));
                };

                const renderPhotoCard = (photo: WardStatusPhoto) => (
                  <div
                    key={photo.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full"
                  >
                    {/* Photo with Overlay Badges */}
                    <div className="relative h-52 bg-gray-100 overflow-hidden group">
                      <img
                        src={photo.url}
                        alt={photo.caption}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.src.includes('photo-1590486803833')) {
                            target.src = 'https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?auto=format&fit=crop&w=1000&q=80';
                          }
                        }}
                      />
                      {/* Top Badges */}
                      <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1 pointer-events-none">
                        <StatusBadge status={photo.status} />
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 text-white shadow-xs"
                          style={{ background: '#145a32', borderRadius: '0.2rem' }}
                        >
                          {photo.ward}
                        </span>
                      </div>

                      {/* Hover Actions */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={() => setModal({ kind: 'view-ward-photo', photo })}
                          className="px-3 py-1.5 bg-white text-gray-800 text-xs font-semibold rounded-lg shadow hover:bg-gray-100 cursor-pointer flex items-center gap-1.5"
                        >
                          <Maximize2 size={13} /> View Full
                        </button>
                        <button
                          onClick={() => setModal({ kind: 'upload-ward-photo', initialPhoto: photo })}
                          className="px-3 py-1.5 bg-[#145a32] text-white text-xs font-semibold rounded-lg shadow hover:bg-[#0f4424] cursor-pointer flex items-center justify-center"
                        >
                          Change Picture
                        </button>
                      </div>
                    </div>

                    {/* Card Body - monitor name removed */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                          <CategoryBadge category={photo.category} className="text-[10px] px-2 py-0.5" />
                          {photo.projectName && (
                            <span className="text-[10px] font-medium text-gray-500 truncate max-w-[200px]" title={photo.projectName}>
                              {photo.projectName}
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-bold text-gray-900 leading-snug line-clamp-2 mb-2" title={photo.caption}>
                          {photo.caption}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-gray-100 mb-3">
                          <span className="font-medium text-gray-700">{photo.ward}</span>
                          <span className="flex-shrink-0 text-gray-400">{photo.date}</span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => setModal({ kind: 'upload-ward-photo', initialPhoto: photo })}
                            className="flex-1 flex items-center justify-center text-xs font-semibold text-white bg-[#145a32] hover:bg-[#0f4424] py-1.5 px-2.5 rounded-lg transition-colors cursor-pointer shadow-xs active:scale-[0.99]"
                          >
                            Change Picture
                          </button>
                          <button
                            onClick={() => setModal({ kind: 'upload-ward-photo', initialPhoto: photo })}
                            className="text-xs text-gray-500 hover:text-gray-800 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                          <button
                            onClick={() => deleteWardStatusPhoto(photo.id)}
                            className="text-xs text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete photo"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );

                const currentDesktopIndex = Math.min(wardPhotoDesktopSlide, Math.max(0, desktopSlides.length - 1));
                const currentMobileIndex = Math.min(wardPhotoMobileSlide, Math.max(0, mobileSlides.length - 1));

                return (
                  <div className="space-y-4">
                    {/* Carousel Header Controls & Counter */}
                    <div className="flex items-center justify-between px-1">
                      <div className="text-xs font-medium text-gray-500">
                        <span className="hidden lg:inline">
                          Showing slide {desktopSlides.length > 0 ? currentDesktopIndex + 1 : 0} of {desktopSlides.length}
                        </span>
                        <span className="lg:hidden">
                          Showing slide {mobileSlides.length > 0 ? currentMobileIndex + 1 : 0} of {mobileSlides.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={prevSlide}
                          disabled={photosToDisplay.length <= 1}
                          className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
                          aria-label="Previous slide"
                          title="Previous slide"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          onClick={nextSlide}
                          disabled={photosToDisplay.length <= 1}
                          className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
                          aria-label="Next slide"
                          title="Next slide"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Desktop view: two slides in a row */}
                    <div className="hidden lg:grid lg:grid-cols-2 gap-5 items-stretch">
                      {desktopSlides[currentDesktopIndex]?.map(renderPhotoCard)}
                      {(desktopSlides[currentDesktopIndex]?.length ?? 0) === 1 && <div className="invisible" />}
                    </div>

                    {/* Mobile and tablet view: a single slide in a row while on center */}
                    <div className="lg:hidden flex justify-center w-full">
                      <div className="w-full max-w-md mx-auto">
                        {mobileSlides[currentMobileIndex]?.map(renderPhotoCard)}
                      </div>
                    </div>

                    {/* Carousel navigation indicators */}
                    {photosToDisplay.length > 1 && (
                      <div className="flex justify-center items-center gap-1.5 pt-2">
                        {/* Desktop indicators */}
                        <div className="hidden lg:flex items-center gap-1.5">
                          {desktopSlides.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setWardPhotoDesktopSlide(i)}
                              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                                currentDesktopIndex === i ? 'w-6 bg-[#145a32]' : 'w-2 bg-gray-200 hover:bg-gray-300'
                              }`}
                              aria-label={`Go to slide ${i + 1}`}
                            />
                          ))}
                        </div>
                        {/* Mobile and tablet indicators */}
                        <div className="lg:hidden flex items-center gap-1.5 flex-wrap max-w-xs justify-center">
                          {mobileSlides.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setWardPhotoMobileSlide(i)}
                              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                                currentMobileIndex === i ? 'w-5 bg-[#145a32]' : 'w-1.5 bg-gray-200 hover:bg-gray-300'
                              }`}
                              aria-label={`Go to slide ${i + 1}`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* MONITORS */}
          {section === 'monitors' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Field Monitors</h2>
                  <p className="text-sm text-gray-500">{localMonitors.filter(m => m.status === 'Active').length} active monitors</p>
                </div>
                <button onClick={() => setModal({ kind: 'add-monitor' })} className="flex items-center gap-2 bg-[#145a32] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#0f4424] self-start sm:self-auto shadow-sm">
                  <Plus size={16} /> Add Monitor
                </button>
              </div>

              <div className="relative mb-4">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#145a32]" placeholder="Search monitors..." value={monSearch} onChange={e => setMonSearch(e.target.value)} />
              </div>
              <div className="hidden md:block bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-100">
                    {['Monitor','Contact','Wards','Projects','Reports','Status','Actions'].map(h => <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {filteredMonitors.map(m => (
                      <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {(() => { const mu = users.find(u => u.monitorId === m.id); return mu?.photoUrl ? (
                              <img src={mu.photoUrl} alt={m.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-200" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                                <Contact size={14} className="text-gray-400" />
                              </div>
                            ); })()}
                            <div><p className="font-semibold text-gray-900">{m.name}</p></div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><p className="text-xs text-gray-600">{m.email}</p><p className="text-xs text-gray-400">{m.phone}</p></td>
                        <td className="px-4 py-3 text-xs text-gray-600">{m.wards}</td>
                        <td className="px-4 py-3 text-center text-sm text-gray-700">{m.assignedProjects}</td>
                        <td className="px-4 py-3 text-xs text-gray-600"><span className="text-green-600 font-semibold">{m.approved}</span> / {m.submitted}</td>
                        <td className="px-4 py-3"><span className="text-xs font-semibold px-2.5 py-0.5 text-white" style={{ background: m.status === 'Active' ? '#016630' : '#dc2626', borderRadius: '0.2rem' }}>{m.status}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => setModal({ kind: 'send-credentials', monitor: m })} className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg" title="Send Login Credentials via Email"><KeyRound size={14} /></button>
                            <button onClick={() => setModal({ kind: 'edit-monitor', monitor: m })} className="p-1.5 text-gray-400 hover:text-[#145a32] hover:bg-green-50 rounded-lg" title="Edit Monitor"><Edit2 size={14} /></button>
                            <button onClick={() => toggleMonitorStatus(m)} className={`p-1.5 rounded-lg ${m.status === 'Active' ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`} title={m.status === 'Active' ? 'Deactivate' : 'Reactivate'}>
                              {m.status === 'Active' ? <XCircle size={14} /> : <CheckCircle size={14} />}
                            </button>
                            <button onClick={() => { setSection('schedule'); setVisitFilter('All'); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Schedule visit"><Calendar size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden space-y-3">
                {filteredMonitors.map(m => (
                  <div key={m.id} className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {(() => { const mu = users.find(u => u.monitorId === m.id); return mu?.photoUrl ? (
                          <img src={mu.photoUrl} alt={m.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-gray-200" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                            <Contact size={16} className="text-gray-400" />
                          </div>
                        ); })()}
                        <div><p className="font-semibold text-gray-900 text-sm">{m.name}</p><p className="text-xs text-gray-400">{m.email}</p></div>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-0.5 text-white" style={{ background: m.status === 'Active' ? '#016630' : '#dc2626', borderRadius: '0.2rem' }}>{m.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{m.wards}</p>
                    <div className="flex flex-wrap gap-2.5 pt-1 border-t border-gray-50">
                      <button onClick={() => setModal({ kind: 'send-credentials', monitor: m })} className="text-xs text-emerald-700 font-semibold flex items-center gap-1"><KeyRound size={12} /> Send Credentials</button>
                      <button onClick={() => setModal({ kind: 'edit-monitor', monitor: m })} className="text-xs text-[#145a32] font-semibold">Edit</button>
                      <button onClick={() => toggleMonitorStatus(m)} className={`text-xs font-semibold ${m.status === 'Active' ? 'text-red-500' : 'text-green-600'}`}>{m.status === 'Active' ? 'Deactivate' : 'Reactivate'}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SCHEDULE VISITS */}
          {section === 'schedule' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Schedule Monitor Visits</h2>
                  <p className="text-sm text-gray-500">{visits.length} total / {visits.filter(v=>v.status==='Upcoming').length} upcoming / {missedVisits} missed</p>
                </div>
                <button onClick={() => setModal({ kind: 'schedule-visit' })} className="flex items-center gap-2 bg-[#145a32] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#0f4424] self-start sm:self-auto">
                  <Plus size={16} /> Schedule Visit
                </button>
              </div>

              {missedVisits > 0 && (
                <div className="bg-red-600 rounded-2xl p-4 flex items-start gap-3 mb-4">
                  <AlertTriangle size={18} className="text-white flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-white">{missedVisits} Missed Visit{missedVisits > 1 ? 's' : ''}</p>
                    <p className="text-xs text-white/90 mt-0.5">These monitors did not complete their scheduled visits. Use the Re-schedule button to set a new date and notify them.</p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-4">
                {['All','Upcoming','Acknowledged','Completed','Missed','Rescheduled'].map(f => (
                  <button key={f} onClick={() => setVisitFilter(f)} style={{ borderRadius: '0.2rem' }} className={`px-3 py-1.5 text-xs font-semibold transition-colors ${visitFilter===f ? 'bg-[#145a32] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{f}</button>
                ))}
              </div>

              <div className="hidden md:block bg-white rounded-2xl border border-gray-100 overflow-x-auto">
                <table className="min-w-max w-full text-sm">
                  <thead><tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-100">
                    {['Visit ID','Monitor','Project','Ward','Date','Time','Status','Actions'].map(h => <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {filteredVisits.map(v => (
                      <tr key={v.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${v.status==='Missed' ? 'bg-red-50/40' : ''}`}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{v.id}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 text-sm whitespace-nowrap">{v.monitorName}</td>
                        <td className="px-4 py-3 text-gray-700 text-xs whitespace-nowrap">{v.projectName}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{v.ward}</td>
                        <td className="px-4 py-3 text-gray-700 text-xs whitespace-nowrap">{v.date}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{v.time}</td>
                        <td className="px-4 py-3 whitespace-nowrap"><VisitStatusPill status={v.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {v.status === 'Missed' && (
                              <button onClick={() => setModal({ kind: 'reschedule-visit', visit: v })} className="flex items-center gap-1 text-xs bg-amber-500 text-white px-2 py-1 rounded-lg font-semibold hover:bg-amber-600 whitespace-nowrap">
                                <RefreshCw size={11} /> Re-schedule
                              </button>
                            )}
                            {v.acknowledgedAt && <span className="text-[10px] text-gray-400 whitespace-nowrap">Ack: {v.acknowledgedAt.slice(0,10)}</span>}
                            {v.rescheduledFrom && <span className="text-[10px] text-purple-500 whitespace-nowrap">Was: {v.rescheduledFrom}</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredVisits.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No visits match this filter.</div>}
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {filteredVisits.map(v => (
                  <div key={v.id} className={`bg-white rounded-xl border p-4 ${v.status==='Missed' ? 'border-red-200 bg-red-50/30' : 'border-gray-100'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{v.projectName}</p>
                        <p className="text-xs text-gray-500">{v.monitorName} / {v.id}</p>
                      </div>
                      <VisitStatusPill status={v.status} />
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{v.date} at {v.time} / {v.ward}</p>
                    {v.notes && <p className="text-xs text-gray-600 mb-2 leading-relaxed">{v.notes}</p>}
                    {v.status === 'Missed' && (
                      <button onClick={() => setModal({ kind: 'reschedule-visit', visit: v })} className="flex items-center gap-1 text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-amber-600">
                        <RefreshCw size={11} /> Re-schedule Visit
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MONITOR REPORTS */}
          {section === 'monitorReports' && (
            <div className="max-w-5xl mx-auto">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Monitor Field Reports</h2>
                <p className="text-sm text-gray-500">{pendingReports} pending review / {submissions.length} total submissions</p>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {['All','Pending Review','Approved','Returned'].map(f => (
                  <button key={f} onClick={() => setSubFilter(f)} style={{ borderRadius: '0.2rem' }} className={`px-3 py-1.5 text-xs font-semibold transition-colors ${subFilter===f ? 'bg-[#145a32] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                    {f}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {filteredSubmissions.map(s => (
                  <div key={s.id} className={`bg-white rounded-2xl border p-5 ${s.status==='Pending Review' ? 'border-amber-200' : 'border-gray-100'}`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{s.projectName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{s.monitorName} / {s.id} / {s.date}</p>
                      </div>
                      <SubStatusPill status={s.status} />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                      {[
                        ['Progress', `${s.progress}%`],
                        ['Photos Attached', `${s.photos?.length ?? s.photoCount}`],
                        ['GPS', s.gpsLat ? `${s.gpsLat}, ${s.gpsLng}` : 'Not captured'],
                      ].map(([l, v]) => (
                        <div key={l} className="bg-gray-50 rounded-xl p-2">
                          <p className="text-[10px] text-gray-400 font-semibold uppercase">{l}</p>
                          <p className="text-xs text-gray-800 font-medium mt-0.5 truncate">{v}</p>
                        </div>
                      ))}
                    </div>
                    {/* Photo thumbnails */}
                    {s.photos && s.photos.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-600 mb-2">Site Photos ({s.photos.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {s.photos.map((photo, idx) => (
                            <button key={idx} onClick={() => setPhotoLightbox(photo)} className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 hover:opacity-90 transition-opacity border border-gray-200">
                              <img src={photo} alt={`Site photo ${idx + 1}`} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {s.progress === 100 && s.status !== 'Approved' && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-2.5 mb-3">
                        <p className="text-xs font-semibold text-green-700">100% progress reported - approving this will auto-mark the project as Completed.</p>
                      </div>
                    )}
                    <p className="text-sm text-gray-700 leading-relaxed mb-3">{s.observation}</p>
                    {/* Admin Note - editable */}
                    {(s.adminNote || s.status !== 'Pending Review') && editNoteId === s.id ? (
                      <div className={`rounded-xl p-3 mb-3 border ${s.status==='Returned' ? 'bg-red-600 border-red-600' : 'bg-green-50 border-green-100'}`}>
                        <p className={`text-xs font-semibold mb-2 ${s.status==='Returned' ? 'text-white' : 'text-green-700'}`}>Edit Admin Note:</p>
                        <textarea
                          rows={3}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#145a32] bg-white"
                          value={editNoteText}
                          onChange={e => setEditNoteText(e.target.value)}
                        />
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => saveEditedNote(s.id)} className="text-xs bg-[#145a32] text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-[#0f4424]">Save Note</button>
                          <button onClick={() => { setEditNoteId(null); setEditNoteText(''); }} className="text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">Cancel</button>
                        </div>
                      </div>
                    ) : s.adminNote ? (
                      <div className={`rounded-xl p-3 mb-3 ${s.status==='Returned' ? 'bg-red-600' : 'bg-green-50 border border-green-100'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-semibold mb-1 ${s.status==='Returned' ? 'text-white' : 'text-green-700'}`}>
                            Admin Note:
                          </p>
                          <button onClick={() => { setEditNoteId(s.id); setEditNoteText(s.adminNote); }} className={`text-[10px] flex items-center gap-0.5 flex-shrink-0 ${s.status==='Returned' ? 'text-white hover:text-gray-100' : 'text-gray-500 hover:text-[#145a32]'}`}>
                            <Edit2 size={10} className={s.status==='Returned' ? 'text-white' : ''} /> Edit
                          </button>
                        </div>
                        <p className={`text-xs ${s.status==='Returned' ? 'text-white' : 'text-green-800'}`}>{s.adminNote}</p>
                      </div>
                    ) : null}
                    <div className="flex gap-2 flex-wrap">
                      {s.status === 'Pending Review' && (
                        <>
                          <button onClick={() => setModal({ kind: 'review-submission', submission: s, action: 'approve' })} className="flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-green-700">
                            <CheckCircle size={12} /> Approve
                          </button>
                          <button onClick={() => setModal({ kind: 'review-submission', submission: s, action: 'return' })} className="flex items-center gap-1.5 text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-amber-600">
                            <RefreshCw size={12} /> Return for Correction
                          </button>
                        </>
                      )}
                      {s.status !== 'Pending Review' && !s.adminNote && (
                        <button onClick={() => { setEditNoteId(s.id); setEditNoteText(''); }} className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-gray-200">
                          <Edit2 size={12} /> Add Note
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {filteredSubmissions.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No submissions match this filter.</div>}
              </div>
            </div>
          )}

          {/* FEEDBACK */}
          {section === 'feedback' && (
            <div className="max-w-4xl mx-auto">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Citizen Feedback</h2>
                <p className="text-sm text-gray-500">{unresolved} pending / {localFeedback.length} total</p>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {['All','Received','Under Review','Verification Requested','Resolved'].map(f => (
                  <button key={f} onClick={() => setFbFilter(f)} style={{ borderRadius: '0.2rem' }} className={`px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${fbFilter===f ? 'bg-[#145a32] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{f}</button>
                ))}
              </div>
              <div className="space-y-3">
                {filteredFeedback.map(f => (
                  <div key={f.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0"><p className="font-semibold text-gray-900 text-sm">{f.type}</p><p className="text-xs text-gray-500 truncate">{f.id} / {f.project} / {f.date}</p></div>
                      <div className="flex-shrink-0"><FbPill status={f.status} /></div>
                    </div>
                    <p className="text-sm text-gray-700 mb-3">{f.message}</p>
                    {f.status !== 'Resolved' && f.status !== 'Rejected' && (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => resolveFb(f.id)} className="flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-green-700">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="white" fillOpacity="0.25"/><path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Mark Resolved
                        </button>
                        {f.status !== 'Under Review' && (
                          <button onClick={() => reviewFb(f.id)} className="flex items-center gap-1 text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-amber-600">
                            <RefreshCw size={12} /> Under Review
                          </button>
                        )}
                        {f.status !== 'Verification Requested' && (
                          <button onClick={() => verifyFb(f.id)} className="flex items-center gap-1 text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-purple-700">
                            <AlertCircle size={12} /> Request Verification
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {filteredFeedback.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No feedback items match the filter.</div>}
              </div>
            </div>
          )}

          {/* REPORTS */}
          {/* ANALYTICS */}
          {section === 'analytics' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Analytics</h2>
                  <p className="text-sm text-gray-500 flex items-center gap-1.5">
                    How citizens are using the Council Yanga Portal
                    {isLiveDb ? (
                      <span className="text-emerald-700 font-semibold">Live data, all visitors</span>
                    ) : (
                      <span className="text-amber-600 font-semibold">(demo data — offline mode)</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex bg-gray-100 rounded-xl p-1 text-xs font-semibold">
                    {([[7,'7D'],[14,'14D'],[30,'30D'],[0,'All']] as [7|14|30|0,string][]).map(([d,l]) => (
                      <button key={l} onClick={() => setAnalyticsRange(d)}
                        className={`px-3 py-1.5 rounded-lg transition-colors ${analyticsRange === d ? 'bg-white text-[#145a32] shadow-sm' : 'text-gray-500'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <button onClick={refreshAnalytics} disabled={analyticsLoading} className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 px-3 py-2 rounded-xl font-semibold hover:bg-gray-200 disabled:opacity-60"><RefreshCw size={13} className={analyticsLoading ? 'animate-spin' : ''} /> {analyticsLoading ? 'Refreshing…' : 'Refresh'}</button>
                  <div className="relative" ref={analyticsExportRef}>
                    <div className="inline-flex rounded-xl shadow-xs overflow-hidden">
                      <button
                        type="button"
                        onClick={doExportAnalyticsCSV}
                        className="flex items-center gap-1.5 text-xs bg-[#145a32] text-white px-3 py-2 font-semibold hover:bg-[#0f4424] transition-colors cursor-pointer"
                        title="Export analytics as CSV"
                      >
                        <Download size={13} /> Export
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnalyticsExportMenu(prev => !prev)}
                        className="flex items-center justify-center px-2 py-2 text-xs bg-[#104828] text-white hover:bg-[#0c391f] border-l border-emerald-800 transition-colors cursor-pointer"
                        title="More export formats"
                      >
                        <ChevronDown size={12} className={analyticsExportMenu ? 'rotate-180 transition-transform' : 'transition-transform'} />
                      </button>
                    </div>
                    {analyticsExportMenu && (
                      <div className="absolute right-0 mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-30 text-xs">
                        <button
                          type="button"
                          onClick={() => { doExportAnalyticsCSV(); setAnalyticsExportMenu(false); }}
                          className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-emerald-50 text-gray-700 hover:text-[#145a32] font-medium cursor-pointer"
                        >
                          <Download size={13} className="text-emerald-700" /> Export CSV
                        </button>
                        <button
                          type="button"
                          onClick={() => { doExportAnalyticsExcel(); setAnalyticsExportMenu(false); }}
                          className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-emerald-50 text-gray-700 hover:text-[#145a32] font-medium cursor-pointer"
                        >
                          <Download size={13} className="text-green-700" /> Export Excel
                        </button>
                        <button
                          type="button"
                          onClick={() => { doExportAnalyticsPDF(); setAnalyticsExportMenu(false); }}
                          className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-emerald-50 text-gray-700 hover:text-[#016630] font-medium cursor-pointer"
                        >
                          <FileText size={13} className="text-[#016630]" style={{ color: '#016630' }} /> Export PDF
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { if (window.confirm(isLiveDb ? 'Permanently delete all analytics data for every visitor? This cannot be undone.' : 'Clear all locally stored analytics data? This cannot be undone.')) handleClearAnalytics(); }}
                    className="flex items-center gap-1.5 text-xs bg-red-600 text-white px-3 py-2 rounded-xl font-semibold hover:bg-red-700 transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} className="text-white" /> Clear Data
                  </button>
                </div>
              </div>

              {/* KPI row */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <MiniStat label="Total Visitors" value={visitorStats.totalVisitors} icon={<Users size={24} />} />
                <MiniStat label="New Visitors" value={visitorStats.newVisitors} icon={<UserCheck size={24} />} />
                <MiniStat label="Returning" value={visitorStats.returningVisitors} icon={<RefreshCw size={24} />} />
                <MiniStat label="Sessions" value={visitorStats.totalSessions} icon={<Activity size={24} />} />
                <MiniStat label="Events / Session" value={visitorStats.avgEventsPerSession} icon={<TrendingUp size={24} />} />
              </div>

              {/* Traffic trend */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Traffic Trend (unique visitors / day)</p>
                <div className="h-56 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trafficTrend} margin={{ top: 8, right: 16, left: -15, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="visitors" name="Visitors" stroke="#145a32" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="events" name="Events" stroke="#2563eb" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* Tab views */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 md:col-span-1">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Page/Tab Views</p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tabViews} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="tab" tick={{ fontSize: 10 }} width={80} />
                        <Tooltip />
                        <Bar dataKey="views" fill="#145a32" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                {/* Device breakdown */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Devices</p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={deviceBreakdown} cx="50%" cy="50%" innerRadius={42} outerRadius={75} dataKey="value">
                          {deviceBreakdown.map((_, i) => <Cell key={i} fill={PCOLORS[i % PCOLORS.length]} />)}
                        </Pie>
                        <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                {/* Language breakdown */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Language</p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={languageBreakdown} cx="50%" cy="50%" innerRadius={42} outerRadius={75} dataKey="value">
                          {languageBreakdown.map((_, i) => <Cell key={i} fill={PCOLORS[(i + 2) % PCOLORS.length]} />)}
                        </Pie>
                        <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* Traffic sources */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100"><p className="text-sm font-semibold text-gray-700">Traffic Sources</p></div>
                  <div className="p-4 space-y-2.5">
                    {trafficSources.length === 0 && <p className="text-xs text-gray-400">No data yet.</p>}
                    {trafficSources.map(s => {
                      const max = trafficSources[0]?.value || 1;
                      return (
                        <div key={s.name}>
                          <div className="flex justify-between text-xs mb-1"><span className="text-gray-600">{s.name}</span><span className="font-semibold text-gray-800">{s.value}</span></div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#145a32] rounded-full" style={{ width: `${(s.value / max) * 100}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Top projects viewed */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100"><p className="text-sm font-semibold text-gray-700">Most Viewed Projects</p></div>
                  <div className="divide-y divide-gray-50">
                    {topProjectsViewed.length === 0 && <p className="text-xs text-gray-400 p-4">No data yet.</p>}
                    {topProjectsViewed.map((p, i) => (
                      <div key={p.label} className="flex items-center justify-between px-4 py-2.5 text-xs">
                        <span className="text-gray-700 truncate pr-2">{i + 1}. {p.label}</span>
                        <span className="font-semibold text-gray-900 whitespace-nowrap">{p.count} views</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Top documents */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100"><p className="text-sm font-semibold text-gray-700">Most Downloaded Documents</p></div>
                  <div className="divide-y divide-gray-50">
                    {topDocuments.length === 0 && <p className="text-xs text-gray-400 p-4">No data yet.</p>}
                    {topDocuments.map((d, i) => (
                      <div key={d.label} className="flex items-center justify-between px-4 py-2.5 text-xs">
                        <span className="text-gray-700 truncate pr-2">{i + 1}. {d.label}</span>
                        <span className="font-semibold text-gray-900 whitespace-nowrap">{d.count} downloads</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Feedback funnel */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Feedback Conversion</p>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex-1 w-full grid grid-cols-3 gap-3">
                    <MiniStat label="Feedback Tab Views" value={feedbackFunnel.started} icon={<Eye size={22} />} />
                    <MiniStat label="Forms Submitted" value={feedbackFunnel.submitted} icon={<CheckCircle2 size={22} />} />
                    <MiniStat label="Conversion Rate" value={`${feedbackFunnel.rate}%`} icon={<TrendingUp size={22} />} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === 'reports' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Reports</h2>
                  <p className="text-sm text-gray-500">CDF Project Summary - 2025/2026</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={doPDF} className="flex items-center gap-1.5 text-xs bg-red-600 text-white px-3 py-2 rounded-xl font-semibold hover:bg-red-700"><FileText size={13} /> Export PDF</button>
                  <button onClick={doExcel} className="flex items-center gap-1.5 text-xs bg-green-700 text-white px-3 py-2 rounded-xl font-semibold hover:bg-green-800"><Download size={13} /> Export Excel</button>
                  <button onClick={doCSV} className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-2 rounded-xl font-semibold hover:bg-blue-700"><Download size={13} /> Export CSV</button>
                </div>
              </div>
              <div className="mb-3">
                <h3 className="text-base font-bold text-gray-700" style={{ fontFamily: 'Outfit, sans-serif' }}>Project Portfolio Summary</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <MiniStat label="Total Projects" value={sharedProjects.length} icon={<FolderKanban size={24} />} />
                <MiniStat label="Completed" value={completed} icon={<CheckCircle2 size={24} />} />
                <MiniStat label="Total Funds Allocation" value="MK 5BN" icon={<Wallet size={24} />} />
                <MiniStat label="Beneficiaries" value={totalBeneficiaries.toLocaleString()} icon={<Users size={24} />} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Status Distribution</p>
                  <div className="h-60 sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(sharedProjects.reduce<Record<string,number>>((acc,p)=>{acc[p.status]=(acc[p.status]||0)+1;return acc;},{})).map(([name,value])=>({name,value}))}
                          cx="50%" cy="50%" innerRadius={48} outerRadius={82} dataKey="value"
                        >
                          {sharedProjects.reduce<string[]>((acc,p)=>acc.includes(p.status)?acc:[...acc,p.status],[]).map((_,i)=><Cell key={i} fill={PCOLORS[i%PCOLORS.length]} />)}
                        </Pie>
                        <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Budget by Sector (MK M)</p>
                  <div className="overflow-x-auto pb-1">
                    <div className="h-56 min-w-[500px] w-full">
                      <ResponsiveContainer width="100%" height={224}>
                        <BarChart data={SECTORS.map(s=>({sector:s.substring(0,8),budget:sharedProjects.filter(p=>p.sector===s).reduce((t,p)=>t+p.budget,0)/1000000})).filter(d=>d.budget>0)} margin={{ top: 8, right: 16, left: -15, bottom: 25 }}>
                          <XAxis dataKey="sector" tick={{ fontSize: 10 }} interval={0} height={30} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v)=>[`MK ${Number(v).toFixed(1)}M`]} />
                          <Bar dataKey="budget" name="Budget" fill="#145a32" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100"><p className="text-sm font-semibold text-gray-700">Full Project List</p></div>
                <div className="overflow-x-auto">
                  <table className="min-w-max w-full text-xs">
                    <thead><tr className="bg-gray-50 text-gray-500 border-b border-gray-100">
                      {['ID','Project Name','Sector','Ward','Status','Progress','Budget','Beneficiaries','Monitor'].map(h => <th key={h} className="text-left px-3 py-2.5 font-medium whitespace-nowrap">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {sharedProjects.map(p => (
                        <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{p.id}</td>
                          <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{p.name}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{p.sector}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{p.ward}</td>
                          <td className="px-3 py-2 whitespace-nowrap"><StatusBadge status={p.status} /></td>
                          <td className="px-3 py-2 whitespace-nowrap">{p.status==='Completed'?100:p.progress}%</td>
                          <td className="px-3 py-2 whitespace-nowrap">{formatMK(p.budget)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{p.beneficiaries.toLocaleString()}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{p.monitor || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* AUDIT */}
          {section === 'audit' && (
            <div className="max-w-5xl mx-auto">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Audit Trail</h2>
                <p className="text-sm text-gray-500">All system activity log</p>
              </div>
              <div className="relative mb-4">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#145a32]" placeholder="Search audit log..." value={auditSearch} onChange={e => setAuditSearch(e.target.value)} />
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-max w-full text-xs">
                    <thead><tr className="bg-gray-50 text-gray-500 border-b border-gray-100">
                      {['Date','Time','User','Action','Target','Before','After'].map(h => <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {filteredAudit.map(a => (
                        <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{a.date}</td>
                          <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{a.time}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-700 whitespace-nowrap">{a.user}</td>
                          <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{a.action}</td>
                          <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{a.target}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">{a.oldValue && <span className="px-2 py-0.5 text-white text-xs font-semibold" style={{ background: '#00cc00', borderRadius: '0.2rem' }}>{a.oldValue}</span>}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">{a.newValue && <span className="px-2 py-0.5 text-white text-xs font-semibold" style={{ background: '#00cc00', borderRadius: '0.2rem' }}>{a.newValue}</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredAudit.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No entries match your search.</div>}
              </div>
            </div>
          )}

          {/* ANNOUNCEMENTS */}
          {section === 'announcements' && (
            <div className="max-w-4xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Announcements</h2>
                  <p className="text-sm text-gray-500">{localAnnouncements.filter(a => a.published).length} published</p>
                </div>
                <button onClick={() => setModal({ kind: 'new-announcement' })} className="flex items-center gap-2 bg-[#145a32] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#0f4424] self-start sm:self-auto">
                  <Plus size={16} /> New Announcement
                </button>
              </div>
              <div className="space-y-4">
                {localAnnouncements.map(a => (
                  <div key={a.id} className={`bg-white rounded-2xl border p-5 ${!a.published ? 'border-gray-200 opacity-60' : 'border-gray-100'}`}>
                    <div className="flex items-start gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-xs font-semibold px-2.5 py-0.5 text-white" style={{ background: '#00cc00', borderRadius: '0.2rem' }}>{a.category}</span>
                          {!a.published && <span className="text-xs font-semibold px-2.5 py-0.5 bg-gray-200 text-gray-500" style={{ borderRadius: '0.2rem' }}>Unpublished</span>}
                        </div>
                        <h3 className="font-bold text-gray-900 text-sm">{a.title}</h3>
                        <p className="text-xs text-gray-400">{a.date}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-4 leading-relaxed line-clamp-3">{a.body}</p>
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => setModal({ kind: 'edit-announcement', announcement: a })} className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-gray-200">
                        <Edit2 size={12} /> Edit
                      </button>
                      <button onClick={() => togglePublished(a)} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold ${a.published ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                        {a.published ? <><XCircle size={12} /> Unpublish</> : <><CheckCircle size={12} /> Republish</>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {modal?.kind === 'new-project' && <ProjectModal initialAddType={modal.defaultType} onSave={saveProject} onClose={() => setModal(null)} monitorList={localMonitors} />}
      {modal?.kind === 'edit-project' && <ProjectModal initial={modal.project} onSave={saveProject} onClose={() => setModal(null)} monitorList={localMonitors} />}
      {modal?.kind === 'view-project' && (
        <Modal title={modal.project.name} onClose={() => setModal(null)}>
          <div className="space-y-3">
            {[
              ['ID', modal.project.id],
              ['Type / Initiative', modal.project.projectType || 'CDF'],
              ['Component', modal.project.component || 'Community Development Project'],
              ...(modal.project.initiativeName ? [['Initiative Name', modal.project.initiativeName]] : []),
              ...(modal.project.initiativeComponent ? [['Initiative Component', modal.project.initiativeComponent]] : []),
              ['Region', modal.project.region || 'Northern'],
              ['District', modal.project.district || 'Likoma'],
              ['Constituency', modal.project.constituency],
              ['Ward', modal.project.ward],
              ['Sector', modal.project.sector],
              ['Status', modal.project.status],
              ['Progress', `${modal.project.progress}%`],
              ['Location', modal.project.location],
              ['Budget', formatMK(modal.project.budget)],
              ['Beneficiaries', modal.project.beneficiaries.toLocaleString()],
              ['Beneficiary Type', getProjectBeneficiaryType(modal.project)],
              ['Contractor', modal.project.contractor],
              ['Monitor', modal.project.monitor],
              ['Expected Completion', modal.project.expectedCompletion],
              ['Actual Completion', modal.project.actualCompletion],
            ].map(([l, v]) => (
              <div key={l} className="flex gap-2"><span className="text-xs text-gray-500 w-36 flex-shrink-0 pt-0.5">{l}</span><span className="text-xs text-gray-900 font-medium">{String(v||'—')}</span></div>
            ))}
            {modal.project.description && <div><p className="text-xs text-gray-500 mb-1">Description</p><p className="text-xs text-gray-700 bg-gray-50 rounded-lg p-3">{modal.project.description}</p></div>}
            {modal.project.photos && modal.project.photos.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5 font-semibold">Attached Project Photos ({modal.project.photos.length})</p>
                <div className="grid grid-cols-3 gap-2">
                  {modal.project.photos.map((ph, idx) => (
                    <a key={idx} href={ph} target="_blank" rel="noreferrer" className="aspect-video rounded-xl overflow-hidden border border-gray-200 block hover:opacity-90 transition-opacity bg-gray-50">
                      <img src={ph} alt={`Project photo ${idx + 1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button onClick={() => setModal({ kind: 'edit-project', project: modal.project })} className="flex items-center gap-1.5 text-sm bg-[#145a32] text-white px-4 py-2 rounded-xl font-semibold hover:bg-[#0f4424]">
                <Edit2 size={14} /> Edit Project
              </button>
            </div>
          </div>
        </Modal>
      )}
      {modal?.kind === 'add-monitor' && (
        <MonitorModal
          onSave={saveMonitor}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'edit-monitor' && (
        <MonitorModal
          initial={modal.monitor}
          existingUser={users.find(u => u.monitorId === modal.monitor.id || u.email.toLowerCase() === modal.monitor.email.toLowerCase())}
          onSave={saveMonitor}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'send-credentials' && (
        <SendCredentialsModal
          monitor={modal.monitor}
          existingUser={users.find(u => u.monitorId === modal.monitor.id || u.email.toLowerCase() === modal.monitor.email.toLowerCase())}
          onSend={handleSendCredentials}
          onClose={() => setModal(null)}
        />
      )}
      {credentialSent && (
        <CredentialSentModal
          data={credentialSent}
          onClose={() => setCredentialSent(null)}
          onResend={async () => {
            const m = localMonitors.find(mon => mon.email.toLowerCase() === credentialSent.monitorEmail.toLowerCase());
            if (m) {
              await handleSendCredentials(m, credentialSent.password);
            }
          }}
        />
      )}
      {modal?.kind === 'new-announcement' && <AnnouncementModal onSave={saveAnnouncement} onClose={() => setModal(null)} />}
      {modal?.kind === 'edit-announcement' && <AnnouncementModal initial={modal.announcement} onSave={saveAnnouncement} onClose={() => setModal(null)} />}
      {modal?.kind === 'schedule-visit' && <ScheduleVisitModal onSave={scheduleVisit} onClose={() => setModal(null)} monitorList={localMonitors} projectList={sharedProjects} />}
      {modal?.kind === 'reschedule-visit' && <ScheduleVisitModal onSave={(data) => rescheduleVisit(modal.visit, data)} onClose={() => setModal(null)} monitorList={localMonitors} projectList={sharedProjects} prefill={modal.visit} />}
      {modal?.kind === 'review-submission' && (
        <SubmissionReviewModal
          sub={modal.submission}
          action={modal.action}
          project={sharedProjects.find(p => p.id === modal.submission.projectId || p.name.toLowerCase() === modal.submission.projectName.toLowerCase())}
          onConfirm={(note, progress, fundsUsed) =>
            modal.action === 'approve'
              ? approveSubmission(modal.submission, note, progress, fundsUsed)
              : returnSubmission(modal.submission, note)
          }
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'upload-ward-photo' && (
        <WardStatusPhotoModal
          initial={modal.initialPhoto}
          defaultWard={modal.defaultWard}
          defaultStatus={modal.defaultStatus}
          defaultCategory={modal.defaultCategory}
          defaultProjectId={modal.defaultProjectId}
          projects={sharedProjects}
          onSave={saveWardStatusPhoto}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'view-ward-photo' && (
        <WardPhotoLightboxModal
          photo={modal.photo}
          onClose={() => setModal(null)}
          onEdit={(p) => setModal({ kind: 'upload-ward-photo', initialPhoto: p })}
        />
      )}
      {modal?.kind === 'confirm' && <ConfirmDialog message={modal.message} onConfirm={modal.action} onCancel={() => setModal(null)} />}

      {/* Monitor added popup */}
      {monitorPopup && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[101] w-full max-w-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-green-200 overflow-hidden">
            <div className="bg-[#145a32] px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="none" stroke="white" strokeWidth="2"/><path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <p className="text-white font-semibold text-sm">Monitor Added</p>
              <button onClick={() => setMonitorPopup(null)} className="ml-auto text-white/70 hover:text-white"><X size={16} /></button>
            </div>
            <div className="px-4 py-4 space-y-3">
              <p className="text-sm text-gray-700"><span className="font-semibold">{monitorPopup.name}</span> has been added as a Field Monitor.</p>
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-gray-600"><Mail size={12} className="text-[#145a32]" /> <span className="font-semibold">{monitorPopup.email}</span></div>
                <div className="flex items-start gap-2 text-xs text-gray-600">
                  <CheckCircle size={12} className="text-[#145a32] mt-0.5 flex-shrink-0" />
                  <span>Ward assignment: <span className="font-semibold">{monitorPopup.wards || 'To be assigned'}</span></span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                <Mail size={13} className="text-blue-500 flex-shrink-0" />
                <p className="text-xs text-blue-700">
                  Email notification sent to <span className="font-semibold">{monitorPopup.email}</span> with ward assignment details.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo lightbox */}
      {photoLightbox && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4" onClick={() => setPhotoLightbox(null)}>
          <div className="relative max-w-3xl w-full max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={photoLightbox} alt="Site photo" className="w-full h-full object-contain rounded-2xl shadow-2xl" style={{ maxHeight: '85vh' }} />
            <button onClick={() => setPhotoLightbox(null)} className="absolute top-3 right-3 bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
