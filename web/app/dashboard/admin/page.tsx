"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { getAppClient, type AppSupabaseClient } from "@/lib/supabase-client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Clock,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Zap,
  Loader2,
  BellRing,
  FolderOpen,
  ShieldCheck,
  Users,
  Ticket,
  Search,
  Copy,
  Check,
  Trash2,
  Plus,
  Sparkles,
  RefreshCw,
  AlertTriangle,
} from "lucide-react"
import { useProfile } from "@/components/dashboard/profile-context"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  isSetupIncomplete?: boolean
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
  durationType: "1_month" | "6_months" | "1_year" | "lifetime"
  maxUses: number | null
  usesCount: number
  isActive: boolean
  createdAt: string
}

function getStatusBadge(user: UserSubData) {
  if (user.status === "canceled" || user.status === "expired") {
    return (
      <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10">
        Expired / Canceled
      </Badge>
    )
  }

  const isLifetime =
    user.razorpaySubscriptionId === "admin_free_lifetime" ||
    (user.currentPeriodEnd && new Date(user.currentPeriodEnd).getFullYear() > 2090)
  const is1Year = user.razorpaySubscriptionId === "admin_free_1year"
  const is6Months = user.razorpaySubscriptionId === "admin_free_6months"
  const is1Month = user.razorpaySubscriptionId === "admin_free_1month"
  const isInvite = user.razorpaySubscriptionId?.startsWith("invite_")

  if (isLifetime) {
    return (
      <Badge className="border-purple-500/30 bg-purple-500/15 text-purple-600 dark:text-purple-400">
        Free Lifetime
      </Badge>
    )
  }
  if (is1Year) {
    return <Badge className="border-blue-500/30 bg-blue-500/15 text-blue-600 dark:text-blue-400">Free 1-Year</Badge>
  }
  if (is6Months) {
    return <Badge className="border-cyan-500/30 bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">Free 6-Months</Badge>
  }
  if (is1Month) {
    return (
      <Badge className="border-indigo-500/30 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">Free 1-Month</Badge>
    )
  }
  if (isInvite) {
    return (
      <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        Invite Unlocked
      </Badge>
    )
  }
  if (user.status === "active") {
    return (
      <Badge className="border-green-500/30 bg-green-500/15 text-green-600 dark:text-green-400">Active Auto-Pay</Badge>
    )
  }
  if (user.status === "trialing") {
    return <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400">Free Trial</Badge>
  }
  return (
    <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10">
      Expired / Canceled
    </Badge>
  )
}

function checkActiveSubscription(user: UserSubData): { isActive: boolean; type: string } {
  if (user.status === "canceled" || user.status === "expired") {
    return { isActive: false, type: "Expired / Canceled" }
  }

  const isLifetime =
    user.razorpaySubscriptionId === "admin_free_lifetime" ||
    (user.currentPeriodEnd && new Date(user.currentPeriodEnd).getFullYear() > 2090)
  const is1Year = user.razorpaySubscriptionId === "admin_free_1year"
  const is6Months = user.razorpaySubscriptionId === "admin_free_6months"
  const is1Month = user.razorpaySubscriptionId === "admin_free_1month"
  const isInvite = user.razorpaySubscriptionId?.startsWith("invite_")
  const isAutopay = user.status === "active" || (user.currentPeriodEnd && new Date(user.currentPeriodEnd) > new Date())

  if (isLifetime) return { isActive: true, type: "Free Lifetime Access" }
  if (is1Year) return { isActive: true, type: "Free 1-Year Access" }
  if (is6Months) return { isActive: true, type: "Free 6-Months Access" }
  if (is1Month) return { isActive: true, type: "Free 1-Month Access" }
  if (isInvite) return { isActive: true, type: "Invite Code Free Access" }
  if (isAutopay) return { isActive: true, type: `Active Subscription (${user.planType || "Pro"})` }
  if (user.status === "trialing" && user.trialEnd && new Date(user.trialEnd) > new Date()) {
    return { isActive: true, type: "Free Trial" }
  }
  return { isActive: false, type: "Expired / None" }
}

