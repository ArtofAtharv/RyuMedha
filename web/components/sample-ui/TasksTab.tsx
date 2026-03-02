"use client";

import { useState } from "react";
import { HiPlus, HiTrash, HiCalendar, HiFlag, HiAcademicCap, HiUser } from "react-icons/hi";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "motion/react";

interface Props {
  subjects: any[];
  tasksData: any[];
  token: string;
  profileId: string;
}

export default function TasksTab({ subjects, tasksData, token, profileId }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState(tasksData);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    subject_id: "",
    priority: "low",
    due_date: new Date().toISOString().split('T')[0]
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const addTask = async () => {
    if (!formData.title) return;
    setLoading(true);
    
    const { data, error } = await supabase.from("tasks").insert([{
      profile_id: profileId,
      ...formData,
    }]).select().single();

    if (error) {
      toast.error("Failed to sync task");
    } else {
      setTasks([data, ...tasks]);
      setIsAdding(false);
      setFormData({ title: "", subject_id: "", priority: "low", due_date: new Date().toISOString().split('T')[0] });
      toast.success("Objective logged");
    }
    setLoading(false);
  };

  const toggleTask = async (id: string, current: boolean) => {
    const { error } = await supabase.from("tasks").update({ is_completed: !current }).eq("id", id);
    if (!error) {
      setTasks(tasks.map(t => t.id === id ? { ...t, is_completed: !current } : t));
    }
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (!error) {
      setTasks(tasks.filter(t => t.id !== id));
      toast.success("Objective removed");
    }
  };

  const categories = {
    academic: tasks.filter(t => {
      const sub = subjects.find(s => s.id === t.subject_id);
      return sub?.type === 'academic' || !sub;
    }),
    personal: tasks.filter(t => {
      const sub = subjects.find(s => s.id === t.subject_id);
      return sub?.type === 'personal';
    })
  };

  return (
    <div className="space-y-12 px-4">
      <div className="flex justify-between items-end px-4">
        <div>
           <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-zinc-400 opacity-50" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Objective Hub</span>
           </div>
           <h3 className="text-3xl font-black uppercase tracking-tighter dark:text-white italic">Neural Protocols</h3>
        </div>
        <Button 
          onClick={() => setIsAdding(true)}
          className="h-16 px-10 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-[1.8rem] font-black uppercase tracking-[0.3em] text-[10px] hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-zinc-500/20 flex items-center gap-4"
        >
          <HiPlus className="text-2xl" />
          Initialize
        </Button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-10 px-4"
          >
            <Card className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-2 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
               <CardContent className="p-10 space-y-10 relative z-10">
                  <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center text-2xl border border-purple-500/20 shadow-inner">
                          <HiFlag />
                      </div>
                      <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-600">Priority Registry</p>
                          <h4 className="text-xl font-black dark:text-white uppercase tracking-tight">Log Mission Parameters</h4>
                      </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-8">
                    <div className="space-y-3">
                       <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-4">Objective Label</label>
                       <Input 
                         value={formData.title} 
                         onChange={(e) => setFormData({...formData, title: e.target.value})}
                         className="h-16 rounded-[1.5rem] border-none bg-zinc-50 dark:bg-zinc-950 px-6 font-black uppercase tracking-widest text-[10px] shadow-inner focus-visible:ring-2 ring-purple-500/30 transition-all"
                         placeholder="IDENTIFYING MISSION..."
                       />
                    </div>
                    <div className="space-y-3">
                       <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-4">Resource Linkage</label>
                       <Select value={formData.subject_id} onValueChange={(val) => setFormData({...formData, subject_id: val})}>
                         <SelectTrigger className="h-16 rounded-[1.5rem] border-none bg-zinc-50 dark:bg-zinc-950 px-6 font-black uppercase tracking-widest text-[10px] shadow-inner">
                           <SelectValue placeholder="CONNECT SUBJECT" />
                         </SelectTrigger>
                         <SelectContent className="rounded-2xl border-zinc-100 dark:border-zinc-800 backdrop-blur-xl">
                           {subjects.map(s => (
                             <SelectItem key={s.id} value={s.id} className="font-black uppercase tracking-[0.1em] text-[10px] py-4 focus:bg-purple-500/10">{s.name}</SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-5 pt-4">
                    <Button 
                      variant="ghost" 
                      onClick={() => setIsAdding(false)} 
                      className="px-10 h-14 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-500 transition-all"
                    >
                      Abort
                    </Button>
                    <Button 
                      disabled={loading} 
                      onClick={addTask} 
                      className="px-12 h-14 bg-purple-600 hover:bg-purple-700 text-white rounded-[1.2rem] text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-purple-500/40 hover:scale-105 active:scale-95 transition-all"
                    >
                      Deploy Mission
                    </Button>
                  </div>
               </CardContent>
               <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-purple-500 blur-[80px] opacity-10 rounded-full" />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid lg:grid-cols-2 gap-12">
        {/* Academic Column */}
        <div className="space-y-8">
          <SectionHeader icon={<HiAcademicCap />} label="Academic Mainframe" count={categories.academic.length} color="text-purple-600" />
          <div className="space-y-4 px-2">
            {categories.academic.map((t, idx) => (
              <TaskCard key={t.id} task={t} onToggle={toggleTask} onDelete={deleteTask} subjects={subjects} delay={idx} />
            ))}
            {categories.academic.length === 0 && <EmptyState />}
          </div>
        </div>

        {/* Personal Column */}
        <div className="space-y-8">
          <SectionHeader icon={<HiUser />} label="Personal Subsystem" count={categories.personal.length} color="text-blue-500" />
          <div className="space-y-4 px-2">
            {categories.personal.map((t, idx) => (
              <TaskCard key={t.id} task={t} onToggle={toggleTask} onDelete={deleteTask} subjects={subjects} delay={idx} />
            ))}
            {categories.personal.length === 0 && <EmptyState />}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, label, count, color }: any) {
  return (
    <div className="flex items-center justify-between px-6 pb-2">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center text-2xl ${color} shadow-sm`}>
          {icon}
        </div>
        <div>
          <h4 className="text-[13px] font-black uppercase tracking-tighter dark:text-white leading-none">{label}</h4>
          <p className="text-[9px] text-zinc-400 font-bold uppercase mt-2 tracking-widest">{count} Active Threads</p>
        </div>
      </div>
      <div className="h-[1px] flex-1 ml-8 bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-16 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-900 rounded-[2.5rem] opacity-40">
      <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] italic leading-relaxed">Neural field static<br/>Waiting for protocols</p>
    </div>
  );
}

function TaskCard({ task, onToggle, onDelete, subjects, delay }: any) {
  const subject = subjects.find((s: any) => s.id === task.subject_id);
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: delay * 0.05 }}
    >
      <Card className={`group bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2rem] p-6 hover:shadow-2xl hover:border-purple-500/30 transition-all duration-500 relative overflow-hidden ${task.is_completed ? 'opacity-40 grayscale-[0.5]' : ''}`}>
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-6 flex-1">
             <div className="relative">
                <Checkbox 
                  checked={task.is_completed} 
                  onCheckedChange={() => onToggle(task.id, task.is_completed)}
                  className="w-8 h-8 rounded-[1rem] border-zinc-200 dark:border-zinc-800 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600 border-2 transition-all shadow-sm"
                />
             </div>
             <div className="flex-1">
                <h4 className={`text-lg font-black dark:text-white uppercase tracking-tighter leading-tight transition-all ${task.is_completed ? 'line-through decoration-zinc-400 text-zinc-400 italic' : ''}`}>
                  {task.title}
                </h4>
                <div className="flex items-center gap-4 mt-3">
                   <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-950 px-3 py-1 rounded-full border border-zinc-100 dark:border-zinc-800">
                      <HiFlag className={`text-[10px] ${task.priority === 'critical' ? 'text-red-500' : task.priority === 'urgent' ? 'text-orange-500' : 'text-zinc-400'}`} />
                      <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">{task.priority || 'standard'}</span>
                   </div>
                   <div className="h-1 w-1 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                   <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest truncate max-w-[120px]">{subject?.name || "Global Objective"}</span>
                </div>
             </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onDelete(task.id)} 
            className="opacity-0 group-hover:opacity-100 h-10 w-10 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all ml-4"
          >
            <HiTrash className="text-xl" />
          </Button>
        </div>

        {/* Neural shadow effect */}
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-purple-500 blur-[60px] opacity-0 group-hover:opacity-5 transition-opacity" />
      </Card>
    </motion.div>
  );
}
