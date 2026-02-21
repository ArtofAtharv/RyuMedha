"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { getSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, X, Pencil } from "lucide-react"

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState("")
  
  const [name, setName] = useState("")
  const [type, setType] = useState("academic")
  const [categoryId, setCategoryId] = useState("none")

  const [supabaseClient, setSupabaseClient] = useState<any>(null)
  const [profileId, setProfileId] = useState<string|null>(null)
  
  // Modals Data
  const [editingSubject, setEditingSubject] = useState<any>(null)
  const [subjectToDelete, setSubjectToDelete] = useState<any>(null)

  useEffect(() => {
    async function init() {
      const session = await getSession()
      if (!session) return
      
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${session.user.supabaseToken}` } } }
      )
      
      setSupabaseClient(supabase)
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('whatsapp_number', session.user.phone)
        .single()
        
      if (profile) setProfileId(profile.id)

      await fetchSubjects(supabase)
      await fetchCategories(supabase, profile?.id)
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
    setCategories(data || [])
  }

  async function handleAddSubject(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setErrorMsg("")

    // Check for duplicate subject name (case-insensitive)
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
    await supabaseClient
      .from('subjects')
      .delete()
      .eq('id', subjectToDelete.id)
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

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      
      <div>
        <h1 className="text-3xl font-black tracking-tight">Subjects</h1>
        <p className="text-muted-foreground mt-1">Manage your active academic courses and personal learning tracks.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        
        {/* Add Form */}
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Add Subject</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddSubject} className="space-y-4">
              {errorMsg && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{errorMsg}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">Subject Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Contract Law" required />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Track Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-10 w-full bg-background border-input">
                    <SelectValue placeholder="Select track type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="academic">🎓 Academic</SelectItem>
                    <SelectItem value="personal">📂 Personal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {type === 'personal' && (
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="h-10 w-full bg-background border-input">
                      <SelectValue placeholder="No Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button type="submit" className="w-full">Create Subject</Button>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <div className="md:col-span-2 space-y-4">
          {loading ? (
            <p className="text-muted-foreground animate-pulse text-sm">Loading subjects...</p>
          ) : subjects.length === 0 ? (
            <div className="p-12 text-center border rounded-xl border-dashed bg-muted/30">
              <p className="text-muted-foreground">No active subjects found.</p>
            </div>
          ) : (
            subjects.map(sub => (
              <Card key={sub.id} className="flex flex-row items-center justify-between p-4 shadow-sm border-l-4 group" style={{borderLeftColor: sub.color_hex || 'hsl(var(--primary))'}}>
                
                <div className="text-left flex-1" title={sub.label || sub.instructor_name}>
                  <h3 className="font-bold">{sub.name}</h3>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {sub.type === 'academic' ? '🎓 Academic' : '📂 Personal'}
                    </Badge>
                    {sub.label && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                        {sub.label}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => setEditingSubject({...sub})} className="h-8 w-8 hover:text-primary">
                    <Pencil className="w-4 h-4"/>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setSubjectToDelete(sub)} className="h-8 w-8 hover:text-destructive">
                    <Trash2 className="w-4 h-4"/>
                  </Button>
                </div>

              </Card>
            ))
          )}
        </div>
      </div>

      {/* Edit Subject Modal Dialog */}
      {editingSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md bg-background shadow-lg shadow-primary/10 overflow-hidden outline-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Edit Subject</CardTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md m-0" onClick={() => setEditingSubject(null)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 max-h-[75vh] overflow-y-auto">
              
              <div className="space-y-1.5">
                <Label>Subject Name</Label>
                <Input value={editingSubject.name} onChange={e => setEditingSubject({...editingSubject, name: e.target.value})} />
              </div>

              <div className="space-y-1.5">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {['#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316','#14b8a6','#6366f1','#84cc16','#a855f7'].map(hex => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setEditingSubject({...editingSubject, color_hex: hex})}
                      className={`w-8 h-8 rounded-full border-2 transition-all shrink-0 ${editingSubject.color_hex === hex ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'border-transparent hover:scale-110'}`}
                      style={{backgroundColor: hex}}
                      title={hex}
                    />
                  ))}
                </div>
              </div>

              {editingSubject.type === 'personal' && (
                <>
                  <div className="space-y-1.5">
                    <Label>Short Label (e.g. Hobby)</Label>
                    <Input value={editingSubject.label || ""} onChange={e => setEditingSubject({...editingSubject, label: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={editingSubject.category_id || "none"} onValueChange={v => setEditingSubject({...editingSubject, category_id: v})}>
                      <SelectTrigger className="h-10 w-full bg-background border-input">
                        <SelectValue placeholder="No Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
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
                    <Input value={editingSubject.instructor_name || ""} onChange={e => setEditingSubject({...editingSubject, instructor_name: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Expected Total Lectures</Label>
                    <Input type="number" placeholder="e.g. 45" value={editingSubject.expected_total_lectures || ""} onChange={e => setEditingSubject({...editingSubject, expected_total_lectures: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-dashed">
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-primary font-bold">Legacy Attendance</Label>
                      <p className="text-xs text-muted-foreground leading-tight">Add lectures you attended or missed before you started using the app to sync your overall percentages.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-green-500">Classes Attended</Label>
                      <Input type="number" value={editingSubject.legacy_attended_lectures || 0} onChange={e => setEditingSubject({...editingSubject, legacy_attended_lectures: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-red-500">Classes Missed</Label>
                      <Input type="number" value={editingSubject.legacy_missed_lectures || 0} onChange={e => setEditingSubject({...editingSubject, legacy_missed_lectures: e.target.value})} />
                    </div>
                  </div>
                </>
              )}

              <div className="pt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditingSubject(null)}>Cancel</Button>
                <Button onClick={saveEdit}>Save Changes</Button>
              </div>

            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal Dialog */}
      {subjectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm bg-background shadow-lg shadow-destructive/10 overflow-hidden outline-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-destructive">Delete Subject?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <p className="text-sm">Are you sure you want to completely delete <strong>{subjectToDelete.name}</strong>? This will also remove any tasks, grades, or attendance logs linked to it.</p>
              <div className="pt-2 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setSubjectToDelete(null)}>Cancel</Button>
                <Button variant="destructive" onClick={confirmDelete}>Delete Forever</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  )
}
