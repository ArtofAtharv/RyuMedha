"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"

export default function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/dashboard") || pathname?.startsWith("/setup")) {
    return null;
  }

  return (
    <footer className="flex flex-col sm:flex-row items-center justify-between gap-4 py-8 px-6 text-center border-t border-border max-w-6xl mx-auto w-full text-xs text-muted-foreground">
      <p>© 2026 Ryu Medha. All rights reserved.</p>
      <div className="flex items-center space-x-4">
        <Link href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
        <span>•</span>
        <Link href="/terms-conditions" className="hover:text-foreground transition-colors">Terms & Conditions</Link>
      </div>
    </footer>
  );
}