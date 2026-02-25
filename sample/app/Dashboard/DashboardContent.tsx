"use client";
import { useState, useEffect, useMemo } from "react"; 
import { useLiveQuery } from "dexie-react-hooks"; 
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { motion } from "motion/react";
import AddSubjectModal from "../components/AddSubjectModal";
import SemesterSettingsModal from "../components/SemesterSettingModal";
import SubjectGrid from "../components/subjectCard";
import AttendanceView from "../components/AttendanceView";
import { RiSettingsFill } from "react-icons/ri";
import GradesTab from "../components/GradesTab";
import TasksTab from "../components/TasksTab";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { HiCheckCircle } from "react-icons/hi";

const tabs = ["Attendance", "Grades", "Tasks"] as const;
type TabType = (typeof tabs)[number];

export default function DashboardContent({ data }: { data: any }) { 
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = tabs.includes(tabParam as TabType) ? (tabParam as TabType) : tabs[0];
  const activeSemId = searchParams.get("sem") || "";
  const pathname = usePathname();

  // DERIVE LOCAL STATE FROM PROPS (data)
  const allSemesters = data?.program?.semesters?.sort((a: any, b: any) => a.number - b.number) || [];

  // --- AUTO-SELECT LOGIC ---
  useEffect(() => {
    if (allSemesters.length > 0 && !activeSemId) {
      const firstSemId = allSemesters[0].id;
      const params = new URLSearchParams(searchParams.toString());
      params.set("sem", firstSemId);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [allSemesters.length, activeSemId]); 

  // --- INITIAL SYNC ---
  useEffect(() => {
    if (data) {
      const triggerSync = async () => {
        // Simple throttle to prevent constant hammering during revalidation
        const now = Date.now();
        const lastSync = (window as any)._lastSyncPull || 0;
        if (now - lastSync < 15000) return; // 15s throttle
        (window as any)._lastSyncPull = now;

        const { syncPull } = await import("@/lib/sync");
        console.log("Triggering throttled sync...");
        await syncPull();
      };
      triggerSync();
    }
  }, [data]);
  const activeSemData = allSemesters.find((s: any) => s.id === activeSemId);
  const serverSubjects = activeSemData?.subjects || [];

  const liveSubjects = useLiveQuery(async () => {
    if (!activeSemId) return [];
    try {
        // 1. Fetch Subjects (Filtered by Sem)
        const subs = await db.subjects.where('semId').equals(activeSemId).toArray();
        
        // 2. Fetch only related data via indexed sub-queries
        const subIds = subs.map(s => s.id);
        const [allTasks, allGrades, allAttendance] = await Promise.all([
          db.tasks.where('subjectId').anyOf(subIds).toArray(),
          db.grades.where('subjectId').anyOf(subIds).toArray(),
          db.attendance.where('subjectId').anyOf(subIds).toArray()
        ]);

        // 3. Join in Memory
        subs.forEach((s: any) => {
            s.tasks = allTasks.filter((t: any) => t.subjectId === s.id);
            s.grades = allGrades.filter((g: any) => g.subjectId === s.id);
            s.attendance = allAttendance.filter((a: any) => a.subjectId === s.id);
        });

        return subs;
    } catch (e) {
        console.error("LiveQuery Error:", e);
        return [];   
    }
  }, [activeSemId]);

  const subjects = liveSubjects || serverSubjects;
  const totalSubjects = subjects.length;
  
  const attendanceStats = useMemo(() => {
      let total = 0;
      let attended = 0;
      subjects.forEach((sub: any) => {
          (sub.attendance || []).forEach((att: any) => {
             total += att.totalLectures;
             attended += att.attendedLectures;
          });
      });
      return total > 0 ? (attended / total) * 100 : 0;
  }, [subjects]);

  const sgpa = useMemo(() => {
      if (subjects.length === 0) return "0.00";
      let totalPoints = 0;
      subjects.forEach((sub: any) => {
          (sub.grades || []).forEach((g: any) => {
             const marks = (g.midSem || 0) + (g.endSem || 0) + (g.Project || 0) + (g.Viva || 0);
             if (marks >= 90) totalPoints += 10;
             else if (marks >= 80) totalPoints += 9;
             else if (marks >= 70) totalPoints += 8;
             else if (marks >= 60) totalPoints += 7;
             else if (marks >= 50) totalPoints += 6;
             else if (marks >= 40) totalPoints += 5;
          });
      });
      return (totalPoints / subjects.length).toFixed(2);
  }, [subjects]);

  const totalCredits = useMemo(() => {
    return subjects.reduce((acc: number, sub: any) => acc + (sub.credits || 0), 0);
  }, [subjects]);

  const totalEarnedCredits = useMemo(() => {
    let earned = 0;
    subjects.forEach((sub: any) => {
        (sub.attendance || []).forEach((att: any) => {
            earned += (att.attendedLectures / 15);
        });
    });
    return earned;
  }, [subjects]);

  const pendingTasksCount = useMemo(() => {
      let count = 0;
      subjects.forEach((sub: any) => {
          (sub.tasks || []).forEach((t: any) => {
             if (!t.completed) count++;
          });
      });
      return count;
  }, [subjects]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false);
  
  const handleTabChange = (tab: TabType) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const [isMarking, setIsMarking] = useState(false);
  const handleMarkAllPresent = async () => {
    if (!activeSemId) return;
    try {
      setIsMarking(true);
      
      const today = new Date();
      const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const todayDayName = dayNames[today.getDay()];

      const { queueMutation } = await import("@/lib/sync");
      const { isSameDay, startOfDay, differenceInCalendarWeeks } = await import("date-fns");
      const { toLocalMidnight } = await import("@/lib/dateUtils");

      let count = 0;
      for (const subject of subjects) {
        const attendance = subject.attendance?.[0];
        if (!attendance) continue;

        const isScheduledToday = attendance.schedule?.includes(todayDayName);
        if (!isScheduledToday) continue;

        // NEW: Check Alternate Week Parity
        if (attendance.scheduleType === "alternate") {
            const weekDiff = differenceInCalendarWeeks(todayMidnight, toLocalMidnight(attendance.startDate), { weekStartsOn: 0 });
            if (weekDiff % 2 !== 0) continue; // Skip if it's an "off" week
        }

        const isAlreadyMarked = [...(attendance.presentDates || []), ...(attendance.absencesDates || [])].some(
          (d: Date) => isSameDay(startOfDay(new Date(d)), todayMidnight)
        );

        if (!isAlreadyMarked) {
          const newPresents = [...(attendance.presentDates || []), todayMidnight];
          
          // 1. Local Optimistic Update
          await db.attendance.update(attendance.id, {
            presentDates: newPresents,
            attendedLectures: newPresents.length
          });

          // 2. Queue Mutation for Background Sync
          await queueMutation('attendance', 'update', {
            id: attendance.id,
            subjectId: attendance.subjectId,
            presentDates: newPresents,
            attendedLectures: newPresents.length
          });
          count++;
        }
      }

      if (count > 0) {
        toast.success(`Success! Marked attendance for ${count} subjects.`, {
          description: "All scheduled classes for today have been updated locally and queued for sync."
        });
      } else {
        toast.info("No unmarked classes scheduled for today.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong.");
    } finally {
      setIsMarking(false);
    }
  };
  
  const activeSubjectId = searchParams.get("subject");
  const activeSubject = subjects.find((s: any) => s.id === activeSubjectId);

  return (
    <div className="flex flex-col items-center bg-zinc-50 font-sans dark:bg-zinc-950 min-h-screen p-4 md:p-8 transition-all">
      {activeSemId ? (
        <div className="max-w-6xl w-full">
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
            <div className="bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 p-6 rounded-xl border">
              <SemesterSettingsModal
                isOpen={isSettingModalOpen}
                onClose={() => setIsSettingModalOpen(false)}
                semId={activeSemId}
                semesters={allSemesters}
                programId={data?.programId}
              />
              <div className="flex justify-between items-center">
                <h3 className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                  Semester
                </h3>
                <RiSettingsFill
                  onClick={() => setIsSettingModalOpen(true)}
                  className="cursor-pointer"
                />
              </div>
              <p className="text-zinc-900 dark:text-zinc-50 text-3xl font-bold">
                {activeSemData ? `${activeSemData.no}` : "..."}
              </p>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs font-small mt-2">
                Current Semester
              </p>
            </div>

            <div className="bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 p-6 rounded-xl border">
              <h3 className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                Total Subjects
              </h3>
              <p className="text-zinc-900 dark:text-zinc-50 text-3xl font-bold">
                {totalSubjects}
              </p>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs font-small mt-2">
                {totalCredits} Total Credits
              </p>
            </div>

            <div className="bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 p-6 rounded-xl border">
              <h3 className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                Overall Attendance
              </h3>
              <p className="text-zinc-900 dark:text-zinc-50 text-3xl font-bold">
                {attendanceStats.toFixed(0)}%
              </p>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full mt-4">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${attendanceStats}%` }}
                  className="bg-linear-to-r from-violet-600 via-purple-600 to-pink-500 dark:from-violet-500 h-2 rounded-full"
                />
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 text-[10px] items-center gap-1 font-medium mt-2 flex">
                <span className="text-purple-600 font-bold">{totalEarnedCredits.toFixed(1)}</span> Credits Earned of <span className="text-zinc-900 dark:text-zinc-50 font-bold">{totalCredits}</span>
              </p>
            </div>
            
            <div className="bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 p-6 rounded-xl border">
              <h3 className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                SGPA
              </h3>
              <p className="text-zinc-900 dark:text-zinc-50 text-3xl font-bold">
                {sgpa}
              </p>
               <p className="text-zinc-500 dark:text-zinc-400 text-xs font-small mt-2">
                Semester Grade Point Average: {sgpa}
              </p>
            </div>
             <div className="bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 p-6 rounded-xl border">
              <h3 className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                Pending Tasks
              </h3>
              <p className="text-zinc-900 dark:text-zinc-50 text-3xl font-bold">
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
                disabled={!activeSemId || isMarking}
                onClick={handleMarkAllPresent}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-xs sm:text-sm font-medium border ${
                  !activeSemId || isMarking
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed opacity-50"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-purple-600 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                <HiCheckCircle className={isMarking ? "animate-pulse" : ""} />
                {isMarking ? "Marking..." : "Mark Today's Classes"}
              </button>
              <button
                disabled={!activeSemId}
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete("edit");
                  router.replace(`${pathname}?${params.toString()}`, {
                    scroll: false,
                  });
                  setIsModalOpen(true);
                }}
                className={`px-4 py-2 rounded-lg flex items-center transition-all ${
                  !activeSemId
                    ? "bg-zinc-300 cursor-not-allowed opacity-50"
                    : "bg-zinc-950 dark:bg-zinc-50 text-white dark:text-black hover:bg-zinc-800"
                }`}
              >
                Add Subject
              </button>
            </div>
            <AddSubjectModal
              isOpen={isModalOpen}
              onClose={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.delete("edit");
                router.replace(`${pathname}?${params.toString()}`, {
                  scroll: false,
                });
                setIsModalOpen(false);
              }}
              semId={activeSemId}
              subjects={subjects}
            />
          </div>
          
          <div className="mt-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 min-h-40 flex items-center justify-center">
            {activeTab === "Attendance" && (
              <>
                 {searchParams.get("view") === "attendance" && activeSubject ? (
                  <AttendanceView subject={activeSubject} />
                ) : (
                  <SubjectGrid subjects={subjects} />
                )}
              </>
            )}
            {activeTab === "Grades" && <GradesTab subjects={subjects} />}
            {activeTab === "Tasks" && <TasksTab subjects={subjects} />}
          </div>
        </div>
      ) : (
        <div className="text-zinc-500 dark:text-zinc-400">
          Loading Data...
        </div>
      )}
    </div>
  );
}
