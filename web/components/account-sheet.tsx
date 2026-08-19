"use client"

/**
 * AccountSheet
 *
 * Apple HIG "Sheet" pattern:
 *  • Mobile (< sm)  — slides up as a bottom sheet with a drag handle
 *  • Desktop (≥ sm) — appears as a centered dialog / modal
 *
 * Contains:
 *  - User identity card (or guest state)
 *  - Color theme accordion (expands inline, applies globally)
 *  - Light / dark mode toggle
 *  - Sign in / Sign out
 */

import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useSupabaseSession } from "@/lib/supabase-auth"
import { AnimatePresence, m } from "motion/react"
import { Check, ChevronRight, Headphones, LogIn, LogOut, Moon, User, Palette, X } from "lucide-react"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/haptic"
import Link from "next/link"

/* ─── Color theme data & logic ─────────────────────────── */

type ColorTheme = "neutral" | "violet" | "green" | "rose" | "orange" | "crimson"

const STORAGE_KEY = "ryumedha-color-theme"

const THEMES: { value: ColorTheme; label: string; bg: string; ring: string }[] = [
  { value: "neutral", label: "Neutral", bg: "bg-zinc-800 dark:bg-zinc-200", ring: "ring-zinc-800 dark:ring-zinc-200" },
  { value: "violet", label: "Purple", bg: "bg-violet-600", ring: "ring-violet-500" },
  { value: "green", label: "Green", bg: "bg-green-600", ring: "ring-green-500" },
  { value: "rose", label: "Rose", bg: "bg-rose-600", ring: "ring-rose-500" },
  { value: "orange", label: "Orange", bg: "bg-orange-500", ring: "ring-orange-400" },
  { value: "crimson", label: "Crimson", bg: "bg-[#FF4E6B]", ring: "ring-[#FF4E6B]" },
]

function applyTheme(theme: ColorTheme) {
  const root = document.documentElement
  if (theme === "neutral") {
    delete root.dataset.theme
  } else {
    root.dataset.theme = theme
  }
  localStorage.setItem(STORAGE_KEY, theme)
}

function useColorTheme() {
  const [active, setActive] = useState<ColorTheme>("neutral")

  useEffect(() => {
    let saved = (localStorage.getItem(STORAGE_KEY) as ColorTheme) ?? "neutral"
    if ((saved as string) === "blue") saved = "violet" // migrate old value
    if ((saved as string) === "red") saved = "crimson" // migrate red to crimson
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(saved)
    applyTheme(saved)
  }, [])

  function setTheme(theme: ColorTheme) {
    haptic()
    setActive(theme)
    applyTheme(theme)
  }

  return { active, setTheme }
}

/* ─── Inline color accordion ───────────────────────────── */

