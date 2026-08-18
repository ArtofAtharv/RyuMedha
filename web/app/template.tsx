"use client"

import { m } from "motion/react"

export default function RootTemplate({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="min-h-dvh"
    >
      {children}
    </m.div>
  )
}
