"use client";

import { useState } from "react";
import { HiUser, HiGlobeAlt, HiAcademicCap, HiTranslate } from "react-icons/hi";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface Props {
  profile: any;
  token: string;
}

export default function ProfileTab({ profile, token }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    display_name: profile?.display_name || "",
    timezone: profile?.timezone || "Asia/Kolkata",
    academics_enabled: profile?.academics_enabled ?? false,
    personal_enabled: profile?.personal_enabled ?? true,
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update(formData)
      .eq("id", profile.id);

    if (error) {
      toast.error("Failed to update profile");
    } else {
      toast.success("Profile updated successfully");
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl space-y-12 px-4 pb-12">
      <div className="flex justify-between items-end px-4 mb-4">
        <div>
           <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-zinc-400 opacity-50" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">System Identity</span>
           </div>
           <h3 className="text-3xl font-black uppercase tracking-tighter dark:text-white italic">Neural Preferences</h3>
        </div>
      </div>

      <div className="grid gap-10">
        {/* Basic Info */}
        <div className="space-y-4 px-4">
          <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 ml-6">Personal Identification</label>
          <div className="relative group">
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-purple-500 transition-all z-10 pointer-events-none">
              <HiUser className="text-2xl" />
            </div>
            <Input 
              value={formData.display_name}
              onChange={(e) => setFormData({...formData, display_name: e.target.value})}
              placeholder="NEURAL IDENTIFIER"
              className="h-20 pl-16 rounded-[2rem] bg-zinc-50 dark:bg-zinc-950 border-none text-xs font-black uppercase tracking-widest focus-visible:ring-2 ring-purple-500/30 transition-all shadow-inner dark:text-white"
            />
          </div>
        </div>

        {/* Global Settings */}
        <div className="space-y-4 px-4">
          <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 ml-6">Temporal Alignment</label>
          <div className="relative group">
             <div className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-purple-500 transition-all z-10 pointer-events-none">
              <HiGlobeAlt className="text-2xl" />
            </div>
            <select 
              value={formData.timezone}
              onChange={(e) => setFormData({...formData, timezone: e.target.value})}
              className="w-full h-20 pl-16 pr-8 rounded-[2rem] border-none bg-zinc-50 dark:bg-zinc-950 text-xs font-black uppercase tracking-widest shadow-inner outline-none focus:ring-2 focus:ring-purple-500/30 transition-all appearance-none cursor-pointer dark:text-white"
            >
              <option value="Asia/Kolkata">Asia / Kolkata (IST)</option>
              <option value="UTC">Universal Time (UTC)</option>
              <option value="America/New_York">New York (EST)</option>
            </select>
          </div>
        </div>

        {/* Track Toggles */}
        <div className="space-y-6 px-4">
          <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 ml-6">Operational Subsystems</label>
          <div className="grid sm:grid-cols-2 gap-6">
            <ToggleCard 
              icon={<HiAcademicCap />} 
              label="Academic Frame" 
              active={formData.academics_enabled} 
              onCheckedChange={(val: boolean) => setFormData({...formData, academics_enabled: val})}
            />
            <ToggleCard 
              icon={<HiTranslate />} 
              label="Personal Core" 
              active={formData.personal_enabled} 
              onCheckedChange={(val: boolean) => setFormData({...formData, personal_enabled: val})}
            />
          </div>
        </div>
      </div>

      <div className="px-4 pt-6">
        <Button 
          disabled={loading}
          onClick={handleSave}
          className="w-full h-20 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-[2rem] font-black uppercase tracking-[0.4em] text-[11px] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 shadow-2xl shadow-zinc-500/20"
        >
          {loading ? "Re-aligning Neural Field..." : "Synchronize Preferences"}
        </Button>
      </div>
    </div>
  );
}

function ToggleCard({ icon, label, active, onCheckedChange }: any) {
  return (
    <div 
      className={`p-8 rounded-[2.5rem] border transition-all duration-500 flex items-center justify-between gap-6 group relative overflow-hidden ${
        active 
          ? "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 shadow-xl" 
          : "bg-zinc-50 dark:bg-zinc-950 border-zinc-100 dark:border-zinc-900 opacity-60 grayscale-[0.5]"
      }`}
    >
      <div className="flex items-center gap-5 relative z-10">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl transition-all duration-500 ${
          active ? "bg-purple-600 text-white shadow-2xl shadow-purple-500/40 scale-110" : "bg-zinc-100 dark:bg-zinc-900 text-zinc-400"
        }`}>
          {icon}
        </div>
        <div>
          <p className="text-[11px] font-black dark:text-white uppercase tracking-widest">{label}</p>
          <p className={`text-[9px] font-black uppercase mt-1.5 tracking-[0.2em] transition-colors ${active ? "text-purple-500" : "text-zinc-500"}`}>
            {active ? "Online" : "Paused"}
          </p>
        </div>
      </div>
      <Switch 
        checked={active} 
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-purple-600 relative z-10"
      />
      {/* Background glow */}
      {active && (
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-purple-500 blur-[50px] opacity-[0.05] rounded-full" />
      )}
    </div>
  );
}
