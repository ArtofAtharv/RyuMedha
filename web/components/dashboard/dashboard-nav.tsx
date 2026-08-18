"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { m } from "motion/react"

import {
  LayoutDashboard,
  BookOpen,
  CheckSquare,
  Clock,
  GraduationCap,
  CreditCard,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { useProfile } from "./profile-context"
import { haptic } from "@/lib/haptic"
import { cn } from "@/lib/utils"

export function DashboardNav({ isExpanded = true, onToggle }: { isExpanded?: boolean; onToggle?: () => void }) {
  const pathname = usePathname()
  const { profile } = useProfile()
  const isAdmin = profile?.is_admin === true

  const tabs = [
    { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { label: "Subjects", href: "/dashboard/subjects", icon: BookOpen },
    { label: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
    { label: "Timers", href: "/dashboard/timers", icon: Clock },
    { label: "Grades", href: "/dashboard/grades", icon: GraduationCap },
    { label: "Billing", href: "/dashboard/subscription", icon: CreditCard },
  ]

  if (isAdmin) {
    tabs.push({ label: "Admin", href: "/dashboard/admin", icon: ShieldCheck })
  }

  // Match active tab — exact match for /dashboard, startsWith for sub-pages
  const activeHref = tabs.find((t) =>
    t.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(t.href)
  )?.href

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside
        className={cn(
          "bg-background border-border/50 fixed top-14 left-0 z-40 hidden h-[calc(100dvh-3.5rem)] flex-col overflow-y-auto border-r transition-all duration-300 md:flex",
          isExpanded ? "w-64" : "w-[4.5rem]"
        )}
      >
        <div className="flex flex-1 flex-col space-y-2 px-3 py-6">
          {tabs.map((tab) => {
            const isActive = activeHref === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-2xl px-3 py-3 transition-all",
                  isActive
                    ? "text-primary font-bold"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground font-medium",
                  !isExpanded && "justify-center px-0"
                )}
                title={!isExpanded ? tab.label : undefined}
              >
                {isActive && (
                  <m.span
                    layoutId="dashboard-sidebar-bubble"
                    className="bg-primary/10 border-primary/10 absolute inset-0 z-0 rounded-2xl border"
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                  />
                )}
                <tab.icon
                  className={cn("relative z-10 h-5 w-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")}
                />
                {isExpanded && <span className="relative z-10 text-sm">{tab.label}</span>}
              </Link>
            )
          })}
        </div>

        {/* Sidebar Toggle Button */}
        {onToggle && (
          <div className="border-border/30 border-t p-3">
            <button
              onClick={() => {
                haptic()
                onToggle()
              }}
              className={cn(
                "text-muted-foreground hover:bg-muted/50 hover:text-foreground flex w-full items-center gap-3 rounded-xl px-3 py-2 transition-all",
                !isExpanded && "justify-center px-0"
              )}
              title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {isExpanded ? (
                <>
                  <PanelLeftClose className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-medium">Collapse</span>
                </>
              ) : (
                <PanelLeftOpen className="h-5 w-5 shrink-0" />
              )}
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Bottom Navigation (hidden on desktop) */}
      <div className="pointer-events-none fixed bottom-4 left-0 z-50 flex w-full justify-center px-4 sm:bottom-6 md:hidden">
        <nav className="bg-card/85 border-border/30 pointer-events-auto flex w-full flex-col items-center gap-1.5 overflow-hidden rounded-[28px] border p-2 shadow-lg shadow-black/5 backdrop-blur-2xl sm:max-w-lg dark:shadow-black/20">
          <div className="flex w-full scrollbar-none items-center justify-around gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = activeHref === tab.href
              return (
                <div key={tab.href} className="flex-1 flex-shrink-0 px-0.5">
                  <Link
                    href={tab.href}
                    onClick={() => haptic()}
                    className={`relative flex w-full flex-col items-center justify-center rounded-2xl py-1.5 transition-all ${
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground active:opacity-70"
                    }`}
                  >
                    {isActive && (
                      <m.span
                        layoutId="dashboard-tab-bubble"
                        className="bg-primary/10 absolute inset-0 z-0 rounded-2xl"
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                        }}
                      />
                    )}
                    <tab.icon
                      className={`relative z-10 mb-0.5 h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <span
                      className={`relative z-10 text-[10px] leading-tight ${isActive ? "font-bold" : "font-medium"}`}
                    >
                      {tab.label}
                    </span>
                  </Link>
                </div>
              )
            })}
          </div>
        </nav>
      </div>
    </>
  )
}
