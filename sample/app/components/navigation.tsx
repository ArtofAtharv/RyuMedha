"use client";
import { ThemeToggle } from "./theme";
import { AnimatePresence } from "motion/react";
import { HiUser, HiAcademicCap } from "react-icons/hi2";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
// Removed Dexie/Sync imports

export default function Navigation({ user }: { user: any }) {

  const pathname = usePathname();

  const getTargetHref = () => {
    if (!user) return "/";
    if (pathname === "/Dashboard") return "/Dashboard/UserProfile";
    return "/Dashboard";
  };
  return (
    <AnimatePresence>
      {pathname === "/" ? 
      <nav className="bg-white flex justify-between items-center dark:bg-black p-4 shadow-sm shadow-zinc-300 dark:shadow-zinc-800 sticky top-0 z-50">
        <div className="flex items-center gap-2 font-black text-xl tracking-tighter">
          <div className="w-8 h-8 bg-linear-to-br from-indigo-600 to-pink-600 rounded-lg flex items-center justify-center text-white">
            <HiAcademicCap />
          </div>
          Academics.
        </div>
        <div className="flex gap-4">
          <Link 
            href="/api/auth/signin" 
            className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-black font-bold text-sm rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg shadow-zinc-500/10"
          >
            Sign In
          </Link>
        </div>
      </nav> : (
      <nav className="bg-white flex justify-between items-center dark:bg-black p-4 shadow-sm shadow-zinc-300 dark:shadow-zinc-800 sticky top-0 z-50">
        <h1 className="text-2xl font-bold text-black dark:text-white">
          Academics Tracker
        </h1>
        <div className="flex gap-3 items-center">
          <Link href={getTargetHref()} className="p-2 rounded-full border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all">
             <HiUser />
          </Link>
          <ThemeToggle />
        </div>
      </nav>
      )}
    </AnimatePresence>
  );
}
