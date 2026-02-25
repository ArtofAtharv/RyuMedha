"use client";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  HiAcademicCap,
  HiOfficeBuilding,
  HiRefresh,
  HiCheckCircle,
  HiExclamation,
  HiTrash,
} from "react-icons/hi";
import { fetchDashboardData, upsertProfile, resetUserData } from "@/app/actions/academic";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { db } from "@/lib/db";

const programs = [
  { id: "ballb", name: "BA. LL.B", sems: 10 },
  { id: "btech", name: "B.Tech (CS)", sems: 8 },
  { id: "bba", name: "BBA", sems: 6 },
  { id: "mca", name: "MCA", sems: 4 },
];

export default function UserProfilePage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loggedout, setLoggedOut] = useState(false);

  const [form, setForm] = useState({
    name: "",
    college: "",
    programId: "",
    currentSemester: 1,
  });

  // 1. Fetch current user data from Server
  useEffect(() => {
    const init = async () => {
         const data = await fetchDashboardData();
          if (data) {
              const activeSem = data.program?.semesters?.find((s: any) => s.id === data.currentSemId);
              setForm({
                  name: data.name || "",
                  college: data.college || "",
                  programId: data.programId || "",
                  currentSemester: activeSem?.number || 1
              });
          }
    };
    init();
  }, []);

  const handleLogOut = () => {
    setLoggedOut(true);
    signOut({ callbackUrl: "/" });
  }

  const selectedProgram = programs.find((p) => p.id === form.programId);

  const handleUpdate = async () => {
    if (!form.name || !form.college || !form.programId) return;
    setLoading(true);
    setSuccess(false);

    try {
      await upsertProfile({
          name: form.name,
          college: form.college,
          programId: form.programId,
          currentSemester: form.currentSemester
      });
      // Update session just in case
      await update({ programId: form.programId });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Update failed", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = async () => {
    const confirmReset = confirm(
      "CRITICAL ACTION: This will delete your profile data. This cannot be undone. Proceed?",
    );
    if (confirmReset) {
      try {
        setLoading(true);
        // 1. Clear Server Data
        await resetUserData();
        
        // 2. Clear Local Data
        await Promise.all([
          db.users.clear(),
          db.programs.clear(),
          db.semesters.clear(),
          db.subjects.clear(),
          db.tasks.clear(),
          db.grades.clear(),
          db.attendance.clear(),
          db.mutationQueue.clear()
        ]);

        alert("All academic data has been deleted successfully.");
        window.location.reload(); // Refresh to reset state
      } catch (error) {
        console.error("Reset failed", error);
        alert("Failed to reset data. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-12 pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
        {/* --- LEFT SIDE: THE CARD VIEW --- */}
        <div className="lg:sticky lg:top-12">
          <div className="mb-8">
            <h2 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">
              Profile
            </h2>
            <p className="text-zinc-500 text-sm mt-1">
              Manage your academic identity and preferences.
            </p>
          </div>

          <motion.div
            layout
            className="w-full bg-linear-to-br from-indigo-600 via-purple-600 to-pink-500 p-8 rounded-[40px] shadow-2xl shadow-purple-500/30 text-white relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-16">
                <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl">
                  <HiAcademicCap className="text-3xl" />
                </div>
                <div className="text-right opacity-60">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                    Verified Student
                  </p>
                  <p className="text-xs font-mono italic">Cloud Sync Active</p>
                </div>
              </div>

              <div className="space-y-1">
                <motion.h2 layout className="text-3xl font-bold tracking-tight">
                  {form.name || "Set Name"}
                </motion.h2>
                <motion.p
                  layout
                  className="text-purple-100 flex items-center gap-2 text-sm opacity-80"
                >
                  <HiOfficeBuilding className="text-lg" />{" "}
                  {form.college || "Set University"}
                </motion.p>
              </div>

              <div className="mt-10 pt-6 border-t border-white/10 flex justify-between items-center">
                <div>
                  <p className="text-[10px] uppercase font-bold text-purple-200 tracking-wider">
                    Program
                  </p>
                  <p className="font-semibold">
                    {selectedProgram?.name || "Not Set"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-purple-200 tracking-wider">
                    Duration
                  </p>
                  <p className="font-semibold">
                    {selectedProgram?.sems || 0} Sems
                  </p>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          </motion.div>
        </div>

        {/* --- RIGHT SIDE: THE UPDATE FORM --- */}
        <div className="space-y-12">
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <div className="h-px w-8 bg-zinc-200 dark:bg-zinc-800" />
              <h3 className="text-[10px] font-black uppercase tracking-widest">
                Personal Details
              </h3>
            </div>
            <div className="space-y-3">
              <div className="group">
                <label className="text-xs font-bold text-zinc-500 ml-1">
                  Full Name
                </label>
                <input
                  type="text"
                  className="w-full bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-4 rounded-2xl outline-none focus:ring-2 ring-purple-500/20 transition-all dark:text-white"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="group">
                <label className="text-xs font-bold text-zinc-500 ml-1">
                  Institution
                </label>
                <input
                  type="text"
                  className="w-full bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-4 rounded-2xl outline-none focus:ring-2 ring-purple-500/20 transition-all dark:text-white"
                  value={form.college}
                  onChange={(e) =>
                    setForm({ ...form, college: e.target.value })
                  }
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <div className="h-px w-8 bg-zinc-200 dark:bg-zinc-800" />
              <h3 className="text-[10px] font-black uppercase tracking-widest">
                Current Course
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {programs.map((prog) => (
                <button
                  key={prog.id}
                  onClick={() => setForm({ ...form, programId: prog.id })}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    form.programId === prog.id
                      ? "bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-500/20"
                      : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-purple-500/50"
                  }`}
                >
                  <span className="font-bold">{prog.name}</span>
                  <span className="text-[10px] font-bold opacity-60">
                    {prog.sems} Semesters
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <div className="h-px w-8 bg-zinc-200 dark:bg-zinc-800" />
              <h3 className="text-[10px] font-black uppercase tracking-widest">
                Start Semester
              </h3>
            </div>
            <div className="group">
              <label className="text-xs font-bold text-zinc-500 ml-1">
                Which semester are you currently in?
              </label>
              <div className="flex items-center gap-4 mt-2">
                <input
                  type="number"
                  min="1"
                  max={selectedProgram?.sems || 10}
                  className="w-24 bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-4 rounded-2xl outline-none focus:ring-2 ring-purple-500/20 transition-all dark:text-white font-bold text-center"
                  value={form.currentSemester}
                  onChange={(e) => setForm({ ...form, currentSemester: parseInt(e.target.value) || 1 })}
                />
                <p className="text-sm text-zinc-500 font-medium">
                  Semester {form.currentSemester}
                </p>
              </div>
            </div>
          </section>

          <div className="pt-4">
            <button
              disabled={loading}
              onClick={handleUpdate}
              className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-xl active:scale-95 ${
                success
                  ? "bg-green-500 text-white"
                  : "bg-zinc-900 dark:bg-white dark:text-black text-white hover:opacity-90"
              }`}
            >
              {loading ? (
                <HiRefresh className="animate-spin text-lg" />
              ) : success ? (
                <HiCheckCircle className="text-lg" />
              ) : (
                "Save Changes"
              )}
              {success ? "Profile Updated" : ""}
            </button>
            <button
              disabled={loading}
              onClick={handleLogOut}
              className={`w-full py-4 mt-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-xl active:scale-95 ${
                loggedout
                  ? "bg-red-800 text-white"
                  : "bg-red-600 text-white hover:opacity-80"
              }`}
            >
              {loading ? (
                <HiRefresh className="animate-spin text-lg" />
              ) : loggedout ? (
                <HiCheckCircle className="text-lg" />
              ) : (
                "Log Out"
              )}
              {loggedout ? "Logged Out" : ""}
            </button>

            {/* DANGER ZONE */}
            <div className="mt-12 p-6 rounded-4xl border border-red-100 dark:border-red-900/20 bg-red-50/30 dark:bg-red-950/10 space-y-4">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <HiExclamation className="text-xl" />
                <h4 className="font-bold text-sm uppercase tracking-tight">
                  Danger Zone
                </h4>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Resetting your account will delete all data. This action is irreversible.
              </p>
              <button
                onClick={handleResetData}
                className="flex items-center gap-2 text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
              >
                <HiTrash />
                Delete All Academic Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
