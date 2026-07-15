"use client"

import { useEffect, useState } from "react"
import { useSupabaseSession } from "@/lib/supabase-auth"
import { useRouter } from "next/navigation"
import { getAppClient, type AppSupabaseClient } from "@/lib/supabase-client"
import { m, AnimatePresence } from "motion/react"
import { 
  User, Phone, GraduationCap, Target, BookOpen, 
  Check, X, Loader2,
  School, FolderOpen, Trash2, Plus, ChevronRight
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PageHeader } from '@/components/dashboard/page-header'

interface IdName { id: string; name: string }
interface SessionData { user: { phone?: string; supabaseToken?: string; name?: string | null } }

interface ProfileData {
  id: string
  display_name?: string
  whatsapp_number?: string
  email?: string | null
  current_university_id?: string | null
  current_program_id?: string | null
  current_semester_id?: string | null
  target_attendance_pct?: number
  academics_enabled?: boolean
  personal_enabled?: boolean
  timezone?: string
  max_gpa?: number
  is_admin?: boolean
}

interface SubjectRow {
  id: string
  is_active?: boolean
  source_course_id?: { semester_id?: string } | Array<{ semester_id?: string }>
}

export default function ProfilePage() {
  const router = useRouter()
  const { session } = useSupabaseSession()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  
  const [universities, setUniversities] = useState<IdName[]>([])
  const [programs, setPrograms] = useState<IdName[]>([])
  const [semesters, setSemesters] = useState<(IdName & { semester_number: number })[]>([])

  const [uniName, setUniName] = useState("Not Set")
  const [progName, setProgName] = useState("Not Set")
  const [semName, setSemName] = useState("Not Set")
  
  const [supabaseClient, setSupabaseClient] = useState<AppSupabaseClient | null>(null)
  const [loading, setLoading] = useState(true)

  const [editField, setEditField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [saving, setSaving] = useState(false)

  const [isAddingUni, setIsAddingUni] = useState(false)
  const [newUniName, setNewUniName] = useState("")
  
  const [isAddingProg, setIsAddingProg] = useState(false)
  const [newProgName, setNewProgName] = useState("")

  const [isAddingSem, setIsAddingSem] = useState(false)
  const [newSemName, setNewSemName] = useState("")
  const [newSemNumber, setNewSemNumber] = useState("")

  const [hasArchivedSubjects, setHasArchivedSubjects] = useState(false)
  const [hasActiveSubjects, setHasActiveSubjects] = useState(false)

  const [deleting, setDeleting] = useState(false)

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
      
      ;(subs || []).forEach((s: SubjectRow) => {
        const semId = Array.isArray(s.source_course_id) 
          ? s.source_course_id[0]?.semester_id 
          : (s.source_course_id as { semester_id?: string })?.semester_id
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

  async function fetchUniversityData(supabase: AppSupabaseClient, id: string | null | undefined) {
    if (id) {
      const { data: u } = await supabase.from('universities').select('name').eq('id', id).single()
      if (u) setUniName(u.name)
      const { data: progs } = await supabase.from('programs').select('id, name').eq('university_id', id).order('name')
      if (progs) setPrograms(progs)
    } else {
      setUniName("Not Set")
      setPrograms([])
    }
  }

  async function fetchProgramData(supabase: AppSupabaseClient, id: string | null | undefined) {
    if (id) {
      const { data: p } = await supabase.from('programs').select('name').eq('id', id).single()
      if (p) setProgName(p.name)
      const { data: sems } = await supabase.from('semesters').select('id, name, semester_number').eq('program_id', id).order('semester_number')
      if (sems) setSemesters(sems)
    } else {
      setProgName("Not Set")
      setSemesters([])
    }
  }

  async function fetchSemesterData(supabase: AppSupabaseClient, id: string | null | undefined) {
    if (id) {
      const { data: s } = await supabase.from('semesters').select('name').eq('id', id).single()
      if (s) setSemName(s.name)
    } else {
      setSemName("Not Set")
    }
  }

  async function fetchNamesAndDropdowns(supabase: AppSupabaseClient, prof: ProfileData) {
    await Promise.all([
      fetchUniversityData(supabase, prof.current_university_id),
      fetchProgramData(supabase, prof.current_program_id),
      fetchSemesterData(supabase, prof.current_semester_id)
    ])
  }

  useEffect(() => {
    async function fetchInitialData(supabase: AppSupabaseClient, sess: SessionData) {
      const [{ data: prof }, { data: unis }] = await Promise.all([
        supabase.from('profiles').select('*').eq('whatsapp_number', sess.user.phone).single(),
        supabase.from('universities').select('id, name').order('name')
      ])

      if (unis) setUniversities(unis)

      if (prof) {
        setProfile(prof)
        await Promise.all([
          fetchUniversityData(supabase, prof.current_university_id),
          fetchProgramData(supabase, prof.current_program_id),
          fetchSemesterData(supabase, prof.current_semester_id)
        ])
      }
      setLoading(false)
    }

    async function init() {
      const supabase = getAppClient()
      setSupabaseClient(supabase)

      // Fetch initial data (RLS scopes profiles to caller)
      const [{ data: prof }, { data: unis }] = await Promise.all([
        supabase.from('profiles').select('*').single(),
        supabase.from('universities').select('id, name').order('name')
      ])

      if (unis) setUniversities(unis)

      if (prof) {
        setProfile(prof)
        await Promise.all([
          fetchUniversityData(supabase, prof.current_university_id),
          fetchProgramData(supabase, prof.current_program_id),
          fetchSemesterData(supabase, prof.current_semester_id)
        ])
      }
      setLoading(false)
    }
    init()
  }, [])


  // Refetch just the profile and names
  async function refreshProfileData() {
    if (!supabaseClient) return
    const { data: prof } = await supabaseClient.from('profiles').select('*').single()
    if (prof) {
      setProfile(prof)
      await fetchNamesAndDropdowns(supabaseClient, prof)
    }
  }

  // Handle cascaded fetches when a dropdown selection changes
  async function handleRelationalChange(field: string, newId: string) {
    if (!profile || !supabaseClient) return
    setSaving(true)

    const updates: Record<string, string | null> = {}
    
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
  async function saveField(field: string, value: string | number | boolean) {
    if (!profile || !supabaseClient) return
    setSaving(true)
    await supabaseClient.from('profiles').update({ [field]: value }).eq('id', profile.id)
    await refreshProfileData()
    router.refresh()
    setSaving(false)
    setEditField(null)
  }

  function startEdit(field: string, currentValue: string | number | null | undefined) {
    setEditField(field)
    setEditValue(currentValue?.toString() || "")
  }

  function cancelEdit() {
    setEditField(null)
    setEditValue("")
  }

  async function handleDeleteAccount() {
    if (!profile || !supabaseClient) return
    const confirmed = globalThis.confirm(
      "⚠️ Are you sure you want to permanently delete your account?\n\n" +
      "This will delete ALL your data including subjects, attendance, grades, tasks, and timers.\n\n" +
      "This action CANNOT be undone."
    )
    if (!confirmed) return

    const doubleConfirm = globalThis.prompt(
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
    await supabaseClient.auth.signOut()
    window.location.href = '/login'
  }

  async function handleExportUserData() {
    if (!profile || !supabaseClient) return
    try {
      toast.info("Preparing your data export...")
      
      const [
        { data: subjects },
        { data: attendance },
        { data: grades },
        { data: timers },
        { data: tasks },
        { data: reminders }
      ] = await Promise.all([
        supabaseClient.from('subjects').select('*').eq('profile_id', profile.id),
        supabaseClient.from('attendance_logs').select('*').eq('profile_id', profile.id),
        supabaseClient.from('grades').select('*').eq('profile_id', profile.id),
        supabaseClient.from('study_timers').select('*').eq('profile_id', profile.id),
        supabaseClient.from('tasks').select('*').eq('profile_id', profile.id),
        supabaseClient.from('task_reminders').select('*').eq('profile_id', profile.id),
      ])

      const exportData = {
        exported_at: new Date().toISOString(),
        profile,
        subjects: subjects || [],
        attendance_logs: attendance || [],
        grades: grades || [],
        study_timers: timers || [],
        tasks: tasks || [],
        task_reminders: reminders || []
      }

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2))
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute("href", dataStr)
      downloadAnchor.setAttribute("download", `ryumedha_export_${profile.display_name || 'user'}_${new Date().toISOString().split('T')[0]}.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
      toast.success("Data exported successfully!")
    } catch (err) {
      console.error(err)
      toast.error("Failed to export data")
    }
  }

  // Institutional Management Functions
  async function handleCreateUni() {
    if (!newUniName.trim() || !supabaseClient) return
    const { data, error } = await supabaseClient.from('universities').insert([{ name: newUniName.trim() }]).select().single()
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
    
    const { error } = await supabaseClient.from('universities').delete().eq('id', id)
    
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
    const { data, error } = await supabaseClient.from('programs').insert([{ 
      name: newProgName.trim(), 
      university_id: profile.current_university_id 
    }]).select().single()
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
    
    const { error } = await supabaseClient.from('programs').delete().eq('id', id)
    
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
    const { data, error } = await supabaseClient.from('semesters').insert([{ 
      name: newSemName.trim(), 
      semester_number: Number.parseInt(newSemNumber) || 1,
      program_id: profile.current_program_id 
    }]).select().single()
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
    
    const { error } = await supabaseClient.from('semesters').delete().eq('id', id)
    
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
    const confirmed = globalThis.confirm(
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

      const subjectIdsToArchive = (subs || []).filter((s: SubjectRow) => {
        const semId = Array.isArray(s.source_course_id) 
          ? s.source_course_id[0]?.semester_id 
          : (s.source_course_id as { semester_id?: string })?.semester_id
        return semId === profile.current_semester_id
      }).map((s: SubjectRow) => s.id)

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
      console.error(err)
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

      const subjectIdsToRestore = (subs || []).filter((s: SubjectRow) => {
        const semId = Array.isArray(s.source_course_id) 
          ? s.source_course_id[0]?.semester_id 
          : (s.source_course_id as { semester_id?: string })?.semester_id
        return semId === profile.current_semester_id
      }).map((s: SubjectRow) => s.id)

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
      console.error(err)
      toast.error("Failed to unarchive semester")
    } finally {
      setSaving(false)
    }
  }

  // Compile academic summary for the hero card (must be before early returns)
  // const academicSummary = useMemo(() => {
  //   const parts = [uniName, progName, semName].filter(p => p && p !== "Not Set")
  //   if (parts.length === 0) return "Academic Track Not Setup"
  //   return parts.join(" • ")
  // }, [uniName, progName, semName])

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
          {[1, 2, 3, 4, 5].map((val) => (
            // NOSONAR
            <div key={`skeleton-${val}`} className="flex justify-between items-center p-4 rounded-xl border bg-card animate-pulse">
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

  const displayName = profile.display_name || session?.user?.email || 'User'


  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-4 space-y-6">
      
      <PageHeader 
        title="Settings" 
        description="Manage your account, academic details, and preferences." 
      />

      {/* Hero Header / User Card */}
      <div className="bg-card rounded-2xl p-4 flex items-center gap-4 shadow-sm border border-border/50">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-medium text-primary shrink-0">
          {displayName?.charAt(0)?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold tracking-tight truncate">{displayName}</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-1.5 mt-0.5">
            {session?.user?.email}
          </p>
        </div>
      </div>

      {/* Profile Section */}
      <div className="space-y-1.5">
        <h2 className="text-[13px] uppercase tracking-wider text-muted-foreground ml-4 font-medium">Personal</h2>
        <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden divide-y divide-border/50">
          <ProfileRow
            icon={<User className="w-4 h-4 text-white" />}
            iconBg="bg-blue-500"
            label="Display Name"
            value={displayName ?? ""}
            isEditing={editField === "display_name"}
            editValue={editValue}
            saving={saving}
            onEdit={() => startEdit("display_name", profile.display_name || "")}
            onCancel={cancelEdit}
            onChange={setEditValue}
            onSave={() => saveField("display_name", editValue)}
          />

          <ProfileRow
            icon={<User className="w-4 h-4 text-white" />}
            iconBg="bg-teal-500"
            label="Email"
            value={profile.email ?? "Not Linked"}
            isEditing={editField === "email"}
            editValue={editValue}
            saving={saving}
            onEdit={() => startEdit("email", profile.email || "")}
            onCancel={cancelEdit}
            onChange={setEditValue}
            onSave={() => saveField("email", editValue)}
          />

          <ProfileRow
            icon={<Phone className="w-4 h-4 text-white" />}
            iconBg="bg-green-500"
            label="Link WhatsApp No"
            value={profile.whatsapp_number ?? "Not Linked"}
            isEditing={editField === "whatsapp_number"}
            editValue={editValue}
            saving={saving}
            onEdit={() => startEdit("whatsapp_number", profile.whatsapp_number || "")}
            onCancel={cancelEdit}
            onChange={setEditValue}
            onSave={() => saveField("whatsapp_number", editValue)}
          />
        </div>
      </div>

      {/* Feature Tracks Section */}
      <div className="space-y-1.5">
        <h2 className="text-[13px] uppercase tracking-wider text-muted-foreground ml-4 font-medium">Features</h2>
        <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden divide-y divide-border/50">
          <TrackToggle
            icon={<GraduationCap className="w-4 h-4 text-white" />}
            iconBg="bg-indigo-500"
            label="Academic Features"
            enabled={profile.academics_enabled ?? false}
            saving={saving}
            onToggle={() => saveField("academics_enabled", !profile.academics_enabled)}
          />
          <TrackToggle
            icon={<FolderOpen className="w-4 h-4 text-white" />}
            iconBg="bg-orange-500"
            label="Personal Features"
            enabled={profile.personal_enabled ?? false}
            saving={saving}
            onToggle={() => saveField("personal_enabled", !profile.personal_enabled)}
          />
        </div>
      </div>

      {/* Institutional Academic Section */}
      {profile.academics_enabled && (
        <div className="space-y-1.5">
          <h2 className="text-[13px] uppercase tracking-wider text-muted-foreground ml-4 font-medium">Academic Profile</h2>
          <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden divide-y divide-border/50">
            <DropdownRow
              icon={<School className="w-4 h-4 text-white" />}
              iconBg="bg-blue-600"
              label="University"
              value={uniName}
              options={universities}
              currentId={profile.current_university_id ?? null}
              saving={saving}
              isAdding={isAddingUni}
              onSetIsAdding={setIsAddingUni}
              newName={newUniName}
              onNewNameChange={setNewUniName}
              onCreate={handleCreateUni}
              onDelete={handleDeleteUni}
              onChange={(newId) => handleRelationalChange("current_university_id", newId)}
              placeholder="Select University"
              addLabel="Add University"
              addValue="ADD_NEW_UNI"
            />

            <DropdownRow
              icon={<GraduationCap className="w-4 h-4 text-white" />}
              iconBg="bg-indigo-600"
              label="Degree Program"
              value={progName}
              options={programs}
              currentId={profile.current_program_id ?? null}
              saving={saving}
              isAdding={isAddingProg}
              onSetIsAdding={setIsAddingProg}
              newName={newProgName}
              onNewNameChange={setNewProgName}
              onCreate={handleCreateProg}
              onDelete={handleDeleteProg}
              onChange={(newId) => handleRelationalChange("current_program_id", newId)}
              disabled={!profile.current_university_id}
              disabledMessage="Select university first"
              placeholder="Select Program"
              addLabel="Add Program"
              addValue="ADD_NEW_PROG"
            />

            <DropdownRow
              icon={<BookOpen className="w-4 h-4 text-white" />}
              iconBg="bg-purple-500"
              label="Current Semester"
              value={semName}
              options={semesters}
              currentId={profile.current_semester_id ?? null}
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
              disabledMessage="Select program first"
              placeholder="Select Semester"
              addLabel="Add Semester"
              addValue="ADD_NEW_SEM"
              isSemester
            />

            <ProfileRow
              icon={<Target className="w-4 h-4 text-white" />}
              iconBg="bg-rose-500"
              label="Target Attendance"
              value={`${profile.target_attendance_pct ?? 75}%`}
              isEditing={editField === "target_attendance_pct"}
              editValue={editValue}
              saving={saving}
              onEdit={() => startEdit("target_attendance_pct", profile.target_attendance_pct ?? 75)}
              onCancel={cancelEdit}
              onChange={setEditValue}
              onSave={() => {
                const pct = Number.parseFloat(editValue)
                if (!Number.isNaN(pct) && pct >= 0 && pct <= 100) saveField("target_attendance_pct", pct)
              }}
              inputType="number"
              suffix="%"
            />

            <button 
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={hasArchivedSubjects && !hasActiveSubjects ? handleUnarchiveSemester : handleArchiveSemester}
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
                  <FolderOpen className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium">{hasArchivedSubjects && !hasActiveSubjects ? "Restore Archived Semester" : "Archive Current Semester"}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground ml-4 mt-1.5">
            Archiving your semester hides current subjects but preserves history.
          </p>
        </div>
      )}

      {/* Data Portability Section */}
      <div className="space-y-1.5">
        <h2 className="text-[13px] uppercase tracking-wider text-muted-foreground ml-4 font-medium">Data Portability</h2>
        <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden divide-y divide-border/50">
          <button 
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={handleExportUserData}
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
                <FolderOpen className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium">Export My Data</p>
                <p className="text-xs text-muted-foreground">Download a copy of your personal data as JSON</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="space-y-1.5 pt-4">
        <div className="bg-card rounded-2xl shadow-sm border border-destructive/20 overflow-hidden divide-y divide-border/50">
          <button 
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-destructive/5 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            onClick={handleDeleteAccount}
            disabled={deleting}
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-destructive flex items-center justify-center shrink-0">
                {deleting ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Trash2 className="w-4 h-4 text-white" />}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-destructive">{deleting ? "Deleting..." : "Delete Account"}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-destructive/50" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground ml-4 mt-1.5">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
      </div>

    </div>
  )
}

/* ─── Reusable Inline-Edit Row (Scalars) ─── */
function ProfileRow({
  icon, iconBg, label, value, isEditing, editValue, saving,
  onEdit, onCancel, onChange, onSave,
  inputType = "text", suffix, placeholder
}: Readonly<{
  icon: React.ReactNode
  iconBg: string
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
}>) {
  return (
    <div className="px-4 py-3 flex items-center gap-3 min-h-[44px]">
      <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0 flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        <AnimatePresence mode="wait">
          {isEditing ? (
            <m.div
              key="edit"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center gap-2"
            >
              <input
                type={inputType}
                value={editValue}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                autoFocus
                className="h-7 px-2 rounded-md bg-muted border text-sm w-[120px] outline-none focus:ring-2 focus:ring-primary/30 text-right"
                onKeyDown={e => {
                  if (e.key === 'Enter') onSave()
                  if (e.key === 'Escape') onCancel()
                }}
              />
              {suffix && <span className="text-sm text-muted-foreground font-medium">{suffix}</span>}
              <button
                onClick={onSave}
                disabled={saving}
                className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0 hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={onCancel}
                className="w-7 h-7 rounded-md bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </m.div>
          ) : (
            <m.div
              key="display"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 group cursor-pointer"
              onClick={onEdit}
            >
              <p className="text-sm text-muted-foreground">{value}</p>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ─── Reusable Dropdown Row (Relational FKs) ─── */
function DropdownRow({
  icon, iconBg, label, value: _value, options, currentId, saving: _saving,
  onChange, disabled, disabledMessage, placeholder,
  isAdding, onSetIsAdding, newName, onNewNameChange, onCreate, onDelete,
  addLabel, addValue, isSemester, newNumber, onNewNumberChange
}: Readonly<{
  icon: React.ReactNode
  iconBg: string
  label: string
  value: string
  options: IdName[]
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
}>) {
  return (
    <div className="px-4 py-3 flex items-center gap-3 min-h-[44px]">
      <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0 flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        <AnimatePresence mode="wait">
          {disabled && (
            <m.div key="disabled" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="text-sm text-muted-foreground/50">{disabledMessage}</p>
            </m.div>
          )}
          {!disabled && isAdding && (
            <m.div
              key="adding"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center gap-2"
            >
              {isSemester ? (
                <>
                  <Input 
                    autoFocus
                    placeholder="Name" 
                    className="h-7 text-xs px-2 w-[80px]"
                    value={newName}
                    onChange={(e) => onNewNameChange(e.target.value)}
                  />
                  <Input 
                    type="number"
                    placeholder="#" 
                    className="h-7 text-xs px-2 w-[40px]"
                    value={newNumber}
                    onChange={(e) => onNewNumberChange?.(e.target.value)}
                  />
                  <Button size="icon" className="h-7 w-7 shrink-0" onClick={onCreate}>
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onSetIsAdding(false)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Input 
                    autoFocus
                    placeholder={placeholder} 
                    className="h-7 text-xs px-2 w-[120px]"
                    value={newName}
                    onChange={(e) => onNewNameChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onCreate()}
                  />
                  <Button size="icon" className="h-7 w-7 shrink-0" onClick={onCreate}>
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onSetIsAdding(false)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </m.div>
          )}
          {!disabled && !isAdding && (
            <m.div
              key="display"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2"
            >
              <Select 
                value={currentId || ""} 
                onValueChange={(val) => {
                  if (val === addValue) onSetIsAdding(true)
                  else onChange(val)
                }}
              >
                <SelectTrigger className="h-7 border-0 bg-transparent text-sm text-muted-foreground shadow-none px-0 gap-1 focus:ring-0 w-auto justify-end hover:bg-transparent">
                  <SelectValue placeholder={placeholder || "Select"} />
                </SelectTrigger>
                <SelectContent position="popper" align="end" alignOffset={-16} sideOffset={8}>
                  {options.map(opt => (
                    <div key={opt.id} className="flex items-center justify-between group/item px-2 hover:bg-muted/50 rounded-md">
                      <SelectItem value={opt.id} className="flex-1">{opt.name}</SelectItem>
                      {opt.id !== currentId && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                          onClick={(e) => onDelete(e, opt.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <div className="border-t mt-1 pt-1">
                    <SelectItem value={addValue} className="text-primary font-medium focus:bg-primary/10 focus:text-primary">
                      <span className="flex items-center gap-2"><Plus className="w-3.5 h-3.5" /> {addLabel}</span>
                    </SelectItem>
                  </div>
                </SelectContent>
              </Select>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ─── Track Toggle Button ─── */
function TrackToggle({
  icon, iconBg, label, enabled, saving, onToggle
}: Readonly<{
  icon: React.ReactNode
  iconBg: string
  label: string
  enabled: boolean
  saving: boolean
  onToggle: () => void
}>) {
  return (
    <div className="px-4 py-3 flex items-center justify-between min-h-[44px]">
      <div className="flex items-center gap-3">
        <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <p className="text-sm font-medium">{label}</p>
      </div>
      <Switch 
        checked={enabled} 
        onCheckedChange={onToggle} 
        disabled={saving}
      />
    </div>
  )
}
