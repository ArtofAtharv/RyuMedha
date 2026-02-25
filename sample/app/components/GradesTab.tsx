"use client";
import { useState, useEffect } from "react"; 
import { updateGrade } from "@/app/actions/academic";
import { motion, Variants } from "motion/react";
import { HiOutlineClipboardCheck } from "react-icons/hi";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.9, 
    y: 20 
  },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: {
      type: "spring", 
      mass: 0.8,
      stiffness: 100,
      damping: 15
    }
  },
};

// --- HOISTED HELPER FUNCTION ---
const getGradeDetails = (score: number) => {
  if (score >= 90) return { grade: "O", points: 10 };
  if (score >= 80) return { grade: "A+", points: 9 };
  if (score >= 70) return { grade: "B+", points: 8 };
  if (score >= 60) return { grade: "B", points: 7 };
  if (score >= 50) return { grade: "C", points: 6 };
  if (score >= 40) return { grade: "P", points: 5 };
  return { grade: "F", points: 0 };
};

export default function GradesTab({ subjects }: { subjects: any[] }) {
  if (!subjects.length) return <p className="text-zinc-500">No subjects to grade.</p>;

  return (
    <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
      {subjects.map((sub) => (
        <GradeSubjectCard key={sub.id} subject={sub} />
      ))}
    </motion.div>
  );
}

function GradeSubjectCard({ subject }: { subject: any }) {
  // 1. Get initial grade from Subject Prop (Server Data)
  const initialGrade = subject.grades?.[0] || {};
  const [localGrade, setLocalGrade] = useState<any>(initialGrade);

  useEffect(() => {
     // Update if server data changes
     setLocalGrade(subject.grades?.[0] || {});
  }, [subject]); 

  // --- CALCULATION LOGIC ---
  const total = (localGrade.midSem || 0) + (localGrade.endSem || 0) + (localGrade.Project || 0) + (localGrade.Viva || 0);
  const { grade, points } = getGradeDetails(total);

  const updateMark = async (field: string, value: number) => {
    // Dynamic Imports
    const { db } = await import("@/lib/db");
    const { queueMutation } = await import("@/lib/sync");

    // 1. Prepare Data
    let currentId = localGrade.id;
    let isNew = false;
    
    if (!currentId) {
        currentId = crypto.randomUUID();
        isNew = true;
        // Update local state immediately with new ID context
        setLocalGrade((prev: any) => ({ ...prev, id: currentId, subjectId: subject.id, [field]: value }));
    } else {
        setLocalGrade((prev: any) => ({ ...prev, [field]: value }));
    }

    // 2. Local DB Update
    if (isNew) {
         await db.grades.add({
             id: currentId,
             subjectId: subject.id,
             midSem: localGrade.midSem || 0,
             endSem: localGrade.endSem || 0,
             Project: localGrade.Project || 0,
             Viva: localGrade.Viva || 0,
             [field]: value // Ensure override
         });
    } else {
         await db.grades.update(currentId, { [field]: value });
    }

    // 3. Queue Mutation
    await queueMutation('grades', 'update', { 
        id: currentId, // Pass ID just in case, though sync might strip it
        subjectId: subject.id,
        [field]: value 
    });
  };

  return (
    <motion.div 
      variants={cardVariants}
      className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-6 rounded-4xl shadow-sm space-y-4"
    >
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-black text-lg dark:text-white uppercase tracking-tight">{subject.name}</h3>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{subject.code || "Core"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MarkInput label="Mid-Sem /20" value={localGrade.midSem || 0} onChange={(val) => updateMark("midSem", val)} />
        <MarkInput label="End-Sem /50" value={localGrade.endSem || 0} onChange={(val) => updateMark("endSem", val)} />
        <MarkInput label="Project" value={localGrade.Project || 0} onChange={(val) => updateMark("Project", val)} />
        <MarkInput label="Viva" value={localGrade.Viva || 0} onChange={(val) => updateMark("Viva", val)} />
      </div>

      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 flex items-center justify-between border border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-3">
           <div className="p-2 bg-white dark:bg-zinc-900 rounded-lg shadow-sm">
              <HiOutlineClipboardCheck className="" />
           </div>
           <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Total Score:</span>
        </div>
        
        <div className="text-right">
          <div className="text-sm font-black dark:text-white">
            {total.toFixed(1)}<span className="text-zinc-700 dark:text-zinc-400">/100</span>
          </div>
          <div className="text-[11px] font-bold text-zinc-500 uppercase flex gap-2 justify-end">
            <span>Grade: <span className="text-purple-600 dark:text-purple-400 font-black">{grade}</span></span>
            <span>•</span>
            <span>Points: <span className="text-purple-600 dark:text-purple-400 font-black">{points}</span></span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function MarkInput({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black uppercase text-zinc-400 ml-1 tracking-tighter">{label}</label>
      <input 
        type="number"
        value={value === 0 ? "" : value}
        onChange={(e) => {
            const val = e.target.value === "" ? 0 : Number(e.target.value);
            onChange(val);
        }}
        placeholder="0"
        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-transparent focus:border-purple-500 focus:bg-white dark:focus:bg-zinc-800 rounded-2xl px-3 py-2 text-sm font-bold outline-none transition-all dark:text-white"
      />
    </div>
  );
}