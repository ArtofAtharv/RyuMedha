"use client";

import { useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { motion, Variants } from "motion/react";
import { toast } from "sonner";
import RichAttendanceCard from "./RichAttendanceCard";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 80, damping: 12 }
  },
};

interface Props {
  initialData: any[];
  subjectsInfo: any[];
  token: string;
  profileId: string;
  targetPct: number;
}

export default function RichAttendanceView({ initialData, subjectsInfo, token, profileId, targetPct }: Props) {
  const [data, setData] = useState(initialData);
  const [isUpdating, setIsUpdating] = useState(false);
  const router = useRouter();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  function calculateAdvice(totalPresent: number, totalAbsent: number, totalDeemed: number, expectedTotal: number) {
    const totalLogged = totalPresent + totalAbsent + totalDeemed;
    const pct = totalLogged > 0 ? ((totalPresent + totalDeemed) / totalLogged) * 100 : 0;
    
    let bunksRemaining = undefined;
    let neededToRecover = undefined;
    let maxPossiblePct = undefined;
    let isPossibleToRecover = true;

    if (expectedTotal > 0) {
      const t = targetPct / 100;
      const maxAllowedMisses = Math.floor(expectedTotal * (1 - t));
      const netAbsent = Math.max(0, totalAbsent - totalDeemed);
      bunksRemaining = maxAllowedMisses - netAbsent;
      
      const remaining = Math.max(0, expectedTotal - totalLogged);
      const totalPresentsNeededForGoal = Math.ceil(expectedTotal * t);
      neededToRecover = Math.max(0, totalPresentsNeededForGoal - (totalPresent + totalDeemed));

      if (bunksRemaining < 0) {
        if (neededToRecover > remaining) {
          isPossibleToRecover = false;
          maxPossiblePct = ((totalPresent + totalDeemed + remaining) / expectedTotal) * 100;
        }
      }
    } else {
      const t = targetPct / 100;
      if (pct < targetPct) {
        neededToRecover = Math.ceil((t * totalLogged - (totalPresent + totalDeemed)) / (1 - t));
      }
    }

    return { pct, bunksRemaining, neededToRecover, maxPossiblePct, isPossibleToRecover };
  }

  const mergedData = useMemo(() => {
    const academicSubjects = subjectsInfo.filter((s: any) => s.type === 'academic' && s.is_active === true);
    
    return academicSubjects.map((sub: any) => {
      const existingAtt = data.find((d: any) => d.subject_id === sub.id);
      
      const present = existingAtt ? existingAtt.total_present : (sub.legacy_attended_lectures || 0);
      const absent = existingAtt ? existingAtt.total_absent : (sub.legacy_missed_lectures || 0);
      const deemed = existingAtt ? (existingAtt.total_deemed || 0) : 0;
      const expectedTotal = sub.expected_total_lectures || 0;

      const stats = calculateAdvice(present, absent, deemed, expectedTotal);

      return {
        subject_id: sub.id,
        subject_name: sub.name,
        total_present: present,
        total_absent: absent,
        total_deemed: deemed,
        attendance_percentage: stats.pct,
        bunks_remaining: stats.bunksRemaining,
        needed_to_recover: stats.neededToRecover,
        max_possible_pct: stats.maxPossiblePct,
        is_possible_to_recover: stats.isPossibleToRecover,
        accent_color: sub.color_hex,
        instructor_name: sub.instructor_name || sub.source_course_id?.instructor_name
      };
    }).sort((a: any, b: any) => a.attendance_percentage - b.attendance_percentage);
  }, [data, subjectsInfo, targetPct]);

  async function handleLogAttendance(subjectId: string, action: string) {
    if (isUpdating) return;
    setIsUpdating(true);

    const isUndo = action.startsWith('undo_');
    const targetStatus = action.replace('undo_', '');

    // Optimistic Update
    setData(prev => {
      const exists = prev.find(item => item.subject_id === subjectId);
      const updateRow = (item: any) => {
        let newP = item.total_present;
        let newA = item.total_absent;
        let newD = item.total_deemed ?? 0;

        if (isUndo) {
          if (targetStatus === 'present' && newP > 0) newP--;
          if (targetStatus === 'absent' && newA > 0) newA--;
          if (targetStatus === 'deemed' && newD > 0) newD--;
        } else {
          if (targetStatus === 'present') newP++;
          if (targetStatus === 'absent') newA++;
          if (targetStatus === 'deemed') newD++;
        }
        return { ...item, total_present: newP, total_absent: newA, total_deemed: newD };
      };

      if (exists) {
        return prev.map(item => item.subject_id === subjectId ? updateRow(item) : item);
      } else {
        const sub = subjectsInfo.find(s => s.id === subjectId);
        if (!sub) return prev;
        return [...prev, updateRow({
          subject_id: subjectId,
          total_present: sub.legacy_attended_lectures || 0,
          total_absent: sub.legacy_missed_lectures || 0,
          total_deemed: 0
        })];
      }
    });

    // DB Update
    if (!isUndo) {
        const today = new Date().toISOString().split('T')[0];
        const { error } = await supabase.from('attendance_logs').insert([{
          profile_id: profileId,
          subject_id: subjectId,
          status: targetStatus,
          lecture_date: today
        }]);

        if (error) {
            toast.error("Cloud sync failed");
            router.refresh();
        } else {
            const sub = subjectsInfo.find(s => s.id === subjectId);
            toast.success(`Marked ${targetStatus} for ${sub?.name}`);
        }
    } else {
        // Simple undo logic for now
        toast.info("Undo requested. Please use main dashboard for detailed corrections.");
    }

    setIsUpdating(false);
  }

  if (mergedData.length === 0) {
    return (
      <div className="py-20 text-center px-4">
        <div className="inline-block p-10 rounded-[3rem] bg-zinc-50 dark:bg-zinc-950 border-none shadow-inner">
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Neutral State</p>
           <p className="text-zinc-500 font-bold uppercase mt-2 text-xs">No academic modules registered</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-4"
    >
      {mergedData.map((item: any) => (
        <motion.div key={item.subject_id} variants={cardVariants}>
          <RichAttendanceCard
            subjectId={item.subject_id}
            subjectName={item.subject_name}
            present={item.total_present}
            absent={item.total_absent}
            deemed={item.total_deemed}
            percentage={item.attendance_percentage}
            accentColor={item.accent_color}
            instructorName={item.instructor_name}
            targetPct={targetPct}
            bunksRemaining={item.bunks_remaining}
            neededToRecover={item.needed_to_recover}
            maxPossiblePct={item.max_possible_pct}
            isPossibleToRecover={item.is_possible_to_recover}
            onLog={handleLogAttendance}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
