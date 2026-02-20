import { ReactNode } from "react"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Secondary Dashboard Navigation */}
      <nav className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 h-12 flex items-center overflow-x-auto gap-6 text-sm font-medium">
          <Link href="/dashboard" className="px-2 py-3 hover:text-primary transition-colors text-muted-foreground focus:text-primary">
            Overview
          </Link>
          <Link href="/dashboard/profile" className="px-2 py-3 hover:text-primary transition-colors text-muted-foreground focus:text-primary">
            Profile
          </Link>
          <Link href="/dashboard/subjects" className="px-2 py-3 hover:text-primary transition-colors text-muted-foreground focus:text-primary">
            Subjects
          </Link>
          <Link href="/dashboard/tasks" className="px-2 py-3 hover:text-primary transition-colors text-muted-foreground focus:text-primary">
            Tasks
          </Link>
          <Link href="/dashboard/timers" className="px-2 py-3 hover:text-primary transition-colors text-muted-foreground focus:text-primary">
            Timers
          </Link>
          <Link href="/dashboard/grades" className="px-2 py-3 hover:text-primary transition-colors text-muted-foreground focus:text-primary">
            Grades
          </Link>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
}
