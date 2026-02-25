"use client"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { FaMoon, FaSun } from "react-icons/fa6";
import { AnimatePresence, motion } from "motion/react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="p-2 h-9 w-20" /> // Placeholder

  return (
    <AnimatePresence>
    <motion.button
      key={theme}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-full border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all"
    >
      {theme === "dark" ? <FaMoon className="text-white" /> : <FaSun className="text-black" />}
    </motion.button>
    </AnimatePresence>
  )
}
