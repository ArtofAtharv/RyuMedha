"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSupabaseSession } from "@/lib/supabase-auth"
import { getAppClient, type AppSupabaseClient } from "@/lib/supabase-client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  BookOpen, FolderOpen, User, ArrowRight, CheckCircle2, 
  School, GraduationCap, Calendar, Loader2, ChevronLeft,
  Plus, Trash2, X, Check
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { m, AnimatePresence } from "motion/react"

// interface SessionUser {
//   supabaseToken?: string
//   phone?: string
// }

// interface SessionData {
//   user: SessionUser
// }

interface IdName { id: string; name: string }
interface Program extends IdName { default_target_attendance?: number }
interface Semester extends IdName { semester_number: number }
interface Course { id: string; course_name: string }

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const { session: _session } = useSupabaseSession()
  const [supabaseClient, setSupabaseClient] = useState<AppSupabaseClient | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  
  // Step 1: Basics
  const [displayName, setDisplayName] = useState("")
  const [academicsEnabled, setAcademicsEnabled] = useState(false)
  const [personalEnabled, setPersonalEnabled] = useState(false)
  
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
  
  // Step 3: Subjects
  const [availableCourses, setAvailableCourses] = useState<Course[]>([])
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([])
  const [newCourseName, setNewCourseName] = useState("")
  const [customCourses, setCustomCourses] = useState<string[]>([])

  const handleAddCustomCourse = () => {
    const trimmed = newCourseName.trim()
    if (!trimmed) return
    if (customCourses.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("This subject is already in your list")
      return
    }
    setCustomCourses(prev => [...prev, trimmed])
    setNewCourseName("")
    toast.success(`Added '${trimmed}'`)
  }

  const handleRemoveCustomCourse = (indexToRemove: number) => {
    setCustomCourses(prev => prev.filter((_, idx) => idx !== indexToRemove))
  }
  
  const toggleCourseSelection = (courseId: string) => {
    setSelectedCourseIds(prev => prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId])
  }
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    async function init() {
      const supabase = getAppClient()
      setSupabaseClient(supabase)

      let activeSession = null
      const { data: sessionData } = await supabase.auth.getSession()
      activeSession = sessionData?.session

      if (!activeSession) {
        const getCookie = (name: string) => {
          if (typeof document === 'undefined') return null
          const cookies = document.cookie.split(';')
          for (let i = 0; i < cookies.length; i++) {
            const c = cookies[i].trim()
            if (c.startsWith(`${name}=`)) {
              return decodeURIComponent(c.substring(name.length + 1))
            }
          }
          return null
        }
        const accessToken = getCookie('sb-access-token')
        const refreshToken = getCookie('sb-refresh-token')

        if (refreshToken) {
          const { data: setSessionRes } = await supabase.auth.setSession({
            access_token: accessToken || '',
            refresh_token: refreshToken
          })
          activeSession = setSessionRes?.session
        }
      }

      if (!activeSession) {
        router.push("/login")
        return
      }
      
      const { data: profile, error: _profileError } = await supabase
        .from('profiles')
        .select('*')
        .single()
        
      if (profile) {
        setProfileId(profile.id)
        setDisplayName((prev) => prev || profile.display_name || "")
        setAcademicsEnabled(profile.academics_enabled ?? false)
        setPersonalEnabled(profile.personal_enabled ?? false)
        setTargetAttendance(profile.target_attendance_pct?.toString() || "75")
      } else {
        // If profile is missing, auto-create it on the fly
        const user = activeSession.user
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            whatsapp_number: user.phone || user.user_metadata?.whatsapp_number || user.user_metadata?.phone || null,
            display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            academics_enabled: null,
            personal_enabled: null,
            target_attendance_pct: 75
          })
          .select()
          .single()

        if (newProfile) {
          setProfileId(newProfile.id)
          setDisplayName(newProfile.display_name || "")
          setAcademicsEnabled(false)
          setPersonalEnabled(false)
          setTargetAttendance("75")
        } else {
          console.error("Setup init: failed to auto-create profile", insertError)
          toast.error("Failed to initialize profile. Please refresh the page.")
        }
      }

      // Pre-fetch universities
      const { data: unis } = await supabase.from('universities').select('id, name').order('name')
      if (unis) setUniversities(unis)
    }
    init()
  }, [router])

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
      if (prog?.default_target_attendance) {
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
      console.error("handleCreateUni error:", error)
      toast.error(`Failed to add university: ${error.message || "Unknown error"}`)
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
      console.error("handleCreateProg error:", error)
      toast.error(`Failed to add program: ${error.message || "Unknown error"}`)
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
    if (!newSemName.trim() || !selectedProgId || !supabaseClient) return
    setIsSubmitting(true)
    
    // Auto-extract semester number from semester name (e.g. "Semester 5" -> 5)
    const semNameStr = newSemName.trim()
    const digitMatch = semNameStr.match(/\d+/)
    const parsedNumber = digitMatch ? Number.parseInt(digitMatch[0], 10) : (semesters.length + 1)

    const { data, error } = await supabaseClient.from('semesters').insert([{ 
      name: semNameStr, 
      program_id: selectedProgId,
      semester_number: parsedNumber
    }]).select().single()
    setIsSubmitting(false)
    if (error) {
      console.error("handleCreateSem error:", error)
      toast.error(`Failed to add semester: ${error.message || "Unknown error"}`)
    } else {
      setSemesters(prev => [...prev, data].sort((a, b) => a.semester_number - b.semester_number))
      setSelectedSemId(data.id)
      setIsAddingSem(false)
      setNewSemName("")
      toast.success(`Semester '${data.name}' added (Sem #${parsedNumber})!`)
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
    } else {
      await saveProfileOnly()
    }
  }

  async function saveProfileOnly() {
    if (!supabaseClient || !profileId) return
    setIsSubmitting(true)
    const { error } = await supabaseClient
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        academics_enabled: academicsEnabled,
        personal_enabled: personalEnabled
      })
      .eq('id', profileId)
    
    setIsSubmitting(false)
    if (error) setErrorMsg(error.message)
    else setStep(4)
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

  async function handleFinalSave(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!supabaseClient || !profileId) return
    setIsSubmitting(true)
    setErrorMsg("")

    // 1. Update Profile
    const profileUpdates: Record<string, unknown> = {
      display_name: displayName.trim(),
      academics_enabled: academicsEnabled,
      personal_enabled: personalEnabled,
      target_attendance_pct: Number.parseFloat(targetAttendance) || 75
    }

    if (academicsEnabled) {
      profileUpdates.current_university_id = selectedUniId
      profileUpdates.current_program_id = selectedProgId
      profileUpdates.current_semester_id = selectedSemId
    }

    const { error: pError } = await supabaseClient
      .from('profiles')
      .update(profileUpdates)
      .eq('id', profileId)

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

    // 3. Add Custom Courses if provided
    const allCustomNames = [...customCourses]
    if (newCourseName.trim() && !allCustomNames.some(c => c.toLowerCase() === newCourseName.trim().toLowerCase())) {
      allCustomNames.push(newCourseName.trim())
    }

    if (academicsEnabled && allCustomNames.length > 0) {
      for (const customName of allCustomNames) {
        const { data: newCourse, error: courseError } = await supabaseClient
          .from('academic_courses')
          .insert([{
            semester_id: selectedSemId,
            course_name: customName
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
    }

    setIsSubmitting(false)
    setStep(4)
  }

  const step1Bundle = { displayName, setDisplayName, academicsEnabled, setAcademicsEnabled, personalEnabled, setPersonalEnabled, handleStep1Next };
  const step2Bundle = {
    isAddingUni, setIsAddingUni, newUniName, setNewUniName, handleCreateUni, selectedUniId, setSelectedUniId, universities, handleDeleteUni,
    isAddingProg, setIsAddingProg, newProgName, setNewProgName, handleCreateProg, selectedProgId, setSelectedProgId, programs, handleDeleteProg,
    isAddingSem, setIsAddingSem, newSemName, setNewSemName, handleCreateSem, selectedSemId, setSelectedSemId, semesters, handleDeleteSem,
    errorMsg, setStep, handleStep2Next, isSubmitting
  };
  const step3Bundle = {
    availableCourses, semesters, selectedSemId, universities, selectedUniId, academicsEnabled,
    selectedCourseIds, toggleCourseSelection, newCourseName, setNewCourseName, customCourses, handleAddCustomCourse, handleRemoveCustomCourse, handleFinalSave, isSubmitting, setSelectedCourseIds, setStep, errorMsg
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 selection:bg-primary/20">
      <div className="w-full max-w-md">
        <div className="flex justify-center gap-2 mb-6">
          <div className={`h-1.5 w-8 rounded-full transition-colors ${step === 1 ? 'bg-primary' : 'bg-primary/20'}`} />
          <div className={`h-1.5 w-8 rounded-full transition-colors ${step === 2 ? 'bg-primary' : 'bg-primary/20'}`} />
          <div className={`h-1.5 w-8 rounded-full transition-colors ${step === 3 ? 'bg-primary' : 'bg-primary/20'}`} />
          <div className={`h-1.5 w-8 rounded-full transition-colors ${step === 4 ? 'bg-primary' : 'bg-primary/20'}`} />
        </div>

        <Card className="overflow-hidden border-border/60 bg-card">
          <AnimatePresence mode="wait">
            {step === 1 && <SetupStep1Card {...step1Bundle} />}
            {step === 2 && <SetupStep2Card {...step2Bundle} />}
            {step === 3 && <SetupStep3Card {...step3Bundle} />}
            {step === 4 && <SetupStep4Card onComplete={() => router.push("/dashboard/whatsapp-bot")} />}
          </AnimatePresence>
        </Card>
      </div>
    </div>
  )
}

interface Step1CardProps {
  displayName: string
  setDisplayName: (val: string) => void
  academicsEnabled: boolean
  setAcademicsEnabled: (val: boolean) => void
  personalEnabled: boolean
  setPersonalEnabled: (val: boolean) => void
  handleStep1Next: () => void
}

function SetupStep1Card(props: Readonly<Step1CardProps>) {
  const { displayName, setDisplayName, academicsEnabled, setAcademicsEnabled, personalEnabled, setPersonalEnabled, handleStep1Next } = props;
  return (
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
            autoComplete="name"
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
  )
}

interface Step2CardProps {
  isAddingUni: boolean
  setIsAddingUni: (val: boolean) => void
  newUniName: string
  setNewUniName: (val: string) => void
  handleCreateUni: () => void
  selectedUniId: string
  setSelectedUniId: (val: string) => void
  universities: IdName[]
  handleDeleteUni: (e: React.MouseEvent, id: string) => void
  isAddingProg: boolean
  setIsAddingProg: (val: boolean) => void
  newProgName: string
  setNewProgName: (val: string) => void
  handleCreateProg: () => void
  selectedProgId: string
  setSelectedProgId: (val: string) => void
  programs: Program[]
  handleDeleteProg: (e: React.MouseEvent, id: string) => void
  isAddingSem: boolean
  setIsAddingSem: (val: boolean) => void
  newSemName: string
  setNewSemName: (val: string) => void
  handleCreateSem: () => void
  selectedSemId: string
  setSelectedSemId: (val: string) => void
  semesters: Semester[]
  handleDeleteSem: (e: React.MouseEvent, id: string) => void
  errorMsg: string
  setStep: (val: number) => void
  handleStep2Next: () => void
  isSubmitting: boolean
}

function SetupStep2Card(props: Readonly<Step2CardProps>) {
  const {
    isAddingUni, setIsAddingUni, newUniName, setNewUniName, handleCreateUni, selectedUniId, setSelectedUniId, universities, handleDeleteUni,
    isAddingProg, setIsAddingProg, newProgName, setNewProgName, handleCreateProg, selectedProgId, setSelectedProgId, programs, handleDeleteProg,
    isAddingSem, setIsAddingSem, newSemName, setNewSemName, handleCreateSem, selectedSemId, setSelectedSemId, semesters, handleDeleteSem,
    errorMsg, setStep, handleStep2Next, isSubmitting
  } = props;

  return (
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
              <SelectTrigger className="h-12 bg-background border-muted-foreground/20">
                <SelectValue placeholder={selectedUniId ? "Select degree program..." : "Select university first"} />
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
                <div className="border-t mt-1 pt-1">
                  <SelectItem value="ADD_NEW_PROG" className="text-primary font-bold focus:bg-primary/10 focus:text-primary">
                    <span className="flex items-center gap-2 font-semibold"><Plus className="w-4 h-4" /> Add New Program</span>
                  </SelectItem>
                </div>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* SEMESTER */}
        <div className="space-y-2">
          <Label className="font-bold flex items-center gap-2 data-[enabled=false]:opacity-50" data-enabled={!!selectedProgId}>
            <Calendar className="w-4 h-4 text-muted-foreground" /> Current Semester
          </Label>
          
          {isAddingSem ? (
            <div className="flex gap-2 animate-in slide-in-from-top-1">
              <Input 
                autoFocus
                placeholder="Semester Name (e.g. Semester 5 or Sem 3)" 
                className="h-10 bg-background flex-1"
                value={newSemName}
                onChange={(e) => setNewSemName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSem()}
              />
              <Button size="icon" className="h-10 w-10 shrink-0" onClick={handleCreateSem} disabled={isSubmitting || !newSemName.trim()}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </Button>
              <Button size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={() => { setIsAddingSem(false); setNewSemName(""); }}>
                <X className="w-4 h-4" />
              </Button>
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
              <SelectTrigger className="h-12 bg-background border-muted-foreground/20">
                <SelectValue placeholder={selectedProgId ? "Select semester..." : "Select program first"} />
              </SelectTrigger>
              <SelectContent>
                {semesters.map(s => (
                  <div key={s.id} className="flex items-center justify-between group/item px-2 hover:bg-muted/50 rounded-md">
                    <SelectItem value={s.id} className="flex-1">{s.name}</SelectItem>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 opacity-0 group-hover/item:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => handleDeleteSem(e, s.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <div className="border-t mt-1 pt-1">
                  <SelectItem value="ADD_NEW_SEM" className="text-primary font-bold focus:bg-primary/10 focus:text-primary">
                    <span className="flex items-center gap-2 font-semibold"><Plus className="w-4 h-4" /> Add New Semester</span>
                  </SelectItem>
                </div>
              </SelectContent>
            </Select>
          )}
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
  )
}

interface Step3CardProps {
  availableCourses: Course[]
  semesters: Semester[]
  selectedSemId: string
  universities: IdName[]
  selectedUniId: string
  academicsEnabled: boolean
  selectedCourseIds: string[]
  toggleCourseSelection: (id: string) => void
  newCourseName: string
  setNewCourseName: (val: string) => void
  customCourses: string[]
  handleAddCustomCourse: () => void
  handleRemoveCustomCourse: (idx: number) => void
  handleFinalSave: (e: React.SyntheticEvent) => void
  isSubmitting: boolean
  setSelectedCourseIds: React.Dispatch<React.SetStateAction<string[]>>
  setStep: (val: number) => void
  errorMsg: string
}

function SetupStep3Card(props: Readonly<Step3CardProps>) {
  const {
    availableCourses, semesters, selectedSemId, universities, selectedUniId, academicsEnabled,
    selectedCourseIds, toggleCourseSelection, newCourseName, setNewCourseName, customCourses, handleAddCustomCourse, handleRemoveCustomCourse, handleFinalSave, isSubmitting, setSelectedCourseIds, setStep, errorMsg
  } = props;

  return (
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
            ? "Choose existing courses or add your custom subjects below."
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
                <CourseSelectionList 
                  courses={availableCourses} 
                  selectedIds={selectedCourseIds} 
                  onToggle={toggleCourseSelection} 
                />
              </div>
            )}

            <div className="space-y-3">
              <Label className="font-bold">
                {availableCourses.length > 0 ? "Add Custom Subjects" : "Add Your Subjects"}
              </Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Enter subject name (e.g. Contract Law)" 
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddCustomCourse()
                    }
                  }}
                  className="h-10 bg-background flex-1"
                />
                <Button 
                  type="button" 
                  onClick={handleAddCustomCourse}
                  disabled={!newCourseName.trim()}
                  className="h-10 px-4 font-bold text-xs shrink-0 rounded-xl gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Subject
                </Button>
              </div>

              {/* Added Custom Courses Chips / List */}
              {customCourses.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs text-muted-foreground font-semibold">Custom Subjects to Add ({customCourses.length}):</span>
                  <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto">
                    {customCourses.map((course, idx) => (
                      <Badge 
                        key={idx} 
                        variant="secondary" 
                        className="py-1 px-3 text-xs flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-xl"
                      >
                        <span>{course}</span>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveCustomCourse(idx)}
                          className="hover:bg-primary/20 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3 text-primary" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {errorMsg && <p className="text-xs text-destructive text-center font-semibold bg-destructive/10 p-2 rounded">{errorMsg}</p>}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="h-12 w-14 border-muted-foreground/20" onClick={() => setStep(2)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button 
            className="h-12 flex-1 rounded-full text-base font-semibold"
            onClick={handleFinalSave}
            disabled={isSubmitting || (academicsEnabled && selectedCourseIds.length === 0 && customCourses.length === 0 && !newCourseName.trim())}
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Finish Setup"}
          </Button>
        </div>
        <div className="text-center">
          <Button 
            variant="ghost" 
            className="text-muted-foreground"
            onClick={() => { setSelectedCourseIds([]); setNewCourseName(""); handleFinalSave({ preventDefault: () => {} } as React.SyntheticEvent) }}
            disabled={isSubmitting}
          >
            Skip and Connect WhatsApp
          </Button>
        </div>
      </CardContent>
    </m.div>
  )
}

function TrackOption({ icon, label, selected, onClick }: Readonly<{ icon: React.ReactNode, label: string, selected: boolean, onClick: () => void }>) {
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

function CourseSelectionList({ 
  courses, 
  selectedIds, 
  onToggle 
}: Readonly<{ 
  courses: { id: string; course_name: string }[]; 
  selectedIds: string[]; 
  onToggle: (id: string) => void 
}>) {
  return (
    <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-2">
      {courses.map(course => {
        const isSelected = selectedIds.includes(course.id)
        return (
          <button 
            type="button"
            key={course.id}
            onClick={() => onToggle(course.id)}
            className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between group w-full text-left ${isSelected ? 'border-primary bg-primary/5' : 'border-border/50 hover:bg-muted/50'}`}
          >
            <span className="font-medium text-sm">{course.course_name}</span>
            {isSelected && <Check className="w-4 h-4 text-primary" />}
          </button>
        )
      })}
    </div>
  )
}

function SetupStep4Card({ onComplete }: Readonly<{ onComplete: () => void }>) {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly')
  const [loadingPay, setLoadingPay] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [loadingInvite, setLoadingInvite] = useState(false)
  const [showInviteInput, setShowInviteInput] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const codeParam = params.get('invite') || params.get('code')
      if (codeParam) {
        setInviteCode(codeParam)
        setShowInviteInput(true)
      }
    }
  }, [])

  const handleSubscribe = async () => {
    setLoadingPay(true)
    try {
      const res = await fetch('/api/razorpay/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planType: selectedPlan })
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        toast.error(data.error || 'Failed to initialize subscription')
        setLoadingPay(false)
        return
      }

      // Load Razorpay Checkout Script
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => {
        // @ts-expect-error Razorpay SDK attached to window
        const rzp = new window.Razorpay({
          key: data.key_id,
          subscription_id: data.subscription_id,
          name: 'Ryu Medha',
          description: `Auto-Pay Subscription (${selectedPlan === 'yearly' ? '₹399/yr' : '₹39/mo'})`,
          handler: async (response: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
            const verifyRes = await fetch('/api/razorpay/verify-subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_signature: response.razorpay_signature,
                planType: selectedPlan
              })
            })
            if (verifyRes.ok) {
              toast.success('Auto-Pay set up successfully! Welcome to Ryu Medha.')
              onComplete()
            } else {
              toast.error('Payment verification failed')
            }
            setLoadingPay(false)
          },
          modal: {
            ondismiss: () => {
              setLoadingPay(false)
            }
          }
        })
        rzp.open()
      }
      script.onerror = () => {
        toast.error('Failed to load Razorpay SDK')
        setLoadingPay(false)
      }
      document.body.appendChild(script)
    } catch (err: unknown) {
      console.error(err)
      toast.error('An unexpected error occurred')
      setLoadingPay(false)
    }
  }

  const handleRedeemInviteCode = async () => {
    if (!inviteCode.trim()) {
      toast.error('Please enter an invite code')
      return
    }
    setLoadingInvite(true)
    try {
      const res = await fetch('/api/invite/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode.trim() })
      })
      const data = await res.json()

      if (res.ok && data.success) {
        toast.success(data.message || 'Free access granted!')
        onComplete()
      } else {
        toast.error(data.error || 'Failed to redeem invite code')
      }
    } catch (err) {
      console.error(err)
      toast.error('Error redeeming invite code')
    } finally {
      setLoadingInvite(false)
    }
  }

  return (
    <m.div
      key="step4"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.4 }}
    >
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">Set Up Auto-Pay</CardTitle>
        <CardDescription>
          Auto-pay setup is required to start your 30-day free trial. You won&apos;t be charged today—billing starts only after your trial ends. Cancel anytime.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 pt-3">
        <div className="grid grid-cols-2 gap-3">
          <div
            onClick={() => setSelectedPlan('monthly')}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
              selectedPlan === 'monthly'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border/60 hover:bg-muted/30'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monthly</p>
            <p className="text-2xl font-bold mt-1">₹39<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-tight">1st month FREE, then ₹39/mo auto-pay.</p>
          </div>

          <div
            onClick={() => setSelectedPlan('yearly')}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
              selectedPlan === 'yearly'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border/60 hover:bg-muted/30'
            }`}
          >
            <span className="absolute -top-2.5 right-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
              SAVE 15%
            </span>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Yearly</p>
            <p className="text-2xl font-bold mt-1">₹399<span className="text-xs font-normal text-muted-foreground">/yr</span></p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-tight">1st month FREE, then ₹399/yr auto-pay.</p>
          </div>
        </div>

        <div className="bg-muted/40 rounded-xl p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Data Retention Guarantee
          </p>
          <p>If unsubscribed after trial, data is retained for 60 days before automatic permanent deletion.</p>
        </div>

        <div className="space-y-3 pt-2">
          <Button
            className="w-full h-12 rounded-full font-bold text-base shadow-md"
            onClick={handleSubscribe}
            disabled={loadingPay || loadingInvite}
          >
            {loadingPay ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Set Up Auto-Pay (Razorpay)'}
          </Button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-border/50"></div>
            <span className="flex-shrink mx-3 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">OR</span>
            <div className="flex-grow border-t border-border/50"></div>
          </div>

          {!showInviteInput ? (
            <Button
              variant="outline"
              className="w-full h-10 rounded-full text-xs font-semibold border-border/60 text-muted-foreground hover:text-foreground"
              onClick={() => setShowInviteInput(true)}
            >
              Have an Invite Code / Link?
            </Button>
          ) : (
            <div className="p-3 border rounded-2xl bg-muted/20 space-y-2 animate-in fade-in duration-200">
              <Label htmlFor="inviteCodeInput" className="text-xs font-bold">Enter Invite Code</Label>
              <div className="flex gap-2">
                <Input
                  id="inviteCodeInput"
                  placeholder="e.g. RYULIFETIME"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="h-10 text-xs font-mono uppercase bg-background"
                />
                <Button
                  size="sm"
                  className="h-10 px-4 rounded-xl font-bold shrink-0"
                  onClick={handleRedeemInviteCode}
                  disabled={loadingInvite || !inviteCode.trim()}
                >
                  {loadingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Redeem'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </m.div>
  )
}

