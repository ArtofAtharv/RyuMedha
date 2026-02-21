import { ReactNode } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Animated Dashboard Navigation */}
      <DashboardNav />

      {/* Main Content Area */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
}
