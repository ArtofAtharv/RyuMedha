"use client"

import { useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { User } from "lucide-react"
import { AccountSheet } from "@/components/account-sheet"

export default function Navigation() {
  const { data: session, status } = useSession()
  const [sheetOpen, setSheetOpen] = useState(false)

  const isAuthenticated = status === "authenticated"
  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : null

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="px-5 sm:px-8 lg:px-14 xl:px-20 h-14 flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group" aria-label="Ryu Medha home">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground transition-transform group-hover:scale-105">
              R
            </span>
            <span className="text-sm font-semibold tracking-tight">Ryu Medha</span>
          </Link>

          {/* Account avatar — opens AccountSheet */}
          <button
            id="account-sheet-trigger"
            aria-label="Your account"
            aria-expanded={sheetOpen}
            aria-haspopup="dialog"
            onClick={() => setSheetOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-foreground transition-all hover:bg-muted/70 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isAuthenticated && initials ? (
              <span className="text-xs">{initials}</span>
            ) : (
              <User className="h-4 w-4" />
            )}
          </button>
        </div>
      </nav>

      <AccountSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  )
}
