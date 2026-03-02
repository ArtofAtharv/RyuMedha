"use client";

import { useState } from "react"; 
import { motion, Variants } from "motion/react";
import { createClient } from "@supabase/supabase-js";
import { HiCheckCircle, HiScale, HiFlag, HiAcademicCap } from "react-icons/hi";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 15 }
  },
};

const getGradeDetails = (score: number, maxScore: number) => {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (pct >= 90) return { grade: "O", points: 10, color: "text-emerald-500" };
  if (pct >= 80) return { grade: "A+", points: 9, color: "text-emerald-400" };
  if (pct >= 70) return { grade: "B+", points: 8, color: "text-blue-500" };
  if (pct >= 60) return { grade: "B", points: 7, color: "text-blue-400" };
  if (pct >= 50) return { grade: "C", points: 6, color: "text-amber-500" };
  if (pct >= 40) return { grade: "P", points: 5, color: "text-amber-400" };
  return { grade: "F", points: 0, color: "text-red-500" };
};

export default function GradesTab({ subjects, gradesData, token, profileId }: { subjects: any[], gradesData: any[], token: string, profileId: string }) {
  if (!subjects.length) {
    return (
      <div className="py-20 text-center px-4">
        <div className="inline-block p-10 rounded-[3rem] bg-zinc-50 dark:bg-zinc-950 border-none shadow-inner">
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Neutral State</p>
           <p className="text-zinc-500 font-bold uppercase mt-2 text-xs">No curriculum detected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 px-4">
      <div className="flex justify-between items-end px-4">
        <div>
           <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-zinc-400 opacity-50" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Efficiency Matrix</span>
           </div>
           <h3 className="text-3xl font-black uppercase tracking-tighter dark:text-white italic">Academic Performance</h3>
        </div>
      </div>

      <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
    </div>
  );
}

function GradeSubjectCard({ subject, subjectGrades, token, profileId }: { subject: any, subjectGrades: any[], token: string, profileId: string }) {
  const router = useRouter();
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
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const totalMarks = Number(localGrades.midSem) + Number(localGrades.endSem) + Number(localGrades.Project) + Number(localGrades.Viva);
  const totalMax = 100;
  const { grade, points, color } = getGradeDetails(totalMarks, totalMax);

  const updateMark = async (field: keyof typeof localGrades, mappedType: string, value: number) => {
    setLocalGrades(prev => ({ ...prev, [field]: value }));
    const id = getGradeId(mappedType);
    if (id) {
       await supabase.from('grades').update({ marks: value }).eq('id', id);
    } else {
       await supabase.from('grades').insert([{
           profile_id: profileId,
           subject_id: subject.id,
           grade_type: mappedType,
           marks: value,
           max_marks: mappedType === "mid_sem" ? 20 : mappedType === "end_sem" ? 50 : 15
       }]);
    }
  };

  return (
    <motion.div variants={cardVariants}>
      <Card className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden group hover:shadow-2xl transition-all duration-500 relative">
        <CardContent className="p-8 relative z-10 flex flex-col h-full">
          <div className="flex justify-between items-start mb-10">
            <div className="flex-1">
               <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_currentColor]" style={{color: subject.color_hex || '#8b5cf6'}} />
                  <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-400">Assessment Module</span>
               </div>
               <h3 className="text-2xl font-black dark:text-white tracking-tighter leading-tight uppercase line-clamp-2">{subject.name}</h3>
               <p className="text-[10px] font-bold text-zinc-500 uppercase mt-2 tracking-widest">{subject.code || "REG-MT-01"}</p>
            </div>
            <div className={`text-5xl font-black ${color} tracking-tighter`}>{grade}</div>
          </div>

          <div className="grid grid-cols-2 gap-5 mb-10">
            <MarkItem label="Mid" max={20} value={localGrades.midSem} onChange={(v) => updateMark("midSem", "mid_sem", v)} />
            <MarkItem label="End" max={50} value={localGrades.endSem} onChange={(v) => updateMark("endSem", "end_sem", v)} />
            <MarkItem label="Prj" max={15} value={localGrades.Project} onChange={(v) => updateMark("Project", "project", v)} />
            <MarkItem label="Viv" max={15} value={localGrades.Viva} onChange={(v) => updateMark("Viva", "viva", v)} />
          </div>

          <div className="bg-zinc-50/50 dark:bg-zinc-950/50 rounded-[2rem] p-6 flex items-center justify-between border border-zinc-100/50 dark:border-zinc-800/50 shadow-inner backdrop-blur-sm">
             <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Full Efficiency</span>
                <span className="text-2xl font-black dark:text-white mt-1">{totalMarks.toFixed(1)}<span className="text-zinc-500 text-xs font-bold ml-1">/100</span></span>
             </div>
             <div className="text-right flex flex-col items-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Points Registry</span>
                <span className={`text-2xl font-black ${color} mt-1`}>{points} <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">PTS</span></span>
             </div>
          </div>
        </CardContent>
        {/* Aesthetic neural glow */}
        <div className="absolute -bottom-16 -right-16 w-56 h-56 blur-[90px] opacity-0 group-hover:opacity-10 transition-opacity duration-700 rounded-full bg-purple-500" />
      </Card>
    </motion.div>
  );
}

function MarkItem({ label, max, value, onChange }: { label: string; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <div className="bg-zinc-50/80 dark:bg-zinc-950/80 border border-zinc-100 dark:border-zinc-800/50 rounded-[1.2rem] p-4 focus-within:ring-2 ring-purple-500/30 transition-all flex flex-col justify-center">
       <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">{label}</span>
          <span className="text-[8px] font-bold text-zinc-400 italic">/{max}</span>
       </div>
       <Input 
         type="number"
         max={max}
         value={value || ""}
         onChange={(e) => onChange(Math.min(max, Number(e.target.value) || 0))}
         className="h-10 border-none bg-transparent p-0 text-2xl font-black focus-visible:ring-0 shadow-none dark:text-white tracking-widest"
       />
    </div>
  );
}
