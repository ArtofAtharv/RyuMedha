'use client'

import { ThemeProvider } from '@/components/theme-provider'
import { MotionConfig } from "motion/react"

/**
 * NOTE: We intentionally do NOT use LazyMotion here.
 * LazyMotion creates a Suspense boundary that wraps all children in
 * `style="opacity:0"` until the motion JS bundle loads — this hides the
 * entire page body from search crawlers and Google OAuth verification bots.
 * MotionConfig is lightweight and causes no Suspense wrapping.
 */
export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <MotionConfig reducedMotion="user">
        {children}
      </MotionConfig>
    </ThemeProvider>
  )
}
