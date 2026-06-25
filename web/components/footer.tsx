"use client"

import { usePathname } from "next/navigation"

export default function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/dashboard") || pathname?.startsWith("/setup")) {
    return null;
  }

  return (
    <footer className="flex items-center justify-center py-8 px-6 text-center border-t border-border">
      <p className="text-xs text-muted-foreground">© 2026 Ryu Medha — Flow of Intelligence.</p>
    </footer>
  );
}