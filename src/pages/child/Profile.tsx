import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { updatePassword } from 'firebase/auth';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { BadgeCheck, Lock, Sparkles, Star } from 'lucide-react';
import { auth, db } from '../../config/firebase';
import { useChildLayout } from './ChildLayout';
import ChildSpecialDates from './SpecialDates';
import ChildGrowth from './Growth';
import { calculateAgeFromDob } from '../../hooks/useCoreLogic';
import { getLevelProgress } from '../../utils/childProgression';

const AVATARS = ['🦊', '🐯', '🦁', '🐼', '🧠', '🚀', '🌟', '🐬'];
const PERSONALITY_TAGS = ['Animal lover', 'Book explorer', 'Science curious', 'Creative thinker', 'Fast finisher', 'Kind helper', 'Nature buddy', 'Puzzle solver'];
const STYLE_OPTIONS: Array<{ id: NonNullable<ReturnType<typeof useChildLayout>['profile']['communication_style']>; label: string; hint: string }> = [
  { id: 'cheerful', label: 'Cheerful', hint: 'Bright and excited' },
  { id: 'calm', label: 'Calm', hint: 'Soft and steady' },
  { id: 'challenge', label: 'Challenge me', hint: 'Push me a little' },
  { id: 'short', label: 'Short', hint: 'Quick and simple' }
];

