"use client";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  HiAcademicCap,
  HiOfficeBuilding,
  HiArrowRight,
} from "react-icons/hi";
import { useRouter } from "next/navigation";
import { upsertProfile, fetchDashboardData } from "@/app/actions/academic";
import { useSession } from "next-auth/react";

const programs = [
  { id: "ballb", name: "BA. LL.B", sems: 10 },
  { id: "btech", name: "B.Tech (CS)", sems: 8 },
  { id: "bba", name: "BBA", sems: 6 },
  { id: "mca", name: "MCA", sems: 4 },
];

export default function ProfileSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [form, setForm] = useState({
    name: "",
    college: "",
    programId: "",
    currentSemester: 1,
  });

  const selectedProgram = programs.find((p) => p.id === form.programId);
  const { data: session, status, update } = useSession(); 

  useEffect(() => {
    // Check if user already has a profile (Server Side check via action wrapper if needed, 
    // or just rely on 'fetchDashboardData' which we imported)
    const checkUser = async () => {
         if (status === "authenticated") {
             const data = await fetchDashboardData();
             if (data && data.programId) {
                 // Already setup
                 router.replace("/Dashboard");
             } else if (data) {
                 // User exists but maybe partial? Pre-fill
                 setForm(prev => ({
                     ...prev,
                     name: data.name || "",
                     college: data.college || "",
                     programId: data.programId || ""
                 }));
             }
         }
         setInitialCheckDone(true);
    };
    if (status !== "loading") {
        checkUser();
    }
  }, [status, router]);

  const handleComplete = async () => {
    // Validation
    if (!form.name || !form.college || !form.programId) {
      alert("Please fill in all required fields");
      return;
    }
    if (!session?.user?.id) {
      alert("Please wait for your session to load or try logging in again.");
      return;
    }

    setLoading(true);
    try {
      console.log("Starting profile setup...");
      
      const result = await upsertProfile({
          name: form.name,
          college: form.college,
          programId: form.programId,
          currentSemester: form.currentSemester
      });
      
      console.log("Profile upserted successfully:", result);
      
      // Update session if needed
      console.log("Updating session...");
      await update({ programId: form.programId });
      console.log("Session updated");

      // Redirect to Dashboard (revalidatePath in server action handles cache)
      console.log("Redirecting to Dashboard...");
      router.replace("/Dashboard");
      
    } catch (error) {
      console.error("Setup failed:", error);
      
      // Extract detailed error message
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      alert(`Setup failed: ${errorMessage}\n\nPlease check the browser console and Vercel logs for more details.`);
      setLoading(false);
    }
  };
  
  if (status === "loading" || !initialCheckDone) {
      return <div className="min-h-screen flex items-center justify-center dark:text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl">
        {/* --- DYNAMIC ID CARD PREVIEW --- */}
        <motion.div
          layout
          className="w-full bg-linear-to-br from-indigo-600 via-purple-600 to-pink-500 p-8 rounded-[40px] shadow-2xl shadow-purple-500/30 text-white mb-12 relative overflow-hidden"
        >
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-10">
              <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl">
                <HiAcademicCap className="text-3xl" />
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
                  Student ID
                </p>
                <p className="text-xs font-mono">2026-STU-AUTO</p>
              </div>
            </div>

            <div className="space-y-1">
              <motion.h2 layout className="text-3xl font-bold tracking-tight">
                {form.name || "Your Full Name"}
              </motion.h2>
              <motion.p
                layout
                className="text-purple-100 flex items-center gap-2 text-sm opacity-80"
              >
                <HiOfficeBuilding className="text-lg" />{" "}
                {form.college || "Your University Name"}
              </motion.p>
            </div>

            <div className="mt-10 pt-6 border-t border-white/10 flex justify-between items-center">
              <div>
                <p className="text-[10px] uppercase font-bold text-purple-200 tracking-wider">
                  Academic Program
                </p>
                <p className="font-semibold text-lg">
                  {selectedProgram?.name || "Select Course"}
                </p>
              </div>
              {selectedProgram && (
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-purple-200 tracking-wider">
                    Duration
                  </p>
                  <p className="font-semibold">
                    {selectedProgram.sems} Semesters
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Decorative blur circles */}
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        </motion.div>

        {/* --- FORM SECTION --- */}
        <div className="space-y-8 px-2">
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-zinc-400 tracking-widest ml-1">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <input
                type="text"
                placeholder="Full Name"
                className="w-full bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-5 rounded-3xl outline-none focus:ring-2 ring-purple-500/20 transition-all dark:text-white"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                type="text"
                placeholder="College / University"
                className="w-full bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-5 rounded-3xl outline-none focus:ring-2 ring-purple-500/20 transition-all dark:text-white"
                value={form.college}
                onChange={(e) => setForm({ ...form, college: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-zinc-400 tracking-widest ml-1">
              Academic Program
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {programs.map((prog) => (
                <button
                  key={prog.id}
                  onClick={() => setForm({ ...form, programId: prog.id })}
                  className={`p-4 rounded-3xl border text-left transition-all ${
                    form.programId === prog.id
                      ? "bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-500/20"
                      : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-purple-500"
                  }`}
                >
                  <p className="text-xs font-bold opacity-70 mb-1">
                    {prog.sems} Sems
                  </p>
                  <p className="font-bold leading-tight">{prog.name}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-zinc-400 tracking-widest ml-1">
              Current Semester
            </h3>
            <div className="group">
              <label className="text-xs font-bold text-zinc-500 ml-1">
                Which semester are you currently in?
              </label>
              <div className="flex items-center gap-4 mt-2">
                <input
                  type="number"
                  min="1"
                  max={selectedProgram?.sems || 10}
                  className="w-24 bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-4 rounded-3xl outline-none focus:ring-2 ring-purple-500/20 transition-all dark:text-white font-bold text-center"
                  value={form.currentSemester}
                  onChange={(e) => setForm({ ...form, currentSemester: parseInt(e.target.value) || 1 })}
                />
                <p className="text-sm text-zinc-500 font-medium">
                  Semester {form.currentSemester}
                </p>
              </div>
            </div>
          </div>

          <button
            disabled={loading || !form.name || !form.programId}
            onClick={handleComplete}
            className="w-full py-6 bg-zinc-900 dark:bg-white dark:text-black text-white rounded-4xl font-bold text-xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:grayscale transition-all shadow-xl"
          >
            {loading ? "Initializing..." : "Get Started"}
            <HiArrowRight />
          </button>
          

        </div>
      </div>
    </div>
  );
}
