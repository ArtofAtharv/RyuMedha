"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"

export default function Footer() {
  const pathname = usePathname()
  if (pathname?.startsWith("/dashboard") || pathname?.startsWith("/setup")) {
    return null
  }

  return (
    <footer className="border-border text-muted-foreground mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 border-t px-6 py-8 text-center text-xs sm:flex-row">
      <p>© 2026 Ryu Medha — Flow of Intelligence.</p>
      <div className="flex items-center space-x-4">
        <Link href="/privacy-policy" className="hover:text-foreground transition-colors">
          Privacy Policy
        </Link>
        <span>•</span>
        <Link href="/terms-conditions" className="hover:text-foreground transition-colors">
          Terms & Conditions
        </Link>
      </div>
    </footer>
  )
}
