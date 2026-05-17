import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import clsx from 'clsx';
import { CheckCircle2, Flame, Star, Clock } from 'lucide-react';
import type { ChildLayoutContextValue } from './ChildLayout';
import { useRoutines } from '../../hooks/useRoutines';
import { useToast } from '../../contexts/ToastContext';
import type { RoutineLog } from '../../types/schema';

export default function RoutinePage() {
  const { profile, childId, familyId, isDark } = useOutletContext<ChildLayoutContextValue>();
  const { routines, loading, logRoutine, getTodayLogs } = useRoutines(familyId, childId);
  const { addToast } = useToast();

  const [todayLogs, setTodayLogs] = useState<Record<string, RoutineLog>>({});
  const [loggingId, setLoggingId] = useState<string | null>(null);

  useEffect(() => {
    if (!childId) return;
    getTodayLogs(childId).then((logs) => {
      const logMap: Record<string, RoutineLog> = {};
      logs.forEach(log => {
        logMap[log.routine_id] = log;
      });
      setTodayLogs(logMap);
    }).catch(console.error);
  }, [childId, routines]); // re-fetch logs when routines change

  const handleComplete = async (routineId: string) => {
    if (!childId) return;
    const routine = routines.find(r => r.id === routineId);
    if (!routine) return;

    setLoggingId(routineId);
    try {
      await logRoutine(routine, childId, 'completed');
      
      // Update local state instantly
      const newLog = {
        id: 'temp',
        routine_id: routine.id,
        family_id: familyId,
        child_id: childId,
        date: new Date().toISOString().slice(0, 10),
        status: 'completed' as const,
      };
      setTodayLogs(prev => ({ ...prev, [routine.id]: newLog }));
      
      addToast(`Awesome! You completed ${routine.title} (+${routine.points} stars)`, 'success');
    } catch (error) {
      addToast('Failed to log routine. Please try again.', 'error');
    } finally {
      setLoggingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className={clsx("animate-pulse font-bold", isDark ? 'text-white/60' : 'text-slate-400')}>Loading your routines...</p>
      </div>
    );
  }

  const activeRoutines = routines.filter(r => r.status === 'active');

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24">
      <div className={clsx('rounded-[1.75rem] border p-6 shadow-xl backdrop-blur-xl', isDark ? 'bg-[#1a1f3c]/80 border-white/10' : 'bg-white border-slate-200')}>
        <div className="flex items-center gap-4 mb-2">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-500 shadow-lg shadow-cyan-500/20 text-white">
            <Clock size={28} />
          </div>
          <div>
            <h1 className={clsx('text-2xl font-black font-display', isDark ? 'text-white' : 'text-slate-900')}>Daily Routines</h1>
            <p className={clsx('text-sm font-semibold mt-1', isDark ? 'text-white/60' : 'text-slate-500')}>Build strong habits everyday and collect stars!</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {activeRoutines.length === 0 ? (
          <div className="col-span-2 rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-white/10">
            <p className={clsx("text-lg font-bold", isDark ? 'text-white/50' : 'text-slate-400')}>No routines set yet. Ask your parents to set them up!</p>
          </div>
        ) : (
          activeRoutines.map(routine => {
            const isCompleted = todayLogs[routine.id]?.status === 'completed';
            const isSick = todayLogs[routine.id]?.status === 'sick';
            
            return (
              <div key={routine.id} className={clsx('relative overflow-hidden rounded-[1.5rem] border p-5 transition-all', 
                isCompleted 
                  ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200')
                  : (isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-slate-200 hover:shadow-lg')
              )}>
                {isCompleted && (
                  <div className="absolute -right-4 -top-4 opacity-20 pointer-events-none">
                    <CheckCircle2 size={120} className="text-emerald-500" />
                  </div>
                )}
                
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl bg-white/10 p-2 rounded-xl border border-white/5">{routine.icon || '📝'}</div>
                    <div>
                      <p className={clsx('text-xs font-black uppercase tracking-wider', isDark ? 'text-cyan-300' : 'text-cyan-600')}>{routine.schedule_time}</p>
                      <h3 className={clsx('text-lg font-bold', isDark ? 'text-white' : 'text-slate-900', isCompleted && 'line-through opacity-70')}>{routine.title}</h3>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-2 mb-5 relative z-10">
                  <div className={clsx('flex items-center gap-1 text-sm font-bold', isDark ? 'text-emerald-400' : 'text-emerald-600')}>
                    <Star size={16} className="fill-current" /> {routine.points} pts
                  </div>
                  <div className={clsx('flex items-center gap-1 text-sm font-bold', isDark ? 'text-orange-400' : 'text-orange-600')}>
                    <Flame size={16} className="fill-current" /> {routine.streak} streak
                  </div>
                </div>

                <button
                  disabled={isCompleted || isSick || loggingId === routine.id}
                  onClick={() => handleComplete(routine.id)}
                  className={clsx(
                    'w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm',
                    isCompleted 
                      ? 'bg-emerald-500 text-white cursor-default shadow-emerald-500/20'
                      : isSick
                      ? 'bg-yellow-500 text-white cursor-default'
                      : 'bg-cyan-500 text-white hover:bg-cyan-400 hover:scale-[1.02] shadow-cyan-500/30'
                  )}
                >
                  {loggingId === routine.id ? (
                    <span className="animate-pulse">Logging...</span>
                  ) : isCompleted ? (
                    <>
                      <CheckCircle2 size={18} /> Completed Today
                    </>
                  ) : isSick ? (
                    <>🤒 Sick Mode Active</>
                  ) : (
                    'Mark Completed'
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
