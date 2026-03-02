"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogoutButton } from "./logout-button"
import { motion } from "motion/react"
import { Sparkles } from "lucide-react"

export default function SampleUINavigation() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-white/5 backdrop-blur-xl">
      <div className="absolute inset-0 bg-[#050510]/80 -z-10" />
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between relative">
        <Link href="/sample_ui" className="flex items-center gap-3 group">
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 10 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)] font-black text-white text-xl"
          >
            R
          </motion.div>
          <div className="flex flex-col">
            <span className="font-black tracking-tight text-xl bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Ryu Medha
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt:-1">
              <Sparkles className="w-3 h-3 text-yellow-400" /> Premium Ed.
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-bold text-indigo-200/60 hover:text-white transition-colors flex items-center gap-2">
            Exit Sandbox
          </Link>
          {pathname.startsWith("/sample_ui/dashboard") && (
            <LogoutButton />
          )}
        </div>
      </div>
    </nav>
  )
}
