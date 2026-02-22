"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { getSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock, Play, Square, History, Trash2 } from "lucide-react"
import { useProfile } from '@/components/dashboard/profile-context'

export default function TimersPage() {
  const { profile } = useProfile()
  const [activeTimer, setActiveTimer] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedSubject, setSelectedSubject] = useState("")
  
  const [supabaseClient, setSupabaseClient] = useState<any>(null)
  const [profileId, setProfileId] = useState<string|null>(null)
  const [elapsed, setElapsed] = useState(0)

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

      await fetchData(supabase, profile?.id)
    }
    init()
  }, [])

  // Live counter for active timer
  useEffect(() => {
    if (!activeTimer) return
    const interval = setInterval(() => {
      const start = new Date(activeTimer.started_at).getTime()
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [activeTimer])

  async function fetchData(supabase: any, pid: string | null) {
    if (!pid) return
    
    // Check for active timer
    const { data: active } = await supabase
      .from('study_timers')
      .select('*, subjects(name)')
      .eq('profile_id', pid)
      .is('ended_at', null)
      .maybeSingle()
      
    setActiveTimer(active)
    if (active) {
      setElapsed(Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000))
    }

    // Recent history
    const { data: past } = await supabase
      .from('study_timers')
      .select('*, subjects(name, type)')
      .eq('profile_id', pid)
      .not('ended_at', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(10)
      
    setHistory(past || [])

    // Subjects for dropdown
    const { data: subs } = await supabase
      .from('subjects')
      .select('id, name, type')
      .eq('profile_id', pid)
      .eq('is_active', true)
      
    setSubjects(subs || [])
    if (subs && subs.length > 0 && !selectedSubject) {
      // Find the first subject that the user is actually allowed to see
      // Cannot reliably use profile context on first render inside fetching logic unless passed in
      setSelectedSubject(subs[0].id) 
    }
  }

  async function startTimer() {
    if (!selectedSubject || activeTimer) return
    await supabaseClient
      .from('study_timers')
      .insert([{
        profile_id: profileId,
        subject_id: selectedSubject,
        started_at: new Date().toISOString()
      }])
    fetchData(supabaseClient, profileId)
  }

  async function stopTimer() {
    if (!activeTimer) return
    await supabaseClient
      .from('study_timers')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', activeTimer.id)
    
    setActiveTimer(null)
    fetchData(supabaseClient, profileId)
  }

  async function deleteTimer(id: string) {
    if (!supabaseClient) return
    await supabaseClient.from('study_timers').delete().eq('id', id)
    fetchData(supabaseClient, profileId)
  }

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      
      <div>
        <h1 className="text-3xl font-black tracking-tight"><span className="gradient-accent-text">Study Timers</span></h1>
        <p className="text-muted-foreground mt-1">Track your dedicated study sessions live.</p>
      </div>

      {subjects.length === 0 ? (
        <div className="grid md:grid-cols-2 gap-6 animate-in fade-in duration-500">
          {/* Active Timer Skeleton */}
          <Card className="border-2 border-primary/10">
            <CardHeader>
              <div className="h-6 w-32 bg-muted animate-pulse rounded-md" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-muted animate-pulse rounded-md" />
                  <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
                </div>
                <div className="h-12 w-full bg-primary/20 animate-pulse rounded-md mt-4" />
              </div>
            </CardContent>
          </Card>

          {/* History Skeleton */}
          <Card>
            <CardHeader>
              <div className="h-6 w-40 bg-muted animate-pulse rounded-md" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex justify-between items-center p-3 border rounded-lg bg-card animate-pulse">
                    <div className="space-y-2">
                      <div className="h-5 w-24 bg-muted rounded-md" />
                      <div className="h-3 w-16 bg-muted/60 rounded-md" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-6 w-12 bg-muted rounded-md" />
                      <div className="h-8 w-8 bg-muted rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
        
        {/* Active Timer / Start Form */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary"/> Active Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeTimer ? (
              <div className="text-center py-6 space-y-4">
                <p className="text-lg font-medium text-muted-foreground">{activeTimer.subjects?.name}</p>
                <div className="text-5xl font-mono font-black text-primary tracking-tighter">
                  {formatTime(elapsed)}
                </div>
                <Button onClick={stopTimer} variant="destructive" size="lg" className="w-full sm:w-auto gap-2">
                  <Square className="fill-current w-4 h-4"/> Stop Timer
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Subject</Label>
                  <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <SelectValue placeholder="Select a Subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects
                        .filter(s => (s.type === 'academic' && profile?.academics_enabled) || (s.type === 'personal' && profile?.personal_enabled))
                        .map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={startTimer} size="lg" className="w-full gap-2">
                  <Play className="fill-current w-4 h-4"/> Start Focusing
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <History className="w-5 h-5"/> Recent Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length > 0 ? (
              <div className="space-y-3">
                {history
                  .filter(h => !h.subjects || 
                               (h.subjects.type === 'academic' && profile?.academics_enabled) || 
                               (h.subjects.type === 'personal' && profile?.personal_enabled))
                  .map(h => (
                    <div key={h.id} className="flex justify-between items-center p-3 border rounded-lg bg-card">
                      <div>
                        <p className="font-semibold">{h.subjects?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(h.started_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="font-mono bg-muted px-2 py-1 rounded text-sm font-medium">
                          {Math.floor(h.duration_seconds / 60)} mins
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => deleteTimer(h.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0">
                          <Trash2 className="w-4 h-4"/>
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No study sessions recorded yet.</p>
            )}
          </CardContent>
        </Card>

      </div>
      )}
    </div>
  )
}
