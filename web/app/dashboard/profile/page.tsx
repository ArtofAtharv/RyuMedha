"use client"

import { useEffect, useState } from "react"
import { getSession } from "next-auth/react"
import { createClient } from "@supabase/supabase-js"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

export default function ProfilePage() {
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [uniName, setUniName] = useState("Not Set")
  const [progName, setProgName] = useState("Not Set")
  const [semName, setSemName] = useState("Not Set")
  
  const [supabaseClient, setSupabaseClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Edit States
  const [editingName, setEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState("")
  const [editingTarget, setEditingTarget] = useState(false)
  const [editTargetValue, setEditTargetValue] = useState("75")

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
      setEditNameValue(prof.display_name || sess.user.name || sess.user.phone)
      setEditTargetValue(prof.target_attendance_pct?.toString() || "75")

      if (prof.current_university_id) {
        const { data: u } = await supabase.from('universities').select('name').eq('id', prof.current_university_id).single()
        if (u) setUniName(u.name)
      }
      if (prof.current_program_id) {
        const { data: p } = await supabase.from('programs').select('name').eq('id', prof.current_program_id).single()
        if (p) setProgName(p.name)
      }
      if (prof.current_semester_id) {
        const { data: s } = await supabase.from('semesters').select('name').eq('id', prof.current_semester_id).single()
        if (s) setSemName(s.name)
      }
    }
    setLoading(false)
  }

  async function saveName() {
    if (!profile) return
    await supabaseClient.from('profiles').update({ display_name: editNameValue }).eq('id', profile.id)
    setEditingName(false)
    fetchProfile(supabaseClient, session)
  }

  async function saveTarget() {
    if (!profile) return
    const pct = parseFloat(editTargetValue)
    if (isNaN(pct) || pct < 0 || pct > 100) return
    await supabaseClient.from('profiles').update({ target_attendance_pct: pct }).eq('id', profile.id)
    setEditingTarget(false)
    fetchProfile(supabaseClient, session)
  }

  if (loading) return <div className="p-8">Loading profile...</div>
  if (!profile) return <div className="p-8 text-destructive">Failed to load profile.</div>

  const displayName = profile.display_name || session.user.name || session.user.phone

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      
      <div>
        <h1 className="text-3xl font-black tracking-tight">Your Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your Ryu Medha settings and academic tracks.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Core Info */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Display Name</p>
              {editingName ? (
                <div className="flex gap-2">
                  <Input value={editNameValue} onChange={e => setEditNameValue(e.target.value)} className="h-8 max-w-[200px]" autoFocus />
                  <Button size="sm" onClick={saveName} className="h-8">Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingName(false)} className="h-8">Cancel</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <p className="font-medium text-lg">{displayName}</p>
                  <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setEditingName(true)}>
                    <span className="text-xs">✏️</span>
                  </Button>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">WhatsApp Number</p>
              <p className="font-medium font-mono">{session.user.phone}</p>
            </div>
          </CardContent>
        </Card>

        {/* Tracks Enabled */}
        <Card>
          <CardHeader>
            <CardTitle>Enabled Tracks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              {profile.academics_enabled ? (
                <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">🎓 Academic</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">🎓 Academic (Disabled)</Badge>
              )}
              {profile.personal_enabled ? (
                <Badge variant="default" className="bg-purple-500 hover:bg-purple-600">📂 Personal</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">📂 Personal (Disabled)</Badge>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Target Attendance</p>
              {editingTarget ? (
                <div className="flex gap-2 items-center">
                  <Input type="number" step="0.1" value={editTargetValue} onChange={e => setEditTargetValue(e.target.value)} className="h-8 w-[100px]" autoFocus />
                  <span className="text-muted-foreground">%</span>
                  <Button size="sm" onClick={saveTarget} className="h-8">Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingTarget(false)} className="h-8">Cancel</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <p className="font-bold text-xl">{profile.target_attendance_pct ?? 75}%</p>
                  <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setEditingTarget(true)}>
                    <span className="text-xs">✏️</span>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Academic Details */}
        {profile.academics_enabled && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Academic Enrollment</CardTitle>
              <CardDescription>Your current university and program affiliation.</CardDescription>
            </CardHeader>
            <CardContent>
              {profile.current_university_id ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">University</p>
                    <p className="font-medium">{uniName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Program</p>
                    <p className="font-medium">{progName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Semester</p>
                    <p className="font-medium">{semName}</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-muted/50 rounded-lg border border-dashed border-border flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">You haven't set up your academic profile yet.</p>
                  <Button variant="outline" size="sm">Set Up Now</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="pt-6 border-t mt-8">
        <h3 className="text-lg font-bold text-destructive">Danger Zone</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Actions here can permanently alter or archive your active study data.
        </p>
        <div className="flex flex-wrap gap-4">
          <Button variant="destructive">Archive Current Semester</Button>
          <Button variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/10">Request Data Export</Button>
        </div>
      </div>

    </div>
  )
}
