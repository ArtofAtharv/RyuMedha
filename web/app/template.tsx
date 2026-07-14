"use client"

import { m } from "motion/react"

/**
 * NOTE: We do NOT set initial={{ opacity: 0 }} here.
 * Motion renders `initial` styles during SSR, which would set
 * `style="opacity:0"` on the entire page body — hiding all content
 * from search crawlers and Google OAuth verification bots.
 *
 * The fade-in only applies on client-side route transitions via
 * `animate`. On first load, the page is immediately visible.
 */
export default function RootTemplate({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <m.div
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen"
    >
      {children}
    </m.div>
  )
}