export default function AdminPage() {
  const router = useRouter()
  const { profile } = useProfile()
  const [activeTab, setActiveTab] = useState<"subscriptions" | "invite_codes" | "whatsapp">("subscriptions")
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
    free6MonthsCount: 0,
    free1MonthCount: 0,
    trialingCount: 0,
    expiredCount: 0,
  })

  // WhatsApp states
  const [windowStatus, setWindowStatus] = useState<WindowStatusRow[]>([])
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([])
  const [engagingId, setEngagingId] = useState<string | null>(null)

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("")

  // New Invite Code form
  const [newCode, setNewCode] = useState("")
  const [newDuration, setNewDuration] = useState<"lifetime" | "1_year" | "6_months" | "1_month">("lifetime")
  const [newMaxUses, setNewMaxUses] = useState("")
  const [isCreatingCode, setIsCreatingCode] = useState(false)
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)

  // Delete user account dialog state
  const [userToDelete, setUserToDelete] = useState<UserSubData | null>(null)
  const [isDeletingUser, setIsDeletingUser] = useState(false)

  const [_isPending, startTransition] = useTransition()

  const isAdmin = profile?.is_admin === true

  const fetchAdminData = async (supabase: AppSupabaseClient) => {
    setLoading(true)
    try {
      // 1. Fetch Subscription Data & Stats & Invite Codes via Admin API
      const res = await fetch("/api/admin/subscriptions")
      if (res.ok) {
        const data = await res.json()
        setUserSubs(data.users || [])
        setStats(data.stats || {})
        setInviteCodes(data.inviteCodes || [])
      }

      // 2. Fetch WhatsApp status
      const { data: status } = await supabase.rpc("get_admin_whatsapp_status")
      setWindowStatus(status || [])

      // 3. Fetch WhatsApp Message Logs
      const { data: logs } = await supabase
        .from("whatsapp_message_logs")
        .select("*, profiles(display_name, whatsapp_number)")
        .order("created_at", { ascending: false })
        .limit(50)
      setMessageLogs(logs || [])
    } catch (err) {
      console.error("Error fetching admin data:", err)
      toast.error("Failed to load admin data")
    } finally {
      setLoading(false)
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
      await fetchAdminData(supabase)
    }
    init()
  }, [isAdmin])

  const handleGrantAccess = async (profileId: string, action: string) => {
    try {
      const res = await fetch("/api/admin/grant-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, action }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message)
        if (supabaseClient) await fetchAdminData(supabaseClient)
        router.refresh()
      } else {
        toast.error(data.error || "Failed to update access")
      }
    } catch (err) {
      console.error(err)
      toast.error("An error occurred")
    }
  }

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return
    setIsDeletingUser(true)
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: userToDelete.profileId }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || `Deleted ${userToDelete.displayName}`)
        setUserToDelete(null)
        if (supabaseClient) fetchAdminData(supabaseClient)
      } else {
        toast.error(data.error || "Failed to delete user account")
      }
    } catch (err) {
      console.error(err)
      toast.error("An error occurred while deleting user account")
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
      const res = await fetch("/api/admin/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode.trim(),
          durationType: newDuration,
          maxUses: newMaxUses ? Number.parseInt(newMaxUses, 10) : null,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Invite Code '${data.code.code}' created!`)
        setNewCode("")
        setNewMaxUses("")
        if (supabaseClient) fetchAdminData(supabaseClient)
      } else {
        toast.error(data.error || "Failed to create code")
      }
    } catch (err) {
      console.error(err)
      toast.error("An error occurred")
    } finally {
      setIsCreatingCode(false)
    }
  }

  const handleDeleteInviteCode = async (codeId: string) => {
    if (!confirm("Are you sure you want to delete this invite code?")) return
    try {
      const res = await fetch(`/api/admin/invite-codes?codeId=${encodeURIComponent(codeId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codeId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success !== false) {
        toast.success("Invite code deleted")
        if (supabaseClient) fetchAdminData(supabaseClient)
      } else {
        toast.error(data.error || "Failed to delete invite code")
      }
    } catch (err) {
      console.error(err)
      toast.error("An error occurred while deleting invite code")
    }
  }

  const copyInviteLink = (code: string, id: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
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
      const { data, error } = await supabaseClient.rpc("export_all_data")
      if (error) throw error

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2))
      const downloadAnchor = document.createElement("a")
      downloadAnchor.setAttribute("href", dataStr)
      downloadAnchor.setAttribute(
        "download",
        `ryumedha_admin_all_users_export_${new Date().toISOString().split("T")[0]}.json`
      )
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
      const { error } = await supabaseClient.functions.invoke("whatsapp-webhook", {
        body: { trigger: "engage", profile_id: profileId },
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
      const { data, error } = await supabaseClient.functions.invoke("whatsapp-webhook", {
        body: { trigger: "reminders" },
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
      const { data, error } = await supabaseClient.functions.invoke("whatsapp-webhook", {
        body: { trigger: "tasks" },
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
      const { data, error } = await supabaseClient.functions.invoke("whatsapp-webhook", {
        body: { trigger: "daily" },
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
      <div className="flex min-h-[60dvh] items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center space-y-4">
        <ShieldAlert className="text-destructive h-16 w-16 animate-bounce" />
        <h1 className="text-destructive text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground max-w-xs text-center">This page is restricted to administrators.</p>
      </div>
    )
  }

  const filteredUsers = userSubs.filter((u) => {
    const q = searchQuery.toLowerCase()
    return (
      u.displayName.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.whatsappNumber && u.whatsappNumber.includes(q))
    )
  })

  return (
    <div className="animate-in fade-in mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 duration-300 sm:space-y-8 sm:px-6 sm:py-8">
      {/* Premium Header Dashboard */}
      <div className="border-border/50 bg-card/40 relative flex flex-col items-start justify-between gap-6 overflow-hidden rounded-3xl border p-6 shadow-xl backdrop-blur-md sm:p-8 md:flex-row md:items-center">
        <div className="bg-primary/5 pointer-events-none absolute top-0 right-0 -mt-20 -mr-20 h-[300px] w-[300px] rounded-full blur-3xl filter" />
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary border-primary/20 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wider uppercase"
            >
              System Admin Console
            </Badge>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
            <span className="text-muted-foreground text-[11px] font-medium">Live System Control</span>
          </div>
          <h1 className="text-foreground flex items-center gap-3 font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            <ShieldCheck className="text-primary h-8 w-8" /> Admin Page
          </h1>
          <p className="text-muted-foreground max-w-lg text-sm">
            Manage user subscriptions, grant lifetime &amp; free access, generate invite links, and monitor WhatsApp bot
            services.
          </p>
        </div>

        {/* Core Header Actions */}
        <div className="relative z-10 flex w-full shrink-0 gap-2 md:w-auto">
          <Button
            onClick={() => {
              if (supabaseClient) fetchAdminData(supabaseClient)
            }}
            variant="outline"
            size="sm"
            className="hover:bg-accent h-9 flex-1 gap-2 rounded-xl shadow-sm transition-all md:flex-none"
          >
            <RefreshCw className="text-primary h-4 w-4" /> Refresh Data
          </Button>
          <Button
            onClick={handleExportAllUsers}
            variant="outline"
            size="sm"
            className="h-9 flex-1 gap-2 rounded-xl border-emerald-500/20 text-emerald-600 shadow-sm transition-all hover:bg-emerald-500/10 md:flex-none"
          >
            <FolderOpen className="h-4 w-4" /> Export DB
          </Button>
        </div>
      </div>

      {/* Aggregate Statistics Overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        <div className="bg-card/60 border-border/50 relative overflow-hidden rounded-2xl border p-4 shadow-sm">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
            <Users className="text-primary h-4 w-4" /> Total Users
          </div>
          <p className="text-foreground mt-2 text-4xl font-bold">{stats.totalUsers}</p>
        </div>
        <div className="bg-card/60 border-border/50 relative overflow-hidden rounded-2xl border p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-purple-600 uppercase dark:text-purple-400">
            <Sparkles className="h-4 w-4 text-purple-500" /> Free Access
          </div>
          <p className="mt-2 text-4xl font-bold text-purple-600 dark:text-purple-400">
            {stats.freeLifetimeCount +
              stats.free1YearCount +
              (stats.free6MonthsCount || 0) +
              (stats.free1MonthCount || 0)}
          </p>
          <p className="text-muted-foreground mt-0.5 text-[10px]">
            {stats.freeLifetimeCount} Life • {stats.free1YearCount} 1-Yr • {stats.free6MonthsCount || 0} 6-Mo •{" "}
            {stats.free1MonthCount || 0} 1-Mo
          </p>
        </div>
        <div className="bg-card/60 border-border/50 relative overflow-hidden rounded-2xl border p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-green-600 uppercase dark:text-green-400">
            <CheckCircle2 className="h-4 w-4 text-green-500" /> Active Auto-Pay
          </div>
          <p className="text-foreground mt-2 text-4xl font-bold">{stats.activeAutopayCount}</p>
        </div>
        <div className="bg-card/60 border-border/50 relative overflow-hidden rounded-2xl border p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-amber-600 uppercase dark:text-amber-400">
            <Clock className="h-4 w-4 text-amber-500" /> Free Trialing
          </div>
          <p className="text-foreground mt-2 text-4xl font-bold">{stats.trialingCount}</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-border/40 flex items-center gap-2 overflow-x-auto border-b pb-2">
        <Button
          variant={activeTab === "subscriptions" ? "default" : "ghost"}
          size="sm"
          className="gap-2 rounded-xl font-bold"
          onClick={() => startTransition(() => setActiveTab("subscriptions"))}
        >
          <Users className="h-4 w-4" /> Subscription &amp; User Access ({userSubs.length})
        </Button>
        <Button
          variant={activeTab === "invite_codes" ? "default" : "ghost"}
          size="sm"
          className="gap-2 rounded-xl font-bold"
          onClick={() => startTransition(() => setActiveTab("invite_codes"))}
        >
          <Ticket className="h-4 w-4" /> Invite Codes &amp; Links ({inviteCodes.length})
        </Button>
        <Button
          variant={activeTab === "whatsapp" ? "default" : "ghost"}
          size="sm"
          className="gap-2 rounded-xl font-bold"
          onClick={() => startTransition(() => setActiveTab("whatsapp"))}
        >
          <MessageSquare className="h-4 w-4" /> WhatsApp Controls &amp; Logs
        </Button>
      </div>

      {/* ── TAB 1: SUBSCRIPTION & USER ACCESS CONTROL ── */}
      {activeTab === "subscriptions" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
              <Input
                placeholder="Search user by name, email, or WhatsApp..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-card/60 h-10 rounded-xl pl-9 text-xs"
              />
            </div>
          </div>

          <Card className="border-border/50 bg-card/50 overflow-hidden rounded-3xl border shadow-md backdrop-blur-sm">
            <CardHeader className="border-border/30 bg-muted/10 border-b py-4">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Users className="text-primary h-4 w-4" /> User Subscriptions ({filteredUsers.length})
              </CardTitle>
              <CardDescription>Grant lifetime access, renew subscription, or manage user access</CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b text-[11px] font-medium tracking-wider uppercase">
                      <th className="px-4 py-3 text-left">User</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Auto-Pay / Access ID</th>
                      <th className="px-4 py-3 text-left">Expires / Renewal</th>
                      <th className="px-4 py-3 text-right">Manage Access</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border/30 divide-y">
                    {filteredUsers.map((u) => (
                      <tr key={u.profileId} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-foreground flex flex-wrap items-center gap-1.5 font-bold">
                            {u.displayName}
                            {u.isAdmin && (
                              <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">
                                Admin
                              </Badge>
                            )}
                            {u.isSetupIncomplete && (
                              <Badge
                                variant="outline"
                                className="border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[9px] text-amber-600 dark:text-amber-400"
                              >
                                Incomplete Setup
                              </Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground font-mono text-[11px]">
                            {u.email || u.whatsappNumber || "No email/phone"}
                          </div>
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(u)}</td>
                        <td className="px-4 py-3 font-mono text-[11px]">
                          {u.razorpaySubscriptionId ? (
                            <span className="bg-muted/60 border-border/40 rounded border px-2 py-0.5">
                              {u.razorpaySubscriptionId}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">No Mandate</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px]">
                          {u.currentPeriodEnd ? (
                            new Date(u.currentPeriodEnd).getFullYear() > 2090 ? (
                              <span className="font-bold text-purple-600 dark:text-purple-400">LIFETIME</span>
                            ) : (
                              new Date(u.currentPeriodEnd).toLocaleDateString("en-IN")
                            )
                          ) : u.trialEnd ? (
                            <span>Trial: {new Date(u.trialEnd).toLocaleDateString("en-IN")}</span>
                          ) : (
                            <span className="text-destructive font-bold">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-lg border-purple-500/30 px-2 text-[10px] font-bold text-purple-600 hover:bg-purple-500/10"
                              onClick={() => handleGrantAccess(u.profileId, "grant_lifetime")}
                              title="Grant Lifetime Free Access"
                            >
                              🎁 Lifetime
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-lg border-blue-500/30 px-2 text-[10px] font-bold text-blue-600 hover:bg-blue-500/10"
                              onClick={() => handleGrantAccess(u.profileId, "grant_1year")}
                              title="Grant 1-Year Free Access"
                            >
                              📅 1-Yr
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-lg border-cyan-500/30 px-2 text-[10px] font-bold text-cyan-600 hover:bg-cyan-500/10"
                              onClick={() => handleGrantAccess(u.profileId, "grant_6months")}
                              title="Grant 6-Months Free Access"
                            >
                              📅 6-Mo
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-lg border-indigo-500/30 px-2 text-[10px] font-bold text-indigo-600 hover:bg-indigo-500/10"
                              onClick={() => handleGrantAccess(u.profileId, "grant_1month")}
                              title="Grant 1-Month Free Access"
                            >
                              ⚡ 1-Mo
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-lg border-green-500/30 px-2 text-[10px] font-bold text-green-600 hover:bg-green-500/10"
                              onClick={() => handleGrantAccess(u.profileId, "extend_30days")}
                              title="Renew / Extend +30 Days"
                            >
                              🔄 +30 Days
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10 h-7 rounded-lg px-1.5 text-[10px] font-bold"
                              onClick={() => handleGrantAccess(u.profileId, "revoke")}
                              title="Revoke Access"
                            >
                              Revoke
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/20 border-destructive/30 h-7 gap-1 rounded-lg border px-1.5 text-[10px] font-bold"
                              onClick={() => setUserToDelete(u)}
                              title={
                                u.profileId === profile?.id
                                  ? "You cannot delete your own admin account"
                                  : "Delete User Account"
                              }
                              disabled={u.profileId === profile?.id}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-muted-foreground py-8 text-center font-medium">
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
      {activeTab === "invite_codes" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {/* Form: Create New Invite Code */}
          <Card className="border-border/50 bg-card/50 overflow-hidden rounded-3xl border shadow-md backdrop-blur-sm lg:col-span-1">
            <CardHeader className="border-border/30 bg-muted/10 border-b">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Ticket className="text-primary h-4 w-4" /> Create Invite Code
              </CardTitle>
              <CardDescription>Generate single or multi-use free access codes for friends</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <form onSubmit={handleCreateInviteCode} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="codeStr" className="text-xs font-bold">
                    Code String
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="codeStr"
                      placeholder="e.g. FRIEND2026"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                      className="bg-background h-10 font-mono text-xs uppercase"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 shrink-0 rounded-xl px-3"
                      onClick={() => setNewCode(`FRIEND_${Math.random().toString(36).substring(2, 7).toUpperCase()}`)}
                      title="Auto Generate Code"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">Access Duration</Label>
                  <Select
                    value={newDuration}
                    onValueChange={(val: "lifetime" | "1_year" | "6_months" | "1_month") => setNewDuration(val)}
                  >
                    <SelectTrigger className="bg-background h-10 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lifetime">♾️ Lifetime Free Access</SelectItem>
                      <SelectItem value="1_year">📅 1-Year Free Access</SelectItem>
                      <SelectItem value="6_months">📅 6-Months Free Access</SelectItem>
                      <SelectItem value="1_month">⚡ 1-Month Free Access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="maxUsesInput" className="text-xs font-bold">
                    Max Uses (Optional)
                  </Label>
                  <Input
                    id="maxUsesInput"
                    type="number"
                    placeholder="Leave empty for Unlimited"
                    value={newMaxUses}
                    onChange={(e) => setNewMaxUses(e.target.value)}
                    className="bg-background h-10 text-xs"
                  />
                </div>

                <Button type="submit" className="mt-2 h-10 w-full gap-2 rounded-xl font-bold" disabled={isCreatingCode}>
                  {isCreatingCode ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4" /> Create Invite Code
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* List: Active Invite Codes */}
          <Card className="border-border/50 bg-card/50 overflow-hidden rounded-3xl border shadow-md backdrop-blur-sm lg:col-span-2">
            <CardHeader className="border-border/30 bg-muted/10 border-b">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Ticket className="text-primary h-4 w-4" /> Active Invite Codes ({inviteCodes.length})
              </CardTitle>
              <CardDescription>Shareable invite links automatically unlock free access during setup</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {inviteCodes.map((c) => (
                <div
                  key={c.id}
                  className="border-border/40 bg-card/60 hover:border-primary/30 flex items-center justify-between gap-4 rounded-2xl border p-4 transition-all"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-foreground font-mono text-base font-black tracking-wider">{c.code}</span>
                      <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px] font-bold">
                        {c.durationType === "lifetime"
                          ? "♾️ Lifetime"
                          : c.durationType === "6_months"
                            ? "📅 6 Months"
                            : c.durationType === "1_month"
                              ? "⚡ 1 Month"
                              : "📅 1 Year"}
                      </Badge>
                      <span className="text-muted-foreground text-[11px]">
                        Uses: <strong className="text-foreground">{c.usesCount}</strong> /{" "}
                        {c.maxUses === null ? "∞" : c.maxUses}
                      </span>
                    </div>
                    <p className="text-muted-foreground truncate font-mono text-[11px]">
                      Link:{" "}
                      {typeof window !== "undefined"
                        ? `${window.location.origin}/setup?invite=${c.code}`
                        : `/setup?invite=${c.code}`}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-primary/30 text-primary hover:bg-primary/10 h-9 gap-1.5 rounded-xl text-xs font-semibold"
                      onClick={() => copyInviteLink(c.code, c.id)}
                    >
                      {copiedCodeId === c.id ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copiedCodeId === c.id ? "Copied Link" : "Copy Link"}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 h-9 w-9 rounded-xl"
                      onClick={() => handleDeleteInviteCode(c.id)}
                      title="Delete Invite Code"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {inviteCodes.length === 0 && (
                <div className="text-muted-foreground py-8 text-center text-xs font-medium">
                  No invite codes created yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TAB 3: WHATSAPP BOT CONTROLS & LOGS ── */}
      {activeTab === "whatsapp" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {/* System Actions */}
            <Card className="border-border/50 bg-card/50 overflow-hidden rounded-3xl border shadow-md backdrop-blur-sm lg:col-span-1">
              <CardHeader className="border-border/30 bg-muted/10 border-b">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Zap className="text-primary h-4 w-4" /> System Actions
                </CardTitle>
                <CardDescription>Trigger automated WhatsApp schedules</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                <Button
                  onClick={triggerTasksReminder}
                  className="h-10 w-full items-center justify-center gap-2.5 rounded-xl font-semibold shadow-sm"
                >
                  <CheckCircle2 className="h-4 w-4" /> Send Due Reminders
                </Button>

                <Button
                  onClick={triggerPendingTasksBlast}
                  variant="secondary"
                  className="border-border/50 h-10 w-full items-center justify-center gap-2.5 rounded-xl border font-semibold"
                >
                  <BellRing className="text-primary h-4 w-4" /> Pending Tasks Blast
                </Button>

                <Button
                  onClick={triggerAttendanceGuardian}
                  variant="secondary"
                  className="border-border/50 h-10 w-full items-center justify-center gap-2.5 rounded-xl border font-semibold"
                >
                  <ShieldAlert className="text-primary h-4 w-4" /> Attendance Guardian
                </Button>
              </CardContent>
            </Card>

            {/* 24h Window Status Table */}
            <Card className="border-border/50 bg-card/50 overflow-hidden rounded-3xl border shadow-md backdrop-blur-sm lg:col-span-2">
              <CardHeader className="border-border/30 bg-muted/10 border-b">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Clock className="text-primary h-4 w-4" /> 24h Meta Window Status
                </CardTitle>
                <CardDescription>Active 24h user conversation windows</CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b text-[11px] font-medium tracking-wider uppercase">
                        <th className="px-3 py-2.5 text-left">User</th>
                        <th className="px-3 py-2.5 text-left">Window</th>
                        <th className="px-3 py-2.5 text-left">Time Left</th>
                        <th className="px-3 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border/30 divide-y">
                      {windowStatus.map((s) => (
                        <tr key={s.profile_id} className="hover:bg-muted/30">
                          <td className="px-3 py-2.5">
                            <div className="text-foreground font-semibold">{s.display_name}</div>
                            <div className="text-muted-foreground font-mono text-[10px]">
                              {s.whatsapp_number || "No number"}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge
                              variant={s.window_status === "open" ? "default" : "outline"}
                              className="px-2 py-0.5 text-[10px]"
                            >
                              {s.window_status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 font-mono">
                            {s.window_status === "expired" ? (
                              <span className="text-destructive font-bold">EXPIRED</span>
                            ) : (
                              `${s.hours_remaining.toFixed(1)}h`
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-primary h-7 text-xs"
                              disabled={engagingId === s.profile_id}
                              onClick={() => triggerEngagement(s.profile_id)}
                            >
                              {engagingId === s.profile_id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <MessageSquare className="h-3.5 w-3.5" />
                              )}{" "}
                              Engage
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
          <Card className="border-border/50 bg-card/50 overflow-hidden rounded-3xl border shadow-md backdrop-blur-sm">
            <CardHeader className="border-border/30 bg-muted/10 border-b">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <MessageSquare className="text-primary h-4 w-4" /> Outbound Delivery Logs ({messageLogs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4">
              {messageLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-card/40 flex items-center justify-between gap-3 rounded-2xl border p-3 text-xs"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{log.profiles?.display_name || "System"}</span>
                      <Badge variant="outline" className="text-[9px] font-bold uppercase">
                        {log.message_type}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground truncate font-medium">{log.body}</p>
                  </div>
                  <Badge
                    variant={log.status === "read" || log.status === "delivered" ? "default" : "outline"}
                    className="text-[10px] uppercase"
                  >
                    {log.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete User Account Confirmation Dialog */}
      <Dialog
        open={!!userToDelete}
        onOpenChange={(open) => {
          if (!open) setUserToDelete(null)
        }}
      >
        <DialogContent className="border-destructive/30 rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2 text-lg font-bold">
              <AlertTriangle className="text-destructive h-5 w-5 animate-bounce" /> Delete User Account
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Are you sure you want to delete the user account for{" "}
              <strong className="text-foreground">{userToDelete?.displayName}</strong> (
              {userToDelete?.email || userToDelete?.whatsappNumber || "No contact info"})?
            </DialogDescription>
          </DialogHeader>

          {userToDelete && checkActiveSubscription(userToDelete).isActive && (
            <div className="bg-destructive/15 border-destructive/40 text-destructive space-y-1.5 rounded-2xl border p-3.5 text-xs">
              <div className="text-destructive flex items-center gap-1.5 font-bold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>WARNING: Active Subscription Detected</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                This user currently has an{" "}
                <strong className="font-bold underline">{checkActiveSubscription(userToDelete).type}</strong>! Deleting
                this user account will immediately revoke their access and permanently delete all their database
                records.
              </p>
            </div>
          )}

          <div className="text-muted-foreground bg-muted/30 border-border/40 rounded-xl border p-3 text-xs">
            <p className="text-foreground mb-1 font-semibold">Impact of Deletion:</p>
            <ul className="list-inside list-disc space-y-0.5 text-[11px]">
              <li>Permanent removal of profile data &amp; preferences</li>
              <li>Deletion of all subject categories, attendance logs &amp; grades</li>
              <li>Deletion of study timers, tasks &amp; WhatsApp message logs</li>
              <li>This action cannot be undone.</li>
            </ul>
          </div>

          <DialogFooter className="mt-2 gap-2 sm:gap-0">
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
              className="bg-destructive hover:bg-destructive/90 gap-1.5 rounded-xl font-bold"
              onClick={handleConfirmDeleteUser}
              disabled={isDeletingUser}
            >
              {isDeletingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Confirm Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
