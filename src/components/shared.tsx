import { type ReactNode, useState, useEffect } from 'react';
import { Banknote, Scale } from 'lucide-react';
import logoImg from '@/imports/Council_Yanga_Logo-1.png';
export { PartnerLogo } from './PartnerLogo';

export function Logo({ className = 'h-10' }: { className?: string }) {
  return (
    <img
      src={logoImg}
      alt="Council Yanga"
      className={`${className} w-auto object-contain flex-shrink-0`}
    />
  );
}

export const STATUS_BG: Record<string, string> = {
  Completed: '#145a32',
  Ongoing: '#145a32',
  'Near Completion': '#145a32',
  'Not Started': '#145a32',
  Proposed: '#145a32',
  Assessed: '#145a32',
  Approved: '#145a32',
  Suspended: '#145a32',
  'On Hold': '#145a32',
  Stalled: '#145a32',
  Active: '#145a32',
  Inactive: '#145a32',
  Published: '#145a32',
};

export function StatusBadge({ status }: { status: string }) {
  const bg = STATUS_BG[status] ?? '#145a32';
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold text-white whitespace-nowrap"
      style={{ background: bg, borderRadius: '0.2rem' }}
    >
      {status}
    </span>
  );
}

export function WardBadge({ ward, className = '' }: { ward: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold text-white whitespace-nowrap ${className}`}
      style={{ background: '#145a32', borderRadius: '0.2rem' }}
    >
      {ward}
    </span>
  );
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const color =
    value === 100
      ? 'bg-green-500'
      : value >= 75
        ? 'bg-emerald-500'
        : value >= 40
          ? 'bg-blue-500'
          : 'bg-gray-400';
  return (
    <div className={`w-full bg-gray-200 rounded-full h-1.5 ${className}`}>
      <div className={`${color} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${value}%` }} />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  accent?: string;
  sub?: string;
}

export function StatCard({ label, value, icon, sub }: StatCardProps) {
  const valStr = String(value);
  const isLong = valStr.length > 10;
  return (
    <div className="flex flex-col items-center justify-center text-center gap-1.5 p-3 sm:p-4 shadow-sm" style={{ background: '#016630', borderRadius: '0.2rem', minHeight: '110px' }}>
      <div className="text-white flex items-center justify-center">{icon}</div>
      <p className={`${isLong ? 'text-base sm:text-lg xl:text-xl' : 'text-xl sm:text-2xl'} font-black text-white leading-tight tracking-tight`} style={{ fontFamily: 'Outfit, sans-serif' }}>
        {value}
      </p>
      <p className="text-[11px] font-semibold text-white/90 leading-tight">{label}</p>
      {sub && <p className="text-[10px] text-white/75">{sub}</p>}
    </div>
  );
}

interface DisbursedAndBalanceKpiCardProps {
  disbursedValue: string | number;
  balanceValue: string | number;
  disbursedLabel?: string;
  balanceLabel?: string;
  balanceSub?: string;
  minHeight?: string;
}

export function DisbursedAndBalanceKpiCard({
  disbursedValue,
  balanceValue,
  disbursedLabel = 'Total Funds Disbursed',
  balanceLabel = 'Total Aggregated Balance',
  balanceSub,
  minHeight = '110px',
}: DisbursedAndBalanceKpiCardProps) {
  const [viewMode, setViewMode] = useState<'disbursed' | 'balance'>('disbursed');
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setViewMode(prev => (prev === 'disbursed' ? 'balance' : 'disbursed'));
        setFade(true);
      }, 350);
    }, 15000); // 15 seconds delay

    return () => clearInterval(timer);
  }, []);

  const handleManualToggle = () => {
    setFade(false);
    setTimeout(() => {
      setViewMode(prev => (prev === 'disbursed' ? 'balance' : 'disbursed'));
      setFade(true);
    }, 200);
  };

  const isBalance = viewMode === 'balance';
  const valStr = String(isBalance ? balanceValue : disbursedValue);
  const isLong = valStr.length > 10;

  return (
    <div
      onClick={handleManualToggle}
      className={`relative cursor-pointer transition-all duration-350 transform shadow-sm select-none ${
        fade ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
      style={{
        borderRadius: '0.2rem',
        minHeight,
        background: isBalance ? '#ffffff' : '#016630',
        border: isBalance ? '2px solid #145a32' : '2px solid transparent',
      }}
      title="Click to toggle between Total Funds Disbursed and Total Aggregated Balance"
    >
      <div className="flex flex-col items-center justify-center text-center gap-1 p-3 sm:p-4 h-full">
        {/* Icon */}
        <div className="flex items-center justify-center">
          {isBalance ? (
            <Scale size={26} style={{ color: '#145a32' }} />
          ) : (
            <Banknote size={26} className="text-white" />
          )}
        </div>

        {/* Value */}
        <p
          className={`${isLong ? 'text-base sm:text-lg xl:text-xl' : 'text-xl sm:text-2xl'} font-black leading-tight tracking-tight`}
          style={{
            fontFamily: 'Outfit, sans-serif',
            color: isBalance ? '#145a32' : '#ffffff',
          }}
        >
          {isBalance ? balanceValue : disbursedValue}
        </p>

        {/* Label */}
        <p
          className="text-[11px] font-semibold leading-tight"
          style={{ color: isBalance ? '#145a32' : 'rgba(255, 255, 255, 0.9)' }}
        >
          {isBalance ? balanceLabel : disbursedLabel}
        </p>

        {/* Subtitle / ward indication */}
        {isBalance && balanceSub && (
          <p
            className="text-[10px] leading-tight font-medium"
            style={{ color: '#145a32', opacity: 0.85 }}
          >
            {balanceSub}
          </p>
        )}

        {/* Dual indicators for 15-second cycle */}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className={`h-1.5 rounded-full transition-all duration-300 ${
              !isBalance
                ? 'w-4 bg-white'
                : 'w-1.5 bg-[#145a32]/40'
            }`}
          />
          <span
            className={`h-1.5 rounded-full transition-all duration-300 ${
              isBalance
                ? 'w-4 bg-[#145a32]'
                : 'w-1.5 bg-white/40'
            }`}
          />
        </div>
      </div>
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-bold text-gray-900 mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>{children}</h2>;
}

interface CardProps { children: ReactNode; className?: string }

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded-2xl border border-green-100 shadow-sm p-4 ${className}`}>
      {children}
    </div>
  );
}

export function FeedbackStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Received: '#2563eb',
    'Under Review': '#d97706',
    'Verification Requested': '#7c3aed',
    Resolved: '#016630',
    Rejected: '#dc2626',
  };
  const bg = colors[status] ?? '#6b7280';
  return (
    <span
      className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 text-white whitespace-nowrap"
      style={{ background: bg, borderRadius: '0.2rem' }}
    >
      {status}
    </span>
  );
}

export function AnnouncementCategoryBadge({ category }: { category: string }) {
  return (
    <span
      className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 text-white whitespace-nowrap"
      style={{ background: '#016630', borderRadius: '0.2rem' }}
    >
      {category}
    </span>
  );
}

export function CategoryBadge({ category, className = '' }: { category: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 text-white whitespace-nowrap ${className}`}
      style={{ background: '#145a32', borderRadius: '0.2rem' }}
    >
      {category}
    </span>
  );
}

export function CheckIcon({ size = 20, variant = 'green', className = '' }: { size?: number; variant?: 'green' | 'white'; className?: string }) {
  const circleFill = variant === 'white' ? 'rgba(255,255,255,0.18)' : '#22c55e';
  const stroke = 'white';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="12" cy="12" r="12" fill={circleFill} />
      <path d="M6.5 12.5l3.8 3.8 7.2-8" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EmptyState({ icon, message }: { icon: ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <div className="mb-3 opacity-40">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function ThreeDotsLoading({
  className = '',
  dotColor = 'bg-white',
  size = 'w-2 h-2',
}: {
  className?: string;
  dotColor?: string;
  size?: string;
}) {
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className={`${size} rounded-full ${dotColor}`}
          style={{
            animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
