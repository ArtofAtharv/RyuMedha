"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { getSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { BookOpen, FolderOpen, User, CheckCircle2 } from "lucide-react"

export default function SetupPage() {
  const router = useRouter()
  const [session, setSession] = useState<any>(null)
  const [supabaseClient, setSupabaseClient] = useState<any>(null)
  
  const [displayName, setDisplayName] = useState("")
  const [academicsEnabled, setAcademicsEnabled] = useState(true)
  const [personalEnabled, setPersonalEnabled] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    async function init() {
      const sess = await getSession()
      if (!sess) {
        router.push("/login")
        return
      }
      setSession(sess)
      
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${sess.user.supabaseToken}` } } }
      )
      setSupabaseClient(supabase)
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('whatsapp_number', sess.user.phone)
        .single()
        
      if (profile && profile.display_name && profile.display_name.trim() !== '') {
        // If they already have a display name, redirect to dashboard to prevent getting stuck
        router.push('/dashboard')
      }
    }
    init()
  }, [router])

  async function handleCompleteSetup(e: React.FormEvent) {
    e.preventDefault()
    if (!displayName.trim() || !supabaseClient || !session) return
    
    setIsSubmitting(true)
    setErrorMsg("")

    const { error } = await supabaseClient
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        academics_enabled: academicsEnabled,
        personal_enabled: personalEnabled
      })
      .eq('whatsapp_number', session.user.phone)

    if (error) {
      setErrorMsg(error.message)
      setIsSubmitting(false)
    } else {
      router.push("/dashboard")
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 selection:bg-primary/20">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Decorative Header */}
        <div className="text-center mb-8 space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-4 transform rotate-3">
            <User className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tight"><span className="gradient-accent-text">Welcome</span></h1>
          <p className="text-muted-foreground">Let's set up your profile.</p>
        </div>

        <Card className="border-border/50 shadow-xl shadow-primary/5 bg-card/50 backdrop-blur-xl">
          <form onSubmit={handleCompleteSetup}>
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Profile Setup</CardTitle>
              <CardDescription>How do you plan to use RyuMedha?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="displayName" className="font-bold">Display Name</Label>
                <Input 
                  id="displayName" 
                  autoComplete="off"
                  placeholder="What should we call you?" 
                  className="h-12 bg-background shadow-sm border-muted-foreground/20 text-lg px-4"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-4 pt-2">
                <Label className="font-bold text-muted-foreground">Learning Tracks</Label>
                
                {/* Academics Toggle */}
                <div 
                  className={`flex flex-row items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${academicsEnabled ? 'border-primary bg-primary/5' : 'border-border/50 bg-background/50 hover:border-primary/30'}`}
                  onClick={() => setAcademicsEnabled(!academicsEnabled)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${academicsEnabled ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className={`font-bold ${academicsEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>Academics</h3>
                      <p className="text-xs text-muted-foreground">Track college courses & grades</p>
                    </div>
                  </div>
                  <Switch checked={academicsEnabled} onCheckedChange={setAcademicsEnabled} />
                </div>

                {/* Personal Toggle */}
                <div 
                  className={`flex flex-row items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${personalEnabled ? 'border-primary bg-primary/5' : 'border-border/50 bg-background/50 hover:border-primary/30'}`}
                  onClick={() => setPersonalEnabled(!personalEnabled)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${personalEnabled ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className={`font-bold ${personalEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>Personal Learning</h3>
                      <p className="text-xs text-muted-foreground">Track hobbies & self-study</p>
                    </div>
                  </div>
                  <Switch checked={personalEnabled} onCheckedChange={setPersonalEnabled} />
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm font-semibold text-center">
                  {errorMsg}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-12 text-lg font-bold mt-4" 
                disabled={isSubmitting || !displayName.trim() || (!academicsEnabled && !personalEnabled)}
              >
                {isSubmitting ? (
                  <span className="animate-pulse">Saving...</span>
                ) : (
                  <>Complete Setup <CheckCircle2 className="w-5 h-5 ml-2" /></>
                )}
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  )
}
