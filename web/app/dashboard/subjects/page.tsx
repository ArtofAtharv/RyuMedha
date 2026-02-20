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

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState("")
  
  const [name, setName] = useState("")
  const [type, setType] = useState("academic")
  const [supabaseClient, setSupabaseClient] = useState<any>(null)
  const [profileId, setProfileId] = useState<string|null>(null)
  
  // Edit State
  const [editingSubjectId, setEditingSubjectId] = useState<string|null>(null)
  const [editName, setEditName] = useState("")

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
      
      // Get profile ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('whatsapp_number', session.user.phone)
        .single()
        
      if (profile) setProfileId(profile.id)

      await fetchSubjects(supabase)
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

  async function handleAddSubject(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setErrorMsg("")

    const { error } = await supabaseClient
      .from('subjects')
      .insert([{
        profile_id: profileId,
        name: name.trim(),
        type: type
      }])

    if (error) {
      setErrorMsg("Failed to add subject. Ensure the name is unique.")
    } else {
      setName("")
      fetchSubjects(supabaseClient)
    }
  }

  async function handleArchive(id: string) {
    await supabaseClient
      .from('subjects')
      .update({ is_active: false })
      .eq('id', id)
    fetchSubjects(supabaseClient)
  }

  function startEdit(sub: any) {
    setEditingSubjectId(sub.id)
    setEditName(sub.name)
  }

  async function saveEdit() {
    if (!editingSubjectId || !editName.trim()) return

    await supabaseClient
      .from('subjects')
      .update({ name: editName.trim() })
      .eq('id', editingSubjectId)

    setEditingSubjectId(null)
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
              <Button type="submit" className="w-full">Create Subject</Button>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <div className="md:col-span-2 space-y-4">
          {loading ? (
            <p>Loading subjects...</p>
          ) : subjects.length === 0 ? (
            <div className="p-12 text-center border rounded-xl border-dashed bg-muted/30">
              <p className="text-muted-foreground">No active subjects found.</p>
            </div>
          ) : (
            subjects.map(sub => (
              <Card key={sub.id} className="flex flex-row items-center justify-between p-4 shadow-sm border-l-4 group" style={{borderLeftColor: sub.color_hex || 'hsl(var(--primary))'}}>
                
                {editingSubjectId === sub.id ? (
                  <div className="flex gap-2 w-full pr-4">
                    <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 flex-1" autoFocus />
                    <Button size="sm" onClick={saveEdit} className="h-8">Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingSubjectId(null)} className="h-8">Cancel</Button>
                  </div>
                ) : (
                  <>
                    <button onClick={() => startEdit(sub)} className="text-left flex-1" title="Click to rename">
                      <h3 className="font-bold group-hover:underline decoration-muted-foreground underline-offset-4">{sub.name}</h3>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {sub.type === 'academic' ? '🎓 Academic' : '📂 Personal'}
                        </Badge>
                      </div>
                    </button>
                    <Button variant="outline" size="sm" onClick={() => handleArchive(sub.id)}>Archive</Button>
                  </>
                )}

              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
