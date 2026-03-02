"use client";

import { useState } from "react";
import { HiPlus, HiTrash, HiAcademicCap, HiUser } from "react-icons/hi";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "motion/react";

interface Props {
  subjects: any[];
  profile: any;
  token: string;
}

export default function SubjectsTab({ subjects, profile, token }: Props) {
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "academic",
    color_hex: "#8b5cf6",
    expected_total_lectures: 45
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const handleAddSubject = async () => {
    if (!formData.name) return;
    setLoading(true);
    
    const { error } = await supabase
      .from("subjects")
      .insert([{
        profile_id: profile.id,
        name: formData.name,
        type: formData.type,
        color_hex: formData.color_hex,
        expected_total_lectures: formData.expected_total_lectures,
        is_active: true
      }]);

    if (error) {
      toast.error("Failed to add subject");
    } else {
      toast.success("Subject added!");
      setIsAdding(false);
      setFormData({ name: "", type: "academic", color_hex: "#8b5cf6", expected_total_lectures: 45 });
      router.refresh();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("subjects").update({ is_active: false }).eq("id", id);
    if (!error) {
      toast.success("Subject archived");
      router.refresh();
    }
  };

  return (
    <div className="space-y-12 px-4">
      {/* Header with Add Button */}
      <div className="flex justify-between items-end px-4">
        <div>
           <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-zinc-400 opacity-50" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Resource Registry</span>
           </div>
           <h3 className="text-3xl font-black uppercase tracking-tighter dark:text-white italic">Knowledge Assets</h3>
        </div>
        <Button 
          onClick={() => setIsAdding(true)}
          size="icon"
          className="w-16 h-16 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-[1.8rem] hover:scale-110 active:scale-95 transition-all shadow-2xl shadow-zinc-500/20"
        >
          <HiPlus className="text-2xl" />
        </Button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="px-4"
          >
            <Card className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-2 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
              <CardContent className="p-10 space-y-10 relative z-10">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center text-2xl border border-purple-500/20 shadow-inner">
                        <HiAcademicCap />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-600">Secure Protocol</p>
                        <h4 className="text-xl font-black dark:text-white uppercase tracking-tight">Register New Track</h4>
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-4">Identification</label>
                      <Input 
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="Neural Subject Identifier"
                        className="h-16 rounded-[1.5rem] border-none bg-zinc-50 dark:bg-zinc-950 px-6 font-black uppercase tracking-widest text-[10px] shadow-inner focus-visible:ring-2 ring-purple-500/30 transition-all"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-4">Classification Layer</label>
                      <Select value={formData.type} onValueChange={(val) => setFormData({...formData, type: val})}>
                        <SelectTrigger className="h-16 rounded-[1.5rem] border-none bg-zinc-50 dark:bg-zinc-950 px-6 font-black uppercase tracking-widest text-[10px] shadow-inner">
                          <SelectValue placeholder="TRACK" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-zinc-100 dark:border-zinc-800 backdrop-blur-xl">
                          <SelectItem value="academic" className="font-black uppercase tracking-widest text-[10px] py-4 focus:bg-purple-500/10">Academic Mainframe</SelectItem>
                          <SelectItem value="personal" className="font-black uppercase tracking-widest text-[10px] py-4 focus:bg-purple-500/10">Personal Subsystem</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                </div>

                <div className="flex justify-end gap-5 pt-4">
                    <Button 
                      variant="ghost"
                      onClick={() => setIsAdding(false)}
                      className="px-10 h-14 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                    >
                      Abort
                    </Button>
                    <Button 
                      disabled={loading}
                      onClick={handleAddSubject}
                      className="px-12 h-14 bg-purple-600 hover:bg-purple-700 text-white rounded-[1.2rem] text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-purple-500/40 hover:scale-105 active:scale-95 transition-all"
                    >
                      {loading ? "Establishing Link..." : "Authenticate"}
                    </Button>
                </div>
              </CardContent>
              <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-purple-500 blur-[80px] opacity-10 rounded-full" />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subjects List */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 px-4">
        {subjects.map((s, idx) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Card className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] group relative overflow-hidden shadow-sm hover:shadow-2xl hover:border-purple-500/30 transition-all duration-500 cursor-default">
              <CardContent className="p-8 relative z-10 h-full flex flex-col justify-between">
                <div className="flex justify-between items-start mb-6">
                   <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_currentColor]" style={{color: s.color_hex}} />
                      <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-400">Track Hash</span>
                   </div>
                   <Button 
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(s.id)}
                    className="opacity-0 group-hover:opacity-100 h-10 w-10 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
                   >
                    <HiTrash className="text-lg" />
                   </Button>
                </div>

                <div className="space-y-4 mb-8">
                   <h4 className="text-2xl font-black dark:text-white uppercase tracking-tighter leading-tight line-clamp-2">{s.name}</h4>
                   <div className="flex items-center gap-3">
                      <div className="px-3 py-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-lg">
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500">{s.type}</span>
                      </div>
                      <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">{s.code || "MT-00-Z"}</span>
                   </div>
                </div>

                <div className="pt-6 border-t border-zinc-50 dark:border-zinc-800/50 flex justify-between items-center">
                   <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 shadow-inner">
                         {s.type === 'academic' ? <HiAcademicCap className="text-lg" /> : <HiUser className="text-lg" />}
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Validation: Active</span>
                   </div>
                   <div className="w-8 h-1 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full w-2/3 bg-purple-500 rounded-full" />
                   </div>
                </div>

                {/* Aesthetic neural glow */}
                <div 
                  className="absolute -bottom-16 -right-16 w-48 h-48 blur-[80px] opacity-0 group-hover:opacity-10 transition-opacity duration-700 rounded-full" 
                  style={{backgroundColor: s.color_hex}} 
                />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
