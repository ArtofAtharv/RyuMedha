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
      setTimeout(() => setDisplayName(""), 0)
      setTimeout(() => setWhatsAppNumber(null), 0)
      setTimeout(() => setLastUserMessageAt(null), 0)
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

  const userMeta = session?.user as { user_metadata?: { full_name?: string; name?: string } } | undefined
  const name =
    displayName || userMeta?.user_metadata?.full_name || userMeta?.user_metadata?.name || session?.user?.email
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
      const diff = new Date(lastUserMessageAt).getTime() + 24 * 60 * 60 * 1000 - new Date().getTime()
      botStatus = diff > 0 ? "active" : "inactive"
    } else {
      botStatus = "inactive"
    }
  }

  // Only show the track toggle on pages where it actually changes what's displayed
  const trackToggleRoutes = ["/dashboard", "/dashboard/subjects"]
  const showTrackToggle = trackToggleRoutes.some((route) =>
    route === "/dashboard" ? pathname === "/dashboard" : pathname?.startsWith(route)
  )

  return (
    <>
      <nav className="border-border/60 bg-background/80 sticky top-0 z-50 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between px-4 md:px-6 lg:px-8">
          {/* Logo */}
          <Link
            href="/"
            className="group flex items-center gap-2.5 transition-transform hover:scale-95"
            aria-label="Ryu Medha home"
          >
            <Image
              src="/badge.png"
              alt="Ryu Medha"
              width={32}
              height={32}
              className="rounded-full invert dark:invert-0"
              priority
            />
            <span className="hidden font-serif text-xl font-bold tracking-tight sm:inline">Ryu Medha</span>
          </Link>

          {/* Right Action Bar */}
          <div className="flex items-center gap-3">
            {/* Track Switcher Dropdown — only shown on overview and subjects */}
            {isAuthenticated && showTrackToggle && profile && profile.academics_enabled && profile.personal_enabled && (
              <div className="relative">
                <button
                  onClick={() => {
                    haptic()
                    setIsTrackDropdownOpen(!isTrackDropdownOpen)
                  }}
                  className="border-border/50 bg-muted/20 hover:bg-muted/40 text-foreground flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all select-none hover:scale-102 active:scale-98"
                >
                  {activeTrack === "academics" ? (
                    <>
                      <BookOpen className="text-primary h-3.5 w-3.5" />
                      <span>Academics</span>
                    </>
                  ) : (
                    <>
                      <FolderOpen className="text-primary h-3.5 w-3.5" />
                      <span>Personal</span>
                    </>
                  )}
                  <ChevronDown
                    className={`text-muted-foreground h-3.5 w-3.5 transition-transform duration-200 ${isTrackDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isTrackDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsTrackDropdownOpen(false)} />
                    <div className="bg-card border-border/50 animate-in fade-in slide-in-from-top-2 absolute right-0 z-50 mt-1.5 w-36 rounded-2xl border p-1 shadow-xl duration-200">
                      <button
                        onClick={() => {
                          setActiveTrack("academics")
                          setIsTrackDropdownOpen(false)
                          haptic()
                        }}
                        className={`flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition-all ${
                          activeTrack === "academics"
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        }`}
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        Academics
                      </button>
                      <button
                        onClick={() => {
                          setActiveTrack("personal")
                          setIsTrackDropdownOpen(false)
                          haptic()
                        }}
                        className={`flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition-all ${
                          activeTrack === "personal"
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        }`}
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
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
                className="border-border/50 bg-muted/20 hover:bg-muted/40 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors select-none"
              >
                {botStatus === "active" && (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                    </span>
                    <span className="hidden text-green-500 sm:inline">Bot Active</span>
                    <span className="text-green-500 sm:hidden">Active</span>
                  </>
                )}
                {botStatus === "inactive" && (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
                    </span>
                    <span className="hidden text-amber-500 sm:inline">Bot Offline</span>
                    <span className="text-amber-500 sm:hidden">Offline</span>
                  </>
                )}
                {botStatus === "unlinked" && (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="bg-muted-foreground/60 relative inline-flex h-2 w-2 rounded-full"></span>
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
              className="border-border bg-muted text-foreground hover:bg-muted/70 focus-visible:ring-ring flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold transition-all hover:scale-105 focus-visible:ring-2 focus-visible:outline-none"
            >
              {isAuthenticated && initials ? <span className="text-xs">{initials}</span> : <User className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </nav>

      <AccountSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  )
}
