import { useState } from 'react';
import { Lock, Eye, EyeOff, KeyRound } from 'lucide-react';
import { CheckIcon } from '@/components/shared';
import { updatePasswordAfterRecovery } from '@/lib/supabaseAuth';

interface Props {
  /** Called once the user is done (either password saved, or they bail out). */
  onDone: () => void;
}

/**
 * Shown when the app detects it was opened from a Supabase "reset password"
 * email link (a `PASSWORD_RECOVERY` auth event / `type=recovery` redirect).
 * This is the piece that was previously missing: without it, the emailed
 * link had nowhere to go and the password was never actually changed.
 */
export default function PasswordRecoveryModal({ onDone }: Props) {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    const { success, error: err } = await updatePasswordAfterRecovery(newPassword);
    setLoading(false);
    if (!success) { setError(err || 'Failed to update password.'); return; }
    setDone(true);
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        {!done ? (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-green-50 border border-green-100 flex items-center justify-center">
                <KeyRound size={18} className="text-[#145a32]" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base" style={{ fontFamily: 'Outfit, sans-serif' }}>Set New Password</h3>
                <p className="text-xs text-gray-400">Choose a new password for your account</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type={showNew ? 'text' : 'password'} required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password (min. 6 chars)"
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#145a32] transition" />
                <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type={showConfirm ? 'text' : 'password'} required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm new password"
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#145a32] transition" />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading} className="w-full py-2.5 text-sm bg-[#145a32] text-white font-semibold rounded-xl hover:bg-[#0f4424] disabled:opacity-60">
                {loading ? 'Saving…' : 'Save Password'}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <CheckIcon size={40} className="mx-auto mb-3" />
            <h3 className="font-bold text-gray-900 text-base mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>Password Updated</h3>
            <p className="text-sm text-gray-500 mb-5">You can now log in with your new password.</p>
            <button onClick={onDone} className="w-full py-2.5 text-sm bg-[#145a32] text-white font-semibold rounded-xl hover:bg-[#0f4424]">Back to Login</button>
          </div>
        )}
      </div>
    </div>
  );
}
