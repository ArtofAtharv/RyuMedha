"use client"

import React, { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { m } from "motion/react"
import { Loader2 } from "lucide-react"
import Image from "next/image"
import { getAppClient } from "@/lib/supabase-client"
import { Alert, AlertDescription } from "@/components/ui/alert"

function LoginPageInner() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard"
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const supabase = getAppClient()

  async function handleGoogleLogin() {
    setLoading(true)
    setError("")
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(callbackUrl)}`,
          queryParams: {
            access_type: "offline",
            prompt: "select_account consent",
          },
          scopes: "https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/calendar",
        },
      })
      if (error) throw error
    } catch (err: unknown) {
      console.error(err)
      setError((err as Error).message || "Authentication failed. Please try again.")
      setLoading(false)
    }
  }

  return (
    <main className="bg-background text-foreground flex min-h-[85dvh] items-center justify-center px-4 py-16">
      <m.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex w-full max-w-md flex-col items-center gap-6"
      >
        {/* Brand block */}
        <div className="flex flex-col items-center gap-2 text-center select-none">
          <Image
            src="/badge.png"
            alt="Ryu Medha Logo"
            width={64}
            height={64}
            className="rounded-full shadow-md invert transition-all duration-300 hover:scale-105 hover:rotate-3 dark:invert-0"
            priority
          />
          <span className="text-foreground mt-1 font-serif text-3xl font-bold tracking-tight">Ryu Medha</span>
          <p className="text-muted-foreground/80 text-[13px] font-medium">Your academics, always within reach.</p>
        </div>

        {/* Card */}
        <div className="border-border/50 bg-card/60 flex w-full flex-col gap-6 overflow-hidden rounded-[24px] border p-6 text-center shadow-xl backdrop-blur-md sm:p-8">
          <div className="flex flex-col gap-1">
            <h2 className="text-foreground text-[19px] font-semibold tracking-tight">Welcome</h2>
            <p className="text-muted-foreground text-[13px] leading-relaxed">
              Sign in with your Google account to access your workspace.
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="border-destructive/20 bg-destructive/5 rounded-xl py-2.5 text-left">
              <AlertDescription className="text-[13px] font-medium">{error}</AlertDescription>
            </Alert>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="bg-primary hover:bg-primary/90 text-primary-foreground inline-flex w-full cursor-pointer items-center justify-center space-x-3 rounded-xl px-6 py-3 font-semibold shadow-md transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white">
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                </div>
                <span className="text-sm">Sign in with Google</span>
              </>
            )}
          </button>
        </div>
      </m.div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="bg-background flex items-center justify-center py-32">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </main>
      }
    >
      <LoginPageInner />
    </Suspense>
  )
}
