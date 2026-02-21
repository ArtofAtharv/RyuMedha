"use client";

import { useState, useMemo } from "react"; 
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { motion } from "motion/react";
import { createClient } from '@supabase/supabase-js';
import { 
  HiCheckCircle, HiClock, HiBookOpen, HiClipboardCheck, 
  HiCollection, HiAcademicCap, HiFolder
} from "react-icons/hi";

import SubjectGrid from "@/components/sample-ui/subjectCard";
import AttendanceView from "@/components/sample-ui/AttendanceView";
import GradesTab from "@/components/sample-ui/GradesTab";
import TasksTab from "@/components/sample-ui/TasksTab";

const tabs = ["Attendance", "Grades", "Tasks"] as const;
type TabType = (typeof tabs)[number];

interface Props {
  profileId: string;
  displayName: string;
  currentSemester: number | null;
  token: string;
  subjects: any[];
  attendanceLogs: any[];
  grades: any[];
  tasks: any[];
  totalStudySecs: number;
}

export default function SampleDashboardContent({ 
  profileId,
  displayName,
  currentSemester,
  token,
  subjects,
  attendanceLogs,
  grades,
  tasks,
  totalStudySecs
}: Props) { 
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = tabs.includes(tabParam as TabType) ? (tabParam as TabType) : tabs[0];
  const pathname = usePathname();

  const academicSubjects = useMemo(() => subjects.filter(s => s.type === 'academic'), [subjects]);
  const personalSubjects = useMemo(() => subjects.filter(s => s.type === 'personal'), [subjects]);
  
  // Attendance stats (mirrors main dashboard exactly)
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

  // Mark All Present — uses Supabase directly
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
        // Check if already marked today
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
    <div className="flex flex-col items-center bg-zinc-50 font-sans dark:bg-zinc-950 min-h-screen p-4 md:p-8 transition-all">
        <div className="max-w-6xl w-full">
          
          {/* Greeting */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4"
          >
            <h1 className="text-2xl font-black tracking-tight dark:text-white">
              Welcome back{displayName ? `, ${displayName}` : ''}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
              Here's your academic overview
            </p>
          </motion.div>

          {/* TOP SUMMARY CARDS */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full"
          >

            {/* Semester */}
            <div className="bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 p-5 rounded-2xl border">
              <h3 className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
                <HiAcademicCap className="text-purple-500" /> Semester
              </h3>
              <p className="text-zinc-900 dark:text-zinc-50 text-3xl font-black mt-1">
                {currentSemester ?? "—"}
              </p>
              <p className="text-zinc-500 dark:text-zinc-400 text-[10px] font-medium mt-2">
                Current Semester
              </p>
            </div>

            {/* Total Subjects */}
            <div className="bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 p-5 rounded-2xl border">
              <h3 className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
                <HiBookOpen className="text-purple-500" /> Subjects
              </h3>
              <p className="text-zinc-900 dark:text-zinc-50 text-3xl font-black mt-1">
                {academicSubjects.length}
              </p>
              <p className="text-zinc-500 dark:text-zinc-400 text-[10px] font-medium mt-2">
                {personalSubjects.length > 0 ? `+ ${personalSubjects.length} personal` : 'Academic'}
              </p>
            </div>

            {/* Overall Attendance */}
            <div className="bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 p-5 rounded-2xl border">
              <h3 className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
                <HiClipboardCheck className="text-purple-500" /> Attendance
              </h3>
              <p className="text-zinc-900 dark:text-zinc-50 text-3xl font-black mt-1">
                {attendanceStats.toFixed(0)}%
              </p>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full mt-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(attendanceStats, 100)}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 h-1.5 rounded-full"
                />
              </div>
            </div>

            {/* SGPA */}
            <div className="bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 p-5 rounded-2xl border">
              <h3 className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
                <HiCollection className="text-purple-500" /> SGPA
              </h3>
              <p className="text-zinc-900 dark:text-zinc-50 text-3xl font-black mt-1">
                {sgpa}
              </p>
              <p className="text-zinc-500 dark:text-zinc-400 text-[10px] font-medium mt-2">
                Grade Point Average
              </p>
            </div>

            {/* Activity */}
            <div className="bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 p-5 rounded-2xl border">
              <h3 className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
                <HiClock className="text-purple-500" /> Activity
              </h3>
              <p className="text-zinc-900 dark:text-zinc-50 text-3xl font-black mt-1">
                {pendingTasksCount}
              </p>
              <p
                className="text-purple-600 dark:text-purple-400 text-[10px] font-bold mt-2 hover:underline cursor-pointer"
                onClick={() => handleTabChange("Tasks")}
              >
                pending • {totalStudyHours}h studied
              </p>
            </div>

          </motion.div>
          
          {/* TAB BUBBLE NAVIGATION & ACTION BUTTONS */}
          <div className="mt-8 w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs sm:text-sm font-medium">
            <div className="bg-zinc-200 dark:bg-zinc-800 flex rounded-full p-1 relative">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`relative z-10 cursor-pointer text-center py-2 px-4 font-medium transition-colors duration-300 ${
                    activeTab === tab
                      ? "text-black dark:text-white"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
                  }`}
                >
                  {activeTab === tab && (
                    <motion.span
                      layoutId="sample-bubble"
                      className="absolute inset-0 z-0 bg-white dark:bg-black rounded-full shadow-sm"
                      transition={{
                        type: "spring",
                        bounce: 0.2,
                        duration: 0.6,
                      }}
                    />
                  )}
                  <span className="relative z-10">{tab}</span>
                </button>
              ))}
            </div>
            
            <div className="flex gap-2">
              <button
                disabled={isMarking}
                onClick={handleMarkAllPresent}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all text-xs sm:text-sm font-medium border ${
                  isMarking
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed opacity-50"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-purple-600 hover:bg-purple-50 dark:hover:bg-zinc-800"
                }`}
              >
                <HiCheckCircle className={isMarking ? "animate-pulse" : ""} />
                {isMarking ? "Marking..." : "Mark All Present"}
              </button>
            </div>
          </div>
          
          {/* TAB CONTENT AREA */}
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 min-h-[400px]"
          >
            {activeTab === "Attendance" && (
              <>
                 {searchParams.get("view") === "attendance" && activeSubject ? (
                   <AttendanceView 
                     subject={activeSubject} 
                     attendanceLogs={attendanceLogs.filter(l => l.subject_id === activeSubject.id)} 
                     token={token}
                     profileId={profileId} 
                   />
                 ) : (
                   <SubjectGrid subjects={academicSubjects} token={token} />
                 )}
              </>
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
          </motion.div>
        </div>
    </div>
  );
}
