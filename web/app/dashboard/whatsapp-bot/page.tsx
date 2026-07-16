"use client"

import { useEffect, useState, startTransition } from "react"
import { useSupabaseSession } from "@/lib/supabase-auth"
import { useRouter } from "next/navigation"
import { getAppClient, type AppSupabaseClient } from "@/lib/supabase-client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  MessageSquare, Phone, ShieldCheck, HelpCircle, 
  RefreshCw, LogOut, Check, Copy, ArrowLeft, Clock, Zap, AlertTriangle
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

const BOT_LINK = "https://wa.me/message/P4QSZGK7MV2PL1"

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
  const { session } = useSupabaseSession()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [supabaseClient, setSupabaseClient] = useState<AppSupabaseClient | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [copied, setCopied] = useState(false)

  async function fetchProfile(supabase: AppSupabaseClient) {
    const { data, error } = await supabase.from('profiles').select('*').single()
    if (!error && data) {
      setProfile(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    const supabase = getAppClient()
    setSupabaseClient(supabase)
    fetchProfile(supabase)

    // Poll profile every 5 seconds to automatically detect when they verify code on WhatsApp
    const interval = setInterval(() => {
      fetchProfile(supabase)
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
        .from('profiles')
        .update({
          whatsapp_verification_code: code,
          whatsapp_verification_expires_at: expiresAt
        })
        .eq('id', profile.id)

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
        .from('profiles')
        .update({
          whatsapp_number: null,
          whatsapp_verification_code: null,
          whatsapp_verification_expires_at: null
        })
        .eq('id', profile.id)

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
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
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
    const now = Date.now()
    const diff = lastMsgTime + 24 * 60 * 60 * 1000 - now
    if (diff > 0) {
      isWindowActive = true
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      timeRemainingStr = `${hours}h ${minutes}m left`
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      
      {/* Back Header */}
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-full"
          onClick={() => startTransition(() => router.push('/dashboard/profile'))}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">WhatsApp Connection</h1>
          <p className="text-xs text-muted-foreground">Manage your automated WhatsApp reminder bot</p>
        </div>
      </div>

      {/* Main Connection Status Dashboard Card */}
      <Card className="rounded-3xl border border-border/50 bg-card/40 backdrop-blur-md overflow-hidden relative shadow-lg">
        <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-primary/5 rounded-full filter blur-3xl pointer-events-none -mr-10 -mt-10" />
        <CardHeader className="border-b border-border/20 bg-muted/5 relative z-10">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-5 h-5 text-primary" />
              <CardTitle className="text-base font-bold">Bot Status</CardTitle>
            </div>
            {hasLinked ? (
              isWindowActive ? (
                <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-400 gap-1.5 px-3 py-1 font-semibold rounded-full select-none">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-ping" />
                  Connected & Active
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400 gap-1.5 px-3 py-1 font-semibold rounded-full select-none">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Bot Inactive
                </Badge>
              )
            ) : (
              <Badge variant="outline" className="border-border/60 bg-muted/20 text-muted-foreground px-3 py-1 font-semibold rounded-full select-none">
                Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6 relative z-10 space-y-6">
          {!hasLinked ? (
            /* ================= UNLINKED VERIFICATION FLOW ================= */
            <div className="space-y-6">
              <div className="bg-muted/10 border border-border/30 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" /> Link Your WhatsApp Account
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  To receive daily attendance check-ins, push task lists, and track your schedules straight from WhatsApp, authorize your number using a secure passcode.
                </p>
              </div>

              {profile.whatsapp_verification_code && (
                <div className="flex flex-col items-center justify-center p-6 border border-dashed border-primary/30 rounded-2xl bg-primary/5 space-y-4">
                  <div className="text-center space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-primary">Your Passcode</span>
                    <div className="flex items-center gap-2 justify-center">
                      <span className="text-3xl font-extrabold tracking-widest font-mono text-foreground">{profile.whatsapp_verification_code}</span>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => copyToClipboard(`/verify ${profile.whatsapp_verification_code}`)}
                      >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Expires in 10 minutes</span>
                  </div>

                  <div className="w-full border-t border-border/40 my-2" />

                  <div className="text-center space-y-3 max-w-sm">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      1. Copy the code above or click the button below to open a chat with our WhatsApp Bot.
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      2. Paste and send the message: <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground font-bold">/verify {profile.whatsapp_verification_code}</code>
                    </p>
                    <Button asChild className="w-full gap-2 rounded-xl mt-2 bg-[#25D366] hover:bg-[#20ba56] text-white">
                      <a href={`${BOT_LINK}?text=%2Fverify%20${profile.whatsapp_verification_code}`} target="_blank" rel="noopener noreferrer">
                        <MessageSquare className="w-4 h-4" /> Message Bot on WhatsApp
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              {!profile.whatsapp_verification_code && (
                <div className="flex justify-center pt-2">
                  <Button 
                    className="rounded-xl px-6 font-bold shadow-md hover:shadow-lg transition-all"
                    onClick={generatePasscode}
                    disabled={generating}
                  >
                    {generating ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                    Generate Verification Code
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* ================= LINKED STATE VIEW ================= */
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 border border-border/30 bg-muted/5 rounded-2xl">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isWindowActive ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>
                  <Phone className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Linked Phone Number</span>
                  <div className="text-base font-extrabold text-foreground mt-0.5">
                    {profile.whatsapp_number?.startsWith('+') ? profile.whatsapp_number : `+${profile.whatsapp_number}`}
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="rounded-xl text-destructive hover:bg-destructive/10 text-xs gap-1.5"
                  onClick={unlinkWhatsApp}
                  disabled={unlinking}
                >
                  <LogOut className="w-3.5 h-3.5" /> Unlink
                </Button>
              </div>

              {isWindowActive ? (
                /* Active Window Alert */
                <div className="bg-green-500/10 border border-green-500/20 p-5 rounded-2xl space-y-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <Clock className="w-24 h-24 text-green-500" />
                  </div>
                  <h3 className="font-bold text-sm text-green-400 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Message Window Lifespan
                  </h3>
                  <p className="text-xs text-green-200/80 leading-relaxed max-w-md">
                    Your connection session is currently active. The bot can deliver reminders for another <strong className="text-white font-mono">{timeRemainingStr}</strong>. The window resets to 24h every time you send a message to the bot.
                  </p>
                  <Button variant="outline" size="sm" asChild className="border-green-500/30 hover:bg-green-500/20 text-white rounded-xl text-xs gap-1">
                    <a href={BOT_LINK} target="_blank" rel="noopener noreferrer">
                      Keep Bot Alive
                    </a>
                  </Button>
                </div>
              ) : (
                /* Expired Alert */
                <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-2xl space-y-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <AlertTriangle className="w-24 h-24 text-amber-500" />
                  </div>
                  <h3 className="font-bold text-sm text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Bot Inactive (Window Expired)
                  </h3>
                  <p className="text-xs text-amber-200/80 leading-relaxed">
                    Meta enforces a strict 24-hour window policy for business API bots. Since you haven&apos;t messaged the bot in 24 hours, it cannot send you reminders. 
                  </p>
                  <p className="text-xs text-amber-200/80 font-semibold leading-relaxed">
                    To reactivate (respawn) the connection and receive schedules, click below to send a quick message to the bot!
                  </p>
                  <Button asChild className="rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white gap-2">
                    <a href={`${BOT_LINK}?text=%2FRyuma%20respawn`} target="_blank" rel="noopener noreferrer">
                      <Zap className="w-4 h-4" /> Respawn Bot Status
                    </a>
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Bot Guide / Commands Catalog */}
      <Card className="rounded-3xl border border-border/50 bg-card/20 overflow-hidden shadow-sm">
        <CardHeader className="border-b border-border/10 bg-muted/5">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-primary" /> WhatsApp Bot Guide
          </CardTitle>
          <CardDescription>Master attendance logging and study tracking straight from your chat</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 border rounded-2xl bg-muted/5 space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-primary">🎓 Attendance Logging</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Log subject attendances instantly:
              </p>
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1 font-medium">
                <li><code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground font-bold">attended MATH</code></li>
                <li><code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground font-bold">missed PHYSICS</code></li>
                <li><code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground font-bold">stats</code> (View rate percentages)</li>
              </ul>
            </div>
            
            <div className="p-4 border rounded-2xl bg-muted/5 space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-primary">📝 Task Management</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Manage checklists straight from your keyboard:
              </p>
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1 font-medium">
                <li><code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground font-bold">tasks</code> (List all active tasks)</li>
                <li><code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground font-bold">done 3</code> (Complete the 3rd task)</li>
                <li><code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground font-bold">add task Submit Report</code></li>
              </ul>
            </div>

            <div className="p-4 border rounded-2xl bg-muted/5 space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-primary">⏱️ Study Timers</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Log study sessions directly with text triggers:
              </p>
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1 font-medium">
                <li><code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground font-bold">start CHEMISTRY</code> (Starts a study session)</li>
                <li><code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground font-bold">stop</code> (Halts and commits study minutes)</li>
              </ul>
            </div>

            <div className="p-4 border rounded-2xl bg-muted/5 space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-primary">⚙️ Other Controls</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Configure your onboarding and view configurations:
              </p>
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1 font-medium">
                <li><code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground font-bold">setup</code> (Reset and adjust bot details)</li>
                <li><code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground font-bold">profile</code> (View connected profile summary)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
