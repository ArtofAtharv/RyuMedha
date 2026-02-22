"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@supabase/supabase-js"
import { getSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, X, Pencil, User, FolderOpen, Target, BookOpen, GraduationCap, Plus, Folder, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { hexToGradient } from "@/lib/gradient"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { SubjectGridCard } from '@/components/dashboard/subject-grid-card'
import { useProfile } from '@/components/dashboard/profile-context'

export default function SubjectsPage() {
  const { profile } = useProfile()
  const [session, setSession] = useState<any>(null)
  const [profileId, setProfileId] = useState<string|null>(null)
  const [supabaseClient, setSupabaseClient] = useState<any>(null)
  
  // Category Filter State
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all")

  const [subjects, setSubjects] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState("")
  
  // Add Form State
  const [name, setName] = useState("")
  const [type, setType] = useState("academic")
  const [categoryId, setCategoryId] = useState("none")
  
  // Modals Data
  const [editingSubject, setEditingSubject] = useState<any>(null)
  const [subjectToDelete, setSubjectToDelete] = useState<any>(null)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)

  // Category Manager State
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryColor, setNewCategoryColor] = useState("#8b5cf6")

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
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('whatsapp_number', sess.user.phone)
        .single()
        
      if (profile) {
        setProfileId(profile.id)
        await fetchSubjects(supabase)
        await fetchCategories(supabase, profile.id)
      }
    }
    init()
  }, [])

  async function fetchSubjects(supabase: any) {
    setLoading(true)
    const { data } = await supabase
      .from('subjects')
      .select('*')
      .eq('is_active', true)
      .order('name')
    setSubjects(data || [])
    setLoading(false)
  }

  async function fetchCategories(supabase: any, pid: string) {
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
    if (!name.trim()) return
    setErrorMsg("")

    const duplicate = subjects.find(s => s.name.toLowerCase() === name.trim().toLowerCase())
    if (duplicate) {
      setErrorMsg(`A subject named "${duplicate.name}" already exists (${duplicate.type}). Please choose a different name.`)
      return
    }

    const { error } = await supabaseClient
      .from('subjects')
      .insert([{
        profile_id: profileId,
        name: name.trim(),
        type: type,
        category_id: type === 'personal' && categoryId !== "none" ? categoryId : null,
        color_hex: type === 'personal' && categoryId !== 'none' ? categories.find(c => c.id === categoryId)?.color_hex : '#8b5cf6'
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
    if (!subjectToDelete) return
    await supabaseClient.from('subjects').delete().eq('id', subjectToDelete.id)
    setSubjectToDelete(null)
    fetchSubjects(supabaseClient)
  }

  async function saveEdit() {
    if (!editingSubject || !editingSubject.name.trim()) return

    await supabaseClient
      .from('subjects')
      .update({ 
        name: editingSubject.name.trim(),
        label: editingSubject.label,
        instructor_name: editingSubject.instructor_name,
        color_hex: editingSubject.color_hex,
        legacy_attended_lectures: Number(editingSubject.legacy_attended_lectures || 0),
        legacy_missed_lectures: Number(editingSubject.legacy_missed_lectures || 0),
        expected_total_lectures: Number(editingSubject.expected_total_lectures || 0),
        category_id: editingSubject.type === 'personal' && editingSubject.category_id !== "none" ? editingSubject.category_id : null
      })
      .eq('id', editingSubject.id)

    setEditingSubject(null)
    fetchSubjects(supabaseClient)
  }

  /* -------------------------------------------------------------------------- */
  /*                            EXAM DATES (TASKS)                              */
  /* -------------------------------------------------------------------------- */

  async function handleAddExamDate(subject_id: string, label: string, date: Date) {
    if (!profileId || !subject_id) return
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
        description: `"${label}" has been added. You can see it in your Tasks tab under Upcoming Exams.` 
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
    if (!newCategoryName.trim() || !profileId) return
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
    if (!profileId) return
    // Setting subjects with this category to NULL category first (handled conditionally by FK constraint IF ON DELETE SET NULL, but doing it safely anyway)
    await supabaseClient.from('subjects').update({ category_id: null }).eq('category_id', id)
    await supabaseClient.from('subject_categories').delete().eq('id', id)
    fetchCategories(supabaseClient, profileId)
    fetchSubjects(supabaseClient) // Refresh to show uncategorized subjects
  }


  /* -------------------------------------------------------------------------- */
  /*                                RENDER LOOP                                 */
  /* -------------------------------------------------------------------------- */

  const academicSubjects = useMemo(() => subjects.filter(s => s.type === 'academic'), [subjects])
  const personalSubjects = useMemo(() => subjects.filter(s => s.type === 'personal'), [subjects])

  // Group personal subjects by category
  const personalByCategory = useMemo(() => {
    const grouped = new Map<string, any[]>()
    
    // Initialize map with all known categories
    categories.forEach(c => grouped.set(c.id, []))
    grouped.set('uncategorized', []) // Default group

    personalSubjects.forEach(sub => {
      if (sub.category_id && grouped.has(sub.category_id)) {
        grouped.get(sub.category_id)!.push(sub)
      } else {
        grouped.get('uncategorized')!.push(sub)
      }
    })

    return grouped
  }, [personalSubjects, categories])

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
          <h1 className="text-3xl font-black tracking-tight"><span className="gradient-accent-text">Subjects</span></h1>
          <p className="text-muted-foreground mt-1">Manage your active academic courses and personal learning tracks.</p>
        </div>
      </div>

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
            
            <div className="space-y-2 sm:col-span-4 lg:col-span-5">
              <Label htmlFor="name" className="text-sm font-semibold text-muted-foreground">Subject Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Contract Law" className="h-10 bg-background shadow-sm border-muted-foreground/20" required />
            </div>
            
            <div className="space-y-2 sm:col-span-4 lg:col-span-5">
              <Label htmlFor="type" className="text-sm font-semibold text-muted-foreground">Type</Label>
              <div className="w-full">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-10 w-full bg-background shadow-sm border-muted-foreground/20">
                  <SelectValue placeholder="Track type" />
                </SelectTrigger>
                <SelectContent>
                  {profile?.academics_enabled && (
                    <SelectItem value="academic"><span className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5"/> Academic</span></SelectItem>
                  )}
                  {profile?.personal_enabled && (
                    <SelectItem value="personal"><span className="flex items-center gap-2"><FolderOpen className="w-3.5 h-3.5"/> Personal</span></SelectItem>
                  )}
                </SelectContent>
              </Select>
              </div>
            </div>

            {type === 'personal' && (
              <div className="space-y-2 sm:col-span-4 lg:col-span-5">
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
              </div>
            )}

            <div className="space-y-2 sm:col-span-4 lg:col-span-5">
              <Button type="submit" className="w-full h-10 font-semibold shadow-sm">Add</Button>
            </div>
          </form>
        </CardContent>
      </Card>


      {/* --- ACADEMIC SUBJECTS --- */}
      {profile?.academics_enabled && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" /> Academic Track
          </h2>
          {academicSubjects.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed rounded-2xl bg-muted/30">
              <p className="text-muted-foreground text-sm font-medium">No academic subjects defined yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {academicSubjects.map(sub => (
                <SubjectGridCard 
                  key={sub.id} 
                  subject={sub} 
                  onEdit={() => setEditingSubject({...sub})}
                  onDelete={() => setSubjectToDelete(sub)}
                  onAddExamDate={(label, date) => handleAddExamDate(sub.id, label, date)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* --- PERSONAL SUBJECTS (FILTERABLE) --- */}
      {profile?.personal_enabled && (
        <section className="space-y-6 pt-4 border-t">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary" /> Personal Learning
            </h2>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
                <SelectTrigger className="h-8 w-full sm:w-[180px] text-xs font-bold border-black/10 dark:border-white/10 shadow-sm bg-muted/20">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {personalSubjects
                .filter(sub => {
                  if (selectedCategoryFilter === "all") return true
                  if (selectedCategoryFilter === "uncategorized") return !sub.category_id
                  return sub.category_id === selectedCategoryFilter
                })
                .map(sub => {
                  const subCategory = categories.find(c => c.id === sub.category_id)
                  return (
                    <SubjectGridCard 
                      key={sub.id} 
                      subject={{...sub, color_hex: subCategory ? subCategory.color_hex : sub.color_hex}} 
                      category={subCategory}
                      onEdit={() => setEditingSubject({...sub})}
                      onDelete={() => setSubjectToDelete(sub)}
                      onAddExamDate={(label, date) => handleAddExamDate(sub.id, label, date)}
                    />
                  )
              })}
            </div>
          )}


        </section>
      )}

      {/* --- EDIT SUBJECT MODAL --- */}
      {editingSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md bg-background shadow-lg shadow-primary/10 overflow-hidden outline-none border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/20 border-b">
              <CardTitle>Edit Subject</CardTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md m-0 hover:bg-muted" onClick={() => setEditingSubject(null)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 max-h-[75vh] overflow-y-auto">
              
              <div className="space-y-1.5">
                <Label>Subject Name</Label>
                <Input value={editingSubject.name} onChange={e => setEditingSubject({...editingSubject, name: e.target.value})} className="bg-muted/30" />
              </div>

              {editingSubject.type === 'personal' && (
                <>
                  <div className="space-y-1.5">
                    <Label>Short Label (e.g. Hobby)</Label>
                    <Input value={editingSubject.label || ""} onChange={e => setEditingSubject({...editingSubject, label: e.target.value})} className="bg-muted/30" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={editingSubject.category_id || "none"} onValueChange={v => setEditingSubject({...editingSubject, category_id: v})}>
                      <SelectTrigger className="h-10 w-full bg-muted/30">
                        <SelectValue placeholder="No Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Uncategorized</SelectItem>
                        {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {editingSubject.type === 'academic' && (
                <>
                  <div className="space-y-1.5">
                    <Label>Instructor / Prof</Label>
                    <Input value={editingSubject.instructor_name || ""} onChange={e => setEditingSubject({...editingSubject, instructor_name: e.target.value})} className="bg-muted/30" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Legacy Attended</Label>
                      <Input type="number" min="0" value={editingSubject.legacy_attended_lectures || 0} onChange={e => setEditingSubject({...editingSubject, legacy_attended_lectures: e.target.value})} className="bg-muted/30" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Legacy Missed</Label>
                      <Input type="number" min="0" value={editingSubject.legacy_missed_lectures || 0} onChange={e => setEditingSubject({...editingSubject, legacy_missed_lectures: e.target.value})} className="bg-muted/30" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Expected Total Lectures</Label>
                    <Input type="number" min="0" value={editingSubject.expected_total_lectures || 0} onChange={e => setEditingSubject({...editingSubject, expected_total_lectures: e.target.value})} className="bg-muted/30" />
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
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- DELETE CONFIRMATION --- */}
      {subjectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <CardTitle className="text-xl">Delete Subject?</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm">Are you sure you want to completely delete <strong>{subjectToDelete.name}</strong>? This will also remove any tasks, grades, or attendance logs linked to it.</p>
              <div className="flex gap-2 w-full pt-2">
                <Button variant="outline" onClick={() => setSubjectToDelete(null)} className="flex-1">Cancel</Button>
                <Button variant="destructive" onClick={confirmDelete} className="flex-1">Delete Permanently</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- MANAGE CATEGORIES MODAL --- */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md bg-background shadow-lg shadow-primary/10 overflow-hidden outline-none border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/30 border-b">
              <CardTitle>Manage Categories</CardTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md m-0 hover:bg-muted" onClick={() => setIsCategoryModalOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              
              {/* Add category form */}
              <div className="flex gap-2 items-end bg-card">
                <div className="space-y-1.5 flex-1">
                  <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">New Category</Label>
                  <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="e.g. Competitive Exams" className="bg-muted/30" />
                </div>
                <div className="space-y-1.5 w-[50px]">
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
                          <div className="w-4 h-4 rounded-full shadow-sm" style={hexToGradient(cat.color_hex)} />
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

            </CardContent>
          </Card>
        </div>
      )}

    </div>
  )
}

function AlertTriangle({className}: {className?: string}) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
  )
}