function ColorAccordion() {
  const { active, setTheme } = useColorTheme()
  const [open, setOpen] = useState(false)
  const currentTheme = THEMES.find((t) => t.value === active)!

  return (
    <div className="flex flex-col">
      {/* Accordion header row */}
      <button
        onClick={() => {
          haptic()
          setOpen((o) => !o)
        }}
        className="hover:bg-muted active:bg-muted/70 flex w-full items-center justify-between rounded-xl px-3 py-2.5 transition-colors"
        aria-expanded={open}
      >
        <div className="text-foreground flex items-center gap-2.5 text-sm">
          <Palette className="text-muted-foreground h-4 w-4" />
          <span>Accent colour</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Current swatch preview */}
          <span className={cn("h-3.5 w-3.5 rounded-full", currentTheme.bg)} />
          <span className="text-muted-foreground text-xs">{currentTheme.label}</span>
          <m.span
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            className="flex items-center"
          >
            <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
          </m.span>
        </div>
      </button>

      {/* Expanded swatches */}
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="swatches"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-3 pt-1 pb-2">
              <div className="flex items-center justify-between">
                {THEMES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTheme(t.value)}
                    title={t.label}
                    aria-label={`${t.label} color theme${active === t.value ? " (active)" : ""}`}
                    className={cn(
                      "group hover:bg-muted relative flex flex-col items-center gap-1.5 rounded-xl p-2 transition-colors",
                      active === t.value && "bg-muted"
                    )}
                  >
                    {/* Swatch circle */}
                    <span
                      className={cn(
                        "ring-offset-background flex h-8 w-8 items-center justify-center rounded-full transition-all",
                        t.bg,
                        active === t.value && `ring-2 ring-offset-2 ${t.ring}`
                      )}
                    >
                      {active === t.value && <Check className="h-3.5 w-3.5 text-white drop-shadow" strokeWidth={3} />}
                    </span>
                    {/* Label */}
                    <span
                      className={cn(
                        "text-[10px] leading-none font-medium",
                        active === t.value ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── helpers ─────────────────────────────────────────── */

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = globalThis.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [breakpoint])
  return isMobile
}

/* ─── types ────────────────────────────────────────────── */

interface AccountSheetProps {
  open: boolean
  onClose: () => void
  displayName?: string
}

/* ─── overlay backdrop ─────────────────────────────────── */

function Backdrop({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <m.div
      key="backdrop"
      className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      onClick={onClick}
      aria-hidden
    />
  )
}

/* ─── shared sheet content ─────────────────────────────── */

// import { useProfile } from "@/components/dashboard/profile-context"

function SheetContent({ onClose, displayName }: Readonly<{ onClose: () => void; displayName?: string }>) {
  const { session, isAuthenticated } = useSupabaseSession()
  const router = useRouter()
  const user = session?.user as any /* eslint-disable-line @typescript-eslint/no-explicit-any */

  const name = displayName || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email
  const initials = name
    ? name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : null

  return (
    <div className="flex flex-col gap-0">
      {/* ── Identity card ─────────────────────────── */}
      {isAuthenticated && user ? (
        <>
          {/* Section header row with close button on desktop */}
          <div className="flex items-center justify-between px-5 pt-4 pb-1">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-widest uppercase">Account</p>
            <button
              onClick={onClose}
              className="bg-muted text-muted-foreground hover:bg-muted/70 focus-visible:ring-ring hidden h-6 w-6 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none sm:flex"
              aria-label="Close"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <Link
            href="/dashboard/profile"
            onClick={() => {
              haptic()
              onClose()
            }}
            className="hover:bg-muted/60 active:bg-muted group mx-2 mb-2 flex items-center gap-3 rounded-xl px-4 py-3 transition-colors"
          >
            {/* Avatar */}
            <div className="bg-primary text-primary-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-semibold">
              {initials ?? <User className="h-5 w-5" />}
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1">
              <p className="text-foreground group-hover:text-primary truncate text-sm leading-tight font-semibold transition-colors">
                {name ?? "Student"}
              </p>
              {user.email && <p className="text-muted-foreground mt-0.5 truncate text-xs">{user.email}</p>}
            </div>

            {/* Chevron */}
            <ChevronRight className="text-muted-foreground group-hover:text-primary h-4 w-4 shrink-0 transition-colors" />
          </Link>
        </>
      ) : (
        <div className="flex items-center gap-3 p-5 pb-4">
          {/* Avatar */}
          <div className="bg-muted text-muted-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-semibold">
            <User className="h-5 w-5" />
          </div>

          {/* Text */}
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-sm font-semibold">Welcome</p>
            <p className="text-muted-foreground mt-0.5 text-xs">Sign in to start tracking your semester</p>
          </div>

          {/* Close — desktop only */}
          <button
            onClick={onClose}
            className="bg-muted text-muted-foreground hover:bg-muted/70 focus-visible:ring-ring hidden h-7 w-7 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none sm:flex"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <Divider />

      {/* ── Appearance ────────────────────────────── */}
      <section className="flex flex-col gap-0.5 px-2 py-3">
        <p className="text-muted-foreground px-3 pb-1 text-[11px] font-semibold tracking-widest uppercase">
          Appearance
        </p>

        {/* Color theme accordion */}
        <ColorAccordion />

        {/* Dark mode row */}
        <div className="flex items-center justify-between rounded-xl px-3 py-2.5">
          <div className="text-foreground flex items-center gap-2.5 text-sm">
            <Moon className="text-muted-foreground h-4 w-4" />
            <span>Dark mode</span>
          </div>
          <AnimatedThemeToggler />
        </div>
      </section>

      <Divider />

      {/* ── Support & Help ────────────────────────── */}
      <div className="px-2 py-2">
        <Link
          href="/support"
          onClick={() => {
            haptic()
            onClose()
          }}
          className="text-foreground hover:bg-muted active:bg-muted/70 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors"
        >
          <Headphones className="text-muted-foreground h-4 w-4" />
          Support & Help
        </Link>
      </div>

      {/* ── Auth action ───────────────────────────── */}
      <div className="px-2 py-2">
        {isAuthenticated ? (
          <button
            onClick={async () => {
              haptic()
              const { getAppClient } = await import("@/lib/supabase-client")
              const supabase = getAppClient()
              await supabase.auth.signOut()
              onClose()
              router.push("/login")
            }}
            className="text-destructive hover:bg-destructive/10 active:bg-destructive/15 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        ) : (
          <button
            onClick={() => {
              haptic()
              onClose()
              router.push("/login")
            }}
            className="text-foreground hover:bg-muted active:bg-muted/70 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors"
          >
            <LogIn className="h-4 w-4" />
            Sign In
          </button>
        )}
      </div>
    </div>
  )
}

function Divider() {
  return <div className="bg-border h-px" />
}

/* ─── Mobile — Bottom Sheet ────────────────────────────── */

const SNAP_THRESHOLD = 80 // px downward drag to dismiss

function BottomSheet({ open, onClose, displayName }: Readonly<AccountSheetProps>) {
  const [dragY, setDragY] = useState(0)
  const startY = useRef(0)
  const isDragging = useRef(false)

  const handlePointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY
    isDragging.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return
    const delta = Math.max(0, e.clientY - startY.current)
    setDragY(delta)
  }

  const handlePointerUp = () => {
    isDragging.current = false
    if (dragY > SNAP_THRESHOLD) {
      haptic()
      onClose()
    }
    setDragY(0)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) setDragY(0)
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          <Backdrop onClick={onClose} />

          <m.div
            key="bottom-sheet"
            className="border-border bg-background fixed right-0 bottom-0 left-0 z-[61] overflow-hidden rounded-t-[20px] border-t shadow-2xl"
            style={{ y: dragY, touchAction: "none" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38, mass: 0.8 }}
            role="dialog"
            aria-modal="true"
            aria-label="Your account"
          >
            {/* Drag handle */}
            <div
              className="flex cursor-grab justify-center pt-3 pb-1 active:cursor-grabbing"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <div className="bg-border h-1 w-9 rounded-full" />
            </div>

            {/* Safe-area padding at the bottom (iOS) */}
            <div className="pb-safe">
              <SheetContent onClose={onClose} displayName={displayName} />
              <div className="h-6" /> {/* extra breathing room */}
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ─── Desktop — Centered Modal ─────────────────────────── */

function Modal({ open, onClose, displayName }: Readonly<AccountSheetProps>) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    globalThis.addEventListener("keydown", handler)
    return () => globalThis.removeEventListener("keydown", handler)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <Backdrop onClick={onClose} />

          <m.div
            key="modal"
            className="border-border bg-background fixed top-1/2 left-1/2 z-[61] w-full max-w-sm overflow-hidden rounded-2xl border shadow-2xl"
            initial={{ opacity: 0, scale: 0.94, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -8 }}
            style={{ translateX: "-50%", translateY: "-50%" }}
            transition={{ type: "spring", stiffness: 400, damping: 36 }}
            role="dialog"
            aria-modal="true"
            aria-label="Your account"
          >
            <SheetContent onClose={onClose} displayName={displayName} />
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ─── Public export — adaptive wrapper ─────────────────── */

import { getAppClient } from "@/lib/supabase-client"

export function AccountSheet({ open, onClose }: Readonly<AccountSheetProps>) {
  const isMobile = useIsMobile(640)
  const [mounted, setMounted] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const { session: _session, isAuthenticated } = useSupabaseSession()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open && isAuthenticated) {
      const supabase = getAppClient()
      supabase
        .from("profiles")
        .select("display_name")
        .single()
        .then(({ data }) => {
          if (data?.display_name) {
            setDisplayName(data.display_name)
          }
        })
    }
  }, [open, isAuthenticated])

  if (!mounted) return null

  return createPortal(
    isMobile ? (
      <BottomSheet open={open} onClose={onClose} displayName={displayName} />
    ) : (
      <Modal open={open} onClose={onClose} displayName={displayName} />
    ),
    document.body
  )
}
