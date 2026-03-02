"use client";

import { useState, useEffect } from "react";
import { HiPlay, HiPause, HiStop, HiTrash, HiClock } from "react-icons/hi";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "motion/react";

interface Props {
  subjects: any[];
  timers: any[];
  profile: any;
  token: string;
}

export default function TimersTab({ subjects, timers: initialTimers, profile, token }: Props) {
  const [timers, setTimers] = useState(initialTimers);
  const [activeTimer, setActiveTimer] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  useEffect(() => {
    const active = timers.find(t => !t.ended_at);
    setActiveTimer(active);
    if (active) {
      const start = new Date(active.started_at).getTime();
      const now = Date.now();
      const gross = Math.floor((now - start) / 1000);
      setElapsed(Math.max(0, gross - (active.total_pause_seconds || 0)));
    }
  }, [timers]);

  useEffect(() => {
    let interval: any;
    if (activeTimer && !activeTimer.pause_started_at) {
      interval = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

  const fetchData = async () => {
    const { data } = await supabase
      .from("study_timers")
      .select("*, subjects(id, name, type)")
      .eq("profile_id", profile.id)
      .order("started_at", { ascending: false });
    if (data) setTimers(data);
  };

  const startTimer = async () => {
    if (!selectedSubject) return;
    setLoading(true);

    // Safety check: close any stuck timers
    try {
      await supabase
        .from("study_timers")
        .update({ ended_at: new Date().toISOString() })
        .eq("profile_id", profile.id)
        .is("ended_at", null);
    } catch (e) {
      console.warn("Safety check failed:", e);
    }

    const { error } = await supabase.from("study_timers").insert([{
      profile_id: profile.id,
      subject_id: selectedSubject,
      started_at: new Date().toISOString(),
    }]);

    if (error) {
      toast.error("Failed to start timer");
    } else {
      toast.success("Timer started!");
      fetchData();
    }
    setLoading(false);
  };

  const pauseTimer = async () => {
    if (!activeTimer) return;
    const { error } = await supabase.from("study_timers").update({
      pause_started_at: new Date().toISOString()
    }).eq("id", activeTimer.id);
    if (error) toast.error("Failed to pause");
    else fetchData();
  };

  const resumeTimer = async () => {
    if (!activeTimer || !activeTimer.pause_started_at) return;
    const pauseStart = new Date(activeTimer.pause_started_at).getTime();
    const pauseDuration = Math.floor((Date.now() - pauseStart) / 1000);
    const newTotalPause = (activeTimer.total_pause_seconds || 0) + pauseDuration;

    const { error } = await supabase.from("study_timers").update({
      pause_started_at: null,
      total_pause_seconds: newTotalPause
    }).eq("id", activeTimer.id);
    if (error) toast.error("Failed to resume");
    else fetchData();
  };

  const stopTimer = async () => {
    if (!activeTimer) return;
    let finalPause = activeTimer.total_pause_seconds || 0;
    if (activeTimer.pause_started_at) {
      finalPause += Math.floor((Date.now() - new Date(activeTimer.pause_started_at).getTime()) / 1000);
    }

    const { error } = await supabase.from("study_timers").update({
      ended_at: new Date().toISOString(),
      pause_started_at: null,
      total_pause_seconds: finalPause
    }).eq("id", activeTimer.id);

    if (error) toast.error("Failed to stop");
    else {
      toast.success("Focus session ended");
      fetchData();
    }
  };

  const deleteTimer = async (id: string) => {
    const { error } = await supabase.from("study_timers").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("Session deleted");
      fetchData();
    }
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const history = timers.filter(t => t.ended_at);

  return (
    <div className="grid md:grid-cols-2 gap-10 items-start px-4">
      {/* Timer Controls */}
      <Card className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden group shadow-sm hover:shadow-2xl transition-all duration-500 relative">
        <CardContent className="p-10 flex flex-col h-full relative z-10">
          {activeTimer ? (
            <div className="space-y-12 text-center">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex justify-center items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-purple-600 animate-pulse shadow-[0_0_10px_rgba(147,51,234,0.5)]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Live Session Log</span>
                </div>
                <h3 className="text-3xl font-black dark:text-white tracking-tighter uppercase leading-tight">{activeTimer.subjects?.name}</h3>
              </motion.div>
              
              <div className="relative inline-block mx-auto">
                 <div className={`text-7xl lg:text-8xl font-black font-mono tracking-tighter transition-all duration-700 ${activeTimer.pause_started_at ? 'text-zinc-300 dark:text-zinc-800 scale-90 blur-[1px]' : 'text-zinc-900 dark:text-white scale-100'}`}>
                   {formatTime(elapsed)}
                 </div>
                 {activeTimer.pause_started_at && (
                    <div className="absolute inset-0 flex items-center justify-center">
                       <span className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-400 dark:text-zinc-600 animate-pulse bg-white/50 dark:bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">System Halted</span>
                    </div>
                 )}
              </div>

              <div className="flex justify-center gap-6">
                {activeTimer.pause_started_at ? (
                  <Button 
                    variant="default"
                    size="icon"
                    onClick={resumeTimer}
                    className="w-24 h-24 rounded-[2rem] bg-emerald-500 hover:bg-emerald-600 text-white text-4xl shadow-2xl shadow-emerald-500/40 hover:scale-110 active:scale-95 transition-all"
                  >
                    <HiPlay className="fill-current" />
                  </Button>
                ) : (
                  <Button 
                    variant="default"
                    size="icon"
                    onClick={pauseTimer}
                    className="w-24 h-24 rounded-[2rem] bg-purple-600 hover:bg-purple-700 text-white text-4xl shadow-2xl shadow-purple-500/40 hover:scale-110 active:scale-95 transition-all"
                  >
                    <HiPause className="fill-current" />
                  </Button>
                )}
                <Button 
                  variant="destructive"
                  size="icon"
                  onClick={stopTimer}
                  className="w-24 h-24 rounded-[2rem] bg-red-500 hover:bg-red-600 text-white text-4xl shadow-2xl shadow-red-500/40 hover:scale-110 active:scale-95 transition-all"
                >
                  <HiStop className="fill-current" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-10 py-4">
              <div className="text-center sm:text-left">
                <div className="flex items-center gap-2 mb-3 justify-center sm:justify-start">
                  <div className="w-2 h-2 rounded-full bg-zinc-400 opacity-50" />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Timer Interface</span>
                </div>
                <h3 className="text-3xl font-black dark:text-white tracking-tighter uppercase">Focus Module</h3>
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-2 opacity-80">Select neural subject to trigger validation</p>
              </div>
              
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-4">Registry Target</label>
                  <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger className="h-16 rounded-[1.5rem] border-none bg-zinc-50 dark:bg-zinc-950 px-6 text-[10px] font-black uppercase tracking-[0.2em] shadow-inner">
                      <SelectValue placeholder="INITIALIZE SUBJECT" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-zinc-100 dark:border-zinc-800 backdrop-blur-xl">
                      {subjects.map(s => (
                        <SelectItem key={s.id} value={s.id} className="font-black uppercase tracking-[0.1em] text-[10px] py-4 cursor-pointer focus:bg-purple-500/10">
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  disabled={!selectedSubject || loading}
                  onClick={startTimer}
                  className="w-full h-16 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-[1.5rem] font-black uppercase tracking-[0.3em] text-[10px] hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50 shadow-2xl shadow-zinc-500/20"
                >
                  {loading ? "Establishing Link..." : "Engage Objective"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>

        {/* Decorative Neural Background */}
        <div className={`absolute -bottom-12 -right-12 w-48 h-48 blur-[80px] opacity-0 group-hover:opacity-10 transition-opacity duration-700 rounded-full bg-purple-500`} />
      </Card>

      {/* History */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-4">
           <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Registry Records</h4>
           <div className="h-[1px] flex-1 mx-6 bg-zinc-100 dark:bg-zinc-900" />
        </div>
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {history.length > 0 ? history.slice(0, 10).map((h, idx) => {
             const start = new Date(h.started_at).getTime();
             const end = new Date(h.ended_at).getTime();
             const netSecs = Math.max(0, Math.floor((end - start) / 1000) - (h.total_pause_seconds || 0));
             
             return (
               <motion.div 
                 key={h.id} 
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 transition={{ delay: idx * 0.05 }}
               >
                 <Card className="bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-900 rounded-[2rem] p-6 flex justify-between items-center group hover:shadow-xl hover:border-purple-500/30 transition-all duration-300 relative overflow-hidden">
                    <div className="flex items-center gap-5 relative z-10">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-purple-500 transition-all group-hover:scale-110">
                        <HiClock className="text-xl" />
                      </div>
                      <div>
                        <p className="text-[13px] font-black dark:text-white uppercase tracking-tighter leading-none">{h.subjects?.name}</p>
                        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                           {new Date(h.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                           <span className="w-1 h-1 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                           {new Date(h.started_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="text-xs font-black dark:text-white bg-zinc-50 dark:bg-zinc-900 px-5 py-2.5 rounded-[1.2rem] border border-zinc-100 dark:border-zinc-800 font-mono shadow-inner group-hover:bg-purple-500/5 group-hover:text-purple-500 transition-all">
                          {formatTime(netSecs)}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => deleteTimer(h.id)}
                          className="opacity-0 group-hover:opacity-100 h-10 w-10 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
                        >
                          <HiTrash className="text-lg" />
                        </Button>
                    </div>

                    {/* Subtle aesthetic stripe */}
                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-purple-500/20 to-transparent group-hover:via-purple-500 transition-all" />
                 </Card>
               </motion.div>
             );
          }) : (
            <div className="p-16 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-900 rounded-[2.5rem] opacity-40">
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] italic leading-relaxed">Neural log cleared<br/>No active records detected</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
