"use client"

import { useEffect, useState } from "react"
import { getAppClient, type AppSupabaseClient } from "@/lib/supabase-client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, MessageSquare, CheckCircle2, AlertCircle, ShieldAlert, Zap, Loader2, BellRing, FolderOpen } from "lucide-react"
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

  const handleExportAllUsers = async () => {
    if (!supabaseClient) return
    try {
      toast.info("Compiling all users' database records...")
      const { data, error } = await supabaseClient.rpc('export_all_data')
      if (error) throw error

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2))
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute("href", dataStr)
      downloadAnchor.setAttribute("download", `ryumedha_admin_all_users_export_${new Date().toISOString().split('T')[0]}.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
      toast.success("Database exported successfully!")
    } catch (err: any) {
      console.error(err)
      toast.error(`Export failed: ${err.message || err}`)
    }
  }

  useEffect(() => {
    async function init() {
      if (!isAdmin) {
        setLoading(false)
        return
      }

      const supabase = getAppClient()
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
      const { data, error } = await supabaseClient.functions.invoke('whatsapp-webhook', {
        body: { trigger: 'engage', profile_id: profileId }
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
      const { data, error } = await supabaseClient.functions.invoke('whatsapp-webhook', {
        body: { trigger: 'reminders' }
      })
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
      const { data, error } = await supabaseClient.functions.invoke('whatsapp-webhook', {
        body: { trigger: 'tasks' }
      })
      if (error) throw error
      toast.success(`Pending Tasks blast sent to ${data?.sent || 0} users!`)
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
      const { data, error } = await supabaseClient.functions.invoke('whatsapp-webhook', {
        body: { trigger: 'daily' }
      })
      if (error) throw error
      toast.success(`Attendance Guardian triggered! Messages sent: ${data?.sent || 0}`)
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      
      {/* Premium Header Dashboard */}
      <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card/40 p-6 sm:p-8 backdrop-blur-md shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/5 rounded-full filter blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-bold px-2.5 py-0.5 rounded-full text-xs uppercase tracking-wider">
              System Admin Console
            </Badge>
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[11px] text-muted-foreground font-medium">Secure Connection</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-primary" /> WhatsApp Manager
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg">
            Monitor outbound logs, trigger automated attendance checks, send bulk pending task notifications, and check active user windows.
          </p>
        </div>
        
        {/* Core Actions */}
        <div className="flex gap-2 shrink-0 relative z-10 w-full md:w-auto">
          <Button onClick={() => { if (supabaseClient) fetchData(supabaseClient) }} variant="outline" size="sm" className="flex-1 md:flex-none gap-2 shadow-sm h-9 hover:bg-accent rounded-xl transition-all">
            <Zap className="w-4 h-4 text-primary" /> Refresh Console
          </Button>
          <Button 
            onClick={handleExportAllUsers} 
            variant="outline" 
            size="sm" 
            className="flex-1 md:flex-none gap-2 border-emerald-500/20 hover:bg-emerald-500/10 shadow-sm h-9 text-emerald-600 rounded-xl transition-all"
          >
            <FolderOpen className="w-4 h-4" /> Export All Data
          </Button>
        </div>
      </div>

      {/* Real-time statistics banner */}
      <div className="grid grid-cols-3 gap-4">
        <div className="relative overflow-hidden p-4 rounded-2xl bg-card/60 border border-border/50 shadow-sm hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/5 rounded-full -mr-4 -mt-4" />
          <p className="text-xs font-bold text-green-600 uppercase tracking-wider truncate">Delivered & Read</p>
          <p className="text-2xl sm:text-4xl font-black mt-2 text-foreground">{messageLogs.filter(l => l.status === 'delivered' || l.status === 'read').length}</p>
        </div>
        <div className="relative overflow-hidden p-4 rounded-2xl bg-card/60 border border-border/50 shadow-sm hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full -mr-4 -mt-4" />
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider truncate">Sent / Pending</p>
          <p className="text-2xl sm:text-4xl font-black mt-2 text-foreground">{messageLogs.filter(l => l.status === 'sent').length}</p>
        </div>
        <div className="relative overflow-hidden p-4 rounded-2xl bg-card/60 border border-border/50 shadow-sm hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-16 h-16 bg-destructive/5 rounded-full -mr-4 -mt-4" />
          <p className="text-xs font-bold text-destructive uppercase tracking-wider truncate">Failed</p>
          <p className="text-2xl sm:text-4xl font-black mt-2 text-foreground">{messageLogs.filter(l => l.status === 'failed').length}</p>
        </div>
      </div>

      {/* Main Grid: Control panel on left, User list on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        
        {/* Left Column: Automated Actions */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="rounded-3xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-md overflow-hidden">
            <CardHeader className="border-b border-border/30 bg-muted/10">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> System Actions
              </CardTitle>
              <CardDescription>Manually trigger background WhatsApp schedules</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5">
              
              <div className="space-y-1.5">
                <Button onClick={triggerTasksReminder} className="w-full justify-start gap-2.5 h-10 shadow-sm rounded-xl font-semibold transition-all">
                  <CheckCircle2 className="w-4 h-4" /> Send Due Reminders
                </Button>
                <p className="text-[11px] text-muted-foreground px-1">
                  Scans database for reminders scheduled for now and delivers notifications.
                </p>
              </div>

              <hr className="border-border/30 my-2" />

              <div className="space-y-1.5">
                <Button onClick={triggerPendingTasksBlast} variant="secondary" className="w-full justify-start gap-2.5 h-10 border border-border/50 rounded-xl font-semibold transition-all">
                  <BellRing className="w-4 h-4 text-primary" /> Pending Tasks Blast
                </Button>
                <p className="text-[11px] text-muted-foreground px-1">
                  Sends a complete list of pending tasks to all registered WhatsApp users.
                </p>
              </div>

              <hr className="border-border/30 my-2" />

              <div className="space-y-1.5">
                <Button onClick={triggerAttendanceGuardian} variant="secondary" className="w-full justify-start gap-2.5 h-10 border border-border/50 rounded-xl font-semibold transition-all">
                  <ShieldAlert className="w-4 h-4 text-primary" /> Attendance Guardian
                </Button>
                <p className="text-[11px] text-muted-foreground px-1">
                  Triggers the daily attendance logging prompt to academic-enabled users.
                </p>
              </div>

              <hr className="border-border/30 my-2" />

              <div className="pt-2">
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
                  className="w-full h-10 rounded-xl font-semibold gap-2 shadow-sm transition-all hover:bg-destructive/95"
                >
                  Clear Logs Table
                </Button>
              </div>

            </CardContent>
          </Card>
        </div>

        {/* Right Column: User statuses (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-3xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-md overflow-hidden">
            <CardHeader className="border-b border-border/30 bg-muted/10">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> User Window Status
              </CardTitle>
              <CardDescription>Verify active 24h Meta session windows</CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-4">
              
              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground font-medium text-xs uppercase tracking-wider">
                      <th className="text-left py-3 px-4">User</th>
                      <th className="text-left py-3 px-4">Window Status</th>
                      <th className="text-left py-3 px-4">Time Left</th>
                      <th className="text-right py-3 px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {windowStatus.map((s) => (
                      <tr key={s.profile_id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground text-sm">{s.display_name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {s.whatsapp_number 
                              ? (s.whatsapp_number.startsWith('+') ? s.whatsapp_number : `+${s.whatsapp_number}`)
                              : "No Number Linked"}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={getBadgeVariant(s.window_status)} className={`${getBadgeClassName(s.window_status)} rounded-full px-2.5 py-0.5 text-xs font-semibold`}>
                            {s.window_status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">
                          {s.window_status === 'expired' ? (
                            <span className="text-destructive/80 font-bold bg-destructive/10 px-2 py-0.5 rounded-md">EXPIRED</span>
                          ) : (
                            <span className="text-foreground/80 font-bold">{s.hours_remaining.toFixed(1)} hours</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 gap-1.5 text-xs text-primary hover:bg-primary/10 rounded-lg"
                            disabled={engagingId === s.profile_id}
                            onClick={() => triggerEngagement(s.profile_id)}
                          >
                            {engagingId === s.profile_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
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

              {/* Mobile Cards View */}
              <div className="sm:hidden p-4 space-y-3">
                {windowStatus.map((s) => (
                  <div key={s.profile_id} className="p-3.5 border border-border/40 rounded-2xl bg-muted/10 space-y-3 hover:border-primary/30 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <div className="font-bold text-foreground text-sm truncate">{s.display_name}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">
                          {s.whatsapp_number 
                            ? (s.whatsapp_number.startsWith('+') ? s.whatsapp_number : `+${s.whatsapp_number}`)
                            : "No Number Linked"}
                        </div>
                      </div>
                      <Badge variant={getBadgeVariant(s.window_status)} className={`${getBadgeClassName(s.window_status)} rounded-full text-[10px]`}>
                        {s.window_status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center pt-2.5 border-t border-border/30">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Expiry: <span className="font-mono font-bold text-foreground">{s.window_status === 'expired' ? <span className="text-destructive">EXPIRED</span> : `${s.hours_remaining.toFixed(1)}h`}</span>
                      </span>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 gap-1.5 text-xs text-primary hover:bg-primary/10 px-2.5 rounded-lg"
                        disabled={engagingId === s.profile_id}
                        onClick={() => triggerEngagement(s.profile_id)}
                      >
                        {engagingId === s.profile_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
                        Engage
                      </Button>
                    </div>
                  </div>
                ))}
                {windowStatus.length === 0 && !loading && (
                  <div className="py-8 text-center font-medium text-muted-foreground text-sm">No users found.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Outbound Logs Section */}
      <Card className="rounded-3xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-md overflow-hidden">
        <CardHeader className="border-b border-border/30 bg-muted/10">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> Outbound Delivery Logs
          </CardTitle>
          <CardDescription>Real-time delivery status of automated messages</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="space-y-3">
            {messageLogs.map((log) => (
              <div key={log.id} className="p-3 sm:p-4 border rounded-2xl flex items-center justify-between gap-3 hover:border-primary/50 transition-all bg-card/40 backdrop-blur-2xl">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-foreground">{log.profiles?.display_name || 'System / Auto'}</span>
                    <Badge variant="outline" className="text-[9px] px-2 py-0.5 uppercase font-bold shrink-0 rounded-full tracking-wider border-border/60">
                      {log.message_type}
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed truncate font-medium">{log.body}</p>
                  <div className="text-[9px] sm:text-[10px] text-muted-foreground/80 flex items-center gap-2 sm:gap-3 flex-wrap">
                    <span>{new Date(log.created_at).toLocaleString()}</span>
                    <span title={log.wa_message_id} className="font-mono bg-muted/65 border border-border/40 px-1.5 py-0.5 rounded text-[8px] max-w-[100px] sm:max-w-[120px] truncate inline-block align-bottom">{log.wa_message_id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right hidden sm:block mr-1">
                    <div className={`text-[10px] font-extrabold uppercase tracking-widest ${getStatusColor(log.status)}`}>
                      {log.status}
                    </div>
                  </div>
                  {log.status === 'read' && <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />}
                  {log.status === 'delivered' && <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />}
                  {log.status === 'sent' && <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />}
                  {log.status === 'failed' && <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive animate-pulse" />}
                </div>
              </div>
            ))}
            {messageLogs.length === 0 && !loading && (
              <div className="py-12 text-center text-muted-foreground font-medium border border-dashed rounded-2xl bg-card/20">
                No logs available yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
