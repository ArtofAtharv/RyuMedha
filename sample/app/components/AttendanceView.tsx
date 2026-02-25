"use client";
import { useState, useMemo } from "react";
import { updateAttendance } from "@/app/actions/academic";
import {
  HiArrowLeft,
  HiCalendar,
  HiUser,
  HiCheckCircle,
  HiXCircle,
  HiQuestionMarkCircle,
  HiMinusCircle,
} from "react-icons/hi";
import { useRouter, useSearchParams } from "next/navigation";
import {
  format,
  eachDayOfInterval,
  isSameDay,
  isWeekend,
  eachMonthOfInterval,
  startOfMonth,
  endOfMonth,
  isToday,
  startOfDay,
  differenceInCalendarWeeks,
} from "date-fns";
import { motion } from "motion/react";
import { toLocalMidnight } from "@/lib/dateUtils";

export default function AttendanceView({ subject }: { subject: any }) { 
  const router = useRouter();
  const searchParams = useSearchParams();

  // Data from props now
  const attendance = subject.attendance?.[0]; // Access via relation

  const backToGrid = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("view");
    params.delete("subject");
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const handleToggle = async (date: Date) => {
    if (!attendance) return;

    // Normalize to local midnight
    const targetDate = startOfDay(new Date(date));

    // Helper to check if a date exists in an array of dates
    const existsIn = (arr: Date[] | undefined, d: Date) =>
      (arr || []).some((item: any) => isSameDay(startOfDay(new Date(item)), d));

    const isPresent = existsIn(attendance.presentDates, targetDate);
    const isAbsent = existsIn(attendance.absencesDates, targetDate);

    let newAbsences = [...(attendance.absencesDates || [])];
    let newPresents = [...(attendance.presentDates || [])];

    if (!isAbsent && !isPresent) {
      newPresents.push(targetDate);
    } else if (isPresent) {
      newPresents = newPresents.filter(
        (d: any) => !isSameDay(startOfDay(new Date(d)), targetDate),
      );
      newAbsences.push(targetDate);
    } else {
      newAbsences = newAbsences.filter(
        (d: any) => !isSameDay(startOfDay(new Date(d)), targetDate),
      );
    }

    // Dynamic import to avoid SSR issues
    const { db } = await import("@/lib/db");
    const { queueMutation } = await import("@/lib/sync");

    // 1. Local Optimistic Update
    await db.attendance.update(attendance.id, {
        presentDates: newPresents,
        absencesDates: newAbsences,
        attendedLectures: newPresents.length
    });

    // 2. Queue Mutation for Background Sync
    await queueMutation('attendance', 'update', {
        id: attendance.id,
        subjectId: attendance.subjectId,
        presentDates: newPresents,
        absencesDates: newAbsences,
        attendedLectures: newPresents.length
    });
  };

  if (!attendance || !subject)
    return (
      <div className="p-10 text-center animate-pulse text-zinc-500">
        Loading Subject Data...
      </div>
    );

  const toLocal = (d: any) => toLocalMidnight(d);

  // 1. Force the start and end to the full month boundaries
  const rangeStart = startOfMonth(toLocal(attendance.startDate));
  const rangeEnd = endOfMonth(toLocal(attendance.endDate));

  // 2. This ensures the loop covers every day from the 1st of the first month
  // to the last day of the last month
  const allDaysInRange = eachDayOfInterval({
    start: rangeStart,
    end: rangeEnd,
  });

  // 3. Update the months array to match
  const months = eachMonthOfInterval({
    start: toLocal(attendance.startDate),
    end: toLocal(attendance.endDate),
  });

  const getDayStatus = (date: Date) => {
    const localDate = startOfDay(date);
    const dayName = format(localDate, "EEEE");

    // Check if this specific calendar day is within your actual subject duration
    const isWithinSubjectDates =
      localDate >= toLocalMidnight(attendance.startDate) &&
      localDate <= toLocalMidnight(attendance.endDate);

    const isHoliday = (attendance.holidays || []).some((h: any) =>
      isSameDay(startOfDay(new Date(h)), localDate),
    );
    const examFound = (attendance.exams || []).find((e: any) =>
      isSameDay(startOfDay(new Date(e.date)), localDate),
    );
    const isScheduled = attendance.schedule.includes(dayName);

    let isLectureDay = isWithinSubjectDates && isScheduled && !isHoliday && !examFound && !isWeekend(localDate);

    if (isLectureDay && attendance.scheduleType === "alternate") {
        const weekDiff = differenceInCalendarWeeks(localDate, toLocalMidnight(attendance.startDate), { weekStartsOn: 0 });
        if (weekDiff % 2 !== 0) {
            isLectureDay = false;
        }
    }

    return {
      // Only a lecture if it's within the subject dates AND scheduled
      isLecture: isLectureDay,
      isWithinSubjectDates,
      isHoliday,
      examName: examFound ? examFound.name : null,
      isWeekend: isWeekend(localDate),
    };
  };

  const actualLectureDays = allDaysInRange.filter(
    (d: any) => getDayStatus(d).isLecture,
  );

  // PRE-CALCULATE LOOKUPS FOR PERFORMANCE (After actualLectureDays is defined)
  const presentSet = useMemo(() => new Set((attendance.presentDates || []).map((d: any) => startOfDay(new Date(d)).getTime())), [attendance.presentDates]);
  const absentSet = useMemo(() => new Set((attendance.absencesDates || []).map((d: any) => startOfDay(new Date(d)).getTime())), [attendance.absencesDates]);
  
  const lectureNoMap = useMemo(() => {
    const map = new Map();
    actualLectureDays.forEach((d: any, index: number) => {
        map.set(startOfDay(new Date(d)).getTime(), index + 1);
    });
    return map;
  }, [actualLectureDays]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 80, damping: 20 }}
      className="space-y-8 pb-20 animate-in fade-in duration-500"
    >
      {/* Header Info Card */}
      <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-8 rounded-[40px] shadow-sm">
        <button
          onClick={backToGrid}
          className="flex items-center gap-2 text-zinc-500 hover:text-purple-500 mb-6 transition-colors font-medium"
        >
          <HiArrowLeft /> Back to Dashboard
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-bold text-[10px] uppercase tracking-[0.2em] px-3 py-1 rounded-full">
              {subject.code || "CORE"}
            </span>
            <h1 className="text-4xl font-black tracking-tight dark:text-white">
              {subject.name}
            </h1>
            <div className="flex flex-wrap gap-5 text-sm text-zinc-500 font-medium">
              <span className="flex items-center gap-1.5">
                <HiUser className="text-purple-500" /> {subject.professor}
              </span>
              <span className="flex items-center gap-1.5">
                <HiCalendar className="text-purple-500" />{" "}
                {attendance.schedule.join(", ")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-4xl pr-6">
            <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-purple-500/20">
              {Math.round(
                (attendance.attendedLectures /
                  (attendance.totalLectures || 1)) *
                  100,
              )}
              %
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Attendance
              </p>
              <p className="text-sm font-bold dark:text-white">
                {attendance.attendedLectures} / {attendance.totalLectures}{" "}
                Lectures
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-4xl pr-6 border border-zinc-200 dark:border-zinc-800">
            <div className="w-16 h-16 rounded-full bg-blue-600 flex flex-col items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/20">
              <span className="text-xs leading-none opacity-80 uppercase tracking-tighter">Earned</span>
              {(attendance.attendedLectures / 15).toFixed(1)}
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Course Credits
              </p>
              <p className="text-sm font-bold dark:text-white">
                {subject.credits || 0} Potential
              </p>
            </div>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.2 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className="space-y-12"
      >
        {months.map((month: any) => {
          const daysInMonth: Date[] = allDaysInRange.filter(
            (d: any) => format(d, "MMM yyyy") === format(month, "MMM yyyy"),
          );
          if (daysInMonth.length === 0) return null;

          const year = month.getFullYear();
          const monthIndex = month.getMonth();
          // STRICT LOCAL 1st of the Month
          const firstOfMonth = new Date(year, monthIndex, 1, 0, 0, 0);

          // Wednesday will now reliably return 3
          const startPadding = firstOfMonth.getDay();
          const spacers = Array.from({ length: startPadding });

          return (
            <div key={month.toString()} className="space-y-6">
              <h3 className="text-xl font-bold ml-2 flex items-center gap-3 dark:text-white">
                <div className="w-1 h-6 bg-purple-500 rounded-full" />
                {format(month, "MMMM yyyy")}
              </h3>

              <div className="lg:grid grid-cols-7 gap-4 mb-2 hidden">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <div
                      key={day}
                      className="text-center text-[10px] font-black uppercase text-zinc-400 tracking-widest"
                    >
                      {day}
                    </div>
                  ),
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-4">
                {spacers.map((_, i) => (
                  <div
                    key={`spacer-${i}`}
                    className="hidden lg:block p-5 rounded-4xl border-2 border-transparent"
                  />
                ))}

                {daysInMonth.map((date: Date) => {
                  const localDate = startOfDay(date);
                  const status = getDayStatus(localDate);
                  const isDayToday = isToday(localDate);
                  const isActive =
                    status.isLecture ||
                    (isDayToday && status.isWithinSubjectDates);

                  const lectureNo = lectureNoMap.get(localDate.getTime());
                  const isPresent = presentSet.has(localDate.getTime());
                  const isAbsent = absentSet.has(localDate.getTime());

                  return (
                    <button
                      key={date.toString()}
                      onClick={() => isActive && handleToggle(localDate)}
                      disabled={!isActive}
                      className={`
                        p-5 rounded-4xl border-2 transition-all flex flex-col items-start gap-4 text-left group relative
                        ${isDayToday ? "ring-2 ring-purple-500 ring-offset-4 dark:ring-offset-zinc-950 border-purple-200 dark:border-purple-800/50 opacity-100" : ""}
                        ${
                          !isActive
                            ? "bg-zinc-50 dark:bg-zinc-900/40 opacity-40 border-transparent cursor-default"
                            : isPresent
                              ? "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800/50"
                              : isAbsent
                                ? "bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800/50"
                                : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:border-purple-300"
                        }
                      `}
                    >
                      <div className="flex justify-between w-full items-start">
                        <span
                          className={`text-3xl font-black tabular-nums ${
                            isDayToday
                              ? "text-purple-600 dark:text-purple-400"
                              : !isActive
                                ? "text-zinc-300 dark:text-zinc-700"
                                : isPresent
                                  ? "text-green-600"
                                  : isAbsent
                                    ? "text-red-600"
                                    : "dark:text-white"
                          }`}
                        >
                          {format(localDate, "dd")}
                        </span>
                        {status.isLecture && (
                          <span
                            className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${isDayToday ? "bg-purple-500 text-white" : "bg-zinc-100 dark:bg-zinc-800"}`}
                          >
                            L# {lectureNo}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!isActive ? (
                          <HiMinusCircle className="text-zinc-200 dark:text-zinc-800 text-lg" />
                        ) : isPresent ? (
                          <HiCheckCircle className="text-green-500 text-lg" />
                        ) : isAbsent ? (
                          <HiXCircle className="text-red-500 text-lg" />
                        ) : (
                          <HiQuestionMarkCircle
                            className={`text-lg ${isDayToday ? "text-purple-400" : "text-zinc-300 dark:text-zinc-700"}`}
                          />
                        )}

                        <div className="leading-none overflow-hidden w-full">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase">
                            {format(localDate, "EEEE")}
                          </p>
                          <p
                            className={`text-[10px] font-black uppercase mt-0.5 truncate ${
                              isDayToday
                                ? "text-purple-600 dark:text-purple-400"
                                : !isActive
                                  ? "text-zinc-300 dark:text-zinc-700"
                                  : isPresent
                                    ? "text-green-600"
                                    : isAbsent
                                      ? "text-red-600"
                                      : "text-zinc-400"
                            }`}
                          >
                            {isDayToday && !isPresent && !isAbsent
                              ? "Today"
                              : status.isHoliday
                                ? "Holiday"
                                : status.examName
                                  ? status.examName
                                  : status.isWeekend && !status.isLecture
                                    ? "Weekend"
                                    : !isActive
                                      ? "No Class"
                                      : isPresent
                                        ? "Present"
                                        : isAbsent
                                          ? "Absent"
                                          : "Unmarked"}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
