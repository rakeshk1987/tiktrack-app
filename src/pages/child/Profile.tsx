import { useState } from 'react';
import clsx from 'clsx';
import { updatePassword } from 'firebase/auth';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { useChildLayout } from './ChildLayout';

export default function ChildProfile() {
  const { accentCaptionClass, isDark, mutedTextClass, panelClass, profile } = useChildLayout();
  const [petName, setPetName] = useState(profile.pet_name || '');
  const [newPassword, setNewPassword] = useState('');
  const [savingPetName, setSavingPetName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState('');

  const savePetName = async () => {
    if (!petName.trim()) return;
    setSavingPetName(true);
    setMessage('');
    try {
      await updateDoc(doc(db, 'child_profile', profile.id), {
        pet_name: petName.trim(),
        updated_at: new Date().toISOString()
      });
      setMessage('Pet name updated.');
    } catch (error) {
      console.error('Failed to update pet name:', error);
      setMessage('Could not update pet name.');
    } finally {
      setSavingPetName(false);
    }
  };

  const savePassword = async () => {
    if (!newPassword.trim() || newPassword.trim().length < 6 || !auth.currentUser) return;
    setSavingPassword(true);
    setMessage('');
    try {
      await updatePassword(auth.currentUser, newPassword.trim());
      setNewPassword('');
      setMessage('Password updated successfully.');
    } catch (error: any) {
      console.error('Failed to update password:', error);
      if (String(error?.code || '').includes('requires-recent-login')) {
        setMessage('Please log out and log in again before updating password.');
      } else {
        setMessage('Could not update password right now.');
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const requestParentReset = async () => {
    setMessage('');
    try {
      await addDoc(collection(db, 'messages'), {
        child_id: profile.id,
        parent_id: profile.family_id || profile.parent_id || '',
        subject: 'Password reset request',
        content: 'Please reset my login password.',
        sender_role: 'child',
        sender_id: profile.id,
        is_read: false,
        timestamp: new Date().toISOString()
      });
      setMessage('Password reset request sent to parent.');
    } catch (error) {
      console.error('Failed to request password reset:', error);
      setMessage('Could not send reset request.');
    }
  };

  return (
    <div className="mt-6 space-y-5">
      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h2 className="text-3xl font-display font-bold">Profile Settings</h2>
        <p className={clsx('mt-1 text-sm', mutedTextClass)}>Manage your pet name and security.</p>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className={clsx('rounded-[1.3rem] border px-4 py-4', isDark ? 'border-white/10 bg-white/6' : 'border-indigo-200/70 bg-white/80')}>
            <p className={clsx('text-xs font-bold uppercase tracking-[0.18em]', accentCaptionClass)}>Pet Name</p>
            <input
              value={petName}
              onChange={(event) => setPetName(event.target.value)}
              placeholder="Enter your pet name"
              className="mt-3 w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void savePetName()}
              disabled={savingPetName || !petName.trim()}
              className="mt-3 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {savingPetName ? 'Saving...' : 'Save Pet Name'}
            </button>
          </div>

          <div className={clsx('rounded-[1.3rem] border px-4 py-4', isDark ? 'border-white/10 bg-white/6' : 'border-indigo-200/70 bg-white/80')}>
            <p className={clsx('text-xs font-bold uppercase tracking-[0.18em]', accentCaptionClass)}>Password</p>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="New password (min 6 chars)"
              className="mt-3 w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void savePassword()}
                disabled={savingPassword || newPassword.trim().length < 6}
                className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {savingPassword ? 'Updating...' : 'Update Password'}
              </button>
              <button
                type="button"
                onClick={() => void requestParentReset()}
                className="rounded-xl border border-white/20 px-4 py-2 text-sm font-bold"
              >
                Request Parent Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {message ? (
        <div className={clsx('rounded-xl border px-4 py-3 text-sm font-semibold', isDark ? 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100' : 'border-cyan-200 bg-cyan-50 text-cyan-700')}>
          {message}
        </div>
      ) : null}
    </div>
  );
}

