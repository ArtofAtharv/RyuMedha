"use client";

import { useState, useMemo } from "react"; 
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from '@supabase/supabase-js';
import { RiSettingsFill } from "react-icons/ri";
import { HiCheckCircle } from "react-icons/hi";

import SubjectGrid from "@/components/sample-ui/subjectCard";
import AttendanceView from "@/components/sample-ui/AttendanceView";
import GradesTab from "@/components/sample-ui/GradesTab";
import TasksTab from "@/components/sample-ui/TasksTab";

const tabs = ["Attendance", "Grades", "Tasks"] as const;
type TabType = (typeof tabs)[number];

export default function SampleDashboardContent({ 
  profile, 
  subjectsData, 
  attendanceLogs, 
  gradesData, 
  tasksData 
}: { 
  profile: any, 
  subjectsData: any[], 
  attendanceLogs: any[], 
  gradesData: any[], 
  tasksData: any[] 
}) { 
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = tabs.includes(tabParam as TabType) ? (tabParam as TabType) : tabs[0];
  const pathname = usePathname();

  // In the real app, we don't have "semesters" scoped like the sample yet,
  // we just have globally "active" academic subjects.
  const subjects = subjectsData || [];
  const totalSubjects = subjects.length;
  
  // Calculate attendance using Supabase mapped data
  const attendanceStats = useMemo(() => {
    let totalClasses = 0;
    let totalAttended = 0;

    subjects.forEach((sub: any) => {
      const subjectLogs = attendanceLogs.filter(log => log.subject_id === sub.id) || [];
      const logPresent = subjectLogs.filter(log => log.status === 'present').length;
      const logAbsent = subjectLogs.filter(log => log.status === 'absent').length;

      const present = logPresent + (sub.legacy_attended_lectures || 0);
      const absent = logAbsent + (sub.legacy_missed_lectures || 0);
      
      totalAttended += present;
      totalClasses += (present + absent);
    });

    return totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;
  }, [subjects, attendanceLogs]);

  // SGPA - Roughly map sample's logic to our maximum marks format
  const sgpa = useMemo(() => {
      if (subjects.length === 0 || gradesData.length === 0) return "0.00";
      let totalPoints = 0;
      subjects.forEach((sub: any) => {
          const subGrades = gradesData.filter(g => g.subject_id === sub.id);
          let marks = 0;
          let maxMarks = 0;
          
          subGrades.forEach(g => {
             marks += Number(g.marks);
             maxMarks += Number(g.max_marks);
          });
          
          // Fallback to average mapping if maxMarks exists
          const pct = maxMarks > 0 ? (marks / maxMarks) * 100 : 0;

          if (pct >= 90) totalPoints += 10;
          else if (pct >= 80) totalPoints += 9;
          else if (pct >= 70) totalPoints += 8;
          else if (pct >= 60) totalPoints += 7;
          else if (pct >= 50) totalPoints += 6;
          else if (pct >= 40) totalPoints += 5;
      });
      return (totalPoints / subjects.length).toFixed(2);
  }, [subjects, gradesData]);

  // Mock static credits as sample did
  const totalCredits = useMemo(() => {
    return subjects.length * 3; // Approx 3 credits per subject
  }, [subjects]);

  const totalEarnedCredits = useMemo(() => {
    // Basic mapped logic
    return (attendanceStats / 100) * totalCredits;
  }, [attendanceStats, totalCredits]);

  const pendingTasksCount = useMemo(() => {
      return tasksData.filter(t => !t.is_completed).length;
  }, [tasksData]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  
  const handleTabChange = (tab: TabType) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleMarkAllPresent = async () => {
     // TODO: Implement Supabase bulk insert
     console.log("Marking all present...");
  };
  
  const activeSubjectId = searchParams.get("subject");
  const activeSubject = subjects.find((s: any) => s.id === activeSubjectId);

  return (
    <div className="flex flex-col items-center bg-zinc-50 font-sans dark:bg-zinc-950 min-h-screen p-4 md:p-8 transition-all">
        <div className="max-w-6xl w-full">
          {/* TOP SUMMARY CARDS */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
            <div className="bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 p-6 rounded-xl border relative">
              <div className="flex justify-between items-center absolute top-6 right-6">
                <RiSettingsFill
                  onClick={() => setIsSettingModalOpen(true)}
                  className="cursor-pointer text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                />
              </div>
              <h3 className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                Semester
              </h3>
              <p className="text-zinc-900 dark:text-zinc-50 text-3xl font-bold mt-1">
                Active
              </p>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs font-small mt-2">
                Current Semester
              </p>
            </div>

            <div className="bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 p-6 rounded-xl border">
              <h3 className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                Total Subjects
              </h3>
              <p className="text-zinc-900 dark:text-zinc-50 text-3xl font-bold mt-1">
                {totalSubjects}
              </p>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs font-small mt-2">
                ~{totalCredits} Total Credits
              </p>
            </div>

            <div className="bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 p-6 rounded-xl border">
              <h3 className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                Overall Attendance
              </h3>
              <p className="text-zinc-900 dark:text-zinc-50 text-3xl font-bold mt-1">
                {attendanceStats.toFixed(0)}%
              </p>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full mt-4">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${attendanceStats}%` }}
                  className="bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 dark:from-violet-500 h-2 rounded-full"
                />
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 text-[10px] items-center gap-1 font-medium mt-2 flex">
                <span className="text-purple-600 font-bold">{totalEarnedCredits.toFixed(1)}</span> Credits Earned of <span className="text-zinc-900 dark:text-zinc-50 font-bold">{totalCredits}</span>
              </p>
            </div>
            
            <div className="bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 p-6 rounded-xl border">
              <h3 className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                Pending Tasks
              </h3>
              <p className="text-zinc-900 dark:text-zinc-50 text-3xl font-bold mt-1">
                {pendingTasksCount}
              </p>
              <p
                className="text-zinc-500 dark:text-zinc-400 text-xs font-small mt-2 hover:underline cursor-pointer"
                onClick={() => handleTabChange("Tasks")}
              >
                view task list →
              </p>
            </div>
          </div>
          
          {/* TAB BUBBLE NAVIGATION & ACTION BUTTONS */}
          <div className="mt-8 w-full flex justify-between items-center text-xs sm:text-sm font-medium">
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
                      layoutId="bubble"
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
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-xs sm:text-sm font-medium border ${
                  isMarking
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed opacity-50"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-purple-600 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                <HiCheckCircle className={isMarking ? "animate-pulse" : ""} />
                {isMarking ? "Marking..." : "Mark Today's Classes"}
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 rounded-lg flex items-center transition-all bg-zinc-950 dark:bg-zinc-50 text-white dark:text-black hover:bg-zinc-800 text-xs sm:text-sm"
              >
                Add Subject
              </button>
            </div>
          </div>
          
          {/* TAB CONTENT AREA */}
          <div className="mt-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 min-h-[400px] flex flex-col items-center justify-center">
            {activeTab === "Attendance" && (
              <>
                 {searchParams.get("view") === "attendance" && activeSubject ? (
                   <AttendanceView 
                     subject={activeSubject} 
                     attendanceLogs={attendanceLogs.filter(l => l.subject_id === activeSubject.id)} 
                     profileId={profile?.id} 
                   />
                 ) : (
                   <SubjectGrid subjects={subjects} />
                 )}
              </>
            )}
            {activeTab === "Grades" && <GradesTab subjects={subjects} gradesData={gradesData} profileId={profile?.id} />}
            {activeTab === "Tasks" && <TasksTab subjects={subjects} tasksData={tasksData} profileId={profile?.id} />}
          </div>
        </div>
    </div>
  );
}
