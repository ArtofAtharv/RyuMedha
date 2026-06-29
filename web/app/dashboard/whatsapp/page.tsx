"use client"

import { useEffect, useState } from "react"
import { getAppClient, type AppSupabaseClient } from "@/lib/supabase-client"
import { getSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, MessageSquare, CheckCircle2, AlertCircle, ShieldAlert, Zap, Loader2, BellRing } from "lucide-react"
import { useProfile } from '@/components/dashboard/profile-context'
import { toast } from "sonner"
import { PageHeader } from '@/components/dashboard/page-header'

// Types for admin page data
interface WindowStatusRow {
  profile_id: string
  display_name: string
  whatsapp_number: string
  window_status: string
  hours_remaining: number
}

interface MessageLog {
  id: string
  status: string
  message_type: string
  body: string
  created_at: string
  wa_message_id: string
  profiles?: { display_name: string; whatsapp_number: string }
}

function getBadgeVariant(status: string): "default" | "secondary" | "outline" {
  if (status === 'open') return 'default'
  if (status === 'closing_soon') return 'secondary'
  return 'outline'
}

function getBadgeClassName(status: string) {
  if (status === 'open') return 'bg-green-500 hover:bg-green-600 border-0'
  if (status === 'closing_soon') return 'bg-orange-500 text-white border-0'
  return ''
}

function getStatusColor(status: string) {
  if (status === 'read') return 'text-blue-500'
  if (status === 'delivered') return 'text-green-500'
  if (status === 'failed') return 'text-destructive'
  return 'text-orange-500'
}

