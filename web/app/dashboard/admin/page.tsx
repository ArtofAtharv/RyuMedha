"use client"

import { useEffect, useState, useTransition } from "react"
import { getAppClient, type AppSupabaseClient } from "@/lib/supabase-client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Clock, MessageSquare, CheckCircle2, AlertCircle, ShieldAlert, 
  Zap, Loader2, BellRing, FolderOpen, ShieldCheck, Users, 
  Ticket, Search, Copy, Check, Trash2, Plus, Sparkles, RefreshCw, AlertTriangle
} from "lucide-react"
import { useProfile } from '@/components/dashboard/profile-context'
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"

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

interface UserSubData {
  profileId: string
  displayName: string
  email: string
  whatsappNumber: string
  isAdmin: boolean
  userCreatedAt: string
  subscriptionId: string | null
  status: string
  planType: string | null
  razorpaySubscriptionId: string | null
  trialStart: string | null
  trialEnd: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  scheduledDeletionAt: string | null
}

interface InviteCodeData {
  id: string
  code: string
  durationType: '1_year' | 'lifetime'
  maxUses: number | null
  usesCount: number
  isActive: boolean
  createdAt: string
}

function getStatusBadge(user: UserSubData) {
  const isLifetime = user.razorpaySubscriptionId === 'admin_free_lifetime' || user.razorpaySubscriptionId?.startsWith('invite_') || (user.currentPeriodEnd && new Date(user.currentPeriodEnd).getFullYear() > 2090)
  const is1Year = user.razorpaySubscriptionId === 'admin_free_1year'

  if (isLifetime) {
    return <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30">Free Lifetime</Badge>
  }
  if (is1Year) {
    return <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30">Free 1-Year</Badge>
  }
  if (user.status === 'active') {
    return <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30">Active Auto-Pay</Badge>
  }
  if (user.status === 'trialing') {
    return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">Free Trial</Badge>
  }
  return <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10">Expired / Canceled</Badge>
}

function checkActiveSubscription(user: UserSubData): { isActive: boolean; type: string } {
  const isLifetime = user.razorpaySubscriptionId === 'admin_free_lifetime' || user.razorpaySubscriptionId?.startsWith('invite_') || (user.currentPeriodEnd && new Date(user.currentPeriodEnd).getFullYear() > 2090)
  const is1Year = user.razorpaySubscriptionId === 'admin_free_1year'
  const isAutopay = user.status === 'active' || (user.currentPeriodEnd && new Date(user.currentPeriodEnd) > new Date())

  if (isLifetime) return { isActive: true, type: 'Free Lifetime Access' }
  if (is1Year) return { isActive: true, type: 'Free 1-Year Access' }
  if (isAutopay) return { isActive: true, type: `Active Subscription (${user.planType || 'Pro'})` }
  if (user.status === 'trialing' && user.trialEnd && new Date(user.trialEnd) > new Date()) {
    return { isActive: true, type: 'Free Trial' }
  }
  return { isActive: false, type: 'Expired / None' }
}

