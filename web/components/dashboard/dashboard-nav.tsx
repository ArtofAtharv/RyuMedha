"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { m } from "motion/react"

import { LayoutDashboard, BookOpen, CheckSquare, Clock, GraduationCap, MessageSquare, FolderOpen } from "lucide-react"
import { useProfile } from './profile-context'
import { haptic } from "@/lib/haptic"

export function DashboardNav() {
  const pathname = usePathname()
  const { profile, activeTrack, setActiveTrack } = useProfile()
  const isAdmin = profile?.is_admin === true

  const tabs = [
    { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { label: "Subjects", href: "/dashboard/subjects", icon: BookOpen },
    { label: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
    { label: "Timers", href: "/dashboard/timers", icon: Clock },
    { label: "Grades", href: "/dashboard/grades", icon: GraduationCap },
  ]

  if (isAdmin) {
    tabs.push({ label: "WhatsApp", href: "/dashboard/whatsapp", icon: MessageSquare })
  }

  // Match active tab — exact match for /dashboard, startsWith for sub-pages
  const activeHref = tabs.find(t =>
    t.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(t.href)
  )?.href

  return (
    <div className="fixed bottom-4 sm:bottom-6 left-0 w-full z-50 flex justify-center pointer-events-none px-4">
      <nav className="pointer-events-auto w-full sm:max-w-lg bg-card/85 backdrop-blur-2xl border border-border/50 shadow-lg shadow-black/5 dark:shadow-black/20 rounded-[28px] p-2 flex flex-col items-center gap-1.5 overflow-hidden">
        
        {/* Navigation Tabs */}
        <div className="w-full flex items-center justify-around gap-1 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeHref === tab.href
            return (
              <div
                key={tab.href}
                className="flex-shrink-0 flex-1 px-0.5"
              >
                <Link
                  href={tab.href}
                  onClick={() => haptic()}
                  className={`relative flex flex-col items-center justify-center w-full py-1.5 rounded-2xl transition-all ${isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground active:opacity-70"
                    }`}
                >
                  {isActive && (
                    <m.span
                      layoutId="dashboard-tab-bubble"
                      className="absolute inset-0 z-0 bg-primary/10 rounded-2xl"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                  <tab.icon className={`relative z-10 w-5 h-5 mb-0.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`relative z-10 text-[10px] leading-tight ${isActive ? "font-bold" : "font-medium"}`}>{tab.label}</span>
                </Link>
              </div>
            )
          })}
        </div>

      </nav>
    </div>
  )
}
