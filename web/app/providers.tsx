'use client'

import { ThemeProvider } from '@/components/theme-provider'
import { LazyMotion, domAnimation } from "motion/react"
import { ProfileProvider } from '@/components/dashboard/profile-context'

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ProfileProvider>
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
    </ProfileProvider>
  )
}
