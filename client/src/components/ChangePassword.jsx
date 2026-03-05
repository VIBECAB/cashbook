import { useState } from 'react';
import { api } from '../api';

export default function ChangePassword({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      return setError('New password must be at least 6 characters');
    }
    if (newPassword !== confirmPassword) {
      return setError('New passwords do not match');
    }

    setLoading(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Change Password</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        {success ? (
          <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-lg text-center">
            Password changed successfully!
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-3">{error}</div>}

            <div className="space-y-3 mb-4">
              <div>
                <label className="label">Current Password</label>
                <input type="password" className="input" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
              </div>
              <div>
                <label className="label">New Password</label>
                <input type="password" className="input" required minLength={6} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div>
                <label className="label">Confirm New Password</label>
                <input type="password" className="input" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="btn-primary flex-1">
                {loading ? 'Changing...' : 'Change Password'}
              </button>
              <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
