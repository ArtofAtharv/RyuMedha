"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getAppClient, type AppSupabaseClient } from "@/lib/supabase-client"
import { getSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  BookOpen, FolderOpen, User, ArrowRight, CheckCircle2, 
  School, GraduationCap, Target, Loader2, ChevronLeft,
  Plus, Trash2, X, Check
} from "lucide-react"
import { toast } from "sonner"
import { m, AnimatePresence } from "motion/react"

interface SessionUser {
  supabaseToken?: string
  phone?: string
}

interface SessionData {
  user: SessionUser
}

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [session, setSession] = useState<SessionData | null>(null)
  const [supabaseClient, setSupabaseClient] = useState<AppSupabaseClient | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  
  // Step 1: Basics
  const [displayName, setDisplayName] = useState("")
  const [academicsEnabled, setAcademicsEnabled] = useState(true)
  const [personalEnabled, setPersonalEnabled] = useState(true)
  
  // Step 2: Academic Details
  interface IdName { id: string; name: string }
  interface Program extends IdName { default_target_attendance?: number }
  interface Semester extends IdName { semester_number: number }
  interface Course { id: string; course_name: string }

  const [universities, setUniversities] = useState<IdName[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  
  const [selectedUniId, setSelectedUniId] = useState<string>("")
  const [selectedProgId, setSelectedProgId] = useState<string>("")
  const [selectedSemId, setSelectedSemId] = useState<string>("")
  const [targetAttendance, setTargetAttendance] = useState("75")

  // Dynamic Management States
  const [isAddingUni, setIsAddingUni] = useState(false)
  const [newUniName, setNewUniName] = useState("")
  const [isAddingProg, setIsAddingProg] = useState(false)
  const [newProgName, setNewProgName] = useState("")
  const [isAddingSem, setIsAddingSem] = useState(false)
  const [newSemName, setNewSemName] = useState("")
  const [newSemNumber, setNewSemNumber] = useState("")
  
  // Step 3: Subjects
  const [availableCourses, setAvailableCourses] = useState<Course[]>([])
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([])
  const [newCourseName, setNewCourseName] = useState("")
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    async function init() {
      const sess = await getSession()
      if (!sess) {
        router.push("/login")
        return
      }
      setSession(sess)
      
      const supabase = getAppClient({ global: { headers: { Authorization: `Bearer ${sess.user.supabaseToken}` } } }
      )
      setSupabaseClient(supabase)
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('whatsapp_number', sess.user.phone)
        .single()
        
      if (profile) {
        setProfileId(profile.id)
        setDisplayName((prev) => prev || profile.display_name || "")
        setAcademicsEnabled(profile.academics_enabled ?? true)
        setPersonalEnabled(profile.personal_enabled ?? true)
        setTargetAttendance(profile.target_attendance_pct?.toString() || "75")
      }

      // Pre-fetch universities
      const { data: unis } = await supabase.from('universities').select('id, name').order('name')
      if (unis) setUniversities(unis)
    }
    init()
  }, [router, session?.user?.phone])

  // cascaded fetches for Step 2
  useEffect(() => {
    if (selectedUniId && supabaseClient) {
      supabaseClient.from('programs').select('id, name, default_target_attendance').eq('university_id', selectedUniId).order('name')
        .then(({ data }: { data: Program[] | null }) => {
          setPrograms(data || [])
          setSelectedProgId("")
          setSemesters([])
          setSelectedSemId("")
        })
    }
  }, [selectedUniId, supabaseClient])

  useEffect(() => {
    if (selectedProgId && supabaseClient) {
      // Find the selected program to get its default target attendance
      const prog = programs.find(p => p.id === selectedProgId)
      if (prog && prog.default_target_attendance) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTargetAttendance(prog.default_target_attendance.toString())
      }

      supabaseClient.from('semesters').select('id, name, semester_number').eq('program_id', selectedProgId).order('semester_number')
        .then(({ data }: { data: Semester[] | null }) => {
          setSemesters(data || [])
          setSelectedSemId("")
        })
    }
  }, [selectedProgId, supabaseClient, programs])

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
      setSelectedUniId(data.id)
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
      if (selectedUniId === id) setSelectedUniId("")
      toast.success("University removed")
    }
  }

  async function handleCreateProg() {
    if (!newProgName.trim() || !selectedUniId || !supabaseClient) return
    setIsSubmitting(true)
    const { data, error } = await supabaseClient.from('programs').insert([{ 
      name: newProgName.trim(), 
      university_id: selectedUniId 
    }]).select().single()
    setIsSubmitting(false)
    if (error) {
      toast.error("Failed to add program")
    } else {
      setPrograms(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedProgId(data.id)
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
      if (selectedProgId === id) setSelectedProgId("")
      toast.success("Program removed")
    }
  }

  async function handleCreateSem() {
    if (!newSemName.trim() || !newSemNumber || !selectedProgId || !supabaseClient) return
    setIsSubmitting(true)
    const { data, error } = await supabaseClient.from('semesters').insert([{ 
      name: newSemName.trim(), 
      program_id: selectedProgId,
      semester_number: parseInt(newSemNumber)
    }]).select().single()
    setIsSubmitting(false)
    if (error) {
      toast.error("Failed to add semester")
    } else {
      setSemesters(prev => [...prev, data].sort((a, b) => a.semester_number - b.semester_number))
      setSelectedSemId(data.id)
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
      toast.error("Cannot delete semester (has linked courses)")
    } else {
      setSemesters(prev => prev.filter(s => s.id !== id))
      if (selectedSemId === id) setSelectedSemId("")
      toast.success("Semester removed")
    }
  }

  // Navigation Logic
  async function handleStep1Next() {
    if (!displayName.trim()) return
    setErrorMsg("")
    if (academicsEnabled) {
      setStep(2)
    } else if (personalEnabled) {
      setStep(3)
    } else {
      await saveProfileOnly()
    }
  }

  async function saveProfileOnly() {
    if (!supabaseClient || !session?.user?.phone) return
    setIsSubmitting(true)
    const { error } = await supabaseClient
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        academics_enabled: academicsEnabled,
        personal_enabled: personalEnabled
      })
      .eq('whatsapp_number', session.user.phone)
    
    setIsSubmitting(false)
    if (error) setErrorMsg(error.message)
    else router.push("/dashboard")
  }

  async function handleStep2Next() {
    if (!supabaseClient) return
    if (!selectedUniId || !selectedProgId || !selectedSemId) {
      setErrorMsg("Please complete all academic details.")
      return
    }
    setErrorMsg("")
    setIsSubmitting(true)
    
    // Fetch available courses for this semester
    const { data: courses, error } = await supabaseClient
      .from('academic_courses')
      .select('id, course_name')
      .eq('semester_id', selectedSemId)
      .order('course_name')
    
    if (error) {
      toast.error("Failed to fetch courses")
    } else {
      setAvailableCourses(courses || [])
      setStep(3)
    }
    setIsSubmitting(false)
  }

  async function handleFinalSave(e: React.FormEvent) {
    e.preventDefault()
    if (!supabaseClient || !session?.user?.phone) return
    setIsSubmitting(true)
    setErrorMsg("")

    // 1. Update Profile
    const profileUpdates: Record<string, unknown> = {
      display_name: displayName.trim(),
      academics_enabled: academicsEnabled,
      personal_enabled: personalEnabled,
      target_attendance_pct: parseFloat(targetAttendance) || 75
    }

    if (academicsEnabled) {
      profileUpdates.current_university_id = selectedUniId
      profileUpdates.current_program_id = selectedProgId
      profileUpdates.current_semester_id = selectedSemId
    }

    const { error: pError } = await supabaseClient
      .from('profiles')
      .update(profileUpdates)
      .eq('whatsapp_number', session.user.phone)

    if (pError) {
      setErrorMsg(pError.message)
      setIsSubmitting(false)
      return
    }

    // 2. Add Subjects from selected courses
    if (academicsEnabled && selectedCourseIds.length > 0) {
      // Fetch existing subjects for this profile to prevent duplication
      const { data: existingSubjects } = await supabaseClient
        .from('subjects')
        .select('source_course_id')
        .eq('profile_id', profileId)
      
      const existingIds = existingSubjects?.map((s: { source_course_id: string }) => s.source_course_id) || []
      const deduplicatedCourseIds = selectedCourseIds.filter(id => !existingIds.includes(id))
      const skippedCount = selectedCourseIds.length - deduplicatedCourseIds.length

      if (deduplicatedCourseIds.length > 0) {
        const subjectsToInsert = deduplicatedCourseIds.map(courseId => {
          const course = availableCourses.find(c => c.id === courseId)
          return {
            profile_id: profileId,
            name: course?.course_name || "Unknown Subject",
            type: 'academic',
            source_course_id: courseId,
            color_hex: '#3b82f6',
            is_active: true
          }
        })
        await supabaseClient.from('subjects').insert(subjectsToInsert)
      }

      if (skippedCount > 0) {
        toast.info(`${skippedCount} subjects were already in your list and were skipped.`)
      }
    }

    // 3. Add New Course if provided
    if (academicsEnabled && newCourseName.trim()) {
      // First create the academic course
      const { data: newCourse, error: courseError } = await supabaseClient
        .from('academic_courses')
        .insert([{
          semester_id: selectedSemId,
          course_name: newCourseName.trim()
        }])
        .select()
        .single()
      
      if (!courseError && newCourse) {
        await supabaseClient.from('subjects').insert([{
          profile_id: profileId,
          name: newCourse.course_name,
          type: 'academic',
          source_course_id: newCourse.id,
          color_hex: '#3b82f6',
          is_active: true
        }])
      }
    }

    setIsSubmitting(false)
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 selection:bg-primary/20">
      <div className="w-full max-w-md">
        
        {/* Progress Dots */}
        <div className="flex justify-center gap-2 mb-6">
          <div className={`h-1.5 w-8 rounded-full transition-colors ${step === 1 ? 'bg-primary' : 'bg-primary/20'}`} />
          <div className={`h-1.5 w-8 rounded-full transition-colors ${step === 2 ? 'bg-primary' : 'bg-primary/20'}`} />
          <div className={`h-1.5 w-8 rounded-full transition-colors ${step === 3 ? 'bg-primary' : 'bg-primary/20'}`} />
        </div>

        <Card className="overflow-hidden border-border/60 bg-card">
          <AnimatePresence mode="wait">
          {step === 1 && (
            <m.div 
              key="step1"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.4 }}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <User className="w-7 h-7 text-primary" />
                </div>
                <CardTitle className="text-3xl font-semibold tracking-tight">Welcome</CardTitle>
                <CardDescription>A few details, then your workspace is ready.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="font-bold">Display Name</Label>
                  <Input 
                    id="displayName" 
                    placeholder="Your name" 
                    className="h-12 bg-background/50 border-muted-foreground/20 text-lg"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <Label className="font-bold text-muted-foreground text-[10px] uppercase tracking-wider">Tracks</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <TrackOption 
                      icon={<BookOpen className="w-5 h-5" />} 
                      label="Academic" 
                      selected={academicsEnabled} 
                      onClick={() => setAcademicsEnabled(!academicsEnabled)} 
                    />
                    <TrackOption 
                      icon={<FolderOpen className="w-5 h-5" />} 
                      label="Personal" 
                      selected={personalEnabled} 
                      onClick={() => setPersonalEnabled(!personalEnabled)} 
                    />
                  </div>
                </div>

                <Button 
                  className="h-12 w-full rounded-full text-base font-semibold"
                  disabled={!displayName.trim() || (!academicsEnabled && !personalEnabled)}
                  onClick={handleStep1Next}
                >
                  Next <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </CardContent>
            </m.div>
          )}

          {step === 2 && (
            <m.div 
              key="step2"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.4 }}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <School className="w-7 h-7 text-primary" />
                </div>
                <CardTitle className="text-3xl font-semibold tracking-tight">Academic details</CardTitle>
                <CardDescription>Connect your university, program, and semester.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-4">
                
                {/* UNIVERSITY */}
                <div className="space-y-2">
                  <Label className="font-bold flex items-center gap-2">
                    <School className="w-4 h-4 text-muted-foreground" /> University
                  </Label>
                  
                  {isAddingUni ? (
                    <div className="flex gap-2 animate-in slide-in-from-top-1 duration-200">
                      <Input 
                        autoFocus
                        placeholder="University Name" 
                        className="h-10 bg-background"
                        value={newUniName}
                        onChange={(e) => setNewUniName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateUni()}
                      />
                      <Button size="icon" className="h-10 w-10 shrink-0" onClick={handleCreateUni} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </Button>
                      <Button size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={() => setIsAddingUni(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="relative group">
                      <Select 
                        value={selectedUniId} 
                        onValueChange={(val) => {
                          if (val === "ADD_NEW_UNI") setIsAddingUni(true)
                          else setSelectedUniId(val)
                        }}
                      >
                        <SelectTrigger className="h-12 bg-background border-muted-foreground/20 w-full">
                          <SelectValue placeholder="Select university..." />
                        </SelectTrigger>
                        <SelectContent>
                          {universities.map(u => (
                            <div key={u.id} className="flex items-center justify-between group/item px-2 hover:bg-muted/50 rounded-md">
                              <SelectItem value={u.id} className="flex-1">{u.name}</SelectItem>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 opacity-0 group-hover/item:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => handleDeleteUni(e, u.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                          <div className="border-t mt-1 pt-1">
                            <SelectItem value="ADD_NEW_UNI" className="text-primary font-bold focus:bg-primary/10 focus:text-primary">
                              <span className="flex items-center gap-2 font-semibold"><Plus className="w-4 h-4" /> Add New University</span>
                            </SelectItem>
                          </div>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* PROGRAM */}
                <div className="space-y-2">
                  <Label className="font-bold flex items-center gap-2 data-[enabled=false]:opacity-50" data-enabled={!!selectedUniId}>
                    <GraduationCap className="w-4 h-4 text-muted-foreground" /> Degree Program
                  </Label>
                  
                  {isAddingProg ? (
                    <div className="flex gap-2 animate-in slide-in-from-top-1">
                      <Input 
                        autoFocus
                        placeholder="Program Name (e.g. B.Tech CS)" 
                        className="h-10 bg-background"
                        value={newProgName}
                        onChange={(e) => setNewProgName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateProg()}
                      />
                      <Button size="icon" className="h-10 w-10 shrink-0" onClick={handleCreateProg} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </Button>
                      <Button size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={() => setIsAddingProg(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Select 
                      value={selectedProgId} 
                      onValueChange={(val) => {
                        if (val === "ADD_NEW_PROG") setIsAddingProg(true)
                        else setSelectedProgId(val)
                      }} 
                      disabled={!selectedUniId}
                    >
                      <SelectTrigger className="h-12 bg-background border-muted-foreground/20 w-full">
                        <SelectValue placeholder={selectedUniId ? "Select program..." : "← Select uni first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {programs.map(p => (
                          <div key={p.id} className="flex items-center justify-between group/item px-2 hover:bg-muted/50 rounded-md">
                            <SelectItem value={p.id} className="flex-1">{p.name}</SelectItem>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 opacity-0 group-hover/item:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => handleDeleteProg(e, p.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                        {selectedUniId && (
                          <div className="border-t mt-1 pt-1">
                            <SelectItem value="ADD_NEW_PROG" className="text-primary font-bold focus:bg-primary/10 focus:text-primary">
                              <span className="flex items-center gap-2 font-semibold"><Plus className="w-4 h-4" /> Add New Program</span>
                            </SelectItem>
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* SEMESTER & TARGET */}
                <div className="grid grid-cols gap-4">
                  <div className="space-y-2">
                    <Label className="font-bold data-[enabled=false]:opacity-50" data-enabled={!!selectedProgId}>Semester</Label>
                    
                    {isAddingSem ? (
                      <div className="flex flex-col gap-1.5 p-2 bg-muted/30 rounded-lg border border-primary/20 animate-in zoom-in-95">
                        <Input 
                          autoFocus
                          placeholder="Name (e.g. Sem 1)" 
                          className="h-8 text-xs px-2"
                          value={newSemName}
                          onChange={(e) => setNewSemName(e.target.value)}
                        />
                        <div className="flex gap-1.5">
                          <Input 
                            type="number"
                            placeholder="#" 
                            className="h-8 w-12 text-xs px-2"
                            value={newSemNumber}
                            onChange={(e) => setNewSemNumber(e.target.value)}
                          />
                          <Button size="sm" className="h-8 flex-1 text-[10px]" onClick={handleCreateSem} disabled={isSubmitting}>Save</Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setIsAddingSem(false)}><X className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    ) : (
                      <Select 
                        value={selectedSemId} 
                        onValueChange={(val) => {
                          if (val === "ADD_NEW_SEM") setIsAddingSem(true)
                          else setSelectedSemId(val)
                        }} 
                        disabled={!selectedProgId}
                      >
                        <SelectTrigger className="h-12 bg-background border-muted-foreground/20 w-full">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {semesters.map(s => (
                            <div key={s.id} className="flex items-center justify-between group/item px-2 hover:bg-muted/50 rounded-md">
                              <SelectItem value={s.id} className="flex-1">{s.name}</SelectItem>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-5 w-5 opacity-0 group-hover/item:opacity-100 text-destructive hover:bg-destructive/10"
                                onClick={(e) => handleDeleteSem(e, s.id)}
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </Button>
                            </div>
                          ))}
                          {selectedProgId && (
                            <div className="border-t mt-1 pt-1">
                              <SelectItem value="ADD_NEW_SEM" className="text-primary font-bold focus:bg-primary/10 focus:text-primary">
                                <span className="flex items-center gap-2 font-semibold"><Plus className="w-4 h-4" /> Add New</span>
                              </SelectItem>
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2 ">
                    <Label className="font-bold flex items-center gap-2">
                      <Target className="w-4 h-4 text-muted-foreground" /> Goal
                    </Label>
                    <div className="flex items-center gap-2 relative">
                      <Input 
                        type="number" 
                        max="100"
                        min="0"
                        className="h-12 bg-background border-muted-foreground/20 text-center font-semibold text-xl"
                        value={targetAttendance}
                        onChange={(e) => setTargetAttendance(e.target.value)}
                      />
                      <span className="absolute right-3 font-bold text-muted-foreground/50">%</span>
                    </div>
                  </div>
                </div>

                {errorMsg && <p className="text-xs text-destructive text-center font-semibold bg-destructive/10 p-2 rounded">{errorMsg}</p>}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="h-12 w-14 border-muted-foreground/20" onClick={() => setStep(1)}>
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button 
                    className="h-12 flex-1 rounded-full text-base font-semibold"
                    onClick={handleStep2Next}
                    disabled={!selectedSemId || isSubmitting}
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Continue"} <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </div>
              </CardContent>
            </m.div>
          )}

          {step === 3 && (
            <m.div 
              key="step3"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.4 }}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <CheckCircle2 className="w-7 h-7 text-primary" />
                </div>
                <CardTitle className="text-3xl font-semibold tracking-tight">Select your courses</CardTitle>
                <CardDescription>
                  {availableCourses.length > 0 
                    ? "Choose the subjects you're studying this semester."
                    : "Be the first user from " + 
                      (semesters.find(s => s.id === selectedSemId)?.name || "this semester") + 
                      " of " + 
                      (universities.find(u => u.id === selectedUniId)?.name || "this University") + 
                      " to manage the study with excellence!"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                
                {academicsEnabled && (
                  <div className="space-y-4">
                    {availableCourses.length > 0 && (
                      <div className="space-y-2">
                        <Label className="font-bold">Existing Courses</Label>
                        <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-2">
                          {availableCourses.map(course => (
                            <div 
                              key={course.id}
                              onClick={() => {
                                if (selectedCourseIds.includes(course.id)) {
                                  setSelectedCourseIds(prev => prev.filter(id => id !== course.id))
                                } else {
                                  setSelectedCourseIds(prev => [...prev, course.id])
                                }
                              }}
                              className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between group ${selectedCourseIds.includes(course.id) ? 'border-primary bg-primary/5' : 'border-border/50 hover:bg-muted/50'}`}
                            >
                              <span className="font-medium text-sm">{course.course_name}</span>
                              {selectedCourseIds.includes(course.id) && <Check className="w-4 h-4 text-primary" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="font-bold">{availableCourses.length > 0 ? "Don't see your course?" : "Add your first course"}</Label>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Course name (e.g. Contract Law)" 
                          value={newCourseName}
                          onChange={(e) => setNewCourseName(e.target.value)}
                          className="h-10 bg-background"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3 pt-2">
                  <Button 
                    className="h-12 rounded-full text-base font-semibold"
                    onClick={handleFinalSave}
                    disabled={isSubmitting || (academicsEnabled && selectedCourseIds.length === 0 && !newCourseName.trim())}
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Finish Setup"}
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="text-muted-foreground"
                    onClick={() => { setSelectedCourseIds([]); setNewCourseName(""); handleFinalSave({ preventDefault: () => {} } as React.FormEvent) }}
                    disabled={isSubmitting}
                  >
                    Skip to Dashboard
                  </Button>
                </div>
              </CardContent>
            </m.div>
          )}
          </AnimatePresence>
        </Card>
      </div>
    </div>
  )
}

function TrackOption({ icon, label, selected, onClick }: { icon: React.ReactNode, label: string, selected: boolean, onClick: () => void }) {
  return (
    <m.div 
     
     
      onClick={onClick}
      className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-4 transition-colors group ${selected ? 'border-primary bg-primary/5' : 'border-border/60 bg-background hover:bg-muted/50'}`}
    >
      <div className={`rounded-xl p-2 transition-colors ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
        {icon}
      </div>
      <span className={`text-xs font-bold ${selected ? 'text-primary' : 'text-muted-foreground'}`}>{label}</span>
    </m.div>
  )
}