export default function ChildProfile() {
  const { accentCaptionClass, isDark, mutedTextClass, panelClass, profile } = useChildLayout();
  const [profileTab, setProfileTab] = useState<'settings' | 'special-dates' | 'growth'>('settings');
  const [petName, setPetName] = useState(profile.pet_name || '');
  const [avatarEmoji, setAvatarEmoji] = useState(profile.avatar_emoji || '🦊');
  const [interests, setInterests] = useState((profile.interests || []).join(', '));
  const [personalityTags, setPersonalityTags] = useState<string[]>(profile.personality_tags || []);
  const [communicationStyle, setCommunicationStyle] = useState(profile.communication_style || 'cheerful');
  const [profileMotto, setProfileMotto] = useState(profile.profile_motto || '');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState('');

  const age = useMemo(() => calculateAgeFromDob(profile.date_of_birth), [profile.date_of_birth]);
  const level = useMemo(() => getLevelProgress(Number(profile.total_stars || 0)), [profile.total_stars]);
  const displayName = petName.trim() || profile.name || 'Explorer';
  const pagePanelClass = isDark
    ? panelClass
    : 'border-slate-200 bg-white text-slate-950';
  const profileCardClass = isDark
    ? 'border-white/10 bg-white/6 text-white'
    : 'border-slate-200 bg-slate-50 text-slate-950 shadow-sm';
  const profileInputClass = isDark
    ? 'border-white/20 bg-white/5 text-white placeholder:text-white/35'
    : 'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400';
  const inactiveTabClass = isDark
    ? 'border border-white/20 text-white'
    : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50';
  const labelClass = isDark ? accentCaptionClass : 'text-cyan-600';
  const descriptionClass = isDark ? mutedTextClass : 'text-slate-600';

  const saveProfile = async () => {
    setSavingProfile(true);
    setMessage('');
    try {
      await updateDoc(doc(db, 'child_profile', profile.id), {
        pet_name: petName.trim() || null,
        avatar_emoji: avatarEmoji,
        interests: interests.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8),
        personality_tags: personalityTags.slice(0, 5),
        communication_style: communicationStyle,
        profile_motto: profileMotto.trim().slice(0, 90) || null,
        updated_at: new Date().toISOString()
      });
      setMessage('Profile updated. Great work!');
    } catch (error) {
      console.error('Failed to update profile:', error);
      setMessage('Could not update profile right now.');
    } finally {
      setSavingProfile(false);
    }
  };

  const togglePersonalityTag = (tag: string) => {
    setPersonalityTags((prev) => {
      if (prev.includes(tag)) return prev.filter((item) => item !== tag);
      return [...prev, tag].slice(0, 5);
    });
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
      <div className={clsx('rounded-[1.75rem] border p-4 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', pagePanelClass)}>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setProfileTab('settings')} className={clsx('rounded-xl px-4 py-2 text-sm font-bold', profileTab === 'settings' ? 'bg-cyan-500 text-white' : inactiveTabClass)}>Profile Settings</button>
          <button type="button" onClick={() => setProfileTab('special-dates')} className={clsx('rounded-xl px-4 py-2 text-sm font-bold', profileTab === 'special-dates' ? 'bg-fuchsia-500 text-white' : inactiveTabClass)}>Special Dates</button>
          <button type="button" onClick={() => setProfileTab('growth')} className={clsx('rounded-xl px-4 py-2 text-sm font-bold', profileTab === 'growth' ? 'bg-emerald-500 text-white' : inactiveTabClass)}>Growth</button>
        </div>
      </div>

      {profileTab === 'settings' && (
        <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', pagePanelClass)}>
          <div className={clsx('rounded-[1.4rem] border p-5', isDark ? 'border-cyan-300/15 bg-cyan-400/8' : 'border-cyan-100 bg-cyan-50')}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className={clsx('grid h-20 w-20 place-items-center rounded-3xl border text-5xl shadow-lg', isDark ? 'border-white/12 bg-white/8' : 'border-cyan-100 bg-white')}>
                  {avatarEmoji}
                </div>
                <div>
                  <p className={clsx('text-xs font-black uppercase tracking-[0.18em]', labelClass)}>Explorer Identity</p>
                  <h2 className="mt-1 text-3xl font-display font-bold">{displayName}</h2>
                  <p className={clsx('mt-1 text-sm font-semibold', descriptionClass)}>
                    Full name: <span className={isDark ? 'text-white' : 'text-slate-900'}>{profile.name}</span>
                  </p>
                  {profileMotto.trim() ? (
                    <p className={clsx('mt-2 max-w-2xl text-sm italic', descriptionClass)}>"{profileMotto.trim()}"</p>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:min-w-[280px]">
                <div className={clsx('rounded-2xl border p-3 text-center', profileCardClass)}>
                  <Star className="mx-auto mb-1 fill-current text-amber-400" size={18} />
                  <p className="text-lg font-black">{profile.total_stars || 0}</p>
                  <p className={clsx('text-[10px] font-black uppercase tracking-wide', descriptionClass)}>Stars</p>
                </div>
                <div className={clsx('rounded-2xl border p-3 text-center', profileCardClass)}>
                  <BadgeCheck className="mx-auto mb-1 text-cyan-400" size={18} />
                  <p className="text-lg font-black">{level.levelName.split(' ')[0]}</p>
                  <p className={clsx('text-[10px] font-black uppercase tracking-wide', descriptionClass)}>Level</p>
                </div>
                <div className={clsx('rounded-2xl border p-3 text-center', profileCardClass)}>
                  <Sparkles className="mx-auto mb-1 text-fuchsia-400" size={18} />
                  <p className="text-lg font-black">{level.starsToNext}</p>
                  <p className={clsx('text-[10px] font-black uppercase tracking-wide', descriptionClass)}>Next</p>
                </div>
              </div>
            </div>
          </div>

          <h3 className="mt-6 text-xl font-display font-bold">Profile Settings</h3>
          <p className={clsx('mt-1 text-sm', descriptionClass)}>Choose how TikTrack sees you and talks with you.</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className={clsx('min-w-0 rounded-2xl border px-3 py-3', profileCardClass)}>
              <p className={clsx('text-[11px] font-bold uppercase tracking-[0.14em]', labelClass)}>Avatar</p>
              <p className="mt-1 text-2xl font-bold">{avatarEmoji}</p>
            </div>
            <div className={clsx('min-w-0 rounded-2xl border px-3 py-3', profileCardClass)}>
              <p className={clsx('text-[11px] font-bold uppercase tracking-[0.14em]', labelClass)}>Age</p>
              <p className="mt-1 text-base font-bold">{age} years</p>
            </div>
            <div className={clsx('min-w-0 rounded-2xl border px-3 py-3', profileCardClass)}>
              <p className={clsx('text-[11px] font-bold uppercase tracking-[0.14em]', labelClass)}>Full Name</p>
              <p className="mt-1 truncate text-base font-bold">{profile.name}</p>
            </div>
            <div className={clsx('min-w-0 rounded-2xl border px-3 py-3', profileCardClass)}>
              <p className={clsx('text-[11px] font-bold uppercase tracking-[0.14em]', labelClass)}>Streak</p>
              <p className="mt-1 truncate text-base font-bold">{profile.streak_count || 0} days</p>
            </div>
            <div className={clsx('min-w-0 rounded-2xl border px-3 py-3', profileCardClass)}>
              <p className={clsx('text-[11px] font-bold uppercase tracking-[0.14em]', labelClass)}>Shields</p>
              <p className="mt-1 text-base font-bold">{profile.streak_shields || 0}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className={clsx('rounded-[1.3rem] border px-4 py-4', profileCardClass)}>
              <p className={clsx('text-xs font-bold uppercase tracking-[0.18em]', labelClass)}>Identity</p>
              <label className={clsx('mt-3 block text-xs font-bold uppercase tracking-wide', descriptionClass)}>Call me</label>
              <input value={petName} onChange={(event) => setPetName(event.target.value)} placeholder="Nickname used in greetings" className={clsx('mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/40', profileInputClass)} />
              <label className={clsx('mt-3 block text-xs font-bold uppercase tracking-wide', descriptionClass)}>Full name</label>
              <div className={clsx('mt-1 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm', isDark ? 'border-white/10 bg-white/5 text-white/70' : 'border-slate-200 bg-slate-100 text-slate-600')}>
                <Lock size={13} />
                <span>{profile.name}</span>
                <span className="ml-auto text-[10px] font-bold uppercase">Parent managed</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {AVATARS.map((emoji) => (
                  <button key={emoji} type="button" onClick={() => setAvatarEmoji(emoji)} className={clsx('rounded-xl border px-3 py-1.5 text-xl', avatarEmoji === emoji ? 'border-cyan-300 bg-cyan-500/15' : isDark ? 'border-white/20' : 'border-slate-300 bg-white')}>{emoji}</button>
                ))}
              </div>
              <input value={profileMotto} onChange={(event) => setProfileMotto(event.target.value)} placeholder="One line about me" maxLength={90} className={clsx('mt-3 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/40', profileInputClass)} />
              <input value={interests} onChange={(event) => setInterests(event.target.value)} placeholder="Interests (comma separated)" className={clsx('mt-3 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/40', profileInputClass)} />
              <div className="mt-3 flex flex-wrap gap-2">
                {PERSONALITY_TAGS.map((tag) => {
                  const selected = personalityTags.includes(tag);
                  return (
                    <button key={tag} type="button" onClick={() => togglePersonalityTag(tag)} className={clsx('rounded-full border px-3 py-1.5 text-xs font-bold transition', selected ? 'border-cyan-300 bg-cyan-500/15 text-cyan-300' : isDark ? 'border-white/15 text-white/65 hover:bg-white/5' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50')}>
                      {tag}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {STYLE_OPTIONS.map((style) => (
                  <button key={style.id} type="button" onClick={() => setCommunicationStyle(style.id)} className={clsx('rounded-xl border px-3 py-2 text-left transition', communicationStyle === style.id ? 'border-fuchsia-300 bg-fuchsia-500/15' : isDark ? 'border-white/15 hover:bg-white/5' : 'border-slate-300 bg-white hover:bg-slate-50')}>
                    <span className="block text-sm font-black">{style.label}</span>
                    <span className={clsx('text-xs', descriptionClass)}>{style.hint}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => void saveProfile()} disabled={savingProfile} className="mt-3 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{savingProfile ? 'Saving...' : 'Save Profile'}</button>
            </div>

            <div className={clsx('rounded-[1.3rem] border px-4 py-4', profileCardClass)}>
              <p className={clsx('text-xs font-bold uppercase tracking-[0.18em]', labelClass)}>Password</p>
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password (min 6 chars)" className={clsx('mt-3 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400/40', profileInputClass)} />
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void savePassword()} disabled={savingPassword || newPassword.trim().length < 6} className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{savingPassword ? 'Updating...' : 'Update Password'}</button>
                <button type="button" onClick={() => void requestParentReset()} className={clsx('rounded-xl border px-4 py-2 text-sm font-bold', isDark ? 'border-white/20 text-white' : 'border-slate-300 bg-white text-slate-800')}>Request Parent Reset</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {profileTab === 'special-dates' && <ChildSpecialDates />}
      {profileTab === 'growth' && <ChildGrowth />}

      {message ? <div className={clsx('rounded-xl border px-4 py-3 text-sm font-semibold', isDark ? 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100' : 'border-cyan-200 bg-cyan-50 text-cyan-700')}>{message}</div> : null}
    </div>
  );
}
