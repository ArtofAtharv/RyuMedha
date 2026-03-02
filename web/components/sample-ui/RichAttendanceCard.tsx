"use client";

import { Card, CardContent } from "@/components/ui/card";
import { HiCheckCircle, HiXCircle, HiMinusCircle, HiScale, HiUser } from "react-icons/hi";
import { motion } from "motion/react";

interface Props {
  subjectId: string;
  subjectName: string;
  present: number;
  absent: number;
  deemed: number;
  percentage: number;
  accentColor?: string;
  instructorName?: string;
  targetPct?: number;
  bunksRemaining?: number;
  neededToRecover?: number;
  maxPossiblePct?: number;
  isPossibleToRecover?: boolean;
  onLog?: (subjectId: string, action: 'present'|'absent'|'deemed'|'undo_present'|'undo_absent'|'undo_deemed') => void;
}

export default function RichAttendanceCard({
  subjectId,
  subjectName,
  present,
  absent,
  deemed,
  percentage,
  accentColor = "#8b5cf6",
  instructorName,
  targetPct = 75,
  bunksRemaining,
  neededToRecover,
  maxPossiblePct,
  isPossibleToRecover = true,
  onLog
}: Props) {
  const pct = Math.round(percentage);
  
  const getHealthColor = () => {
    if (pct >= 85) return "text-emerald-500";
    if (pct >= targetPct) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <Card className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden group shadow-sm hover:shadow-2xl transition-all duration-500 relative">
      <CardContent className="p-8 flex flex-col h-full relative z-10">
        {/* Header Block */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex-1">
             <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{backgroundColor: accentColor, boxShadow: `0 0 10px ${accentColor}`}} />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Class Validation</span>
             </div>
             <h3 className="text-2xl font-black dark:text-white tracking-tighter leading-tight uppercase line-clamp-2 max-w-[80%]">{subjectName}</h3>
             {instructorName && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400">
                    <HiUser />
                  </div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate">{instructorName}</p>
                </div>
             )}
          </div>
          <div className="text-right">
            <div className={`text-5xl font-black ${getHealthColor()} tracking-tighter leading-none`}>
              {pct}<span className="text-sm ml-0.5 opacity-50">%</span>
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mt-2">Efficiency</p>
          </div>
        </div>

        {/* Advice Panel */}
        <div className="flex-1 mb-8">
            <div className="p-6 rounded-[2rem] bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100/50 dark:border-zinc-800/50 shadow-inner flex flex-col justify-center min-h-[6rem] backdrop-blur-sm">
               {bunksRemaining !== undefined && bunksRemaining >= 0 ? (
                 <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-2xl border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                       <HiScale />
                    </div>
                    <div>
                       <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Secure Protocol</p>
                       <p className="text-xs font-bold dark:text-emerald-400/90 mt-1">Buffer: <span className="text-lg font-black text-emerald-500">{bunksRemaining}</span> missions</p>
                    </div>
                 </div>
               ) : (
                 <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center text-2xl border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                       <HiScale />
                    </div>
                    <div>
                       <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-600">Critical Status</p>
                       {isPossibleToRecover ? (
                         <p className="text-xs font-bold dark:text-red-400/90 mt-1">Required: <span className="text-lg font-black text-red-500">{neededToRecover}</span> sessions</p>
                       ) : (
                         <p className="text-xs font-bold dark:text-red-400/90 mt-1 italic opacity-80 underline underline-offset-4">Goal Unreachable</p>
                       )}
                    </div>
                 </div>
               )}
            </div>
        </div>

        {/* Primary Controls */}
        <div className="space-y-6">
            <div className="flex justify-between items-center px-4">
                <StatItem label="Log P" value={present} color="text-emerald-500" />
                <StatItem label="Log A" value={absent} color="text-red-500" />
                <StatItem label="Log D" value={deemed} color="text-blue-500" />
            </div>

            <div className="grid grid-cols-3 gap-4">
                <ActionButton label="P" color="bg-emerald-500" onClick={() => onLog?.(subjectId, 'present')} />
                <ActionButton label="A" color="bg-red-500" onClick={() => onLog?.(subjectId, 'absent')} />
                <ActionButton label="D" color="bg-blue-500" onClick={() => onLog?.(subjectId, 'deemed')} />
            </div>
        </div>
      </CardContent>

      {/* Decorative Neural Background */}
      <div className={`absolute -bottom-12 -right-12 w-48 h-48 blur-[80px] opacity-0 group-hover:opacity-10 transition-opacity duration-700 rounded-full`} style={{backgroundColor: accentColor}} />
    </Card>
  );
}

function StatItem({ label, value, color }: any) {
  return (
    <div className="text-center">
      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">{label}</p>
      <p className={`text-lg font-black ${color}`}>{value}</p>
    </div>
  );
}

function ActionButton({ label, color, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`h-12 rounded-3xl ${color} text-white font-black text-xs hover:scale-105 active:scale-95 transition-all shadow-lg group-hover:shadow-2xl`}
    >
      {label}
    </button>
  );
}
