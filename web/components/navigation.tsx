"use client"

import { ThemeSelector } from "@/components/theme-selector";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import Link from "next/dist/client/link";
import { LogoutButton } from "./logout-button";
import { usePathname } from "next/navigation";


export default function Navigation() {

  const pathname = usePathname();

  const getTargetHref = () => {
    if (pathname === "/dashboard") return "/dashboard/profile";
    return "/dashboard";
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-primary-foreground text-xs font-black shadow-md shadow-primary/30">
            R
          </div>
          <span className="font-black tracking-tight text-lg">Ryu Medha</span>
        </div>
        </Link>
        {/* Top bar — theme controls */}
        <div className="flex items-center gap-2">
        <div className="flex justify-end items-center gap-2">
          <ThemeSelector />
          <AnimatedThemeToggler />
        </div>
        {(pathname.startsWith("/dashboard")) && (
          <LogoutButton />
          )}
        </div>
      </div>
    </nav>
  );
}