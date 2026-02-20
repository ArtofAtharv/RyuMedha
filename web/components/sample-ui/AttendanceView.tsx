"use client";
import { useState } from "react";
import { HiArrowLeft, HiCalendar, HiUser, HiCheckCircle, HiXCircle } from "react-icons/hi";
import { useRouter, useSearchParams } from "next/navigation";
import {
  format, eachDayOfInterval, isSameDay, isWeekend, eachMonthOfInterval,
  startOfMonth, endOfMonth, isToday, startOfDay, subMonths, addMonths
} from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@supabase/supabase-js";

export default function AttendanceView({ subject, attendanceLogs, token, profileId }: { subject: any, attendanceLogs: any[], token?: string, profileId: string }) { 
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isUpdating, setIsUpdating] = useState(false);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}
  );

  const backToGrid = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("view");
    params.delete("subject");
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const handleToggle = async (date: Date) => {
    setIsUpdating(true);
    const targetDateStr = startOfDay(new Date(date)).toISOString().split('T')[0];
    
    // Check if a log already exists
    const existingLog = attendanceLogs.find(l => l.lecture_date === targetDateStr);

    if (existingLog) {
       // Toggle present -> absent -> delete
       if (existingLog.status === 'present') {
          await supabase.from('attendance_logs').update({ status: 'absent' }).eq('id', existingLog.id);
       } else {
          await supabase.from('attendance_logs').delete().eq('id', existingLog.id);
       }
    } else {
       // Insert present
       await supabase.from('attendance_logs').insert([{
           profile_id: profileId,
           subject_id: subject.id,
           status: 'present',
           lecture_date: targetDateStr
       }]);
    }
    
    setIsUpdating(false);
    router.refresh(); // Sync layout
  };

  if (!subject) return <div className="p-10 text-center animate-pulse text-zinc-500 w-full">Loading Subject Data...</div>;

  // We are creating a mock sliding month window since we don't have static start/end dates hooked up from Semesters yet.
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const rangeStart = startOfMonth(currentMonth);
  const rangeEnd = endOfMonth(currentMonth);
  const allDaysInRange = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  // Use logs array directly
  const existsInLogs = (date: Date, status: string) => {
      const dateStr = startOfDay(date).toISOString().split('T')[0];
      return attendanceLogs.some(l => l.lecture_date === dateStr && l.status === status);
  };

  const getDayStatus = (date: Date) => {
    const localDate = startOfDay(date);
    const dayName = format(localDate, "EEEE");
    
    // Normally uses schedule, mocking default weekday schedule since schema doesn't enforce active sched yet
    const isLectureDay = !isWeekend(localDate); 

    return {
      isLecture: isLectureDay,
      isPresent: existsInLogs(localDate, 'present'),
      isAbsent: existsInLogs(localDate, 'absent'),
      isFuture: localDate > new Date()
    };
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 w-full max-w-6xl mx-auto items-stretch relative">
      <button
        onClick={backToGrid}
        className="absolute -top-14 left-0 flex items-center gap-2 text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors text-sm font-bold bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-full"
      >
        <HiArrowLeft /> Back to Subject Grid
      </button>

      {/* --- LEFT: STATISTICS & DETAILS --- */}
      <div className="w-full md:w-1/3 flex flex-col gap-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-4xl shadow-sm h-full flex flex-col relative overflow-hidden">
          <div className="relative z-10 flex-1 flex flex-col text-center mt-6">
            <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight leading-tight">
              {subject.name}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              <span className="bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300 text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full">
                {subject.code || "Core Subject"}
              </span>
            </div>
            {subject.instructor_name && (
               <p className="mt-6 text-sm font-medium text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-2">
                 <HiUser className="text-zinc-400 text-lg" />
                 {subject.instructor_name}
               </p>
            )}
          </div>
        </div>
      </div>

      {/* --- RIGHT: CALENDAR GRID WIDGET --- */}
      <div className="w-full md:w-2/3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-4xl shadow-sm p-4 sm:p-8 flex flex-col items-center">
         
         <div className="flex justify-between items-center w-full mb-6">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 border rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all font-bold">← Prev</button>
            <h3 className="text-xl font-black dark:text-white uppercase">{format(currentMonth, "MMMM yyyy")}</h3>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 border rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all font-bold">Next →</button>
         </div>

          <div className="w-full max-w-lg select-none">
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-4">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <div key={day} className="text-center text-[10px] sm:text-xs font-black text-zinc-400 uppercase tracking-wider py-2">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
               {Array.from({ length: rangeStart.getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
               ))}

              {allDaysInRange.map((date) => {
                const { isLecture, isPresent, isAbsent, isFuture } = getDayStatus(date);
                const today = isToday(date);
                
                let bgColor = "hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-zinc-700 dark:text-zinc-300";
                
                if (!isLecture) {
                  bgColor = "text-zinc-300 dark:text-zinc-600 cursor-not-allowed border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50";
                } else if (isPresent) {
                  bgColor = "bg-green-500 text-white shadow-lg shadow-green-500/30 hover:bg-green-600 scale-105 z-10 font-bold";
                } else if (isAbsent) {
                  bgColor = "bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600 scale-105 z-10 font-bold";
                }

                return (
                  <motion.div
                    key={date.toISOString()}
                    whileHover={isLecture && !isFuture ? { scale: 1.1, zIndex: 20 } : {}}
                    whileTap={isLecture && !isFuture ? { scale: 0.95 } : {}}
                    onClick={() => {
                       if (isLecture && !isFuture && !isUpdating) handleToggle(date);
                    }}
                    className={`aspect-square flex flex-col items-center justify-center rounded-xl sm:rounded-2xl transition-all relative ${bgColor} ${isUpdating ? "opacity-50" : ""}`}
                  >
                    <span className="text-sm sm:text-lg">{format(date, "d")}</span>
                    {today && (
                      <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
      </div>
    </div>
  );
}
