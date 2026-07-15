'use client'

import { ThemeProvider } from '@/components/theme-provider'
import { LazyMotion, domAnimation } from "motion/react"

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <LazyMotion features={domAnimation}>
        {children}
      </LazyMotion>
    </ThemeProvider>
  )
}
