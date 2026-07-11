import { useEffect, useMemo, useState, useRef } from 'react';
import clsx from 'clsx';
import { collection, getDocs, query, where } from 'firebase/firestore';
import RewardMarketplace from '../../components/RewardMarketplace';
import { db } from '../../config/firebase';
import { useRedemptions, useRewards } from '../../hooks/useRedemptions';
import { getRewardLedgerMonthSummary, useRewardLedger } from '../../hooks/useRewardLedger';
import { useScratchRewards } from '../../hooks/useScratchRewards';
import { useChildLayout } from './ChildLayout';
import { computeMonthlyStars, getChildBadges, getLevelProgress } from '../../utils/childProgression';
import { DEFAULT_STAR_PAYOUT_PERCENTAGES, formatCash, normalizeRewardSettings } from '../../utils/rewards';
import type { RewardItem, RewardLedgerEntry, ScratchRewardCard } from '../../types/schema';

function ScratchOffCanvas({ onReveal, width = 300, height = 200 }: { onReveal: () => void, width?: number, height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const isDrawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill with metallic silver gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#e2e8f0');
    gradient.addColorStop(0.5, '#94a3b8');
    gradient.addColorStop(1, '#64748b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add pattern
    for (let i = 0; i < 60; i++) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.random() * 0.25})`;
      ctx.lineWidth = Math.random() * 3;
      ctx.moveTo(Math.random() * width, Math.random() * height);
      ctx.lineTo(Math.random() * width, Math.random() * height);
      ctx.stroke();
    }

    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'center';
    ctx.fillText('SCRATCH TO REVEAL', width / 2, height / 2 + 8);
    
    ctx.globalCompositeOperation = 'destination-out';
  }, [width, height]);

  const handleScratch = (x: number, y: number) => {
    if (isRevealed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.arc(x, y, 22, 0, 2 * Math.PI);
    ctx.fill();

    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    let transparent = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] < 128) transparent++;
    }
    const percent = transparent / (width * height);
    if (percent > 0.4 && !isRevealed) {
      setIsRevealed(true);
      ctx.clearRect(0, 0, width, height);
      setTimeout(onReveal, 400);
    }
  };

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const startScratch = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    const { x, y } = getCoordinates(e);
    handleScratch(x, y);
  };

  const scratch = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    if (e.cancelable) e.preventDefault();
    const { x, y } = getCoordinates(e);
    handleScratch(x, y);
  };

  const stopScratch = () => {
    isDrawing.current = false;
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={clsx("absolute inset-0 w-full h-full cursor-crosshair rounded-2xl transition-opacity duration-1000", isRevealed ? 'opacity-0 pointer-events-none' : 'opacity-100')}
      onMouseDown={startScratch}
      onMouseMove={scratch}
      onMouseUp={stopScratch}
      onMouseLeave={stopScratch}
      onTouchStart={startScratch}
      onTouchMove={scratch}
      onTouchEnd={stopScratch}
      style={{ touchAction: 'none' }}
    />
  );
}

export default function ChildRewards() {
  const { panelClass, mutedTextClass, profile, tasks } = useChildLayout();
  const parentId = profile.family_id || profile.parent_id || '';
  const { rewards, loading: rewardsLoading } = useRewards(parentId);
  const { redemptions, requestRedemption } = useRedemptions(profile.id, parentId);
  const { visibleEntries, surpriseEntries, loading: ledgerLoading, revealEntry } = useRewardLedger(profile.id, parentId);
  const { availableCards, loading: scratchLoading, revealScratchCard } = useScratchRewards(profile.id, parentId);

  const [monthlyEarnedStars, setMonthlyEarnedStars] = useState(0);
  const [conversionRate, setConversionRate] = useState(1);
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [payoutPercentages, setPayoutPercentages] = useState({ ...DEFAULT_STAR_PAYOUT_PERCENTAGES });
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [redemptionMode, setRedemptionMode] = useState<'cash' | 'rewards'>('cash');
  const [cashStars, setCashStars] = useState<number | ''>('');
  const [cashRequesting, setCashRequesting] = useState(false);
  const [cashMessage, setCashMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [openingGiftId, setOpeningGiftId] = useState<string | null>(null);
  const [openedScratch, setOpenedScratch] = useState<ScratchRewardCard | null>(null);
  const [spinningCard, setSpinningCard] = useState<ScratchRewardCard | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  // spinReady=true means the wheel is mounted at rotation=0 and we can safely
  // enable the CSS transition for the next rotation change.
  const [spinReady, setSpinReady] = useState(false);
  const [spinRotation, setSpinRotation] = useState(0);
  const [wonPrize, setWonPrize] = useState<string | null>(null);
  const [scratchFullyRevealed, setScratchFullyRevealed] = useState(false);

  const closeSpinWheel = () => {
    setSpinningCard(null);
    setIsSpinning(false);
    setSpinReady(false);
    setSpinRotation(0);
    setWonPrize(null);
  };


  const level = useMemo(() => getLevelProgress(Number(profile.total_stars || 0)), [profile.total_stars]);
  const pendingRewards = useMemo(() => redemptions.filter((item) => item.status === 'pending').length, [redemptions]);

  const badges = useMemo(() => getChildBadges({
    consistencyScore: Number(profile.consistency_score || 0),
    streakCount: Number(profile.streak_count || 0),
    earlyBirdCompletions: Number(profile.early_bird_count || 0),
    readingCompletions: Number(profile.reading_completed_count || 0),
    studyCompletions: Number(profile.study_completed_count || 0),
    perfectWeekCount: Number(profile.perfect_week_count || 0)
  }), [profile.consistency_score, profile.early_bird_count, profile.perfect_week_count, profile.reading_completed_count, profile.streak_count, profile.study_completed_count]);

  useEffect(() => {
    const loadSummary = async () => {
      setLoadingSummary(true);
      try {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

        const [tasksSnap, logsSnap, rewardSettingsByFamilySnap, rewardSettingsByParentSnap] = await Promise.all([
          getDocs(query(collection(db, 'tasks'), where('child_id', '==', profile.id))),
          getDocs(query(collection(db, 'task_logs'), where('child_id', '==', profile.id), where('status', '==', 'completed'), where('date', '>=', from), where('date', '<=', to))),
          getDocs(query(collection(db, 'reward_settings'), where('family_id', '==', parentId))),
          getDocs(query(collection(db, 'reward_settings'), where('parent_id', '==', parentId)))
        ]);

        const taskStarMap = new Map<string, number>();
        tasksSnap.docs.forEach((docSnap) => {
          const data = docSnap.data() as any;
          taskStarMap.set(docSnap.id, Number(data.points ?? data.star_value ?? 0));
        });

        const logs = logsSnap.docs.map((docSnap) => docSnap.data() as { date: string; status: string; task_id: string });
        setMonthlyEarnedStars(computeMonthlyStars(logs, taskStarMap, now));

        const rewardSettingDoc = rewardSettingsByFamilySnap.docs[0] || rewardSettingsByParentSnap.docs[0];
        if (rewardSettingDoc) {
          const settings = normalizeRewardSettings(rewardSettingDoc.data() as any);
          setConversionRate(settings.point_to_cash_rate);
          setCurrencySymbol(settings.currency_symbol);
          setPayoutPercentages(settings.star_payout_percentages);
        }
      } finally {
        setLoadingSummary(false);
      }
    };

    void loadSummary();
  }, [parentId, profile.id, tasks]);

  const monthlySpentStars = useMemo(() => {
    return getRewardLedgerMonthSummary(visibleEntries).spent;
  }, [visibleEntries]);
  const monthlyLedgerSummary = useMemo(() => getRewardLedgerMonthSummary(visibleEntries), [visibleEntries]);
  const monthlyDisplayEarned = monthlyLedgerSummary.earned || monthlyEarnedStars;

  const monthlyPayoutEstimate = useMemo(() => Number((monthlyDisplayEarned * conversionRate).toFixed(2)), [conversionRate, monthlyDisplayEarned]);
  const availableStars = Number(profile.total_stars || 0);
  const cashStarsValue = cashStars === '' ? 0 : Number(cashStars);
  const cashEstimate = Number(cashStarsValue.toFixed(2));
  const unlockedBadges = useMemo(() => badges.filter((badge) => badge.unlocked).length, [badges]);
  const nextBadge = useMemo(() => badges.find((badge) => !badge.unlocked) || null, [badges]);
  const openedGift = useMemo(
    () => visibleEntries.find((entry) => entry.id === openingGiftId) || null,
    [openingGiftId, visibleEntries]
  );
  const timelineGroups = useMemo(() => {
    const groups = new Map<string, RewardLedgerEntry[]>();
    visibleEntries
      .filter((entry) => entry.surprise_state !== 'hidden')
      .forEach((entry) => {
        const dateKey = new Date(entry.created_at).toISOString().slice(0, 10);
        groups.set(dateKey, [...(groups.get(dateKey) || []), entry]);
      });

    return Array.from(groups.entries()).map(([date, items]) => ({ date, items }));
  }, [visibleEntries]);

  const requestCashRedemption = async () => {
    if (!cashStarsValue || cashStarsValue <= 0) {
      setCashMessage({ type: 'error', text: 'Choose how many stars to redeem for cash.' });
      return;
    }

    if (cashStarsValue > availableStars) {
      setCashMessage({ type: 'error', text: `You only have ${availableStars} stars available.` });
      return;
    }

    const now = new Date().toISOString();
    const cashReward: RewardItem = {
      id: `cash_${profile.id}_${Date.now()}`,
      parent_id: parentId,
      family_id: parentId,
      child_id: profile.id,
      name: 'Cash payout',
      description: `${formatCash(cashStarsValue, currencySymbol)} cash payout request`,
      star_cost: cashStarsValue,
      icon: '💰',
      category: 'cash',
      is_available: true,
      created_at: now,
      updated_at: now
    };

    setCashRequesting(true);
    try {
      await requestRedemption(cashReward.id, cashReward, availableStars);
      setCashMessage({ type: 'success', text: 'Cash request sent for parent approval.' });
      setCashStars('');
      setTimeout(() => setCashMessage(null), 3000);
    } catch (error) {
      setCashMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not send cash request.' });
    } finally {
      setCashRequesting(false);
    }
  };

  const openSurpriseGift = async (entry: RewardLedgerEntry) => {
    await revealEntry(entry.id);
    setOpeningGiftId(entry.id);
  };

  const openScratchReward = async (cardId: string) => {
    // Reset scratch state before opening so a fresh card always starts unscratched
    setScratchFullyRevealed(false);
    const revealed = await revealScratchCard(cardId);
    if (revealed) {
      setOpenedScratch(revealed);
    }
  };

  const handleStartSpin = async () => {
    if (!spinningCard || isSpinning) return;

    setIsSpinning(true);
    try {
      const revealed = await revealScratchCard(spinningCard.id);
      if (!revealed) {
        setIsSpinning(false);
        return;
      }

      const segments = (spinningCard.wheel_segments || []).filter(Boolean);
      const targetIndex = segments.indexOf(revealed.prize_label);

      if (targetIndex === -1 || segments.length === 0) {
        // No matching segment — show prize immediately without spin animation
        setWonPrize(revealed.prize_label);
        setIsSpinning(false);
        return;
      }

      const n = segments.length;
      const sliceAngle = 360 / n;
      const centerAngle = sliceAngle * targetIndex + sliceAngle / 2;
      // The pointer is at the top (270° in SVG coordinate space where 0° is right).
      // We want centerAngle to land at the top, so we subtract it from 270.
      const alignmentRotation = 270 - centerAngle;
      const finalRotation = 2160 + alignmentRotation;

      // spinReady=true enables the CSS transition on the SVG. We set spinRotation
      // in the same microtask tick so the browser can batch the style update
      // together — the key insight is that spinReady was false before (no transition)
      // so the wheel was rendered at 0° without any animation, and now we enable
      // the transition and set the target angle in one commit.
      setSpinReady(true);
      setSpinRotation(finalRotation);

      setTimeout(() => {
        setWonPrize(revealed.prize_label);
        setIsSpinning(false);
      }, 4500);
    } catch (err) {
      console.error('Failed to spin wheel:', err);
      setIsSpinning(false);
    }
  };

  const renderSvgWheel = (segments: string[]) => {
    const n = segments.length;
    const sliceAngle = 360 / n;
    const colors = [
      '#06b6d4', // cyan-500
      '#6366f1', // indigo-500
      '#ec4899', // pink-500
      '#eab308', // yellow-500
      '#a855f7', // purple-500
      '#10b981', // emerald-500
      '#f97316', // orange-500
      '#3b82f6', // blue-500
    ];

    return (
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full max-w-[320px] max-h-[320px] select-none shadow-[0_0_60px_rgba(34,211,238,0.4)] rounded-full border-[6px] border-slate-900 bg-slate-900"
        style={{
          transform: `rotate(${spinRotation}deg)`,
          // Only apply the transition when spinReady is true (wheel has been rendered
          // at 0° first, then we enable transition + set final rotation in the same render).
          transition: spinReady ? 'transform 4.5s cubic-bezier(0.15, 0.9, 0.15, 1)' : 'none'
        }}
      >
        <defs>
          {colors.map((color, i) => (
            <radialGradient key={i} id={`slice-grad-${i}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="100%" stopColor={color} />
            </radialGradient>
          ))}
        </defs>
        {segments.map((label, i) => {
          const startAngleRad = ((sliceAngle * i - 90) * Math.PI) / 180;
          const endAngleRad = ((sliceAngle * (i + 1) - 90) * Math.PI) / 180;
          const x1 = 50 + 50 * Math.cos(startAngleRad);
          const y1 = 50 + 50 * Math.sin(startAngleRad);
          const x2 = 50 + 50 * Math.cos(endAngleRad);
          const y2 = 50 + 50 * Math.sin(endAngleRad);
          
          const pathData = `M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`;
          
          const textAngleRad = ((sliceAngle * i + sliceAngle / 2 - 90) * Math.PI) / 180;
          const textX = 50 + 32 * Math.cos(textAngleRad);
          const textY = 50 + 32 * Math.sin(textAngleRad);
          const textRotation = sliceAngle * i + sliceAngle / 2;

          return (
            <g key={i}>
              <path
                d={pathData}
                fill={`url(#slice-grad-${i % colors.length})`}
                stroke="#1e293b"
                strokeWidth="0.8"
              />
              <text
                x={textX}
                y={textY}
                transform={`rotate(${textRotation}, ${textX}, ${textY})`}
                fill="#ffffff"
                fontSize="3.8"
                fontWeight="black"
                textAnchor="middle"
                dominantBaseline="middle"
                className="pointer-events-none drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.85)]"
              >
                {label.length > 9 ? label.substring(0, 7) + '..' : label}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };


  const getTimelineTypeLabel = (entry: RewardLedgerEntry) => {
    if (entry.type === 'task_completed') return 'Task';
    if (entry.type === 'manual_award') return 'Gift';
    if (entry.type === 'scratch_reward') return 'Scratch';
    if (entry.type === 'redemption') return 'Redeemed';
    if (entry.type === 'bonus') return 'Bonus';
    return 'Update';
  };

  return (
    <div className="mt-6 space-y-5 pb-20">
      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h2 className="text-3xl font-display font-bold">Cash Rewards</h2>
        <p className={clsx('mt-1 text-sm', mutedTextClass)}>Points become cash. Star ratings decide how much of the amount you earn.</p>

        {loadingSummary ? <p className={clsx('mt-3 text-sm', mutedTextClass)}>Loading progress summary...</p> : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Cash Balance <span className="font-normal normal-case opacity-60">all-time</span></p>
            <p className="mt-1 text-2xl font-black">{formatCash(profile.total_stars || 0, currencySymbol)}</p>
            <p className={clsx('mt-1 text-[10px] leading-tight', mutedTextClass)}>Cumulative — includes previous months</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Earned <span className="font-normal normal-case opacity-60">this month</span></p>
            <p className="mt-1 text-2xl font-black">{formatCash(monthlyDisplayEarned, currencySymbol)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Base Estimate</p><p className="mt-1 text-2xl font-black">{formatCash(monthlyPayoutEstimate, currencySymbol)}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Spent <span className="font-normal normal-case opacity-60">this month</span></p>
            <p className="mt-1 text-2xl font-black">{formatCash(monthlySpentStars, currencySymbol)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Streak / Shields</p><p className="mt-1 text-2xl font-black">{profile.streak_count || 0} / {profile.streak_shields || 0}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Pending Rewards</p><p className="mt-1 text-2xl font-black">{pendingRewards}</p></div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-200">Level Progress</p>
            <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
              <p className="text-lg font-bold">{level.levelName}</p>
              <p className="text-sm text-cyan-100/90">{level.nextLevelName ? `${level.starsToNext} stars to ${level.nextLevelName}` : 'Top level unlocked'}</p>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/10 p-[2px]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#818cf8,#f472b6)] transition-all" style={{ width: `${level.progressPct}%` }} /></div>
          </div>
          <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-200">Badges</p>
            <p className="mt-1 text-lg font-bold">{unlockedBadges} / {badges.length} unlocked</p>
            <p className="text-sm text-amber-100/90">{nextBadge ? `Next: ${nextBadge.label}` : 'All badges unlocked'}</p>
          </div>
        </div>
      </div>

      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h3 className="text-2xl font-display font-bold">Redeem Cash</h3>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-1">
          <button
            type="button"
            onClick={() => setRedemptionMode('cash')}
            className={clsx('rounded-lg px-3 py-2 text-sm font-black transition', redemptionMode === 'cash' ? 'bg-emerald-400 text-slate-950' : mutedTextClass)}
          >
            Cash Request
          </button>
          <button
            type="button"
            onClick={() => setRedemptionMode('rewards')}
            className={clsx('rounded-lg px-3 py-2 text-sm font-black transition', redemptionMode === 'rewards' ? 'bg-cyan-400 text-slate-950' : mutedTextClass)}
          >
            Reward Items
          </button>
        </div>

        {redemptionMode === 'cash' ? (
          <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Available Cash</p><p className="mt-1 text-lg font-black">{formatCash(availableStars, currencySymbol)}</p></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Base Rate</p><p className="mt-1 text-lg font-black">1 point = {formatCash(conversionRate, currencySymbol)}</p></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>You'll Get</p><p className="mt-1 text-lg font-black">{formatCash(cashEstimate, currencySymbol)}</p></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {([5, 4, 3, 2, 1] as const).map((star) => (
                <span key={star} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-black">
                  {star}★ = {payoutPercentages[star]}%
                </span>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="number"
                min="1"
                max={availableStars}
                value={cashStars as any}
                onChange={(event) => setCashStars(event.target.value === '' ? '' : Number(event.target.value))}
                placeholder="Cash amount to request"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-bold outline-none"
              />
              <button
                type="button"
                onClick={() => void requestCashRedemption()}
                disabled={cashRequesting || availableStars <= 0}
                className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
              >
                {cashRequesting ? 'Sending...' : 'Request Cash'}
              </button>
            </div>

            {cashMessage ? (
              <p className={clsx('mt-3 rounded-lg px-3 py-2 text-sm font-bold', cashMessage.type === 'success' ? 'bg-emerald-400/15 text-emerald-200' : 'bg-rose-400/15 text-rose-200')}>
                {cashMessage.text}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-4">
            <RewardMarketplace
              rewards={rewards}
              childProfile={profile}
              currencySymbol={currencySymbol}
              onRedeemReward={async (rewardId, reward) => {
                await requestRedemption(rewardId, reward, profile.total_stars || 0);
              }}
              loading={rewardsLoading}
            />
          </div>
        )}
      </div>

      {surpriseEntries.length > 0 ? (
        <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-display font-bold">Surprise Gifts</h3>
              <p className={clsx('mt-1 text-sm', mutedTextClass)}>Parent sent something special. Open it when you are ready.</p>
            </div>
            <p className="rounded-full border border-pink-300/30 bg-pink-400/10 px-3 py-1 text-sm font-black text-pink-200">
              {surpriseEntries.length} unopened
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {surpriseEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => void openSurpriseGift(entry)}
                className="rounded-2xl border border-pink-300/25 bg-pink-500/10 px-4 py-4 text-left transition hover:bg-pink-500/15"
              >
                <p className="text-4xl">🎁</p>
                <p className="mt-2 text-lg font-black">Surprise gift</p>
                <p className={clsx('mt-1 text-sm', mutedTextClass)}>Tap to reveal your stars and message.</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {availableCards.some((card) => (card.reveal_type || 'scratch') === 'scratch') || scratchLoading ? (
        <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-display font-bold">Scratch Rewards</h3>
              <p className={clsx('mt-1 text-sm', mutedTextClass)}>Scratch a card to reveal the prize parent picked for you.</p>
            </div>
            <p className="rounded-full border border-violet-300/30 bg-violet-400/10 px-3 py-1 text-sm font-black text-violet-200">
              {availableCards.length} ready
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {scratchLoading ? (
              <p className={mutedTextClass}>Loading scratch rewards...</p>
            ) : (
              availableCards.filter((card) => (card.reveal_type || 'scratch') === 'scratch').map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => void openScratchReward(card.id)}
                  className="rounded-2xl border border-violet-300/25 bg-violet-500/10 px-4 py-4 text-left transition hover:bg-violet-500/15"
                >
                  <p className="text-4xl">🎟️</p>
                  <p className="mt-2 text-lg font-black">{card.title}</p>
                  <p className={clsx('mt-1 text-sm', mutedTextClass)}>{card.reason}</p>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      {availableCards.some((card) => card.reveal_type === 'wheel') ? (
        <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-display font-bold">Spin Wheel</h3>
              <p className={clsx('mt-1 text-sm', mutedTextClass)}>Spin to reveal the prize parent configured for you.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {availableCards.filter((card) => card.reveal_type === 'wheel').map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => {
                  // Reset all spin state so each new card starts fresh
                  setWonPrize(null);
                  setSpinRotation(0);
                  setSpinReady(false);
                  setIsSpinning(false);
                  setSpinningCard(card);
                }}
                className="group rounded-2xl border border-cyan-300/25 bg-[conic-gradient(from_45deg,#22d3ee,#818cf8,#f472b6,#facc15,#22d3ee)] p-[1px] text-left transition hover:scale-[1.01]"
              >
                <div className="rounded-2xl bg-slate-950/80 px-4 py-4">
                  <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border-4 border-white/30 bg-[conic-gradient(#facc15,#22d3ee,#a78bfa,#fb7185,#34d399,#facc15)] text-3xl transition duration-700">
                    🎡
                  </div>
                  <p className="mt-3 text-lg font-black">{card.title}</p>
                  <p className={clsx('mt-1 text-sm', mutedTextClass)}>{card.reason}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-2xl font-display font-bold">Badges</h3>
            <p className={clsx('mt-1 text-sm', mutedTextClass)}>Small milestones that track consistency, routines, and learning habits.</p>
          </div>
          <p className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-sm font-black text-amber-200">
            {unlockedBadges} / {badges.length} unlocked
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {badges.map((badge) => (
            <div key={badge.id} className={clsx('rounded-xl border px-3 py-3', badge.unlocked ? 'border-emerald-300/35 bg-emerald-500/10' : 'border-white/10 bg-white/[0.03]')}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-2xl">{badge.icon}</p>
                  <p className="mt-1 font-bold">{badge.label}</p>
                </div>
                <p className={clsx('text-xs font-black', badge.unlocked ? 'text-emerald-300' : mutedTextClass)}>{badge.unlocked ? 'Unlocked' : badge.valueLabel}</p>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/10 p-[2px]">
                <div className={clsx('h-full rounded-full transition-all', badge.unlocked ? 'bg-emerald-300' : 'bg-amber-300')} style={{ width: `${badge.progressPct}%` }} />
              </div>
              <p className={clsx('mt-2 text-xs', mutedTextClass)}>{badge.unlocked ? badge.valueLabel : badge.hint}</p>
            </div>
          ))}
        </div>

      </div>

      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-2xl font-display font-bold">Reward Timeline</h3>
            <p className={clsx('mt-1 text-sm', mutedTextClass)}>Track stars earned, gifts received, and rewards redeemed by date.</p>
          </div>
          <p className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-sm font-black text-cyan-200">
            {visibleEntries.length} entries
          </p>
        </div>

        <div className="mt-4 space-y-4">
          {ledgerLoading ? (
            <p className={mutedTextClass}>Loading reward timeline...</p>
          ) : timelineGroups.length === 0 ? (
            <p className={mutedTextClass}>No reward timeline yet. Complete tasks or open gifts to start tracking.</p>
          ) : (
            timelineGroups.slice(0, 8).map((group) => (
              <div key={group.date} className="relative pl-5">
                <div className="absolute left-[5px] top-7 bottom-0 w-px bg-white/10" />
                <div className="mb-2 flex items-center gap-2">
                  <span className="relative z-10 h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_0_4px_rgba(34,211,238,0.12)]" />
                  <p className="text-sm font-black">{new Date(group.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <div className="space-y-2">
                  {group.items.map((entry) => {
                    const isPositive = entry.stars_delta >= 0;
                    return (
                      <div key={entry.id} className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-black uppercase', isPositive ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-200')}>
                                {getTimelineTypeLabel(entry)}
                              </span>
                              <span className={clsx('text-xs', mutedTextClass)}>
                                {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="mt-1 font-bold">{entry.title}</p>
                            <p className={clsx('mt-1 text-xs', mutedTextClass)}>{entry.reason}</p>
                          </div>
                          <p className={clsx('shrink-0 text-right text-lg font-black', isPositive ? 'text-emerald-300' : 'text-amber-300')}>
                            {isPositive ? '+' : ''}{entry.stars_delta}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {openedGift ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 px-4">
          <div className="w-full max-w-md rounded-[1.5rem] border border-pink-300/30 bg-slate-950 p-6 text-center shadow-2xl">
            <p className="text-5xl">🎁</p>
            <h3 className="mt-3 text-2xl font-display font-black">Surprise unlocked</h3>
            <p className="mt-2 text-3xl font-black text-emerald-300">+{openedGift.stars_delta} stars</p>
            <p className={clsx('mt-3 text-sm', mutedTextClass)}>{openedGift.reason}</p>
            <button
              type="button"
              onClick={() => setOpeningGiftId(null)}
              className="mt-5 rounded-xl bg-pink-400 px-5 py-3 text-sm font-black text-slate-950"
            >
              Yay
            </button>
          </div>
        </div>
      ) : null}

      {openedScratch ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <style>{`
            @keyframes bounceIn {
              0% { transform: scale(0.8); opacity: 0; }
              60% { transform: scale(1.05); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
            .animate-bounce-in {
              animation: bounceIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
          `}</style>
          <div className="w-full max-w-md rounded-[2rem] border border-violet-500/40 bg-[linear-gradient(145deg,#1e1b4b,#0f172a)] p-8 text-center shadow-[0_20px_70px_rgba(139,92,246,0.25)] animate-bounce-in relative overflow-hidden">
            <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-fuchsia-500/20 blur-3xl" />

            <h3 className="relative z-10 text-3xl font-display font-black text-white">Scratch & Win</h3>
            <p className={clsx('relative z-10 mt-2 text-sm font-semibold', mutedTextClass)}>{openedScratch.reason}</p>
            
            <div className="relative z-10 mx-auto mt-8 h-[200px] w-full max-w-[300px] overflow-hidden rounded-2xl shadow-2xl border-4 border-slate-800 bg-slate-900">
              <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_center,#4c1d95,#1e1b4b)] p-4">
                <div>
                  <p className="text-4xl animate-bounce">🎁</p>
                  <p className="mt-3 text-3xl font-black text-white drop-shadow-md">{openedScratch.prize_label}</p>
                </div>
              </div>
              <ScratchOffCanvas onReveal={() => setScratchFullyRevealed(true)} width={300} height={200} />
            </div>

            <button
              type="button"
              disabled={!scratchFullyRevealed}
              onClick={() => {
                setOpenedScratch(null);
                setScratchFullyRevealed(false);
              }}
              className={clsx(
                "relative z-10 mt-8 w-full rounded-xl py-4 text-base font-black uppercase tracking-widest transition-all duration-300",
                scratchFullyRevealed 
                  ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-[0_10px_30px_rgba(139,92,246,0.4)] hover:brightness-110 active:scale-95" 
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              )}
            >
              {scratchFullyRevealed ? 'Claim Prize' : 'Scratch Above First'}
            </button>
          </div>
        </div>
      ) : null}

      {spinningCard ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: scale(0.95); }
              to { opacity: 1; transform: scale(1); }
            }
            .animate-fade-in {
              animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            }
          `}</style>
          <div className="relative w-full max-w-md overflow-hidden rounded-[2.25rem] border border-cyan-500/25 bg-slate-950/90 p-8 text-center shadow-[0_24px_60px_rgba(34,211,238,0.18)] backdrop-blur-md animate-fade-in">
            {/* Ambient Background Glow */}
            <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-cyan-500/15 blur-3xl" />
            <div className="absolute -left-20 -bottom-20 h-40 w-40 rounded-full bg-indigo-500/15 blur-3xl" />

            <h3 className="text-3xl font-display font-black text-white drop-shadow-lg">{spinningCard.title}</h3>
            <p className={clsx('mt-2 text-sm font-semibold', mutedTextClass)}>{spinningCard.reason}</p>

            {/* Wheel Container */}
            <div className="relative my-8 flex justify-center drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
              {/* Pointer Arrow pointing down */}
              <div className="absolute -top-4 left-1/2 z-30 h-0 w-0 -translate-x-1/2 border-l-[16px] border-r-[16px] border-t-[24px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow-[0_4px_4px_rgba(0,0,0,0.6)]" />
              
              <div className="relative rounded-full border-8 border-slate-800 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
                {renderSvgWheel(spinningCard.wheel_segments || [])}
              </div>

              {/* Center Spin Button */}
              <button
                type="button"
                disabled={isSpinning || wonPrize !== null}
                onClick={handleStartSpin}
                className={clsx(
                  "absolute left-1/2 top-1/2 z-40 h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[6px] border-slate-900 font-display font-black text-xs uppercase tracking-widest shadow-2xl transition-all duration-300",
                  isSpinning || wonPrize !== null
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(251,191,36,0.5)]"
                )}
              >
                {isSpinning ? '...' : 'SPIN'}
              </button>
            </div>

            {/* Prize Announcement */}
            {wonPrize ? (
              <div className="animate-fade-in mt-6">
                <p className="text-[12px] font-black uppercase tracking-[0.2em] text-amber-300 animate-pulse">🎉 You Won! 🎉</p>
                <h4 className="mt-2 text-4xl font-display font-black text-white drop-shadow-md">{wonPrize}</h4>
                <button
                  type="button"
                  onClick={closeSpinWheel}
                  className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-4 text-base font-black uppercase tracking-widest text-slate-950 transition-all hover:brightness-110 active:scale-95 shadow-[0_10px_30px_rgba(245,158,11,0.4)]"
                >
                  Claim Prize
                </button>
              </div>
            ) : (
              <p className={clsx('text-xs min-h-[40px] flex items-center justify-center', mutedTextClass)}>
                {isSpinning ? 'Good luck! Waiting for the wheel to stop...' : 'Tap SPIN to test your luck!'}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
