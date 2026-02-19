// app/dashboard/page.tsx — protected server component (session via proxy.ts)

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { ThemeSelector } from '@/components/theme-selector'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-black text-sm">
            R
          </div>
          <span className="font-bold tracking-tight">Ryu Medha</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSelector />
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-6 py-12 space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight">
            Welcome back{session.user?.name ? `, ${session.user.name}` : ''}!
          </h1>
          <p className="text-muted-foreground text-sm">📱 {session.user?.phone}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Dashboard — coming soon
          </p>
          <p className="text-sm text-muted-foreground">
            Your attendance, grades, and subjects will appear here.
            Use the WhatsApp bot to track data in the meantime.
          </p>
        </div>
      </main>
    </div>
  )
}
