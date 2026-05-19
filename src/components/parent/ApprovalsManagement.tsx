import React, { useState, useMemo } from 'react';
import clsx from 'clsx';
import { useApprovals } from '../../hooks/useApprovals';
import { useToast } from '../../contexts/ToastContext';
import type { ChildProfile } from '../../types/schema';
import { CheckCircle2, XCircle, ShieldCheck, DollarSign, Calendar, Plus, Hash } from 'lucide-react';

interface ApprovalsManagementProps {
  familyId: string;
  childrenProfiles: ChildProfile[];
  starCashRate?: number;
}

export function ApprovalsManagement({ familyId, childrenProfiles, starCashRate = 0 }: ApprovalsManagementProps) {
  const { approvals, settlements, resolveApproval, createSettlement, markSettlementPaid, loading } = useApprovals(familyId);
  const { addToast } = useToast();

  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'history' | 'settlements'>('pending');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Settlement Form State
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementChild, setSettlementChild] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [baseMoney, setBaseMoney] = useState<number | ''>('');
  const [generating, setGenerating] = useState(false);

  const pendingApprovals = useMemo(() => approvals.filter(a => a.status === 'pending'), [approvals]);
  const historyApprovals = useMemo(() => approvals.filter(a => a.status !== 'pending'), [approvals]);
  const groupedPendingApprovals = useMemo(() => {
    const groups = new Map<string, typeof pendingApprovals>();

    pendingApprovals.forEach((approval) => {
      const submittedDate = new Date(approval.created_at).toISOString().slice(0, 10);
      const groupKey = [
        approval.child_id,
        approval.type,
        approval.reference_id || approval.title,
        submittedDate,
      ].join('|');

      groups.set(groupKey, [...(groups.get(groupKey) || []), approval]);
    });

    return Array.from(groups.values()).map((items) => ({
      primary: items[0],
      items,
    }));
  }, [pendingApprovals]);

  const handleResolveGroup = async (ids: string[], status: 'approved' | 'rejected') => {
    setResolvingId(ids[0]);
    try {
      if (status === 'approved' && ids.length > 1) {
        const [primaryId, ...duplicateIds] = ids;
        await resolveApproval(primaryId, 'approved', familyId);
        await Promise.all(duplicateIds.map((id) => resolveApproval(id, 'rejected', familyId, { notifyChild: false, awardPoints: false })));
        addToast(`Approved once and cleared ${duplicateIds.length} duplicate submission${duplicateIds.length === 1 ? '' : 's'}.`, 'success');
      } else {
        await Promise.all(ids.map((id) => resolveApproval(id, status, familyId)));
        addToast(`${ids.length > 1 ? `${ids.length} submissions` : 'Submission'} successfully ${status}!`, 'success');
      }
    } catch (error) {
      addToast('Failed to resolve approval.', 'error');
    } finally {
      setResolvingId(null);
    }
  };

  const handleCreateSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlementChild || !startDate || !endDate) {
      addToast('Please fill in all fields.', 'error');
      return;
    }

    setGenerating(true);
    try {
      // Find all approved approvals for this child in this date range
      const childApprovals = approvals.filter(a => {
        if (a.child_id !== settlementChild || a.status !== 'approved') return false;
        const appDate = new Date(a.created_at).toISOString().slice(0, 10);
        return appDate >= startDate && appDate <= endDate;
      });

      const totalStars = childApprovals.reduce((acc, curr) => acc + (curr.points || 0), 0);
      
      // Legacy settlement field is named total_points; the product model calls these stars.
      const calculatedMoney = totalStars * starCashRate + (Number(baseMoney) || 0);

      await createSettlement({
        family_id: familyId,
        child_id: settlementChild,
        period_start: startDate,
        period_end: endDate,
        total_points: totalStars,
        total_money: Number(calculatedMoney.toFixed(2)),
      });

      addToast('Settlement report created successfully!', 'success');
      setShowSettlementModal(false);
      setBaseMoney('');
    } catch (error) {
      addToast('Failed to create settlement.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handlePaySettlement = async (id: string) => {
    try {
      await markSettlementPaid(id);
      addToast('Settlement payout completed!', 'success');
    } catch (error) {
      addToast('Failed to mark settlement as paid.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-white/10 pb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="text-cyan-500" /> Approvals & Settlements
          </h2>
          <p className="text-sm text-slate-500 dark:text-white/60">Review child submissions, approve stars, and run monthly allowance payouts.</p>
        </div>
        <div className="flex gap-2">
          {(['pending', 'history', 'settlements'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={clsx(
                'px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all',
                activeSubTab === tab
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10'
              )}
            >
              {tab} {tab === 'pending' && groupedPendingApprovals.length > 0 && `(${groupedPendingApprovals.length})`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 animate-pulse">Loading approvals data...</p>
      ) : activeSubTab === 'pending' ? (
        pendingApprovals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-white/10">
            <p className="text-slate-500 dark:text-white/60">All caught up! No pending approvals at the moment.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedPendingApprovals.map(({ primary: approval, items }) => {
              const child = childrenProfiles.find(c => c.id === approval.child_id);
              const submittedAt = new Date(approval.created_at);
              const duplicateCount = items.length;
              return (
                <div key={items.map(item => item.id).join('-')} className="rounded-xl border px-4 py-3 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {approval.proof_image_url ? (
                      <img src={approval.proof_image_url} alt="Proof" className="h-12 w-12 shrink-0 rounded-lg object-cover border border-slate-200 dark:border-white/10" />
                    ) : (
                      <div className="h-12 w-12 shrink-0 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center text-xl">
                        {approval.type === 'routine' ? '⏰' : approval.type === 'reward' ? '🎁' : '📝'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 px-2 py-0.5 rounded">
                          {approval.type}
                        </span>
                        {duplicateCount > 1 && (
                          <span className="text-[10px] font-bold uppercase bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300 px-2 py-0.5 rounded">
                            {duplicateCount} submissions
                          </span>
                        )}
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar size={12} /> {submittedAt.toLocaleDateString()} at {submittedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white mt-1 truncate">{approval.title}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-white/60">
                        <span>Child: <span className="font-semibold text-slate-700 dark:text-white">{child?.name || 'Unknown Child'}</span></span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">+{approval.points} Stars</span>
                        {approval.reference_id && (
                          <span className="flex items-center gap-1">
                            <Hash size={12} /> {approval.reference_id.slice(0, 8)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      disabled={items.some(item => resolvingId === item.id)}
                      onClick={() => handleResolveGroup(items.map(item => item.id), 'rejected')}
                      className="px-3 py-2 rounded-lg text-sm font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20 transition-colors flex items-center gap-1.5"
                    >
                      <XCircle size={16} /> Reject
                    </button>
                    <button
                      disabled={items.some(item => resolvingId === item.id)}
                      onClick={() => handleResolveGroup(items.map(item => item.id), 'approved')}
                      className="px-3 py-2 rounded-lg text-sm font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 size={16} /> Approve
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : activeSubTab === 'history' ? (
        historyApprovals.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-8 text-center">
            <p className="text-slate-500 dark:text-white/60">No approval history yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {historyApprovals.map(approval => {
              const child = childrenProfiles.find(c => c.id === approval.child_id);
              const isApproved = approval.status === 'approved';
              return (
                <div key={approval.id} className="rounded-xl border p-4 bg-slate-50/50 dark:bg-white/5 border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-white">{approval.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-white/50 mt-1">
                      {child?.name} • {approval.type} • Reviewed on {approval.reviewed_at ? new Date(approval.reviewed_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <span className={clsx(
                    'text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider',
                    isApproved 
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300' 
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300'
                  )}>
                    {approval.status}
                  </span>
                </div>
              );
            })}
          </div>
        )
      ) : (
        // Settlements Sub-Tab
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">Allowance Consolidation & Settlements</h3>
              <p className="text-xs text-slate-500 dark:text-white/50">Generate settlement statements for specific children to calculate pocket-money payouts.</p>
            </div>
            <button
              onClick={() => setShowSettlementModal(true)}
              className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-600 transition-colors shadow-lg shadow-cyan-500/20"
            >
              <Plus size={16} /> Run Settlement
            </button>
          </div>

          {settlements.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-white/10">
              <p className="text-slate-500 dark:text-white/60">No settlements generated yet. Click "Run Settlement" to issue your first pocket payout calculation!</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {settlements.map(settlement => {
                const child = childrenProfiles.find(c => c.id === settlement.child_id);
                const isPaid = settlement.status === 'paid';
                return (
                  <div key={settlement.id} className="rounded-2xl border p-5 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 flex flex-col justify-between hover:shadow-lg transition-shadow">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className={clsx(
                          'text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider',
                          isPaid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                        )}>
                          {settlement.status}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar size={12} /> {settlement.period_start} to {settlement.period_end}
                        </span>
                      </div>
                      <h4 className="font-bold text-lg text-slate-900 dark:text-white">{child?.name || 'Child'}</h4>
                      <div className="mt-3 space-y-1">
                        <p className="text-sm text-slate-500 dark:text-white/60">Approved Stars: <span className="font-bold text-slate-800 dark:text-white">{settlement.total_points} ★</span></p>
                        <p className="text-sm text-slate-500 dark:text-white/60 flex items-center gap-0.5">
                          Total Payout: <span className="font-black text-emerald-600 dark:text-emerald-400 flex items-center"><DollarSign size={14} />{settlement.total_money}</span>
                        </p>
                      </div>
                    </div>
                    {!isPaid && (
                      <button
                        onClick={() => handlePaySettlement(settlement.id)}
                        className="w-full mt-5 py-2.5 rounded-xl text-sm font-bold bg-cyan-500 text-white hover:bg-cyan-600 transition-colors shadow-lg shadow-cyan-500/10 flex items-center justify-center gap-1"
                      >
                        <DollarSign size={16} /> Mark Paid
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Run Settlement Modal */}
      {showSettlementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1a1f3c] shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Run Allowance Settlement</h3>
              <button onClick={() => setShowSettlementModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateSettlement} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-white/60">Child</label>
                <select
                  required
                  value={settlementChild}
                  onChange={(e) => setSettlementChild(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none"
                >
                  <option value="">Select Child</option>
                  {childrenProfiles.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-white/60">Start Date</label>
                  <input
                    required
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-white/60">End Date</label>
                  <input
                    required
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-white/60">Base pocket money allowance ($)</label>
                <input
                  type="number"
                  placeholder="e.g. 5.00"
                  value={baseMoney}
                  onChange={(e) => setBaseMoney(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Cash rate: 1 star = {starCashRate}.</p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/10 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowSettlementModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="px-6 py-2 rounded-xl text-sm font-bold bg-cyan-500 text-white hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/30 flex items-center gap-1"
                >
                  {generating ? 'Processing...' : 'Run payout & statement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
