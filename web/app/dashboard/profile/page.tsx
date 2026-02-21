"use client"

import { useEffect, useState } from "react"
import { getSession } from "next-auth/react"
import { createClient } from "@supabase/supabase-js"
import { motion, AnimatePresence } from "motion/react"
import { 
  User, Phone, GraduationCap, Target, BookOpen, 
  Pencil, Check, X, Loader2, Shield,
  School, FolderOpen, AlertTriangle, Trash2
} from "lucide-react"

export default function ProfilePage() {
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  
  const [supabaseClient, setSupabaseClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Inline edit states
  const [editField, setEditField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function init() {
      const sess = await getSession()
      if (!sess) return
      setSession(sess)
      
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${sess.user.supabaseToken}` } } }
      )
      
      setSupabaseClient(supabase)
      await fetchProfile(supabase, sess)
    }
    init()
  }, [])

  async function fetchProfile(supabase: any, sess: any) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('whatsapp_number', sess.user.phone)
      .single()

    if (prof) {
      setProfile(prof)
    }
    setLoading(false)
  }

  async function saveField(field: string, value: any) {
    if (!profile || !supabaseClient) return
    setSaving(true)
    await supabaseClient.from('profiles').update({ [field]: value }).eq('id', profile.id)
    await fetchProfile(supabaseClient, session)
    setSaving(false)
    setEditField(null)
  }

  function startEdit(field: string, currentValue: any) {
    setEditField(field)
    setEditValue(currentValue?.toString() || "")
  }

  function cancelEdit() {
    setEditField(null)
    setEditValue("")
  }

  async function handleDeleteAccount() {
    if (!profile || !supabaseClient) return
    const confirmed = window.confirm(
      "⚠️ Are you sure you want to permanently delete your account?\n\n" +
      "This will delete ALL your data including subjects, attendance, grades, tasks, and timers.\n\n" +
      "This action CANNOT be undone."
    )
    if (!confirmed) return

    const doubleConfirm = window.prompt(
      "Type DELETE to confirm account deletion:"
    )
    if (doubleConfirm !== "DELETE") return

    setDeleting(true)
    // Delete all user data in order (foreign key constraints)
    await supabaseClient.from('study_timers').delete().eq('profile_id', profile.id)
    await supabaseClient.from('tasks').delete().eq('profile_id', profile.id)
    await supabaseClient.from('grades').delete().eq('profile_id', profile.id)
    await supabaseClient.from('attendance_logs').delete().eq('profile_id', profile.id)
    await supabaseClient.from('subjects').delete().eq('profile_id', profile.id)
    await supabaseClient.from('profiles').delete().eq('id', profile.id)
    
    // Sign out and redirect
    const { signOut } = await import("next-auth/react")
    await signOut({ callbackUrl: '/login' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-destructive font-bold">Failed to load profile.</p>
      </div>
    )
  }

  const displayName = profile.display_name || session?.user?.name || session?.user?.phone

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      
      {/* Hero Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="gradient-accent rounded-3xl p-8 text-white relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-black/10 rounded-3xl" />
        <div className="relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl font-black mb-4">
            {displayName?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <h1 className="text-2xl font-black">{displayName}</h1>
          <p className="text-white/70 text-sm font-medium mt-1 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" />
            {session?.user?.phone}
          </p>
        </div>
      </motion.div>

      {/* Personal Details Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border rounded-2xl overflow-hidden"
      >
        <div className="px-5 py-3 bg-muted/30 border-b">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <User className="w-3.5 h-3.5" /> Personal
          </h2>
        </div>
        <div className="divide-y">
          {/* Display Name — Editable */}
          <ProfileRow
            icon={<User className="w-4 h-4" />}
            label="Display Name"
            value={displayName}
            isEditing={editField === "display_name"}
            editValue={editValue}
            saving={saving}
            onEdit={() => startEdit("display_name", profile.display_name || "")}
            onCancel={cancelEdit}
            onChange={setEditValue}
            onSave={() => saveField("display_name", editValue)}
          />

          {/* Phone — Non-editable */}
          <div className="px-5 py-4 flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Phone className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Phone Number</p>
              <p className="font-mono font-medium text-sm">{session?.user?.phone}</p>
            </div>
            <div className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-full font-bold uppercase tracking-wider">
              Locked
            </div>
          </div>
        </div>
      </motion.div>

      {/* Academic Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card border rounded-2xl overflow-hidden"
      >
        <div className="px-5 py-3 bg-muted/30 border-b">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <GraduationCap className="w-3.5 h-3.5" /> Academic
          </h2>
        </div>
        <div className="divide-y">
          {/* Target Attendance — Editable */}
          <ProfileRow
            icon={<Target className="w-4 h-4" />}
            label="Target Attendance"
            value={`${profile.target_attendance_pct ?? 75}%`}
            isEditing={editField === "target_attendance_pct"}
            editValue={editValue}
            saving={saving}
            onEdit={() => startEdit("target_attendance_pct", profile.target_attendance_pct ?? 75)}
            onCancel={cancelEdit}
            onChange={setEditValue}
            onSave={() => {
              const pct = parseFloat(editValue)
              if (!isNaN(pct) && pct >= 0 && pct <= 100) saveField("target_attendance_pct", pct)
            }}
            inputType="number"
            suffix="%"
          />

          {/* Current Semester — Editable (integer field on profiles table) */}
          <ProfileRow
            icon={<BookOpen className="w-4 h-4" />}
            label="Current Semester"
            value={profile.current_semester != null ? `Semester ${profile.current_semester}` : "Not Set"}
            isEditing={editField === "current_semester"}
            editValue={editValue}
            saving={saving}
            onEdit={() => startEdit("current_semester", profile.current_semester ?? "")}
            onCancel={cancelEdit}
            onChange={setEditValue}
            onSave={() => {
              const sem = parseInt(editValue)
              if (!isNaN(sem) && sem > 0 && sem <= 12) saveField("current_semester", sem)
            }}
            inputType="number"
            placeholder="e.g. 4"
          />

          {/* University — Editable (free text stored as display_university) */}
          <ProfileRow
            icon={<School className="w-4 h-4" />}
            label="University"
            value={profile.display_university || "Not Set"}
            isEditing={editField === "display_university"}
            editValue={editValue}
            saving={saving}
            onEdit={() => startEdit("display_university", profile.display_university || "")}
            onCancel={cancelEdit}
            onChange={setEditValue}
            onSave={() => saveField("display_university", editValue)}
            placeholder="e.g. MIT Pune"
          />

          {/* Program — Editable (free text stored as display_program) */}
          <ProfileRow
            icon={<GraduationCap className="w-4 h-4" />}
            label="Program"
            value={profile.display_program || "Not Set"}
            isEditing={editField === "display_program"}
            editValue={editValue}
            saving={saving}
            onEdit={() => startEdit("display_program", profile.display_program || "")}
            onCancel={cancelEdit}
            onChange={setEditValue}
            onSave={() => saveField("display_program", editValue)}
            placeholder="e.g. B.Tech Computer Science"
          />
        </div>
      </motion.div>

      {/* Tracks Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card border rounded-2xl overflow-hidden"
      >
        <div className="px-5 py-3 bg-muted/30 border-b">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" /> Enabled Tracks
          </h2>
        </div>
        <div className="px-5 py-5 flex gap-3">
          <TrackToggle
            icon={<GraduationCap className="w-4 h-4" />}
            label="Academic"
            enabled={profile.academics_enabled}
            saving={saving}
            onToggle={() => saveField("academics_enabled", !profile.academics_enabled)}
          />
          <TrackToggle
            icon={<FolderOpen className="w-4 h-4" />}
            label="Personal"
            enabled={profile.personal_enabled}
            saving={saving}
            onToggle={() => saveField("personal_enabled", !profile.personal_enabled)}
          />
        </div>
      </motion.div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="border border-destructive/20 rounded-2xl overflow-hidden"
      >
        <div className="px-5 py-3 bg-destructive/5 border-b border-destructive/20">
          <h2 className="text-xs font-bold uppercase tracking-widest text-destructive flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" /> Danger Zone
          </h2>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-muted-foreground">
            This will permanently delete your account and all associated data including subjects, attendance, grades, tasks, and study timers. This action cannot be undone.
          </p>
          <button 
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-destructive text-white hover:bg-destructive/90 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {deleting ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting...</>
            ) : (
              <><Trash2 className="w-3.5 h-3.5" /> Permanently Delete Account</>
            )}
          </button>
        </div>
      </motion.div>

    </div>
  )
}

/* ─── Reusable Inline-Edit Row ─── */
function ProfileRow({
  icon, label, value, isEditing, editValue, saving,
  onEdit, onCancel, onChange, onSave,
  inputType = "text", suffix, placeholder
}: {
  icon: React.ReactNode
  label: string
  value: string
  isEditing: boolean
  editValue: string
  saving: boolean
  onEdit: () => void
  onCancel: () => void
  onChange: (v: string) => void
  onSave: () => void
  inputType?: string
  suffix?: string
  placeholder?: string
}) {
  return (
    <div className="px-5 py-4 flex items-center gap-4">
      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{label}</p>
        <AnimatePresence mode="wait">
          {isEditing ? (
            <motion.div
              key="edit"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-2 mt-1"
            >
              <input
                type={inputType}
                value={editValue}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                autoFocus
                className="h-8 px-3 rounded-lg bg-muted border text-sm font-medium w-full max-w-[200px] outline-none focus:ring-2 focus:ring-primary/30"
                onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
              />
              {suffix && <span className="text-sm text-muted-foreground font-bold">{suffix}</span>}
              <button
                onClick={onSave}
                disabled={saving}
                className="w-8 h-8 rounded-lg gradient-accent text-white flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={onCancel}
                className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0 hover:bg-muted/80 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="display"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 group"
            >
              <p className="font-medium text-sm">{value}</p>
              <button
                onClick={onEdit}
                className="w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
              >
                <Pencil className="w-3 h-3 text-muted-foreground" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ─── Track Toggle Button ─── */
function TrackToggle({
  icon, label, enabled, saving, onToggle
}: {
  icon: React.ReactNode
  label: string
  enabled: boolean
  saving: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      disabled={saving}
      className={`flex-1 py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
        enabled
          ? "border-primary/30 bg-primary/5 text-primary"
          : "border-muted bg-muted/30 text-muted-foreground hover:border-muted-foreground/20"
      } disabled:opacity-50`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
        enabled ? "gradient-accent text-white" : "bg-muted"
      }`}>
        {icon}
      </div>
      <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
        enabled
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground"
      }`}>
        {enabled ? "Active" : "Disabled"}
      </span>
    </button>
  )
}
