"use client";

import { useState, useMemo } from "react"; 
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { motion } from "motion/react";
import { createClient } from '@supabase/supabase-js';
import { 
  HiCheckCircle, HiClock, HiBookOpen, HiClipboardCheck, 
  HiCollection, HiAcademicCap, HiFolder, HiUser, HiLightningBolt
} from "react-icons/hi";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import RichAttendanceView from "@/components/sample-ui/RichAttendanceView";
import GradesTab from "@/components/sample-ui/GradesTab";
import TasksTab from "@/components/sample-ui/TasksTab";
import TimersTab from "@/components/sample-ui/TimersTab";
import SubjectsTab from "@/components/sample-ui/SubjectsTab";
import ProfileTab from "@/components/sample-ui/ProfileTab";

const tabs = ["Attendance", "Grades", "Tasks", "Timers", "Subjects", "Profile"] as const;
type TabType = (typeof tabs)[number];

interface Props {
  profile: any;
  token: string;
  subjects: any[];
  attendanceLogs: any[];
  grades: any[];
  tasks: any[];
  timers: any[];
  totalStudySecs: number;
}

export default function SampleDashboardContent({ 
  profile,
  token,
  subjects,
  attendanceLogs,
  grades,
  tasks,
  timers,
  totalStudySecs
}: Props) { 
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = tabs.includes(tabParam as TabType) ? (tabParam as TabType) : tabs[0];
  const pathname = usePathname();

  const profileId = profile?.id || '';
  const displayName = profile?.display_name || 'Student';
  const currentSemester = profile?.current_semester || null;

  const academicSubjects = useMemo(() => subjects.filter(s => s.type === 'academic'), [subjects]);
  const personalSubjects = useMemo(() => subjects.filter(s => s.type === 'personal'), [subjects]);
  
  // Attendance stats
  const attendanceStats = useMemo(() => {
    let totalClasses = 0;
    let totalAttended = 0;

    academicSubjects.forEach((sub: any) => {
      const subjectLogs = attendanceLogs.filter(log => log.subject_id === sub.id);
      const logPresent = subjectLogs.filter(log => log.status === 'present').length;
      const logAbsent = subjectLogs.filter(log => log.status === 'absent').length;

      const present = logPresent + (sub.legacy_attended_lectures || 0);
      const absent = logAbsent + (sub.legacy_missed_lectures || 0);
      
      totalAttended += present;
      totalClasses += (present + absent);
    });

    return totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;
  }, [academicSubjects, attendanceLogs]);

  // SGPA
  const sgpa = useMemo(() => {
    if (academicSubjects.length === 0) return "0.00";
    let totalPoints = 0;
    let graded = 0;
    academicSubjects.forEach((sub: any) => {
      const subGrades = grades.filter(g => g.subject_id === sub.id);
      let marks = 0, maxMarks = 0;
      subGrades.forEach(g => {
        marks += Number(g.marks);
        maxMarks += Number(g.max_marks);
      });
      if (maxMarks > 0) {
        const pct = (marks / maxMarks) * 100;
        if (pct >= 90) totalPoints += 10;
        else if (pct >= 80) totalPoints += 9;
        else if (pct >= 70) totalPoints += 8;
        else if (pct >= 60) totalPoints += 7;
        else if (pct >= 50) totalPoints += 6;
        else if (pct >= 40) totalPoints += 5;
        graded++;
      }
    });
    return graded > 0 ? (totalPoints / graded).toFixed(2) : "0.00";
  }, [academicSubjects, grades]);

  const pendingTasksCount = useMemo(() => tasks.filter(t => !t.is_completed).length, [tasks]);

  // Format study time
  const totalStudyHours = (totalStudySecs / 3600).toFixed(1);

  const [isMarking, setIsMarking] = useState(false);
  
  const handleTabChange = (tab: TabType) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleMarkAllPresent = async () => {
    if (isMarking || !profileId) return;
    setIsMarking(true);
    
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );
      
      const today = new Date().toISOString().split('T')[0];
      let count = 0;
      
      for (const sub of academicSubjects) {
        const { data: existing } = await supabase
          .from('attendance_logs')
          .select('id')
          .eq('profile_id', profileId)
          .eq('subject_id', sub.id)
          .eq('lecture_date', today)
          .limit(1);
        
        if (!existing || existing.length === 0) {
          await supabase.from('attendance_logs').insert([{
            profile_id: profileId,
            subject_id: sub.id,
            status: 'present',
            lecture_date: today
          }]);
          count++;
        }
      }
      
      if (count > 0) router.refresh();
    } finally {
      setIsMarking(false);
    }
  };
  
  const activeSubjectId = searchParams.get("subject");
  const activeSubject = subjects.find((s: any) => s.id === activeSubjectId);

  return (
    <div className="flex flex-col items-center bg-zinc-50 font-sans dark:bg-black min-h-screen p-6 md:p-12 transition-all selection:bg-purple-500/30">
        <div className="max-w-6xl w-full">
          
          {/* Dashboard Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 px-2">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center gap-3 mb-3">
                 <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black shadow-xl">
                    <HiLightningBolt className="text-xl" />
                 </div>
                 <div className="h-[1px] w-8 bg-zinc-200 dark:bg-zinc-800" />
                 <span className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-400">Terminal 01</span>
              </div>
              <h1 className="text-4xl font-black tracking-tighter dark:text-white flex items-center gap-4 italic uppercase">
                <span>RyuMedha</span>
                <span className="text-zinc-200 dark:text-zinc-800 not-italic font-thin">/</span>
                <span className="text-zinc-400 dark:text-zinc-500">Core</span>
              </h1>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="group flex items-center gap-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 pl-4 pr-6 py-3 rounded-[2rem] shadow-2xl shadow-zinc-200/50 dark:shadow-none hover:border-purple-500/30 transition-all cursor-default"
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white font-black text-sm shadow-lg group-hover:scale-110 transition-transform">
                  {displayName.charAt(0)}
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black dark:text-white uppercase tracking-widest leading-none">{displayName}</span>
                <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-[0.3em] mt-2">Protocol: Lvl {currentSemester ?? "0"}</span>
              </div>
            </motion.div>
          </div>

          {/* TOP SUMMARY CARDS */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 w-full"
          >
            <StatCard icon={<HiAcademicCap />} label="Phase" value={currentSemester ?? "—"} sublabel="Registry Path" color="text-purple-500" />
            <StatCard icon={<HiBookOpen />} label="Tracks" value={academicSubjects.length} sublabel={`${personalSubjects.length} Sub-systems`} color="text-blue-500" />
            <StatCard icon={<HiClipboardCheck />} label="Integrity" value={`${attendanceStats.toFixed(0)}%`} progress={attendanceStats} color="text-emerald-500" />
            <StatCard icon={<HiCollection />} label="Efficiency" value={sgpa} sublabel="Aggregated PT" color="text-orange-500" />
            <StatCard 
              icon={<HiClock />} 
              label="Engagement" 
              value={pendingTasksCount} 
              sublabel={`${totalStudyHours}h Focus`} 
              color="text-pink-500" 
              onClick={() => handleTabChange("Tasks")} 
            />
          </motion.div>
          
          {/* TAB NAVIGATION */}
          <div className="mt-16 flex justify-center">
            <div className="flex flex-wrap items-center gap-3 bg-zinc-200/30 dark:bg-zinc-900/40 p-2 rounded-[2.5rem] w-fit border border-zinc-100 dark:border-zinc-800 backdrop-blur-xl shadow-inner">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`relative cursor-pointer py-3.5 px-8 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 rounded-[1.8rem] ${
                    activeTab === tab
                      ? "text-white"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
                >
                  {activeTab === tab && (
                    <motion.span
                      layoutId="sample-tab-indicator"
                      className="absolute inset-0 z-0 bg-zinc-900 dark:bg-purple-600 shadow-2xl shadow-purple-500/40"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                      style={{borderRadius: '1.8rem'}}
                    />
                  )}
                  <span className="relative z-10">{tab}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* TAB CONTENT AREA */}
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mt-10 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[3.5rem] p-10 min-h-[600px] shadow-2xl shadow-zinc-200/40 dark:shadow-none relative overflow-hidden"
          >
            {/* Background elements for the content area */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2" />

            {activeTab === "Attendance" && (
              <div className="space-y-12">
                <div className="flex flex-col sm:flex-row justify-between items-end gap-6 px-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                       <div className="w-2 h-2 rounded-full bg-zinc-400 opacity-50" />
                       <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Classroom Validation</span>
                    </div>
                    <h2 className="text-3xl font-black tracking-tighter dark:text-white uppercase italic">Presence Log</h2>
                  </div>
                  <Button
                    disabled={isMarking}
                    onClick={handleMarkAllPresent}
                    className="h-16 px-10 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-[1.5rem] font-black uppercase tracking-[0.3em] text-[10px] hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-zinc-500/20 flex items-center gap-4"
                  >
                    <HiCheckCircle className={`text-2xl ${isMarking ? "animate-pulse" : ""}`} />
                    {isMarking ? "Syncing..." : "Protocol All"}
                  </Button>
                </div>

                <RichAttendanceView 
                  initialData={subjects.map(sub => {
                    const subjectLogs = attendanceLogs.filter(log => log.subject_id === sub.id);
                    return {
                      subject_id: sub.id,
                      total_present: subjectLogs.filter(log => log.status === 'present').length + (sub.legacy_attended_lectures || 0),
                      total_absent: subjectLogs.filter(log => log.status === 'absent').length + (sub.legacy_missed_lectures || 0),
                      total_deemed: subjectLogs.filter(log => log.status === 'deemed').length + (sub.legacy_deemed_lectures || 0)
                    };
                  })}
                  subjectsInfo={subjects}
                  token={token}
                  profileId={profileId}
                  targetPct={75}
                />
              </div>
            )}
            
            {activeTab === "Grades" && (
              <GradesTab 
                subjects={academicSubjects} 
                gradesData={grades} 
                token={token}
                profileId={profileId} 
              />
            )}
            
            {activeTab === "Tasks" && (
              <TasksTab 
                subjects={subjects} 
                tasksData={tasks} 
                token={token}
                profileId={profileId} 
              />
            )}
 
            {activeTab === "Timers" && (
              <TimersTab 
                subjects={subjects}
                timers={timers}
                profile={profile}
                token={token}
              />
            )}
 
            {activeTab === "Subjects" && (
              <SubjectsTab 
                subjects={subjects}
                profile={profile}
                token={token}
              />
            )}
 
            {activeTab === "Profile" && (
              <ProfileTab 
                profile={profile}
                token={token}
              />
            )}
          </motion.div>
        </div>
    </div>
  );
}

function StatCard({ icon, label, value, sublabel, color, progress, onClick }: any) {
  return (
    <motion.div 
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
    >
      <Card className={`bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-6 rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all cursor-pointer group relative overflow-hidden ${onClick ? 'hover:border-purple-500/30' : ''}`}>
        <div className={`w-12 h-12 rounded-2xl bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform ${color} border border-zinc-100 dark:border-zinc-800 shadow-sm`}>
          {icon}
        </div>
        <h3 className="text-zinc-400 dark:text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1.5">
          {label}
        </h3>
        <p className="text-zinc-900 dark:text-white text-3xl font-black leading-none tracking-tighter uppercase">
          {value}
        </p>
        
        {progress !== undefined ? (
          <div className="w-full bg-zinc-100 dark:bg-zinc-950 h-2 rounded-full mt-5 overflow-hidden border border-zinc-200/50 dark:border-zinc-800">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progress, 100)}%` }}
              transition={{ duration: 1.5, ease: "circOut" }}
              className="bg-gradient-to-r from-purple-600 to-pink-500 h-full rounded-full"
            />
          </div>
        ) : (
          <p className="text-zinc-400 dark:text-zinc-600 text-[10px] font-bold uppercase tracking-widest mt-4">
            {sublabel}
          </p>
        )}

        {/* Neural subtle glow */}
        <div className={`absolute -bottom-8 -right-8 w-24 h-24 blur-3xl opacity-0 group-hover:opacity-10 transition-opacity rounded-full ${color.replace('text-', 'bg-')}`} />
      </Card>
    </motion.div>
  );
}
