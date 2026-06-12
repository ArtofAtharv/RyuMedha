"use client"

import { useEffect, useState, useMemo } from "react"
import { createAppClient, type AppSupabaseClient } from "@/lib/supabase-client"
import { getSession } from "next-auth/react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Trash2, FolderOpen, BookOpen, Plus, Folder, Check, ChevronDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"
import { AnimatePresence, motion, Variants } from "motion/react"
import { SubjectGridCard } from '@/components/dashboard/subject-grid-card'
import { hexToGradient } from "@/lib/gradient"
import { getSourceCourse } from "@/lib/source-course"
import type { DashboardSubject } from "@/lib/dashboard-types"
import { useProfile } from '@/components/dashboard/profile-context'

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
}

type SubjectRecord = DashboardSubject

interface CategoryRecord {
  id: string
  name: string
  color_hex?: string
}

interface CourseRecord {
  id: string
  course_name: string
}

export default function SubjectsPage() {
  const { profile } = useProfile()
  const [profileId, setProfileId] = useState<string|null>(null)
  const [supabaseClient, setSupabaseClient] = useState<AppSupabaseClient | null>(null)
  
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all")

  const [subjects, setSubjects] = useState<SubjectRecord[]>([])
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState("")
  // UI Tab state (must be declared unconditionally to preserve Hooks order)
  const [tab, setTab] = useState<"academics" | "personal">("academics")
  
  const [name, setName] = useState("")
  const [type, setType] = useState<"academic" | "personal">("academic")
  const [categoryId, setCategoryId] = useState("none")
  
  const [editingSubject, setEditingSubject] = useState<SubjectRecord | null>(null)
  const [subjectToDelete, setSubjectToDelete] = useState<SubjectRecord | null>(null)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)

  const [availableCourses, setAvailableCourses] = useState<CourseRecord[]>([])
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([])
  const [newCourseName, setNewCourseName] = useState("")
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryColor, setNewCategoryColor] = useState("#8b5cf6")

  useEffect(() => {
    async function init() {
      const sess = await getSession()
      if (!sess) return
      
      const supabase = createAppClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${sess.user.supabaseToken}` } } }
      )
      
      setSupabaseClient(supabase)
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('whatsapp_number', sess.user.phone)
        .single()
        
      if (profile) {
        setProfileId(profile.id)
        await fetchSubjects(supabase)
        await fetchCategories(supabase, profile.id)
        
        const { data: profileFull } = await supabase
          .from('profiles')
          .select('current_semester_id')
          .eq('id', profile.id)
          .single()
        
        if (profileFull?.current_semester_id) {
          const { data: courses } = await supabase
            .from('academic_courses')
            .select('id, course_name')
            .eq('semester_id', profileFull.current_semester_id)
            .order('course_name')
          setAvailableCourses(courses || [])
        }
      }
    }
    init()
  }, [])

  async function fetchSubjects(supabase: AppSupabaseClient) {
    setLoading(true)
    const { data } = await supabase
      .from('subjects')
      .select('*, source_course_id(*)')
      .eq('is_active', true)
      .order('name')
    
    setSubjects(data || [])
    setLoading(false)
  }

  const enrolledCourseIds = subjects
    .filter(s => s.source_course_id)
    .map(s => {
      if (typeof s.source_course_id === 'string') return s.source_course_id
      return getSourceCourse(s.source_course_id)?.id
    })
    .filter((id): id is string => Boolean(id))

  async function fetchCategories(supabase: AppSupabaseClient, pid: string) {
    if (!pid) return
    const { data } = await supabase
      .from('subject_categories')
      .select('*')
      .eq('profile_id', pid)
      .order('name')
    setCategories(data || [])
  }

  /* -------------------------------------------------------------------------- */
  /*                             SUBJECT MANAGEMENT                             */
  /* -------------------------------------------------------------------------- */

  async function handleAddSubject(e: React.FormEvent) {
    e.preventDefault()
    if (!supabaseClient || !profileId) return
    
    // Fixed validation: personal needs name, academic needs selected courses or a new name
    if (type === 'personal' && !name.trim()) return
    if (type === 'academic' && selectedCourseIds.length === 0 && !newCourseName.trim()) return

    setErrorMsg("")

    const duplicate = subjects.find(s => s.name.toLowerCase() === name.trim().toLowerCase())
    if (duplicate) {
      setErrorMsg(`A subject named "${duplicate.name}" already exists (${duplicate.type}). Please choose a different name.`)
      return
    }

    if (type === 'academic') {
      if (!profile?.current_semester_id) {
        setErrorMsg("Please complete your academic setup in the Profile tab first.")
        return
      }

      try {
        // Bulk Add Selected Courses
        if (selectedCourseIds.length > 0) {
          const existingIds = subjects
            .map(s => typeof s.source_course_id === 'string' ? s.source_course_id : getSourceCourse(s.source_course_id)?.id)
            .filter((id): id is string => Boolean(id))
          const deduplicatedIds = selectedCourseIds.filter(cid => !existingIds.includes(cid))
          const skippedCount = selectedCourseIds.length - deduplicatedIds.length

          if (deduplicatedIds.length > 0) {
            const toInsert = deduplicatedIds.map(cid => {
              const course = availableCourses.find(c => c.id === cid)
              return {
                profile_id: profileId,
                name: course?.course_name || "Unknown",
                type: 'academic',
                source_course_id: cid,
                color_hex: '#3b82f6',
                is_active: true
              }
            })
            const { error } = await supabaseClient.from('subjects').insert(toInsert)
            if (error) throw error
            toast.success(`Succesfully added ${deduplicatedIds.length} course(s)!`)
          }

          if (skippedCount > 0) {
            toast.info(`${skippedCount} course(s) were already enrolled and were skipped.`)
          }
        }

        // Add New Course if typed
        if (newCourseName.trim()) {
          const { data: newCourse, error: courseErr } = await supabaseClient
            .from('academic_courses')
            .insert([{
              semester_id: profile.current_semester_id,
              course_name: newCourseName.trim()
            }])
            .select()
            .single()
          
          if (courseErr) throw courseErr

          if (newCourse) {
            const { error: subErr } = await supabaseClient.from('subjects').insert([{
              profile_id: profileId,
              name: newCourse.course_name,
              type: 'academic',
              source_course_id: newCourse.id,
              color_hex: '#3b82f6',
              is_active: true
            }])
            if (subErr) throw subErr
            toast.success(`Created and added "${newCourse.course_name}"`)
          }
        }

        setSelectedCourseIds([])
        setNewCourseName("")
        fetchSubjects(supabaseClient)
      } catch (err: unknown) {
        const error = err as Error
        toast.error(`Failed to add subjects: ${error.message}`)
        setErrorMsg(error.message)
      }
      return
    }

    // Personal Subject Flow

    const colorHex = type === 'personal'
      ? (categoryId !== 'none' ? categories.find(c => c.id === categoryId)?.color_hex : '#8b5cf6')
      : null

    const { error } = await supabaseClient
      .from('subjects')
      .insert([{
        profile_id: profileId,
        name: name.trim(),
        type: type,
        source_course_id: null,
        category_id: type === 'personal' && categoryId !== "none" ? categoryId : null,
        color_hex: colorHex
      }])

    if (error) {
      setErrorMsg(`Failed to add subject: ${error.message}`)
    } else {
      setName("")
      setCategoryId("none")
      fetchSubjects(supabaseClient)
    }
  }

  async function confirmDelete() {
    if (!subjectToDelete || !supabaseClient) return
    await supabaseClient.from('subjects').delete().eq('id', subjectToDelete.id)
    setSubjectToDelete(null)
    fetchSubjects(supabaseClient)
  }

  async function saveEdit() {
    if (!editingSubject || !editingSubject.name.trim() || !supabaseClient) return
    const supabase = supabaseClient

    // Handle shared data if academic
    if (editingSubject.type === 'academic' && editingSubject.source_course_id) {
      const courseId = typeof editingSubject.source_course_id === 'string'
        ? editingSubject.source_course_id
        : getSourceCourse(editingSubject.source_course_id)?.id

      if (!courseId) return

      await supabase
        .from('academic_courses')
        .update({ 
          instructor_name: editingSubject.instructor_name,
          expected_total_lectures: Number(editingSubject.expected_total_lectures || 0)
        })
        .eq('id', courseId)
    }

    const updates: Record<string, string | number | null | boolean> = { 
        name: editingSubject.name.trim(),
        label: editingSubject.label ?? null,
        color_hex: editingSubject.color_hex ?? null,
        category_id: editingSubject.type === 'personal' && editingSubject.category_id !== "none" ? (editingSubject.category_id ?? null) : null
    }

    if (editingSubject.type === 'personal') {
        updates.expected_total_lectures = Number(editingSubject.expected_total_lectures || 0)
    }

    await supabase
      .from('subjects')
      .update(updates)
      .eq('id', editingSubject.id)

    setEditingSubject(null)
    fetchSubjects(supabase)
  }

  useEffect(() => {
    if (!profile) return
    if (profile.academics_enabled && profile.personal_enabled) return

    if (profile.academics_enabled) {
      setTab('academics')
      setType('academic')
    } else if (profile.personal_enabled) {
      setTab('personal')
      setType('personal')
    }
  }, [profile?.academics_enabled, profile?.personal_enabled])

  useEffect(() => {
    setType(tab === 'academics' ? 'academic' : 'personal')
  }, [tab])

  /* -------------------------------------------------------------------------- */
  /*                            EXAM DATES (TASKS)                              */
  /* -------------------------------------------------------------------------- */

  async function handleAddExamDate(subject_id: string, label: string, date: Date) {
    if (!profileId || !subject_id || !supabaseClient) return

    // 1. Try to update academic_courses so it is shared with everyone
    const { data: subjectData } = await supabaseClient
      .from('subjects')
      .select('type, source_course_id(id, exam_dates)')
      .eq('id', subject_id)
      .single()

    if (subjectData && subjectData.type === 'academic' && subjectData.source_course_id) {
      const courseId = typeof subjectData.source_course_id === 'object' ? (subjectData.source_course_id as {id?: string})?.id : (subjectData.source_course_id as string);
      const existingDates: Record<string, string> = typeof subjectData.source_course_id === 'object' && !Array.isArray(subjectData.source_course_id) ? ((subjectData.source_course_id as {exam_dates?: Record<string, string>})?.exam_dates || {}) : {};
       
      const updatedDates = { ...existingDates, [label]: formatOutputDate(date) };

      const { error: courseError } = await supabaseClient
        .from('academic_courses')
        .update({ exam_dates: updatedDates })
        .eq('id', courseId)
       
      if (courseError) {
        toast.error("Failed to add shared exam date to course", { description: courseError.message })
        return
      }
      
      // Refresh subjects so the UI picks up the new exam_date object
      fetchSubjects(supabaseClient)
    }

    // 2. Add to user's personal tasks
    const { error } = await supabaseClient
      .from('tasks')
      .insert([{
        profile_id: profileId,
        subject_id: subject_id,
        title: label,
        due_date: formatOutputDate(date),
        priority: 'high',
        is_completed: false,
        is_exam: true
      }])
    
    if (error) {
      setErrorMsg(`Failed to add custom date: ${error.message}`)
      toast.error("Failed to add exam date", { description: error.message })
    } else {
      toast.success("Exam Date Added", { 
        description: `"${label}" has been added. It is visible on the subject card and in your Tasks tab.` 
      })
    }
  }

  function formatOutputDate(d: Date) {
    // Return YYYY-MM-DD for database
    // we need to offset timezone issues
    const offsetDate = new Date(d.getTime() - (d.getTimezoneOffset() * 60000))
    return offsetDate.toISOString().split('T')[0]
  }

  /* -------------------------------------------------------------------------- */
  /*                            CATEGORY MANAGEMENT                             */
  /* -------------------------------------------------------------------------- */

  async function handleCreateCategory() {
    if (!newCategoryName.trim() || !profileId || !supabaseClient) return
    await supabaseClient
      .from('subject_categories')
      .insert([{
        profile_id: profileId,
        name: newCategoryName.trim(),
        color_hex: newCategoryColor
      }])
    setNewCategoryName("")
    setNewCategoryColor("#8b5cf6")
    fetchCategories(supabaseClient, profileId)
  }

  async function handleDeleteCategory(id: string) {
    if (!profileId || !supabaseClient) return
    // Setting subjects with this category to NULL category first (handled conditionally by FK constraint IF ON DELETE SET NULL, but doing it safely anyway)
    await supabaseClient.from('subjects').update({ category_id: null }).eq('category_id', id)
    await supabaseClient.from('subject_categories').delete().eq('id', id)
    fetchCategories(supabaseClient, profileId)
    fetchSubjects(supabaseClient) // Refresh to show uncategorized subjects
  }


  /* -------------------------------------------------------------------------- */
  /*                                RENDER LOOP                                 */
  /* -------------------------------------------------------------------------- */

  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => {
      // 1. Filter by Academic Hierarchy (active semester)
      if (s.type === 'academic') {
        const semId = Array.isArray(s.source_course_id)
          ? s.source_course_id[0]?.semester_id
          : s.source_course_id?.semester_id
        if (semId !== profile?.current_semester_id) return false
      }

      // 2. Filter by Category (Personal)
      if (selectedCategoryFilter === "all") return true
      if (selectedCategoryFilter === "academic") return s.type === "academic"
      return s.category_id === selectedCategoryFilter
    })
  }, [subjects, selectedCategoryFilter, profile?.current_semester_id])

  const academicSubjects = useMemo(() => filteredSubjects.filter(s => s.type === 'academic'), [filteredSubjects])
  const personalSubjects = useMemo(() => filteredSubjects.filter(s => s.type === 'personal'), [filteredSubjects])

  if (loading && subjects.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-10 animate-in fade-in duration-500">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <div className="h-9 w-48 bg-muted animate-pulse rounded-md" />
            <div className="h-4 w-72 bg-muted/60 animate-pulse rounded-md" />
          </div>
        </div>

        {/* Add Form Skeleton */}
        <Card className="bg-muted/10 border-dashed border-2">
          <CardContent className="p-4">
            <div className="h-4 w-32 bg-muted animate-pulse rounded-md mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="space-y-2 sm:col-span-5">
                <div className="h-3 w-20 bg-muted/60 animate-pulse rounded-md" />
                <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
              </div>
              <div className="space-y-2 sm:col-span-4">
                <div className="h-3 w-12 bg-muted/60 animate-pulse rounded-md" />
                <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
              </div>
              <div className="sm:col-span-3">
                <div className="h-10 w-full bg-primary/20 animate-pulse rounded-md" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Categories Skeleton */}
        <div className="space-y-4">
          <div className="h-6 w-40 bg-muted animate-pulse rounded-md" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="h-36 bg-muted/20 animate-pulse border-border/50" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight"><span className="text-primary">Subjects</span></h1>
          <p className="text-muted-foreground mt-1">Manage your active academic courses and personal learning tracks.</p>
        </div>
        {profile?.academics_enabled && profile?.personal_enabled && (
        <div className="relative flex gap-2 bg-accent/50 rounded-full p-1">
          {/* Animated indicator moves between active Button using shared layoutId */}
            <Button
              variant="ghost"
              onClick={() => {
                setTab("academics")
                setType("academic")
              }}
              className="relative gap-2 px-3 py-1 rounded-full"
            >
              {tab === "academics" && (
                <motion.span
                  layoutId="subjects-tab-indicator"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  className="absolute inset-0 m-0.1 rounded-full bg-white dark:bg-black/50 z-0"
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <BookOpen className={`w-4 h-4 ${tab === "academics" ? 'text-foreground' : 'text-muted-foreground'}`} />
                <span className={`${tab === "academics" ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>Academics</span>
              </span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setTab("personal")
                setType("personal")
              }}
              className="relative gap-2 px-3 py-1 rounded-full"
            >
              {tab === "personal" && (
                <motion.span
                  layoutId="subjects-tab-indicator"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  className="absolute inset-0 m-0.1 rounded-full bg-white dark:bg-black/50 z-0"
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <FolderOpen className={`w-4 h-4 ${tab === "personal" ? 'text-foreground' : 'text-muted-foreground'}`} />
                <span className={`${tab === "personal" ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>Personal</span>
              </span>
            </Button>
        </div>
        )}
      </div>

      {/* --- ACADEMIC SUBJECTS --- */}
      {profile?.academics_enabled && tab === "academics" && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" /> Academic Track
          </h2>
          {academicSubjects.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed rounded-2xl bg-muted/30">
              <p className="text-muted-foreground text-sm font-medium">No academic subjects defined yet.</p>
            </div>
          ) : (
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {academicSubjects.map(sub => (
                <motion.div key={sub.id} variants={itemVariants} whileHover={{ scale: 1.02, y: -2 }}>
                  <SubjectGridCard 
                    subject={sub} 
                    onEdit={() => {
                      const sourceCourse = getSourceCourse(sub.source_course_id)
                      setEditingSubject({
                        ...sub, 
                        instructor_name: sourceCourse?.instructor_name || sub.instructor_name || "",
                        expected_total_lectures: sourceCourse?.expected_total_lectures || sub.expected_total_lectures || 0
                      })
                    }}
                    onDelete={() => setSubjectToDelete(sub)}
                    onAddExamDate={(label, date) => handleAddExamDate(sub.id, label, date)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </section>
      )}

      {/* --- PERSONAL SUBJECTS (FILTERABLE) --- */}
      {profile?.personal_enabled && tab === "personal" && (
        <section className="space-y-6 pt-4 border-t">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary" /> Personal Learning
            </h2>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
                <SelectTrigger className="h-8 w-full sm:w-45 text-xs font-bold border-black/10 dark:border-white/10 shadow-sm bg-muted/20">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="uncategorized">Uncategorized</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={() => setIsCategoryModalOpen(true)} className="h-8 shrink-0 font-bold border-black/10 dark:border-white/10 shadow-sm text-xs px-2 sm:px-3">
                <Folder className="w-3.5 h-3.5 sm:mr-1" /> <span className="hidden sm:inline">Manage</span>
              </Button>
            </div>
          </div>

          {personalSubjects.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed rounded-2xl bg-muted/30">
              <p className="text-muted-foreground text-sm font-medium">No personal learning tracks defined yet.</p>
            </div>
          ) : (
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSubjects
                .filter(s => s.type === 'personal')
                .map(sub => {
                  const subCategory = categories.find(c => c.id === sub.category_id)
                  return (
                    <motion.div key={sub.id} variants={itemVariants} whileHover={{ scale: 1.02, y: -2 }}>
                      <SubjectGridCard 
                        subject={{...sub, color_hex: subCategory ? subCategory.color_hex : sub.color_hex}} 
                        category={subCategory}
                        onEdit={() => setEditingSubject({...sub})}
                        onDelete={() => setSubjectToDelete(sub)}
                        onAddExamDate={(label, date) => handleAddExamDate(sub.id, label, date)}
                      />
                    </motion.div>
                  )
              })}
            </motion.div>
          )}

        </section>
      )}

      {/* --- ADD SUBJECT FORM --- */}
      <Card className="bg-muted/30 border-dashed border-2">
        <CardContent className="p-4 w-full">
          <form onSubmit={handleAddSubject} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
            <div className="sm:col-span-12 mb-2">
              <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Plus className="w-4 h-4" /> Add New Subject
              </h2>
            </div>
            {errorMsg && (
              <div className="sm:col-span-12">
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{errorMsg}</AlertDescription>
                </Alert>
              </div>
            )}
            
            <motion.div 
              layout 
              className={`space-y-2 sm:col-span-12 ${tab === 'personal' ? 'lg:col-span-4' : 'lg:col-span-10'}`}
            >
              {tab === "academics" ? (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-muted-foreground">Select Course(s)</Label>
                  
                  <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen} >
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full h-10 justify-between bg-background border-muted-foreground/20 text-xs font-bold px-3">
                        {selectedCourseIds.length > 0 
                          ? `${selectedCourseIds.length} course(s) selected` 
                          : "Select academic courses..."}
                        <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="min-w-full p-0" align="start">
                      <div className="p-2 border-b bg-muted/20">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2 py-1">Semester Curriculum</p>
                      </div>
                      <div className="max-h-62.5 overflow-y-auto p-1">
                        {availableCourses.length > 0 ? (
                          [...availableCourses]
                            .sort((a, b) => {
                              const aEnrolled = enrolledCourseIds.includes(a.id)
                              const bEnrolled = enrolledCourseIds.includes(b.id)
                              if (aEnrolled === bEnrolled) return 0
                              return aEnrolled ? 1 : -1
                            })
                            .map(c => {
                              const isEnrolled = enrolledCourseIds.includes(c.id)
                              const isSelected = selectedCourseIds.includes(c.id)
                              return (
                                <div 
                                  key={c.id}
                                  onClick={() => {
                                    if (isEnrolled) return 
                                    if (isSelected) setSelectedCourseIds(prev => prev.filter(id => id !== c.id))
                                    else setSelectedCourseIds(prev => [...prev, c.id])
                                  }}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer transition-all hover:bg-muted/50 mb-0.5 ${isEnrolled ? 'opacity-50 cursor-not-allowed bg-muted/20' : ''} ${isSelected ? 'bg-primary/5 text-primary' : ''}`}
                                >
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected || isEnrolled ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'}`}>
                                    {(isSelected || isEnrolled) && <Check className="w-3 h-3" />}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className={`font-bold text-xs truncate ${isSelected ? 'text-primary' : ''}`}>{c.course_name}</span>
                                    {isEnrolled && <span className="text-[9px] font-medium text-muted-foreground">Already enrolled</span>}
                                  </div>
                                </div>
                              )
                            })
                        ) : (
                          <p className="text-xs text-muted-foreground italic p-4 text-center">No shared courses found for your semester.</p>
                        )}
                      </div>
                      <div className="p-2 border-t bg-muted/10">
                        <Button variant="secondary" className="w-full text-[10px] font-black uppercase tracking-wider h-10" onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsPopoverOpen(false);
                        }}>
                          Done
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  {availableCourses.length === 0 && (
                    <p className="text-[10px] text-muted-foreground italic mb-2">
                      Be the first from this semester to add courses!
                    </p>
                  )}
                  
                  <Input 
                    value={newCourseName} 
                    onChange={(e) => setNewCourseName(e.target.value)} 
                    placeholder="Or type new course name..." 
                    className="h-10 bg-background shadow-sm border-muted-foreground/20"
                  />
                </div>
              ) : (
                <>
                  <Label htmlFor="name" className="text-sm font-semibold text-muted-foreground">Subject Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={tab === 'personal' ? 'e.g. Personal Development' : 'e.g. Contract Law'} className="h-10 bg-background shadow-sm border-muted-foreground/20" required />
                </>
              )}
            </motion.div>

            <AnimatePresence mode="popLayout">
              {tab === 'personal' && (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.95, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95, x: 20 }}
                  className="space-y-2 sm:col-span-6 lg:col-span-3"
                >
                  <Label htmlFor="category" className="text-sm font-semibold text-muted-foreground">Category</Label>
                  <div className="w-full">
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger className="h-10 w-full bg-background shadow-sm border-muted-foreground/20">
                        <SelectValue placeholder="No Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Uncategorized</SelectItem>
                        {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div 
              layout 
              className={`space-y-2 sm:col-span-12 ${tab === 'personal' ? 'lg:col-span-2' : 'lg:col-span-12'}`}
            >
              <Button type="submit" className="w-full h-10 font-bold tracking-tight shadow-sm">
                Add {type === 'academic' && (selectedCourseIds.length > 1 ? `(${selectedCourseIds.length})` : '')}
              </Button>
            </motion.div>
          </form>
        </CardContent>
      </Card>

      {/* --- EDIT SUBJECT MODAL --- */}
      <Dialog open={!!editingSubject} onOpenChange={(open: boolean) => !open && setEditingSubject(null)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden outline-none border-border/50">
          <DialogHeader className="pt-6 px-6 pb-2 border-b bg-muted/20">
            <DialogTitle>Edit Subject</DialogTitle>
          </DialogHeader>
          {editingSubject && (
            <div className="space-y-4 px-6 pb-6 pt-4 max-h-[75vh] overflow-y-auto">
              
              <div className="space-y-1.5">
                <Label>Subject Name</Label>
                <Input value={editingSubject.name} onChange={e => setEditingSubject({...editingSubject, name: e.target.value})} className="bg-muted/30" />
              </div>

              {editingSubject.type === 'academic' && (
                <div className="space-y-1.5">
                  <Label>Instructor Name (Shared)</Label>
                  <Input 
                    value={editingSubject.instructor_name || ""} 
                    onChange={e => setEditingSubject({...editingSubject, instructor_name: e.target.value})} 
                    placeholder="Shared with everyone in your semester" 
                    className="bg-muted/30"
                  />
                  <p className="text-[10px] text-muted-foreground italic">Updating this changes it for all students in this semester.</p>
                </div>
              )}

              {editingSubject.type === 'academic' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Expected Total Lectures</Label>
                    <Input type="number" min="0" value={editingSubject.expected_total_lectures || 0} onChange={e => setEditingSubject({...editingSubject, expected_total_lectures: Number(e.target.value) || 0})} className="bg-muted/30" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Color Identity</Label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {['#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316','#14b8a6','#6366f1','#84cc16','#a855f7'].map(hex => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setEditingSubject({...editingSubject, color_hex: hex})}
                          className={`w-8 h-8 rounded-full border-2 transition-all shrink-0 shadow-sm ${editingSubject.color_hex === hex ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'border-transparent hover:scale-110'}`}
                          style={hexToGradient(hex)}
                          title={hex}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="pt-4 flex gap-2 w-full">
                <Button variant="outline" onClick={() => setEditingSubject(null)} className="flex-1">Cancel</Button>
                <Button onClick={saveEdit} className="flex-1 font-bold tracking-wider">Save Changes</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* --- DELETE CONFIRMATION --- */}
      <Dialog open={!!subjectToDelete} onOpenChange={(open: boolean) => !open && setSubjectToDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="text-center">
            <div className="w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl">Delete Subject?</DialogTitle>
          </DialogHeader>
          {subjectToDelete && (
            <div className="text-center space-y-4">
              <p className="text-sm">Are you sure you want to completely delete <strong>{subjectToDelete.name}</strong>? This will also remove any tasks, grades, or attendance logs linked to it.</p>
              <div className="flex gap-2 w-full pt-2">
                <Button variant="outline" onClick={() => setSubjectToDelete(null)} className="flex-1">Cancel</Button>
                <Button variant="destructive" onClick={confirmDelete} className="flex-1">Delete Permanently</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* --- MANAGE CATEGORIES MODAL --- */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden outline-none border-border/50">
          <DialogHeader className="pt-6 px-6 pb-2 border-b bg-muted/30">
            <DialogTitle>Manage Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 px-6 pb-6 pt-4">
            
            {/* Add category form */}
            <div className="flex gap-2 items-end bg-card">
              <div className="space-y-1.5 flex-1">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">New Category</Label>
                <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="e.g. Competitive Exams" className="bg-muted/30" />
              </div>
              <div className="space-y-1.5 w-12.5">
                <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Color</Label>
                <Input type="color" value={newCategoryColor} onChange={e => setNewCategoryColor(e.target.value)} className="h-10 w-full p-1 cursor-pointer" />
              </div>
              <Button onClick={handleCreateCategory} disabled={!newCategoryName.trim()} className="h-10 font-bold px-4">Add</Button>
            </div>

            {/* List categories */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b pb-1">Existing Categories</h3>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-4">No categories created yet.</p>
              ) : (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/20">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full shadow-sm" style={hexToGradient(cat.color_hex ?? '#8b5cf6')} />
                        <span className="font-bold text-sm tracking-tight">{cat.name}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(cat.id)} className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

function AlertTriangle({className}: {className?: string}) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
  )
}
