'use client'

import { SessionProvider } from 'next-auth/react'
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
      <SessionProvider>
        <LazyMotion features={domAnimation}>
          {children}
        </LazyMotion>
      </SessionProvider>
    </ThemeProvider>
  )
}
