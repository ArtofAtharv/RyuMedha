"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HiX, HiCalendar, HiAcademicCap } from "react-icons/hi";
import { addSubject, updateSubject } from "@/app/actions/academic";
import { format } from "date-fns";
import { toLocalMidnight, calculateEndDate } from "@/lib/dateUtils";
import { useSearchParams } from "next/navigation";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  semId: string;
  subjects?: any[]; // Pass existing subjects to find data for edit
}
const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function AddSubjectModal({ isOpen, onClose, semId, subjects }: Props) {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const getTodayString = () => format(new Date(), "yyyy-MM-dd");

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    professor: "",
    startDate: "",
    totalLectures: 60,
    credits: 0, // NEW
    scheduleType: "weekly", // NEW: weekly, alternate
  });
  const [schedule, setSchedule] = useState<string[]>([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ]);

  useEffect(() => {
    if (editId && isOpen && subjects) {
        const subject = subjects.find(s => s.id === editId);
        if (subject) {
            const attendance = subject.attendance?.[0]; // Access relation
            
            const formattedDate = attendance ? format(new Date(attendance.startDate), "yyyy-MM-dd") : getTodayString();
            
            setFormData({
                name: subject.name,
                code: subject.code || "",
                professor: subject.professor || "",
                startDate: formattedDate,
                totalLectures: attendance?.totalLectures || 60,
                credits: subject.credits || 0,
                scheduleType: attendance?.scheduleType || "weekly",
            });
            if (attendance?.schedule) {
                setSchedule(attendance.schedule);
            }
        }
    } else {
      // Reset for Add Mode
      setFormData({
        name: "",
        code: "",
        professor: "",
        startDate: getTodayString(),
        totalLectures: 60,
        credits: 0,
        scheduleType: "weekly",
      });
      setSchedule(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
    }
  }, [editId, isOpen, subjects]);

  const toggleDay = (day: string) => {
    setSchedule((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  // Import these at top, but for now assuming next step adds imports or I use dynamic import if needed.
  // Actually better to add imports first. 
  // I will write the function body assuming imports exist.
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Dynamic imports to avoid SSR issues if any, though "use client" handles it.
    // I will add top level imports in next step.
    const { db } = await import("@/lib/db");
    const { queueMutation } = await import("@/lib/sync");

    if (editId) {
        // Update Local
        await db.subjects.update(editId, {
            name: formData.name,
            code: formData.code,
            professor: formData.professor,
            credits: Number(formData.credits)
        });

        const calculatedEndDate = calculateEndDate(
            new Date(formData.startDate),
            formData.totalLectures,
            [], // Current holiday list not accessible here easily? 
            [], // Current exams list not accessible
            schedule,
            formData.scheduleType
        );

        // Update Attendance if exists
        const att = await db.attendance.where('subjectId').equals(editId).first();
        if (att) {
            await db.attendance.update(att.id, {
                startDate: new Date(formData.startDate),
                endDate: calculatedEndDate,
                totalLectures: formData.totalLectures,
                schedule: schedule,
                scheduleType: formData.scheduleType
            });
        }

        // Queue Mutation
        await queueMutation('subjects', 'update', {
            id: editId,
            name: formData.name,
            code: formData.code,
            professor: formData.professor,
            credits: Number(formData.credits),
            attendanceConfig: {
                 startDate: new Date(formData.startDate),
                 totalLectures: formData.totalLectures,
                 schedule: schedule,
                 scheduleType: formData.scheduleType
            }
        });

    } else {
        // Create Local
        const id = crypto.randomUUID();
        const attendanceId = crypto.randomUUID();
        
        await db.subjects.add({
            id,
            semId: semId,
            name: formData.name,
            code: formData.code,
            professor: formData.professor,
            credits: Number(formData.credits)
        });

        // Add default empty arrays/values for joined tables to prevent errors
        const calculatedEndDate = calculateEndDate(
            new Date(formData.startDate),
            formData.totalLectures,
            [], 
            [],
            schedule,
            formData.scheduleType
        );

        await db.attendance.add({
            id: attendanceId,
            subjectId: id,
            startDate: new Date(formData.startDate),
            endDate: calculatedEndDate,
            totalLectures: formData.totalLectures,
            attendedLectures: 0,
            holidays: [],
            absencesDates: [],
            presentDates: [],
            schedule: schedule,
            scheduleType: formData.scheduleType
        });
        
        // Queue Mutation
        await queueMutation('subjects', 'create', {
             id,
             semId: semId,
             name: formData.name,
             code: formData.code,
             professor: formData.professor,
             credits: Number(formData.credits),
             attendanceConfig: {
                 id: attendanceId,
                 startDate: new Date(formData.startDate),
                 totalLectures: formData.totalLectures,
                 schedule: schedule,
                 scheduleType: formData.scheduleType
             }
        });
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white dark:bg-zinc-950 border dark:border-zinc-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-6 border-b dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <HiAcademicCap className="text-purple-500" /> {editId ? "Edit Subject" : "Add New Subject"}
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
              >
                <HiX />
              </button>
            </div>

            {/* Form Content */}
            <form
              onSubmit={handleSubmit}
              className="p-6 overflow-y-auto space-y-6 scrollbar-hide"
            >
              {/* Basic Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1 tracking-widest">
                    Subject Name
                  </label>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-purple-500 outline-none dark:text-white"
                    placeholder="e.g. Constitutional Law II"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1 tracking-widest">
                    Course Code
                  </label>
                  <input
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-2xl px-4 py-3 outline-none dark:text-white"
                    placeholder="e.g. CN002"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1 tracking-widest">
                    Professor
                  </label>
                  <input
                    value={formData.professor}
                    onChange={(e) =>
                      setFormData({ ...formData, professor: e.target.value })
                    }
                    className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-2xl px-4 py-3 outline-none dark:text-white"
                    placeholder="e.g. Dr. Pratap Salunke"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1 tracking-widest">
                    Course Credits
                  </label>
                  <input
                    type="number"
                    value={formData.credits}
                    onChange={(e) =>
                      setFormData({ ...formData, credits: Number(e.target.value) })
                    }
                    className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-2xl px-4 py-3 outline-none dark:text-white"
                    placeholder="e.g. 4"
                  />
                </div>
              </div>

              <hr className="dark:border-zinc-800" />

              <div className="space-y-4">
                <h3 className="font-bold text-sm flex items-center gap-2 text-black tracking-tight">
                  <HiCalendar className="text-purple-500" /> Scheduling
                </h3>

                <div className="space-y-1">
                   <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1 tracking-widest">
                     Schedule Type
                   </label>
                   <div className="flex gap-2">
                     {["weekly", "alternate"].map((type) => (
                       <button
                         key={type}
                         type="button"
                         onClick={() => setFormData({ ...formData, scheduleType: type })}
                         className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold capitalize transition-all ${
                           formData.scheduleType === type
                             ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20"
                             : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                         }`}
                       >
                         {type} Week
                       </button>
                     ))}
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1 tracking-widest">
                      Start Date
                    </label>
                    <input
                      required
                      type="date"
                      value={formData.startDate}
                      onChange={(e) =>
                        setFormData({ ...formData, startDate: e.target.value })
                      }
                      className="w-full bg-zinc-100 dark:bg-zinc-900 rounded-2xl px-4 py-3 outline-none dark:text-white dark:color-scheme-dark"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1 tracking-widest">
                      Total Lectures
                    </label>
                    <input
                      type="number"
                      value={formData.totalLectures}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          totalLectures: Number(e.target.value),
                        })
                      }
                      className="w-full bg-zinc-100 dark:bg-zinc-900 rounded-2xl px-4 py-3 outline-none dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1 tracking-widest">
                    Weekly Schedule
                  </label>
                  <div className="flex flex-wrap my-2 gap-2">
                    {WEEKDAYS.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${schedule.includes(day) ? "bg-purple-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"}`}
                      >
                        {day.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-900 rounded-2xl font-black text-xs dark:text-zinc-400 uppercase tracking-widest transition-all hover:bg-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-purple-500/30 transition-all active:scale-95"
                >
                  {editId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
