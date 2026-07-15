"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSupabaseSession } from "@/lib/supabase-auth"
import { User, ChevronDown, BookOpen, FolderOpen } from "lucide-react"
import { AccountSheet } from "@/components/account-sheet"
import { usePathname } from "next/navigation"
import { getAppClient } from "@/lib/supabase-client"
import Image from "next/image"
import { useProfile } from "@/components/dashboard/profile-context"
import { haptic } from "@/lib/haptic"

export default function Navigation() {
  const { session, isAuthenticated } = useSupabaseSession()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isTrackDropdownOpen, setIsTrackDropdownOpen] = useState(false)
  const pathname = usePathname()
  const [displayName, setDisplayName] = useState("")
  const [whatsAppNumber, setWhatsAppNumber] = useState<string | null>(null)
  const [lastUserMessageAt, setLastUserMessageAt] = useState<string | null>(null)

  const { profile, activeTrack, setActiveTrack } = useProfile()

  useEffect(() => {
    if (!isAuthenticated) {
      setDisplayName("")
      setWhatsAppNumber(null)
      setLastUserMessageAt(null)
      return
    }
    const supabase = getAppClient()
    supabase
      .from("profiles")
      .select("display_name, whatsapp_number, last_user_message_at")
      .single()
      .then(({ data }) => {
        if (data) {
          if (data.display_name) setDisplayName(data.display_name)
          setWhatsAppNumber(data.whatsapp_number || null)
          setLastUserMessageAt(data.last_user_message_at || null)
        }
      })
  }, [isAuthenticated, pathname])

  const name = displayName || session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email
  const initials = name
    ? name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
    : null

  let botStatus: "unlinked" | "active" | "inactive" = "unlinked"
  if (whatsAppNumber) {
    if (lastUserMessageAt) {
      const diff = new Date(lastUserMessageAt).getTime() + 24 * 60 * 60 * 1000 - Date.now()
      botStatus = diff > 0 ? "active" : "inactive"
    } else {
      botStatus = "inactive"
    }
  }

  const isDashboard = pathname?.startsWith("/dashboard")

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="px-5 sm:px-8 lg:px-14 xl:px-20 h-14 flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group transition-transform hover:scale-95" aria-label="Ryu Medha home">
            <Image
              src="/badge.png"
              alt="Ryu Medha"
              width={32}
              height={32}
              className="rounded-full invert dark:invert-0"
            />
            <span className="text-xl tracking-tight font-changa-one hidden sm:inline">Ryu Medha</span>
          </Link>

          {/* Right Action Bar */}
          <div className="flex items-center gap-3">
            {/* Track Switcher Dropdown */}
            {isAuthenticated && isDashboard && profile && profile.academics_enabled && profile.personal_enabled && (
              <div className="relative">
                <button
                  onClick={() => { haptic(); setIsTrackDropdownOpen(!isTrackDropdownOpen); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 bg-muted/20 text-xs font-semibold hover:bg-muted/40 transition-all select-none cursor-pointer text-foreground shadow-sm hover:scale-102 active:scale-98"
                >
                  {activeTrack === 'academics' ? (
                    <>
                      <BookOpen className="w-3.5 h-3.5 text-primary" />
                      <span>Academics</span>
                    </>
                  ) : (
                    <>
                      <FolderOpen className="w-3.5 h-3.5 text-primary" />
                      <span>Personal</span>
                    </>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isTrackDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isTrackDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsTrackDropdownOpen(false)} />
                    <div className="absolute right-0 mt-1.5 w-36 bg-card border border-border/50 rounded-2xl shadow-xl p-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      <button
                        onClick={() => {
                          setActiveTrack('academics');
                          setIsTrackDropdownOpen(false);
                          haptic();
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs font-bold rounded-xl transition-all cursor-pointer ${
                          activeTrack === 'academics' 
                            ? 'bg-primary/10 text-primary' 
                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        }`}
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Academics
                      </button>
                      <button
                        onClick={() => {
                          setActiveTrack('personal');
                          setIsTrackDropdownOpen(false);
                          haptic();
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs font-bold rounded-xl transition-all cursor-pointer ${
                          activeTrack === 'personal' 
                            ? 'bg-primary/10 text-primary' 
                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        }`}
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Personal
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {isAuthenticated && (
              <Link 
                href="/dashboard/whatsapp-bot"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 bg-muted/20 text-xs font-semibold hover:bg-muted/40 transition-colors select-none"
              >
                {botStatus === "active" && (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-green-500 hidden sm:inline">Bot Active</span>
                    <span className="text-green-500 sm:hidden">Active</span>
                  </>
                )}
                {botStatus === "inactive" && (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    <span className="text-amber-500 hidden sm:inline">Bot Offline</span>
                    <span className="text-amber-500 sm:hidden">Offline</span>
                  </>
                )}
                {botStatus === "unlinked" && (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground/60"></span>
                    </span>
                    <span className="text-muted-foreground hidden sm:inline">Link Bot</span>
                    <span className="text-muted-foreground sm:hidden">Link</span>
                  </>
                )}
              </Link>
            )}

            {/* Account avatar — opens AccountSheet */}
            <button
              id="account-sheet-trigger"
              aria-label="Your account"
              aria-expanded={sheetOpen}
              aria-haspopup="dialog"
              onClick={() => setSheetOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-foreground transition-all hover:bg-muted/70 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isAuthenticated && initials ? (
                <span className="text-xs">{initials}</span>
              ) : (
                <User className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </nav>

      <AccountSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  )
}
