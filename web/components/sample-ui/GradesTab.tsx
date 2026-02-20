"use client";
import { useState, useEffect } from "react"; 
import { motion, Variants } from "framer-motion";
import { createClient } from "@supabase/supabase-js";
import { HiOutlineClipboardCheck } from "react-icons/hi";
import { useRouter } from "next/navigation";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { type: "spring", mass: 0.8, stiffness: 100, damping: 15 }
  },
};

// --- HOISTED HELPER FUNCTION ---
const getGradeDetails = (score: number, maxScore: number) => {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (pct >= 90) return { grade: "O", points: 10 };
  if (pct >= 80) return { grade: "A+", points: 9 };
  if (pct >= 70) return { grade: "B+", points: 8 };
  if (pct >= 60) return { grade: "B", points: 7 };
  if (pct >= 50) return { grade: "C", points: 6 };
  if (pct >= 40) return { grade: "P", points: 5 };
  return { grade: "F", points: 0 };
};

export default function GradesTab({ subjects, gradesData, token, profileId }: { subjects: any[], gradesData: any[], token?: string, profileId: string }) {
  if (!subjects.length) return <p className="text-zinc-500 text-center py-10 w-full">No active subjects to grade.</p>;

  return (
    <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
      {subjects.map((sub) => (
        <GradeSubjectCard 
            key={sub.id} 
            subject={sub} 
            subjectGrades={gradesData.filter(g => g.subject_id === sub.id)}
            token={token}
            profileId={profileId}
        />
      ))}
    </motion.div>
  );
}

function GradeSubjectCard({ subject, subjectGrades, token, profileId }: { subject: any, subjectGrades: any[], token?: string, profileId: string }) {
  const router = useRouter();

  // We are going to map our dynamic list of grades back into the static 4-item Sample Layout 
  // MidSem, EndSem, Project, Viva
  const getGradeValue = (type: string) => subjectGrades.find(g => g.grade_type === type)?.marks || 0;
  const getGradeId = (type: string) => subjectGrades.find(g => g.grade_type === type)?.id || null;

  const [localGrades, setLocalGrades] = useState({
     midSem: getGradeValue('mid_sem'),
     endSem: getGradeValue('end_sem'),
     Project: getGradeValue('project'),
     Viva: getGradeValue('viva')
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}
  );

  // --- CALCULATION LOGIC (Sample used static max factors) ---
  const totalMarks = Number(localGrades.midSem) + Number(localGrades.endSem) + Number(localGrades.Project) + Number(localGrades.Viva);
  const totalMax = 100; // Sample locked this at 100
  const { grade, points } = getGradeDetails(totalMarks, totalMax);

  const updateMark = async (field: keyof typeof localGrades, mappedType: string, value: number) => {
    // 1. Optimistic Update
    setLocalGrades(prev => ({ ...prev, [field]: value }));

    const id = getGradeId(mappedType);
    if (id) {
       // Live Update
       await supabase.from('grades').update({ marks: value }).eq('id', id);
    } else {
       // Live Insert
       await supabase.from('grades').insert([{
           profile_id: profileId,
           subject_id: subject.id,
           grade_type: mappedType,
           marks: value,
           max_marks: mappedType === "mid_sem" ? 20 : mappedType === "end_sem" ? 50 : 15 // Roughly matching sample out-of distribution
       }]);
    }
    router.refresh();
  };

  return (
    <motion.div 
      variants={cardVariants}
      className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-6 rounded-4xl shadow-sm space-y-4 w-full"
    >
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-black text-lg dark:text-white uppercase tracking-tight">{subject.name}</h3>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{subject.code || "Core"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MarkInput label="Mid-Sem /20" value={localGrades.midSem} onChange={(val) => updateMark("midSem", "mid_sem", val)} />
        <MarkInput label="End-Sem /50" value={localGrades.endSem} onChange={(val) => updateMark("endSem", "end_sem", val)} />
        <MarkInput label="Project /15" value={localGrades.Project} onChange={(val) => updateMark("Project", "project", val)} />
        <MarkInput label="Viva /15" value={localGrades.Viva} onChange={(val) => updateMark("Viva", "viva", val)} />
      </div>

      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 flex items-center justify-between border border-zinc-100 dark:border-zinc-800 mt-2">
        <div className="flex items-center gap-3">
           <div className="p-2 bg-white dark:bg-zinc-900 rounded-lg shadow-sm">
              <HiOutlineClipboardCheck />
           </div>
           <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Total Score:</span>
        </div>
        
        <div className="text-right">
          <div className="text-sm font-black dark:text-white">
            {totalMarks.toFixed(1)}<span className="text-zinc-700 dark:text-zinc-400">/{totalMax}</span>
          </div>
          <div className="text-[11px] font-bold text-zinc-500 uppercase flex gap-2 justify-end">
            <span>Grade: <span className="text-purple-600 dark:text-purple-400 font-black">{grade}</span></span>
            <span>({points} PT)</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function MarkInput({ label, value, onChange }: { label: string; value: number; onChange: (val: number) => void }) {
  return (
    <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl p-3 flex flex-col gap-1 focus-within:ring-2 ring-purple-500/50 transition-all">
      <label className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">
        {label}
      </label>
      <input
        type="number"
        min={0}
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="bg-transparent border-none appearance-none outline-none text-xl font-black text-zinc-900 dark:text-zinc-50 w-full"
        placeholder="0"
      />
    </div>
  );
}
