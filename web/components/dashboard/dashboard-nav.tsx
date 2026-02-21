"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "motion/react"

const tabs = [
  { label: "Overview", href: "/dashboard" },
  { label: "Profile", href: "/dashboard/profile" },
  { label: "Subjects", href: "/dashboard/subjects" },
  { label: "Tasks", href: "/dashboard/tasks" },
  { label: "Timers", href: "/dashboard/timers" },
  { label: "Grades", href: "/dashboard/grades" },
]

export function DashboardNav() {
  const pathname = usePathname()

  // Match active tab — exact match for /dashboard, startsWith for sub-pages
  const activeHref = tabs.find(t =>
    t.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(t.href)
  )?.href

  return (
    <nav className="border-b bg-card">
      <div className="max-w-6xl mx-auto px-6 h-12 flex items-center overflow-x-auto gap-1 text-sm font-medium">
        {tabs.map((tab) => {
          const isActive = activeHref === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative px-3 py-1.5 rounded-full transition-colors ${
                isActive
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="dashboard-tab-bubble"
                  className="absolute inset-0 z-0 gradient-accent rounded-full shadow-sm"
                  transition={{
                    type: "spring",
                    bounce: 0.2,
                    duration: 0.6,
                  }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
