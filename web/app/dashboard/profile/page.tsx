"use client"

import { useEffect, useState, useMemo } from "react"
import { getSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { motion, AnimatePresence } from "motion/react"
import { 
  User, Phone, GraduationCap, Target, BookOpen, 
  Pencil, Check, X, Loader2, Shield,
  School, FolderOpen, AlertTriangle, Trash2, Plus
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function ProfilePage() {
  const router = useRouter()
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  
  // Reference data lists
  const [universities, setUniversities] = useState<any[]>([])
  const [programs, setPrograms] = useState<any[]>([])
  const [semesters, setSemesters] = useState<any[]>([])

  // Display names for active relational fields
  const [uniName, setUniName] = useState("Not Set")
  const [progName, setProgName] = useState("Not Set")
  const [semName, setSemName] = useState("Not Set")
  
  const [supabaseClient, setSupabaseClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Inline edit states
  const [editField, setEditField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Dynamic Management state
  const [isAddingUni, setIsAddingUni] = useState(false)
  const [newUniName, setNewUniName] = useState("")
  
  const [isAddingProg, setIsAddingProg] = useState(false)
  const [newProgName, setNewProgName] = useState("")

  const [isAddingSem, setIsAddingSem] = useState(false)
  const [newSemName, setNewSemName] = useState("")
  const [newSemNumber, setNewSemNumber] = useState("")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasArchivedSubjects, setHasArchivedSubjects] = useState(false)
  const [hasActiveSubjects, setHasActiveSubjects] = useState(false)

  useEffect(() => {
    async function checkSemesterStatus() {
      if (!profile?.current_semester_id || !supabaseClient) {
        setHasArchivedSubjects(false)
        setHasActiveSubjects(false)
        return
      }
      const { data: subs } = await supabaseClient
        .from('subjects')
        .select('id, is_active, source_course_id(semester_id)')
        .eq('profile_id', profile.id)
        .eq('type', 'academic')
      
      let activeCount = 0
      let archivedCount = 0
      
      ;(subs || []).forEach((s: any) => {
        const semId = Array.isArray(s.source_course_id) 
          ? s.source_course_id[0]?.semester_id 
          : (s.source_course_id as any)?.semester_id
        if (semId === profile.current_semester_id) {
          if (s.is_active) activeCount++
          else archivedCount++
        }
      })
      
      setHasActiveSubjects(activeCount > 0)
      setHasArchivedSubjects(archivedCount > 0)
    }
    checkSemesterStatus()
  }, [profile?.current_semester_id, supabaseClient, profile?.id])

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
      await fetchInitialData(supabase, sess)
    }
    init()
  }, [])

  async function fetchInitialData(supabase: any, sess: any) {
    // Fetch profile and all universities
    const [{ data: prof }, { data: unis }] = await Promise.all([
      supabase.from('profiles').select('*').eq('whatsapp_number', sess.user.phone).single(),
      supabase.from('universities').select('id, name').order('name')
    ])

    if (unis) setUniversities(unis)

    if (prof) {
      setProfile(prof)
      
      // Fetch names for currently selected relational fields
      if (prof.current_university_id) {
        const { data: u } = await supabase.from('universities').select('name').eq('id', prof.current_university_id).single()
        if (u) setUniName(u.name)
        
        // Fetch programs for the currently selected university so the dropdown is ready
        const { data: progs } = await supabase.from('programs').select('id, name').eq('university_id', prof.current_university_id).order('name')
        if (progs) setPrograms(progs)
      } else {
        setUniName("Not Set")
        setPrograms([])
      }

      if (prof.current_program_id) {
        const { data: p } = await supabase.from('programs').select('name').eq('id', prof.current_program_id).single()
        if (p) setProgName(p.name)

        // Fetch semesters for the currently selected program so the dropdown is ready
        const { data: sems } = await supabase.from('semesters').select('id, name, semester_number').eq('program_id', prof.current_program_id).order('semester_number')
        if (sems) setSemesters(sems)
      } else {
        setProgName("Not Set")
        setSemesters([])
      }

      if (prof.current_semester_id) {
        const { data: s } = await supabase.from('semesters').select('name').eq('id', prof.current_semester_id).single()
        if (s) setSemName(s.name)
      } else {
        setSemName("Not Set")
      }
    }
    setLoading(false)
  }

  // Refetch just the profile and names
  async function refreshProfileData() {
    if (!supabaseClient || !session) return
    const { data: prof } = await supabaseClient.from('profiles').select('*').eq('whatsapp_number', session.user.phone).single()
    if (prof) {
      setProfile(prof)
      if (prof.current_university_id) {
        const { data: u } = await supabaseClient.from('universities').select('name').eq('id', prof.current_university_id).single()
        if (u) setUniName(u.name)
      } else setUniName("Not Set")
      
      if (prof.current_program_id) {
        const { data: p } = await supabaseClient.from('programs').select('name').eq('id', prof.current_program_id).single()
        if (p) setProgName(p.name)
      } else setProgName("Not Set")

      if (prof.current_semester_id) {
        const { data: s } = await supabaseClient.from('semesters').select('name').eq('id', prof.current_semester_id).single()
        if (s) setSemName(s.name)
      } else setSemName("Not Set")
    }
  }

  // Handle cascaded fetches when a dropdown selection changes
  async function handleRelationalChange(field: string, newId: string) {
    if (!profile || !supabaseClient) return
    setSaving(true)

    const updates: any = {}
    
    if (field === 'current_university_id') {
      updates.current_university_id = newId || null
      // Reset downstream
      updates.current_program_id = null
      updates.current_semester_id = null
      
      if (newId) {
        const { data: progs } = await supabaseClient.from('programs').select('id, name').eq('university_id', newId).order('name')
        setPrograms(progs || [])
      } else {
        setPrograms([])
      }
      setSemesters([])
    } 
    else if (field === 'current_program_id') {
      updates.current_program_id = newId || null
      // Reset downstream
      updates.current_semester_id = null
      
      if (newId) {
        const { data: sems } = await supabaseClient.from('semesters').select('id, name, semester_number').eq('program_id', newId).order('semester_number')
        setSemesters(sems || [])
      } else {
        setSemesters([])
      }
    }
    else if (field === 'current_semester_id') {
      updates.current_semester_id = newId || null
    }

    await supabaseClient.from('profiles').update(updates).eq('id', profile.id)
    await refreshProfileData()
    router.refresh()
    
    setSaving(false)
    setEditField(null)
  }

  // Handle simple scalar field saves
  async function saveField(field: string, value: any) {
    if (!profile || !supabaseClient) return
    setSaving(true)
    await supabaseClient.from('profiles').update({ [field]: value }).eq('id', profile.id)
    await refreshProfileData()
    router.refresh()
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

  // Institutional Management Functions
  async function handleCreateUni() {
    if (!newUniName.trim() || !supabaseClient) return
    setIsSubmitting(true)
    const { data, error } = await supabaseClient.from('universities').insert([{ name: newUniName.trim() }]).select().single()
    setIsSubmitting(false)
    if (error) {
      toast.error("Failed to add university")
    } else {
      setUniversities(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      handleRelationalChange('current_university_id', data.id)
      setIsAddingUni(false)
      setNewUniName("")
      toast.success("University added!")
    }
  }

  async function handleDeleteUni(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!supabaseClient) return
    if (!confirm("Are you sure? This will remove the university for everyone.")) return
    
    setIsSubmitting(true)
    const { error } = await supabaseClient.from('universities').delete().eq('id', id)
    setIsSubmitting(false)
    
    if (error) {
      toast.error("Cannot delete university (likely has linked programs)")
    } else {
      setUniversities(prev => prev.filter(u => u.id !== id))
      if (profile?.current_university_id === id) {
        handleRelationalChange('current_university_id', "")
      }
      toast.success("University removed")
    }
  }

  async function handleCreateProg() {
    if (!newProgName.trim() || !profile?.current_university_id || !supabaseClient) return
    setIsSubmitting(true)
    const { data, error } = await supabaseClient.from('programs').insert([{ 
      name: newProgName.trim(), 
      university_id: profile.current_university_id 
    }]).select().single()
    setIsSubmitting(false)
    if (error) {
      toast.error("Failed to add program")
    } else {
      setPrograms(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      handleRelationalChange('current_program_id', data.id)
      setIsAddingProg(false)
      setNewProgName("")
      toast.success("Program added!")
    }
  }

  async function handleDeleteProg(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!supabaseClient) return
    if (!confirm("Remove this program?")) return
    
    setIsSubmitting(true)
    const { error } = await supabaseClient.from('programs').delete().eq('id', id)
    setIsSubmitting(false)
    
    if (error) {
      toast.error("Cannot delete program (has linked semesters)")
    } else {
      setPrograms(prev => prev.filter(p => p.id !== id))
      if (profile?.current_program_id === id) {
        handleRelationalChange('current_program_id', "")
      }
      toast.success("Program removed")
    }
  }

  async function handleCreateSem() {
    if (!newSemName.trim() || !profile?.current_program_id || !supabaseClient) return
    setIsSubmitting(true)
    const { data, error } = await supabaseClient.from('semesters').insert([{ 
      name: newSemName.trim(), 
      semester_number: parseInt(newSemNumber) || 1,
      program_id: profile.current_program_id 
    }]).select().single()
    setIsSubmitting(false)
    if (error) {
      toast.error("Failed to add semester")
    } else {
      setSemesters(prev => [...prev, data].sort((a, b) => a.semester_number - b.semester_number))
      handleRelationalChange('current_semester_id', data.id)
      setIsAddingSem(false)
      setNewSemName("")
      setNewSemNumber("")
      toast.success("Semester added!")
    }
  }

  async function handleDeleteSem(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!supabaseClient) return
    if (!confirm("Remove this semester?")) return
    
    setIsSubmitting(true)
    const { error } = await supabaseClient.from('semesters').delete().eq('id', id)
    setIsSubmitting(false)
    
    if (error) {
      toast.error("Cannot delete semester")
    } else {
      setSemesters(prev => prev.filter(s => s.id !== id))
      if (profile?.current_semester_id === id) {
        handleRelationalChange('current_semester_id', "")
      }
      toast.success("Semester removed")
    }
  }

  async function handleArchiveSemester() {
    if (!profile || !supabaseClient) return
    const confirmed = window.confirm(
      "📦 Archive Current Semester?\n\n" +
      "This will:\n" +
      "1. Clear your current semester selection.\n" +
      "2. Archive (hide) all your active academic subjects for this semester.\n\n" +
      "Your history (attendance, grades) will be preserved. You can re-enroll in new subjects for your next semester."
    )
    if (!confirmed) return

    setSaving(true)
    try {
      const { data: subs } = await supabaseClient
        .from('subjects')
        .select('id, source_course_id(semester_id)')
        .eq('profile_id', profile.id)
        .eq('type', 'academic')
        .eq('is_active', true)

      const subjectIdsToArchive = (subs || []).filter((s: any) => {
        const semId = Array.isArray(s.source_course_id) 
          ? s.source_course_id[0]?.semester_id 
          : (s.source_course_id as any)?.semester_id
        return semId === profile.current_semester_id
      }).map((s: any) => s.id)

      if (subjectIdsToArchive.length > 0) {
        await supabaseClient
          .from('subjects')
          .update({ is_active: false })
          .in('id', subjectIdsToArchive)
      }

      await supabaseClient
        .from('profiles')
        .update({ current_semester_id: null })
        .eq('id', profile.id)

      await refreshProfileData()
      toast.success("Semester archived! Setup your new semester below.")
      router.refresh()
    } catch (err) {
      toast.error("Failed to archive semester")
    } finally {
      setSaving(false)
    }
  }

  async function handleUnarchiveSemester() {
    if (!profile || !supabaseClient) return
    setSaving(true)
    try {
      const { data: subs } = await supabaseClient
        .from('subjects')
        .select('id, source_course_id(semester_id)')
        .eq('profile_id', profile.id)
        .eq('type', 'academic')
        .eq('is_active', false)

      const subjectIdsToRestore = (subs || []).filter((s: any) => {
        const semId = Array.isArray(s.source_course_id) 
          ? s.source_course_id[0]?.semester_id 
          : (s.source_course_id as any)?.semester_id
        return semId === profile.current_semester_id
      }).map((s: any) => s.id)

      if (subjectIdsToRestore.length > 0) {
        await supabaseClient
          .from('subjects')
          .update({ is_active: true })
          .in('id', subjectIdsToRestore)
      }

      setHasActiveSubjects(true)
      toast.success("Semester unarchived successfully!")
      router.refresh()
    } catch (err) {
      toast.error("Failed to unarchive semester")
    } finally {
      setSaving(false)
    }
  }

  // Compile academic summary for the hero card (must be before early returns)
  const academicSummary = useMemo(() => {
    const parts = [uniName, progName, semName].filter(p => p && p !== "Not Set")
    if (parts.length === 0) return "Academic Track Not Setup"
    return parts.join(" • ")
  }, [uniName, progName, semName])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6 animate-in fade-in duration-500">
        {/* Hero Header Skeleton */}
        <div className="bg-muted/40 rounded-3xl p-8 relative overflow-hidden animate-pulse h-40">
          <div className="absolute top-8 left-8 space-y-3">
            <div className="h-4 w-24 bg-muted/60 rounded-md" />
            <div className="h-8 w-48 bg-muted rounded-md" />
          </div>
        </div>

        {/* Form Skeleton */}
        <div className="space-y-4">
          <div className="h-6 w-32 bg-muted animate-pulse rounded-md mb-2" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex justify-between items-center p-4 rounded-xl border bg-card animate-pulse">
              <div className="space-y-2">
                <div className="h-3 w-16 bg-muted/60 rounded-md" />
                <div className="h-5 w-32 bg-muted rounded-md" />
              </div>
              <div className="h-8 w-8 bg-muted rounded-md" />
            </div>
          ))}
        </div>
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
        className="bg-primary rounded-3xl p-8 text-primary-foreground relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-black/10 rounded-3xl" />
        <div className="relative z-10">
          <div className="flex justify-between items-start">
            <div>
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl font-black mb-4 shadow-sm border border-white/10">
                {displayName?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <h1 className="text-2xl font-black tracking-tight">{displayName}</h1>
              <p className="text-white/80 font-medium mt-1 flex items-center gap-1.5 pt-1">
                <Phone className="w-4 h-4" />
                {session?.user?.phone}
              </p>
            </div>
          </div>
          
          {/* Compiled Academic Summary at the top */}
          {profile.academics_enabled && (
            <div className="mt-6 pt-5 border-t border-white/20 flex items-start gap-3">
              <School className="w-5 h-5 text-white/70 shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-white/90 leading-relaxed">
                {academicSummary}
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Personal Details Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border rounded-2xl overflow-hidden shadow-sm"
      >
        <div className="px-5 py-3 bg-muted/40 border-b">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <User className="w-3.5 h-3.5" /> Personal Settings
          </h2>
        </div>
        <div className="divide-y">
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

          <div className="px-5 py-4 flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Phone className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Phone Number</p>
              <p className="font-mono font-medium text-sm">{session?.user?.phone}</p>
            </div>
            <div className="text-[10px] text-muted-foreground bg-muted border px-2 py-1 rounded-full font-bold uppercase tracking-wider">
              Locked
            </div>
          </div>
        </div>
      </motion.div>

      {/* Institutional Academic Section */}
      {profile.academics_enabled && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border rounded-2xl overflow-hidden shadow-sm"
        >
          <div className="px-5 py-3 bg-muted/40 border-b">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <School className="w-3.5 h-3.5" /> Institutional Enrollment
            </h2>
          </div>
          <div className="divide-y">
            
            {/* University Selection Dropdown */}
            <DropdownRow
              icon={<School className="w-4 h-4" />}
              label="University"
              value={uniName}
              options={universities}
              currentId={profile.current_university_id}
              saving={saving}
              isAdding={isAddingUni}
              onSetIsAdding={setIsAddingUni}
              newName={newUniName}
              onNewNameChange={setNewUniName}
              onCreate={handleCreateUni}
              onDelete={handleDeleteUni}
              onChange={(newId) => handleRelationalChange("current_university_id", newId)}
              placeholder="Select your university..."
              addLabel="Add New University"
              addValue="ADD_NEW_UNI"
            />

            {/* Program Selection Dropdown */}
            <DropdownRow
              icon={<GraduationCap className="w-4 h-4" />}
              label="Degree Program"
              value={progName}
              options={programs}
              currentId={profile.current_program_id}
              saving={saving}
              isAdding={isAddingProg}
              onSetIsAdding={setIsAddingProg}
              newName={newProgName}
              onNewNameChange={setNewProgName}
              onCreate={handleCreateProg}
              onDelete={handleDeleteProg}
              onChange={(newId) => handleRelationalChange("current_program_id", newId)}
              disabled={!profile.current_university_id}
              disabledMessage="Select a university first"
              placeholder="Select your program..."
              addLabel="Add New Program"
              addValue="ADD_NEW_PROG"
            />

            {/* Semester Selection Dropdown */}
            <DropdownRow
              icon={<BookOpen className="w-4 h-4" />}
              label="Current Semester"
              value={semName}
              options={semesters}
              currentId={profile.current_semester_id}
              saving={saving}
              isAdding={isAddingSem}
              onSetIsAdding={setIsAddingSem}
              newName={newSemName}
              onNewNameChange={setNewSemName}
              newNumber={newSemNumber}
              onNewNumberChange={setNewSemNumber}
              onCreate={handleCreateSem}
              onDelete={handleDeleteSem}
              onChange={(newId) => handleRelationalChange("current_semester_id", newId)}
              disabled={!profile.current_program_id}
              disabledMessage="Select a program first"
              placeholder="Select your semester..."
              addLabel="Add New Semester"
              addValue="ADD_NEW_SEM"
              isSemester
            />

            {/* Target Attendance */}
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

            {/* Archive/Unarchive Semester Action */}
            <div className="px-5 py-4 bg-amber-500/5 flex items-center justify-between gap-4">
               <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20">
                    <FolderOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest">End of Semester</p>
                    <p className="font-medium text-sm text-amber-900 dark:text-amber-100">{hasArchivedSubjects && !hasActiveSubjects ? "Restore Archived Data" : "Archive Current Data"}</p>
                  </div>
               </div>
               {hasArchivedSubjects && !hasActiveSubjects ? (
                 <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleUnarchiveSemester}
                  disabled={saving || !profile.current_semester_id}
                  className="h-9 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 font-bold text-xs uppercase tracking-wider px-4"
                 >
                   Unarchive
                 </Button>
               ) : (
                 <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleArchiveSemester}
                  disabled={saving || !profile.current_semester_id}
                  className="h-9 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 font-bold text-xs uppercase tracking-wider px-4"
                 >
                   Archive
                 </Button>
               )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Tracks Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card border rounded-2xl overflow-hidden shadow-sm"
      >
        <div className="px-5 py-3 bg-muted/40 border-b">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" /> Feature Tracks
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
        className="border border-destructive/20 rounded-2xl overflow-hidden shadow-sm"
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

/* ─── Reusable Inline-Edit Row (Scalars) ─── */
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
      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0 shadow-sm border border-black/5 dark:border-white/5">
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
                className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0 hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={onCancel}
                className="w-8 h-8 rounded-lg bg-muted border text-muted-foreground flex items-center justify-center shrink-0 hover:bg-muted/80 transition-colors shadow-sm"
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

/* ─── Reusable Dropdown Row (Relational FKs) ─── */
function DropdownRow({
  icon, label, value, options, currentId, saving,
  onChange, disabled, disabledMessage, placeholder,
  isAdding, onSetIsAdding, newName, onNewNameChange, onCreate, onDelete,
  addLabel, addValue, isSemester, newNumber, onNewNumberChange
}: {
  icon: React.ReactNode
  label: string
  value: string
  options: any[]
  currentId: string | null
  saving: boolean
  onChange: (id: string) => void
  disabled?: boolean
  disabledMessage?: string
  placeholder?: string
  isAdding: boolean
  onSetIsAdding: (v: boolean) => void
  newName: string
  onNewNameChange: (v: string) => void
  onCreate: () => void
  onDelete: (e: React.MouseEvent, id: string) => void
  addLabel: string
  addValue: string
  isSemester?: boolean
  newNumber?: string
  onNewNumberChange?: (v: string) => void
}) {
  return (
    <div className="px-5 py-4 flex items-center gap-4">
      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0 shadow-sm border border-black/5 dark:border-white/5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{label}</p>
        <AnimatePresence mode="wait">
          {disabled ? (
            <motion.div key="disabled" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1">
              <p className="text-sm text-muted-foreground italic">{disabledMessage}</p>
            </motion.div>
          ) : isAdding ? (
            <motion.div
              key="adding"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-1"
            >
              {isSemester ? (
                <div className="flex flex-col gap-2 p-2 bg-muted/30 rounded-lg border border-primary/20 animate-in zoom-in-95">
                  <Input 
                    autoFocus
                    placeholder="Name (e.g. Sem 1)" 
                    className="h-8 text-xs px-2"
                    value={newName}
                    onChange={(e) => onNewNameChange(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Input 
                      type="number"
                      placeholder="#" 
                      className="h-8 w-16 text-xs px-2"
                      value={newNumber}
                      onChange={(e) => onNewNumberChange?.(e.target.value)}
                    />
                    <Button size="sm" className="h-8 flex-1 text-xs" onClick={onCreate}>Save</Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onSetIsAdding(false)}><X className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 animate-in slide-in-from-top-1 duration-200">
                  <Input 
                    autoFocus
                    placeholder={placeholder} 
                    className="h-10 bg-background"
                    value={newName}
                    onChange={(e) => onNewNameChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onCreate()}
                  />
                  <Button size="icon" className="h-10 w-10 shrink-0" onClick={onCreate}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={() => onSetIsAdding(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="display"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-1"
            >
              <Select 
                value={currentId || ""} 
                onValueChange={(val) => {
                  if (val === addValue) onSetIsAdding(true)
                  else onChange(val)
                }}
              >
                <SelectTrigger className="h-10 w-full bg-background border-muted-foreground/10 text-sm font-medium">
                  <SelectValue placeholder={placeholder || "Select..."} />
                </SelectTrigger>
                <SelectContent>
                  {options.map(opt => (
                    <div key={opt.id} className="flex items-center justify-between group/item px-2 hover:bg-muted/50 rounded-md">
                      <SelectItem value={opt.id} className="flex-1">{opt.name}</SelectItem>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 opacity-0 group-hover/item:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => onDelete(e, opt.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  <div className="border-t mt-1 pt-1">
                    <SelectItem value={addValue} className="text-primary font-bold focus:bg-primary/10 focus:text-primary">
                      <span className="flex items-center gap-2 font-black"><Plus className="w-4 h-4" /> {addLabel}</span>
                    </SelectItem>
                  </div>
                </SelectContent>
              </Select>
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
      className={`flex-1 py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 shadow-sm ${
        enabled
          ? "border-primary/30 bg-primary/5 text-primary"
          : "border-muted bg-muted/30 text-muted-foreground hover:border-muted-foreground/20 hover:bg-muted/50"
      } disabled:opacity-50`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border border-black/5 dark:border-white/5 ${
        enabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      }`}>
        {icon}
      </div>
      <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
        enabled
          ? "bg-primary/10 text-primary border border-primary/20"
          : "bg-muted text-muted-foreground border border-black/5 dark:border-white/10"
      }`}>
        {enabled ? "Active" : "Disabled"}
      </span>
    </button>
  )
}
