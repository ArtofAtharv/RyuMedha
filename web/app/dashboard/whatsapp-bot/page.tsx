"use client"

import { useEffect, useState, startTransition } from "react"
import { useSupabaseSession } from "@/lib/supabase-auth"
import { useRouter } from "next/navigation"
import { getAppClient, type AppSupabaseClient } from "@/lib/supabase-client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  MessageSquare,
  Phone,
  ShieldCheck,
  HelpCircle,
  RefreshCw,
  LogOut,
  Check,
  Copy,
  ArrowLeft,
  Clock,
  Zap,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
// import Link from "next/link"

const BOT_LINK = "https://wa.me/message/P4QSZGK7MV2PL1"
const BOT_URL = "https://wa.me/+918976156904"

interface ProfileData {
  id: string
  whatsapp_number?: string | null
  last_user_message_at?: string | null
  whatsapp_verification_code?: string | null
  whatsapp_verification_expires_at?: string | null
  display_name?: string
}

export default function WhatsAppBotPage() {
  const router = useRouter()
  const { session: _session } = useSupabaseSession()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [supabaseClient, setSupabaseClient] = useState<AppSupabaseClient | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [copied, setCopied] = useState(false)

  async function fetchProfile(supabase: AppSupabaseClient) {
    const { data, error } = await supabase.from("profiles").select("*").single()
    if (!error && data) {
      setProfile(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    const supabase = getAppClient()
    setTimeout(() => setSupabaseClient(supabase), 0)
    setTimeout(() => fetchProfile(supabase), 0)

    // Poll profile every 5 seconds to automatically detect when they verify code on WhatsApp
    const interval = setInterval(() => {
      setTimeout(() => fetchProfile(supabase), 0)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const generatePasscode = async () => {
    if (!profile || !supabaseClient) return
    setGenerating(true)

    // Generate a random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes expiry

    try {
      const { error } = await supabaseClient
        .from("profiles")
        .update({
          whatsapp_verification_code: code,
          whatsapp_verification_expires_at: expiresAt,
        })
        .eq("id", profile.id)

      if (error) throw error
      toast.success("Passcode generated! Send it to the bot.")
      await fetchProfile(supabaseClient)
    } catch (err) {
      console.error(err)
      toast.error("Failed to generate passcode.")
    } finally {
      setGenerating(false)
    }
  }

  const unlinkWhatsApp = async () => {
    if (!profile || !supabaseClient) return
    if (!confirm("Are you sure you want to unlink your WhatsApp number? You will stop receiving reminders.")) return
    setUnlinking(true)

    try {
      const { error } = await supabaseClient
        .from("profiles")
        .update({
          whatsapp_number: null,
          whatsapp_verification_code: null,
          whatsapp_verification_expires_at: null,
        })
        .eq("id", profile.id)

      if (error) throw error
      toast.success("WhatsApp number unlinked successfully.")
      await fetchProfile(supabaseClient)
    } catch (err) {
      console.error(err)
      toast.error("Failed to unlink number.")
    } finally {
      setUnlinking(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success("Copied to clipboard!")
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <RefreshCw className="text-primary h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-destructive font-bold">Failed to load connection data.</p>
      </div>
    )
  }

  // Calculate session active details
  const hasLinked = !!profile.whatsapp_number
  let isWindowActive = false
  let timeRemainingStr = ""

  if (hasLinked && profile.last_user_message_at) {
    const lastMsgTime = new Date(profile.last_user_message_at).getTime()
    const now = new Date().getTime()
    const diff = lastMsgTime + 24 * 60 * 60 * 1000 - now
    if (diff > 0) {
      isWindowActive = true
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      timeRemainingStr = `${hours}h ${minutes}m left`
    }
  }

  return (
    <div className="animate-in fade-in mx-auto max-w-3xl space-y-6 px-4 py-6 duration-300 sm:space-y-8 sm:py-8">
      {/* Back Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => startTransition(() => router.push("/dashboard/profile"))}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-foreground text-xl font-bold tracking-tight">WhatsApp Connection</h1>
          <p className="text-muted-foreground text-xs">Manage your automated WhatsApp reminder bot</p>
        </div>
      </div>

      {/* Main Connection Status Dashboard Card */}
      <Card className="border-border/50 bg-card/40 relative overflow-hidden rounded-3xl border shadow-lg backdrop-blur-md">
        <div className="bg-primary/5 pointer-events-none absolute top-0 right-0 -mt-10 -mr-10 h-[200px] w-[200px] rounded-full blur-3xl filter" />
        <CardHeader className="border-border/20 bg-muted/5 relative z-10 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="text-primary h-5 w-5" />
              <CardTitle className="text-base font-bold">Bot Status</CardTitle>
            </div>
            {hasLinked ? (
              isWindowActive ? (
                <Badge
                  variant="outline"
                  className="gap-1.5 rounded-full border-green-500/30 bg-green-500/10 px-3 py-1 font-semibold text-green-400 select-none"
                >
                  <span className="h-1.5 w-1.5 animate-ping rounded-full bg-green-500" />
                  Connected & Active
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1.5 rounded-full border-amber-500/30 bg-amber-500/10 px-3 py-1 font-semibold text-amber-400 select-none"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Bot Inactive
                </Badge>
              )
            ) : (
              <Badge
                variant="outline"
                className="border-border/60 bg-muted/20 text-muted-foreground rounded-full px-3 py-1 font-semibold select-none"
              >
                Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="relative z-10 space-y-6 p-6">
          {!hasLinked ? (
            /* ================= UNLINKED VERIFICATION FLOW ================= */
            <div className="space-y-6">
              <div className="bg-muted/10 border-border/30 space-y-3 rounded-2xl border p-5">
                <h3 className="text-foreground flex items-center gap-2 text-sm font-bold">
                  <Zap className="text-primary h-4 w-4" /> Link Your WhatsApp Account
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  To receive daily attendance check-ins, push task lists, and track your schedules straight from
                  WhatsApp, authorize your number using a secure passcode.
                </p>
              </div>

              {profile.whatsapp_verification_code && (
                <div className="border-primary/30 bg-primary/5 flex flex-col items-center justify-center space-y-4 rounded-2xl border border-dashed p-6">
                  <div className="space-y-1 text-center">
                    <span className="text-primary text-[10px] font-bold tracking-widest uppercase">Your Passcode</span>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-foreground font-mono text-3xl font-extrabold tracking-widest">
                        {profile.whatsapp_verification_code}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground h-8 w-8"
                        onClick={() => copyToClipboard(`/verify ${profile.whatsapp_verification_code}`)}
                      >
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <span className="text-muted-foreground text-[10px]">Expires in 10 minutes</span>
                  </div>

                  <div className="border-border/40 my-2 w-full border-t" />

                  <div className="max-w-sm space-y-3 text-center">
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      1. Copy the code above and click the button below to open a chat with our WhatsApp Bot.
                    </p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      2. Paste and send the message:{" "}
                      <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono font-bold">
                        /verify {profile.whatsapp_verification_code}
                      </code>
                    </p>
                    <Button asChild className="mt-2 w-full gap-2 rounded-xl bg-[#25D366] text-white hover:bg-[#20ba56]">
                      <a
                        href={`${BOT_URL}?text=%2Fverify%20${profile.whatsapp_verification_code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageSquare className="h-4 w-4" /> Message Bot on WhatsApp
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              {!profile.whatsapp_verification_code && (
                <div className="flex justify-center pt-2">
                  <Button
                    className="rounded-xl px-6 font-bold shadow-md transition-all hover:shadow-lg"
                    onClick={generatePasscode}
                    disabled={generating}
                  >
                    {generating ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    Generate Verification Code
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* ================= LINKED STATE VIEW ================= */
            <div className="space-y-6">
              <div className="border-border/30 bg-muted/5 flex items-center gap-4 rounded-2xl border p-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${isWindowActive ? "bg-green-500/10 text-green-500" : "bg-amber-500/10 text-amber-500"}`}
                >
                  <Phone className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Linked Phone Number
                  </span>
                  <div className="text-foreground mt-0.5 text-base font-extrabold">
                    {profile.whatsapp_number?.startsWith("+") ? profile.whatsapp_number : `+${profile.whatsapp_number}`}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 gap-1.5 rounded-xl text-xs"
                  onClick={unlinkWhatsApp}
                  disabled={unlinking}
                >
                  <LogOut className="h-3.5 w-3.5" /> Unlink
                </Button>
              </div>

              {isWindowActive ? (
                /* Active Window Alert */
                <div className="relative space-y-3 overflow-hidden rounded-2xl border border-green-500/20 bg-green-500/10 p-5">
                  <div className="pointer-events-none absolute top-0 right-0 p-4 opacity-5">
                    <Clock className="h-24 w-24 text-green-500" />
                  </div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-green-400">
                    <Clock className="h-4 w-4" /> Message Window Lifespan
                  </h3>
                  <p className="max-w-md text-xs leading-relaxed text-green-200/80">
                    Your connection session is currently active. The bot can deliver reminders for another{" "}
                    <strong className="font-mono text-white">{timeRemainingStr}</strong>. The window resets to 24h every
                    time you send a message to the bot.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="gap-1 rounded-xl border-green-500/30 text-xs text-white hover:bg-green-500/20"
                  >
                    <a href={BOT_LINK} target="_blank" rel="noopener noreferrer">
                      Keep Bot Alive
                    </a>
                  </Button>
                </div>
              ) : (
                /* Expired Alert */
                <div className="relative space-y-3 overflow-hidden rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
                  <div className="pointer-events-none absolute top-0 right-0 p-4 opacity-5">
                    <AlertTriangle className="h-24 w-24 text-amber-500" />
                  </div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-amber-400">
                    <AlertTriangle className="h-4 w-4" /> Bot Inactive (Window Expired)
                  </h3>
                  <p className="text-xs leading-relaxed text-amber-200/80">
                    Meta enforces a strict 24-hour window policy for business API bots. Since you haven&apos;t messaged
                    the bot in 24 hours, it cannot send you reminders.
                  </p>
                  <p className="text-xs leading-relaxed font-semibold text-amber-200/80">
                    To reactivate (respawn) the connection and receive schedules, click below to send a quick message to
                    the bot!
                  </p>
                  <Button asChild className="gap-2 rounded-xl bg-amber-500 font-bold text-white hover:bg-amber-600">
                    <a href={`${BOT_LINK}?text=%2FRyuma%20respawn`} target="_blank" rel="noopener noreferrer">
                      <Zap className="h-4 w-4" /> Respawn Bot Status
                    </a>
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Bot Guide / Commands Catalog */}
      <Card className="border-border/50 bg-card/20 overflow-hidden rounded-3xl border shadow-sm">
        <CardHeader className="border-border/10 bg-muted/5 border-b">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <HelpCircle className="text-primary h-4 w-4" /> WhatsApp Bot Guide
          </CardTitle>
          <CardDescription>Master attendance logging and study tracking straight from your chat</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="bg-muted/5 space-y-2 rounded-2xl border p-4">
              <h4 className="text-primary text-xs font-bold tracking-wider uppercase">🎓 Attendance Logging</h4>
              <p className="text-muted-foreground text-xs leading-relaxed">Log subject attendances instantly:</p>
              <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-xs font-medium">
                <li>
                  <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono font-bold">
                    attended MATH
                  </code>
                </li>
                <li>
                  <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono font-bold">
                    missed PHYSICS
                  </code>
                </li>
                <li>
                  <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono font-bold">stats</code>{" "}
                  (View rate percentages)
                </li>
              </ul>
            </div>

            <div className="bg-muted/5 space-y-2 rounded-2xl border p-4">
              <h4 className="text-primary text-xs font-bold tracking-wider uppercase">📝 Task Management</h4>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Manage checklists straight from your keyboard:
              </p>
              <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-xs font-medium">
                <li>
                  <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono font-bold">tasks</code>{" "}
                  (List all active tasks)
                </li>
                <li>
                  <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono font-bold">done 3</code>{" "}
                  (Complete the 3rd task)
                </li>
                <li>
                  <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono font-bold">
                    add task Submit Report
                  </code>
                </li>
              </ul>
            </div>

            <div className="bg-muted/5 space-y-2 rounded-2xl border p-4">
              <h4 className="text-primary text-xs font-bold tracking-wider uppercase">⏱️ Study Timers</h4>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Log study sessions directly with text triggers:
              </p>
              <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-xs font-medium">
                <li>
                  <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono font-bold">
                    start CHEMISTRY
                  </code>{" "}
                  (Starts a study session)
                </li>
                <li>
                  <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono font-bold">stop</code>{" "}
                  (Halts and commits study minutes)
                </li>
              </ul>
            </div>

            <div className="bg-muted/5 space-y-2 rounded-2xl border p-4">
              <h4 className="text-primary text-xs font-bold tracking-wider uppercase">⚙️ Other Controls</h4>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Configure your onboarding and view configurations:
              </p>
              <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-xs font-medium">
                <li>
                  <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono font-bold">setup</code>{" "}
                  (Reset and adjust bot details)
                </li>
                <li>
                  <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono font-bold">profile</code>{" "}
                  (View connected profile summary)
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
