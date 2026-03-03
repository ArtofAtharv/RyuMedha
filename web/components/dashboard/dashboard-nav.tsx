"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "motion/react"

import { LayoutDashboard, User, BookOpen, CheckSquare, Clock, GraduationCap } from "lucide-react"

const tabs = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Profile", href: "/dashboard/profile", icon: User },
  { label: "Subjects", href: "/dashboard/subjects", icon: BookOpen },
  { label: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
  { label: "Timers", href: "/dashboard/timers", icon: Clock },
  { label: "Grades", href: "/dashboard/grades", icon: GraduationCap },
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
    <div className="fixed bottom-0 left-0 w-full md:sticky md:top-[36px] z-40 md:pt-6 md:pb-2 md:px-4 flex justify-center pointer-events-none md:pointer-events-auto">
      <nav className="pointer-events-auto w-full sm:max-w-md md:max-w-full md:w-auto bg-card/80 dark:bg-card/60 backdrop-blur-xl border border-border/50 shadow-2xl md:shadow-sm rounded-t-4xl md:rounded-full p-2 md:p-1.5 flex items-center justify-around md:justify-center overflow-x-auto gap-1 scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeHref === tab.href
          return (
            <motion.div
              key={tab.href}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-shrink-0 md:flex-none"
            >
            <Link
              href={tab.href}
              className={`relative flex items-center justify-center md:px-4 w-12 h-12 md:w-auto md:h-auto md:py-2 rounded-full text-sm font-medium transition-all md:whitespace-nowrap ${
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
              {/* Mobile Icon */}
              <tab.icon className={`relative z-10 w-6 h-6 md:hidden ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
              
              {/* Desktop Text */}
              <span className="relative z-10 hidden md:block">{tab.label}</span>
            </Link>
            </motion.div>
          )
        })}
      </nav>
    </div>
  )
}
