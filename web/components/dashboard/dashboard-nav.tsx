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
    <div className="pt-6 pb-2 px-4 flex justify-center w-full sticky top-0 z-40 bg-background/80 backdrop-blur-md">
      <nav className="bg-card border shadow-sm rounded-full p-1.5 flex items-center overflow-x-auto gap-1 max-w-full scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeHref === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="dashboard-tab-bubble"
                  className="absolute inset-0 z-0 gradient-accent rounded-full shadow-md"
                  transition={{
                    type: "spring",
                    bounce: 0.25,
                    duration: 0.5,
                  }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
