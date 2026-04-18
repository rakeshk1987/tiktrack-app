import { useMemo } from 'react';
import clsx from 'clsx';
import { generateBezierPath } from '../../utils/charts';
import type { GrowthLog } from '../../types/schema';
import { calculateBmi } from '../../hooks/useCoreLogic';

interface Props {
  logs: GrowthLog[];
  isDark: boolean;
}

export default function GrowthChart({ logs, isDark }: Props) {
  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [logs]);

  if (sortedLogs.length < 2) {
    return (
      <div className={clsx(
        "rounded-2xl border p-6 flex flex-col items-center justify-center text-center h-64",
        isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white/70'
      )}>
        <p className="opacity-60 font-bold">Not enough data to calculate trends.</p>
        <p className="text-sm opacity-40 mt-1">Please add at least 2 growth logs.</p>
      </div>
    );
  }

  // Calculate SVG Points
  const width = 600;
  const height = 200;
  const padUrl = 20;

  const minH = Math.min(...sortedLogs.map(l => l.height_cm));
  const maxH = Math.max(...sortedLogs.map(l => l.height_cm));
  const minW = Math.min(...sortedLogs.map(l => l.weight_kg));
  const maxW = Math.max(...sortedLogs.map(l => l.weight_kg));

  const getX = (index: number) => padUrl + (index / (sortedLogs.length - 1)) * (width - padUrl * 2);
  const getYRaw = (val: number, min: number, max: number) => {
    const range = max - min || 1; // avoid div by 0
    return height - padUrl - ((val - min) / range) * (height - padUrl * 2);
  };

  const heightPoints = sortedLogs.map((l, i) => ({ x: getX(i), y: getYRaw(l.height_cm, minH, maxH) }));
  const weightPoints = sortedLogs.map((l, i) => ({ x: getX(i), y: getYRaw(l.weight_kg, minW, maxW) }));

  const heightPath = generateBezierPath(heightPoints, 0.15);
  const weightPath = generateBezierPath(weightPoints, 0.15);

  const lastLog = sortedLogs[sortedLogs.length - 1];
  const currentBmi = calculateBmi(lastLog.height_cm, lastLog.weight_kg);

  return (
    <div className={clsx(
      "rounded-[2rem] border p-6 shadow-xl relative overflow-hidden",
      isDark ? 'border-indigo-400/20 bg-[linear-gradient(145deg,rgba(30,27,75,0.6),rgba(15,23,42,0.8))]' : 'border-sky-200 bg-[linear-gradient(145deg,#ffffff,#f0f9ff)]'
    )}>
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div>
          <h3 className="font-bold text-lg">Growth Timeline</h3>
          <p className="text-sm opacity-60">Relative Height & Weight tracking</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-emerald-500">{currentBmi}</p>
          <p className="text-[10px] uppercase tracking-widest opacity-60 font-bold">Latest BMI</p>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto pb-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[500px]" preserveAspectRatio="none">
          {/* Grid lines */}
          <line x1="0" y1={padUrl} x2={width} y2={padUrl} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} strokeWidth="1" strokeDasharray="4 4" />
          <line x1="0" y1={height/2} x2={width} y2={height/2} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} strokeWidth="1" strokeDasharray="4 4" />
          <line x1="0" y1={height - padUrl} x2={width} y2={height - padUrl} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} strokeWidth="1" strokeDasharray="4 4" />

          {/* Lines */}
          <path d={heightPath} fill="none" stroke="url(#heightGrad)" strokeWidth="4" strokeLinecap="round" className="animate-[dash_2s_ease-out_forwards]" />
          <path d={weightPath} fill="none" stroke="url(#weightGrad)" strokeWidth="4" strokeLinecap="round" className="animate-[dash_2.5s_ease-out_forwards]" />

          {/* Points */}
          {heightPoints.map((p, i) => (
             <circle key={`h-${i}`} cx={p.x} cy={p.y} r="5" fill="#38bdf8" stroke={isDark ? "#1e1b4b" : "#fff"} strokeWidth="2" className="animate-in fade-in zoom-in duration-500" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
          {weightPoints.map((p, i) => (
             <circle key={`w-${i}`} cx={p.x} cy={p.y} r="5" fill="#fb923c" stroke={isDark ? "#1e1b4b" : "#fff"} strokeWidth="2" className="animate-in fade-in zoom-in duration-500" style={{ animationDelay: `${i * 150}ms` }} />
          ))}

          <defs>
            <linearGradient id="heightGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>
            <linearGradient id="weightGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fb923c" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="flex gap-6 justify-center mt-4 text-xs font-bold uppercase tracking-wider relative z-10">
        <div className="flex items-center gap-2">
           <span className="w-3 h-3 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.5)]"></span>
           <span className="opacity-80">Height</span>
        </div>
        <div className="flex items-center gap-2">
           <span className="w-3 h-3 rounded-full bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.5)]"></span>
           <span className="opacity-80">Weight</span>
        </div>
      </div>
    </div>
  );
}