export default function WhatsAppAdminPage() {
  const { profile } = useProfile()
  const [windowStatus, setWindowStatus] = useState<WindowStatusRow[]>([])
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([])
  const [loading, setLoading] = useState(true)
  const [supabaseClient, setSupabaseClient] = useState<AppSupabaseClient | null>(null)
  const [engagingId, setEngagingId] = useState<string | null>(null)

  // Use the database is_admin flag
  const isAdmin = profile?.is_admin === true

  useEffect(() => {
    async function init() {
      if (!isAdmin) {
        setLoading(false)
        return
      }

      const session = await getSession()
      if (!session) return
      
      const supabase = getAppClient({ global: { headers: { Authorization: `Bearer ${session.user.supabaseToken}` } } }
      )
      setSupabaseClient(supabase)
      
      await fetchData(supabase)
    }
    init()
  }, [isAdmin])

  async function fetchData(supabase: AppSupabaseClient) {
    setLoading(true)
    
    // 1. Fetch Window Status via Secure RPC Function
    const { data: status, error: statusErr } = await supabase.rpc('get_admin_whatsapp_status')
    if (statusErr) console.error("Error fetching status:", statusErr)
    setWindowStatus(status || [])

    // 2. Fetch Recent Logs (RLS will handle security)
    const { data: logs } = await supabase
      .from('whatsapp_message_logs')
      .select(`
        *,
        profiles(display_name, whatsapp_number)
      `)
      .order('created_at', { ascending: false })
      .limit(50)
      
    setMessageLogs(logs || [])
    setLoading(false)
  }

  const triggerEngagement = async (profileId: string) => {
    if (!supabaseClient) return
    setEngagingId(profileId)
    
    try {
      const { error } = await supabaseClient.functions.invoke('whatsapp-engagement', {
        body: { profile_id: profileId, type: 'manual' }
      })
      
      if (error) throw error
      toast.success("Engagement message sent successfully!")
      await fetchData(supabaseClient) // Refresh logs
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("Engagement Error:", err)
      toast.error(`Failed to send message: ${message}`)
    } finally {
      setEngagingId(null)
    }
  }

  const triggerTasksReminder = async () => {
    if (!supabaseClient) return
    try {
      const { data, error } = await supabaseClient.functions.invoke('send-reminders', { method: 'POST' })
      if (error) throw error
      if (data?.message === "No reminders due") {
        toast.info("No reminders are currently due.")
      } else {
        toast.success(`Task reminders triggered! Sent: ${data?.processedCount || 0}`)
      }
      await fetchData(supabaseClient)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("Tasks Reminder Error:", err)
      toast.error(`Failed: ${message}`)
    }
  }

  const triggerPendingTasksBlast = async () => {
    if (!supabaseClient) return
    try {
      const session = await getSession()
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/whatsapp-webhook?trigger=tasks`
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session?.user.supabaseToken || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        }
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      toast.success(`Pending Tasks blast sent to ${data.sent || 0} users!`)
      await fetchData(supabaseClient)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("Pending Tasks Blast Error:", err)
      toast.error(`Failed: ${message}`)
    }
  }

  const triggerAttendanceGuardian = async () => {
    if (!supabaseClient) return
    try {
      const session = await getSession()
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/whatsapp-webhook?trigger=daily`
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session?.user.supabaseToken || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        }
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      toast.success(`Attendance Guardian triggered! Messages sent: ${data.sent || 0}`)
      await fetchData(supabaseClient)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("Attendance Guardian Error:", err)
      toast.error(`Failed: ${message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <ShieldAlert className="w-16 h-16 text-destructive animate-bounce" />
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground text-center max-w-xs">
          This page is restricted to administrators. Your current status is: 
          <Badge variant="outline" className="ml-2">Regular User</Badge>
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      <PageHeader 
        title={
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1 text-base font-normal">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-bold px-2 py-0">ADMIN</Badge>
              <span className="text-sm font-medium text-muted-foreground">Welcome back, {profile?.display_name || "Admin"}</span>
            </div>
            <div className="flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-primary" />
              <span className="text-primary">WhatsApp Console</span>
            </div>
          </div>
        }
        description="Monitor 24-hour windows and message delivery logs."
        action={
          <div className="flex overflow-x-auto md:flex-wrap items-center gap-2 mt-4 md:mt-0 w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
            <Button onClick={triggerTasksReminder} variant="outline" size="sm" className="shrink-0 gap-2 border-primary/20 hover:bg-primary/10 shadow-sm h-9">
              <CheckCircle2 className="w-4 h-4 text-primary" /> Send Due Reminders
            </Button>
            <Button onClick={triggerPendingTasksBlast} variant="outline" size="sm" className="shrink-0 gap-2 border-primary/20 hover:bg-primary/10 shadow-sm h-9">
              <BellRing className="w-4 h-4 text-primary" /> Pending Tasks Blast
            </Button>
            <Button onClick={triggerAttendanceGuardian} variant="outline" size="sm" className="shrink-0 gap-2 border-primary/20 hover:bg-primary/10 shadow-sm h-9">
              <ShieldAlert className="w-4 h-4 text-primary" /> Attendance Guardian
            </Button>
            <Button onClick={() => { if (supabaseClient) fetchData(supabaseClient) }} variant="outline" size="sm" className="shrink-0 gap-2 shadow-sm h-9">
              <Zap className="w-4 h-4" /> Refresh
            </Button>
            <Button 
              onClick={async () => {
                if (!supabaseClient) return
                if (confirm("Are you sure you want to clear all message logs?")) {
                  const { error } = await supabaseClient.rpc('clear_whatsapp_logs')
                  if (error) {
                    console.error("Clear Logs Error:", error)
                    toast.error(`Failed: ${error.message}`)
                  } else {
                    toast.success("Logs cleared")
                    fetchData(supabaseClient)
                  }
                }
              }} 
              variant="destructive" 
              size="sm" 
              className="shrink-0 gap-2 shadow-sm h-9"
            >
              Clear Logs
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" /> User Window Status
            </CardTitle>
            <CardDescription>Track which users have an active 24-hour messaging window.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground font-medium">
                    <th className="text-left py-3 px-2">User</th>
                    <th className="text-left py-3 px-2">Window</th>
                    <th className="text-left py-3 px-2">Expires In</th>
                    <th className="text-right py-3 px-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {windowStatus.map((s) => (
                    <tr key={s.profile_id} className="hover:bg-card/60 backdrop-blur-2xl shadow-sm rounded-3xl transition-colors">
                      <td className="py-3 px-2">
                        <div className="font-bold">{s.display_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.whatsapp_number.startsWith('+') ? s.whatsapp_number : `+${s.whatsapp_number}`}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant={getBadgeVariant(s.window_status)} className={getBadgeClassName(s.window_status)}>
                          {s.window_status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 font-mono">
                        {s.window_status === 'expired' ? <span className="text-destructive font-bold">EXPIRED</span> : `${s.hours_remaining.toFixed(1)}h`}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 gap-1.5 text-xs text-primary hover:text-primary hover:bg-primary/10"
                          disabled={engagingId === s.profile_id}
                          onClick={() => triggerEngagement(s.profile_id)}
                        >
                          {engagingId === s.profile_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3 h-3" />}
                          Engage
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {windowStatus.length === 0 && !loading && (
                    <tr><td colSpan={4} className="py-8 text-center font-medium text-muted-foreground">No users found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Delivery Stats
            </CardTitle>
            <CardDescription>Real-time delivery tracking.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <p className="text-sm font-bold text-green-600">Delivered/Read</p>
              <p className="text-3xl font-bold">{messageLogs.filter(l => l.status === 'delivered' || l.status === 'read').length}</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm font-bold text-blue-600">Sent (Pending)</p>
              <p className="text-3xl font-bold">{messageLogs.filter(l => l.status === 'sent').length}</p>
            </div>
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
              <p className="text-sm font-bold text-destructive">Failed</p>
              <p className="text-3xl font-bold">{messageLogs.filter(l => l.status === 'failed').length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Message Logs</CardTitle>
          <CardDescription>Detailed logs of all outbound WhatsApp messages.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {messageLogs.map((log) => (
              <div key={log.id} className="p-4 border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/50 transition-all bg-card">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{log.profiles?.display_name || 'System'}</span>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold">{log.message_type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">{log.body}</p>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-3">
                    <span>{new Date(log.created_at).toLocaleString()}</span>
                    <span title={log.wa_message_id} className="font-mono bg-muted px-1.5 py-0.5 rounded text-[8px] max-w-[120px] truncate inline-block align-bottom">{log.wa_message_id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden md:block">
                    <div className={`text-[10px] font-bold uppercase tracking-widest ${getStatusColor(log.status)}`}>
                      {log.status}
                    </div>
                  </div>
                  {log.status === 'read' && <CheckCircle2 className="w-5 h-5 text-blue-500" />}
                  {log.status === 'delivered' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                  {log.status === 'sent' && <Clock className="w-5 h-5 text-orange-500" />}
                  {log.status === 'failed' && <AlertCircle className="w-5 h-5 text-destructive" />}
                </div>
              </div>
            ))}
            {messageLogs.length === 0 && !loading && (
              <div className="py-12 text-center text-muted-foreground font-medium border-none bg-card/60 backdrop-blur-2xl shadow-sm rounded-3xl">No logs available yet.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