export default function AdminPage() {
  const { profile } = useProfile()
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'invite_codes' | 'whatsapp'>('subscriptions')
  const [loading, setLoading] = useState(true)
  const [supabaseClient, setSupabaseClient] = useState<AppSupabaseClient | null>(null)
  
  // Data states
  const [userSubs, setUserSubs] = useState<UserSubData[]>([])
  const [inviteCodes, setInviteCodes] = useState<InviteCodeData[]>([])
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeAutopayCount: 0,
    freeLifetimeCount: 0,
    free1YearCount: 0,
    trialingCount: 0,
    expiredCount: 0
  })
  
  // WhatsApp states
  const [windowStatus, setWindowStatus] = useState<WindowStatusRow[]>([])
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([])
  const [engagingId, setEngagingId] = useState<string | null>(null)

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('')

  // New Invite Code form
  const [newCode, setNewCode] = useState('')
  const [newDuration, setNewDuration] = useState<'lifetime' | '1_year'>('lifetime')
  const [newMaxUses, setNewMaxUses] = useState('')
  const [isCreatingCode, setIsCreatingCode] = useState(false)
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)

  // Delete user account dialog state
  const [userToDelete, setUserToDelete] = useState<UserSubData | null>(null)
  const [isDeletingUser, setIsDeletingUser] = useState(false)

  const [_isPending, startTransition] = useTransition()

  const isAdmin = profile?.is_admin === true

  useEffect(() => {
    async function init() {
      if (!isAdmin) {
        setLoading(false)
        return
      }

      const supabase = getAppClient()
      setSupabaseClient(supabase)
      await fetchAdminData(supabase)
    }
    init()
  }, [isAdmin])

  const fetchAdminData = async (supabase: AppSupabaseClient) => {
    setLoading(true)
    try {
      // 1. Fetch Subscription Data & Stats & Invite Codes via Admin API
      const res = await fetch('/api/admin/subscriptions')
      if (res.ok) {
        const data = await res.json()
        setUserSubs(data.users || [])
        setStats(data.stats || {})
        setInviteCodes(data.inviteCodes || [])
      }

      // 2. Fetch WhatsApp status
      const { data: status } = await supabase.rpc('get_admin_whatsapp_status')
      setWindowStatus(status || [])

      // 3. Fetch WhatsApp Message Logs
      const { data: logs } = await supabase
        .from('whatsapp_message_logs')
        .select('*, profiles(display_name, whatsapp_number)')
        .order('created_at', { ascending: false })
        .limit(50)
      setMessageLogs(logs || [])
    } catch (err) {
      console.error("Error fetching admin data:", err)
      toast.error("Failed to load admin data")
    } finally {
      setLoading(false)
    }
  }

  const handleGrantAccess = async (profileId: string, action: string) => {
    try {
      const res = await fetch('/api/admin/grant-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, action })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message)
        if (supabaseClient) fetchAdminData(supabaseClient)
      } else {
        toast.error(data.error || 'Failed to update access')
      }
    } catch (err) {
      console.error(err)
      toast.error('An error occurred')
    }
  }

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return
    setIsDeletingUser(true)
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: userToDelete.profileId })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || `Deleted ${userToDelete.displayName}`)
        setUserToDelete(null)
        if (supabaseClient) fetchAdminData(supabaseClient)
      } else {
        toast.error(data.error || 'Failed to delete user account')
      }
    } catch (err) {
      console.error(err)
      toast.error('An error occurred while deleting user account')
    } finally {
      setIsDeletingUser(false)
    }
  }

  const handleCreateInviteCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCode.trim()) {
      toast.error("Code name is required")
      return
    }
    setIsCreatingCode(true)
    try {
      const res = await fetch('/api/admin/invite-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCode.trim(),
          durationType: newDuration,
          maxUses: newMaxUses ? Number.parseInt(newMaxUses, 10) : null
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Invite Code '${data.code.code}' created!`)
        setNewCode('')
        setNewMaxUses('')
        if (supabaseClient) fetchAdminData(supabaseClient)
      } else {
        toast.error(data.error || 'Failed to create code')
      }
    } catch (err) {
      console.error(err)
      toast.error('An error occurred')
    } finally {
      setIsCreatingCode(false)
    }
  }

  const handleDeleteInviteCode = async (codeId: string) => {
    if (!confirm("Are you sure you want to delete this invite code?")) return
    try {
      const res = await fetch('/api/admin/invite-codes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId })
      })
      if (res.ok) {
        toast.success("Invite code deleted")
        if (supabaseClient) fetchAdminData(supabaseClient)
      } else {
        toast.error("Failed to delete invite code")
      }
    } catch (err) {
      console.error(err)
      toast.error("An error occurred")
    }
  }

  const copyInviteLink = (code: string, id: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const link = `${origin}/setup?invite=${encodeURIComponent(code)}`
    navigator.clipboard.writeText(link)
    setCopiedCodeId(id)
    toast.success(`Copied invite link: ${link}`)
    setTimeout(() => setCopiedCodeId(null), 2500)
  }

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(err)
      toast.error(`Export failed: ${message}`)
    }
  }

  const triggerEngagement = async (profileId: string) => {
    if (!supabaseClient) return
    setEngagingId(profileId)
    try {
      const { error } = await supabaseClient.functions.invoke('whatsapp-webhook', {
        body: { trigger: 'engage', profile_id: profileId }
      })
      if (error) throw error
      toast.success("Engagement message sent successfully!")
      await fetchAdminData(supabaseClient)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(`Failed: ${message}`)
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
      await fetchAdminData(supabaseClient)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
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
      await fetchAdminData(supabaseClient)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
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
      toast.success(`Attendance Guardian triggered! Sent: ${data?.sent || 0}`)
      await fetchAdminData(supabaseClient)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
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
          This page is restricted to administrators.
        </p>
      </div>
    )
  }

  const filteredUsers = userSubs.filter(u => {
    const q = searchQuery.toLowerCase()
    return u.displayName.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.whatsappNumber && u.whatsappNumber.includes(q))
  })

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      
      {/* Premium Header Dashboard */}
      <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card/40 p-6 sm:p-8 backdrop-blur-md shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/5 rounded-full filter blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-bold px-2.5 py-0.5 rounded-full text-xs uppercase tracking-wider">
              System Admin Console
            </Badge>
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[11px] text-muted-foreground font-medium">Live System Control</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" /> Admin Page
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg">
            Manage user subscriptions, grant lifetime &amp; free access, generate invite links, and monitor WhatsApp bot services.
          </p>
        </div>
        
        {/* Core Header Actions */}
        <div className="flex gap-2 shrink-0 relative z-10 w-full md:w-auto">
          <Button 
            onClick={() => { if (supabaseClient) fetchAdminData(supabaseClient) }} 
            variant="outline" 
            size="sm" 
            className="flex-1 md:flex-none gap-2 shadow-sm h-9 hover:bg-accent rounded-xl transition-all"
          >
            <RefreshCw className="w-4 h-4 text-primary" /> Refresh Data
          </Button>
          <Button 
            onClick={handleExportAllUsers} 
            variant="outline" 
            size="sm" 
            className="flex-1 md:flex-none gap-2 border-emerald-500/20 hover:bg-emerald-500/10 shadow-sm h-9 text-emerald-600 rounded-xl transition-all"
          >
            <FolderOpen className="w-4 h-4" /> Export DB
          </Button>
        </div>
      </div>

      {/* Aggregate Statistics Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="relative overflow-hidden p-4 rounded-2xl bg-card/60 border border-border/50 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider">
            <Users className="w-4 h-4 text-primary" /> Total Users
          </div>
          <p className="text-3xl font-black mt-2 text-foreground">{stats.totalUsers}</p>
        </div>
        <div className="relative overflow-hidden p-4 rounded-2xl bg-card/60 border border-border/50 shadow-sm">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-purple-500" /> Free Access
          </div>
          <p className="text-3xl font-black mt-2 text-purple-600 dark:text-purple-400">
            {stats.freeLifetimeCount + stats.free1YearCount}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{stats.freeLifetimeCount} Lifetime • {stats.free1YearCount} 1-Yr</p>
        </div>
        <div className="relative overflow-hidden p-4 rounded-2xl bg-card/60 border border-border/50 shadow-sm">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> Active Auto-Pay
          </div>
          <p className="text-3xl font-black mt-2 text-foreground">{stats.activeAutopayCount}</p>
        </div>
        <div className="relative overflow-hidden p-4 rounded-2xl bg-card/60 border border-border/50 shadow-sm">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
            <Clock className="w-4 h-4 text-amber-500" /> Free Trialing
          </div>
          <p className="text-3xl font-black mt-2 text-foreground">{stats.trialingCount}</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border/40 pb-2 overflow-x-auto">
        <Button
          variant={activeTab === 'subscriptions' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-xl font-bold gap-2"
          onClick={() => startTransition(() => setActiveTab('subscriptions'))}
        >
          <Users className="w-4 h-4" /> Subscription &amp; User Access ({userSubs.length})
        </Button>
        <Button
          variant={activeTab === 'invite_codes' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-xl font-bold gap-2"
          onClick={() => startTransition(() => setActiveTab('invite_codes'))}
        >
          <Ticket className="w-4 h-4" /> Invite Codes &amp; Links ({inviteCodes.length})
        </Button>
        <Button
          variant={activeTab === 'whatsapp' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-xl font-bold gap-2"
          onClick={() => startTransition(() => setActiveTab('whatsapp'))}
        >
          <MessageSquare className="w-4 h-4" /> WhatsApp Controls &amp; Logs
        </Button>
      </div>

      {/* ── TAB 1: SUBSCRIPTION & USER ACCESS CONTROL ── */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search user by name, email, or WhatsApp..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-card/60 rounded-xl text-xs"
              />
            </div>
          </div>

          <Card className="rounded-3xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-md overflow-hidden">
            <CardHeader className="border-b border-border/30 bg-muted/10 py-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> User Subscriptions ({filteredUsers.length})
              </CardTitle>
              <CardDescription>Grant lifetime access, renew subscription, or manage user access</CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground font-medium text-[11px] uppercase tracking-wider">
                      <th className="text-left py-3 px-4">User</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Auto-Pay / Access ID</th>
                      <th className="text-left py-3 px-4">Expires / Renewal</th>
                      <th className="text-right py-3 px-4">Manage Access</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filteredUsers.map((u) => (
                      <tr key={u.profileId} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-foreground flex items-center gap-1.5">
                            {u.displayName}
                            {u.isAdmin && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Admin</Badge>}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {u.email || u.whatsappNumber || "No email/phone"}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {getStatusBadge(u)}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {u.razorpaySubscriptionId ? (
                            <span className="bg-muted/60 px-2 py-0.5 rounded border border-border/40">
                              {u.razorpaySubscriptionId}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">No Mandate</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {u.currentPeriodEnd ? (
                            new Date(u.currentPeriodEnd).getFullYear() > 2090 ? (
                              <span className="text-purple-600 dark:text-purple-400 font-bold">LIFETIME</span>
                            ) : (
                              new Date(u.currentPeriodEnd).toLocaleDateString('en-IN')
                            )
                          ) : u.trialEnd ? (
                            <span>Trial: {new Date(u.trialEnd).toLocaleDateString('en-IN')}</span>
                          ) : (
                            <span className="text-destructive font-bold">N/A</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px] font-bold text-purple-600 border-purple-500/30 hover:bg-purple-500/10 rounded-lg"
                              onClick={() => handleGrantAccess(u.profileId, 'grant_lifetime')}
                              title="Grant Lifetime Free Access"
                            >
                              🎁 Lifetime
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px] font-bold text-blue-600 border-blue-500/30 hover:bg-blue-500/10 rounded-lg"
                              onClick={() => handleGrantAccess(u.profileId, 'grant_1year')}
                              title="Grant 1-Year Free Access"
                            >
                              📅 1-Yr
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px] font-bold text-green-600 border-green-500/30 hover:bg-green-500/10 rounded-lg"
                              onClick={() => handleGrantAccess(u.profileId, 'extend_30days')}
                              title="Renew / Extend +30 Days"
                            >
                              🔄 +30 Days
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[10px] font-bold text-destructive hover:bg-destructive/10 rounded-lg"
                              onClick={() => handleGrantAccess(u.profileId, 'revoke')}
                              title="Revoke Access"
                            >
                              Revoke
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[10px] font-bold text-destructive hover:bg-destructive/20 border border-destructive/30 rounded-lg gap-1 px-2"
                              onClick={() => setUserToDelete(u)}
                              title={u.profileId === profile?.id ? "You cannot delete your own admin account" : "Delete User Account"}
                              disabled={u.profileId === profile?.id}
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground font-medium">
                          No users found matching query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TAB 2: INVITE CODES & SHAREABLE LINKS ── */}
      {activeTab === 'invite_codes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form: Create New Invite Code */}
          <Card className="rounded-3xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-md overflow-hidden lg:col-span-1">
            <CardHeader className="border-b border-border/30 bg-muted/10">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Ticket className="w-4 h-4 text-primary" /> Create Invite Code
              </CardTitle>
              <CardDescription>Generate single or multi-use free access codes for friends</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <form onSubmit={handleCreateInviteCode} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="codeStr" className="text-xs font-bold">Code String</Label>
                  <div className="flex gap-2">
                    <Input
                      id="codeStr"
                      placeholder="e.g. FRIEND2026"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                      className="h-10 text-xs font-mono uppercase bg-background"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 px-3 shrink-0 rounded-xl"
                      onClick={() => setNewCode(`FRIEND_${Math.random().toString(36).substring(2, 7).toUpperCase()}`)}
                      title="Auto Generate Code"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">Access Duration</Label>
                  <Select value={newDuration} onValueChange={(val: 'lifetime' | '1_year') => setNewDuration(val)}>
                    <SelectTrigger className="h-10 bg-background text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lifetime">♾️ Lifetime Free Access</SelectItem>
                      <SelectItem value="1_year">📅 1-Year Free Access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="maxUsesInput" className="text-xs font-bold">Max Uses (Optional)</Label>
                  <Input
                    id="maxUsesInput"
                    type="number"
                    placeholder="Leave empty for Unlimited"
                    value={newMaxUses}
                    onChange={(e) => setNewMaxUses(e.target.value)}
                    className="h-10 text-xs bg-background"
                  />
                </div>

                <Button type="submit" className="w-full h-10 rounded-xl font-bold gap-2 mt-2" disabled={isCreatingCode}>
                  {isCreatingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Create Invite Code</>}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* List: Active Invite Codes */}
          <Card className="rounded-3xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-md overflow-hidden lg:col-span-2">
            <CardHeader className="border-b border-border/30 bg-muted/10">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Ticket className="w-4 h-4 text-primary" /> Active Invite Codes ({inviteCodes.length})
              </CardTitle>
              <CardDescription>Shareable invite links automatically unlock free access during setup</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {inviteCodes.map((c) => (
                <div key={c.id} className="p-4 rounded-2xl border border-border/40 bg-card/60 flex items-center justify-between gap-4 hover:border-primary/30 transition-all">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-base tracking-wider text-foreground">{c.code}</span>
                      <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {c.durationType === 'lifetime' ? '♾️ Lifetime' : '📅 1 Year'}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        Uses: <strong className="text-foreground">{c.usesCount}</strong> / {c.maxUses === null ? '∞' : c.maxUses}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate font-mono">
                      Link: {typeof window !== 'undefined' ? `${window.location.origin}/setup?invite=${c.code}` : `/setup?invite=${c.code}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 gap-1.5 text-xs rounded-xl font-semibold border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => copyInviteLink(c.code, c.id)}
                    >
                      {copiedCodeId === c.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      {copiedCodeId === c.id ? 'Copied Link' : 'Copy Link'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-xl"
                      onClick={() => handleDeleteInviteCode(c.id)}
                      title="Delete Invite Code"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {inviteCodes.length === 0 && (
                <div className="py-8 text-center text-muted-foreground font-medium text-xs">
                  No invite codes created yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TAB 3: WHATSAPP BOT CONTROLS & LOGS ── */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* System Actions */}
            <Card className="rounded-3xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-md overflow-hidden lg:col-span-1">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" /> System Actions
                </CardTitle>
                <CardDescription>Trigger automated WhatsApp schedules</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <Button onClick={triggerTasksReminder} className="w-full justify-center items-center gap-2.5 h-10 shadow-sm rounded-xl font-semibold">
                  <CheckCircle2 className="w-4 h-4" /> Send Due Reminders
                </Button>

                <Button onClick={triggerPendingTasksBlast} variant="secondary" className="w-full justify-center items-center gap-2.5 h-10 border border-border/50 rounded-xl font-semibold">
                  <BellRing className="w-4 h-4 text-primary" /> Pending Tasks Blast
                </Button>

                <Button onClick={triggerAttendanceGuardian} variant="secondary" className="w-full justify-center items-center gap-2.5 h-10 border border-border/50 rounded-xl font-semibold">
                  <ShieldAlert className="w-4 h-4 text-primary" /> Attendance Guardian
                </Button>
              </CardContent>
            </Card>

            {/* 24h Window Status Table */}
            <Card className="rounded-3xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-md overflow-hidden lg:col-span-2">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" /> 24h Meta Window Status
                </CardTitle>
                <CardDescription>Active 24h user conversation windows</CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground font-medium text-[11px] uppercase tracking-wider">
                        <th className="text-left py-2.5 px-3">User</th>
                        <th className="text-left py-2.5 px-3">Window</th>
                        <th className="text-left py-2.5 px-3">Time Left</th>
                        <th className="text-right py-2.5 px-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {windowStatus.map((s) => (
                        <tr key={s.profile_id} className="hover:bg-muted/30">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-foreground">{s.display_name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{s.whatsapp_number || "No number"}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant={s.window_status === 'open' ? 'default' : 'outline'} className="text-[10px] px-2 py-0.5">
                              {s.window_status}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {s.window_status === 'expired' ? <span className="text-destructive font-bold">EXPIRED</span> : `${s.hours_remaining.toFixed(1)}h`}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-primary"
                              disabled={engagingId === s.profile_id}
                              onClick={() => triggerEngagement(s.profile_id)}
                            >
                              {engagingId === s.profile_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />} Engage
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Outbound Logs Section */}
          <Card className="rounded-3xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-md overflow-hidden">
            <CardHeader className="border-b border-border/30 bg-muted/10">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" /> Outbound Delivery Logs ({messageLogs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {messageLogs.map((log) => (
                <div key={log.id} className="p-3 border rounded-2xl flex items-center justify-between gap-3 bg-card/40 text-xs">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{log.profiles?.display_name || 'System'}</span>
                      <Badge variant="outline" className="text-[9px] uppercase font-bold">{log.message_type}</Badge>
                    </div>
                    <p className="text-muted-foreground truncate font-medium">{log.body}</p>
                  </div>
                  <Badge variant={log.status === 'read' || log.status === 'delivered' ? 'default' : 'outline'} className="text-[10px] uppercase">
                    {log.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete User Account Confirmation Dialog */}
      <Dialog open={!!userToDelete} onOpenChange={(open) => { if (!open) setUserToDelete(null) }}>
        <DialogContent className="sm:max-w-md rounded-3xl border-destructive/30">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive animate-bounce" /> Delete User Account
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete the user account for <strong className="text-foreground">{userToDelete?.displayName}</strong> ({userToDelete?.email || userToDelete?.whatsappNumber || 'No contact info'})?
            </DialogDescription>
          </DialogHeader>

          {userToDelete && checkActiveSubscription(userToDelete).isActive && (
            <div className="p-3.5 rounded-2xl bg-destructive/15 border border-destructive/40 text-destructive text-xs space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>WARNING: Active Subscription Detected</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                This user currently has an <strong className="underline font-bold">{checkActiveSubscription(userToDelete).type}</strong>! Deleting this user account will immediately revoke their access and permanently delete all their database records.
              </p>
            </div>
          )}

          <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border/40">
            <p className="font-semibold text-foreground mb-1">Impact of Deletion:</p>
            <ul className="list-disc list-inside space-y-0.5 text-[11px]">
              <li>Permanent removal of profile data &amp; preferences</li>
              <li>Deletion of all subject categories, attendance logs &amp; grades</li>
              <li>Deletion of study timers, tasks &amp; WhatsApp message logs</li>
              <li>This action cannot be undone.</li>
            </ul>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setUserToDelete(null)}
              disabled={isDeletingUser}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="rounded-xl font-bold gap-1.5 bg-destructive hover:bg-destructive/90"
              onClick={handleConfirmDeleteUser}
              disabled={isDeletingUser}
            >
              {isDeletingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Confirm Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
