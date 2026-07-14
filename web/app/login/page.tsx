'use client'

import React, { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { m } from 'motion/react'
import { Loader2 } from 'lucide-react'
import Image from 'next/image'
import { getAppClient } from '@/lib/supabase-client'
import { Alert, AlertDescription } from '@/components/ui/alert'

function LoginPageInner() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = getAppClient()

  async function handleGoogleLogin() {
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(callbackUrl)}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          scopes: 'https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/calendar'
        }
      })
      if (error) throw error
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Authentication failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main className="flex items-center justify-center px-4 py-16 bg-background text-foreground min-h-[85vh]">
      <m.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md flex flex-col items-center gap-6"
      >
        {/* Brand block */}
        <div className="flex flex-col items-center gap-2 text-center select-none">
          <Image
            src="/badge.png"
            alt="Ryu Medha Logo"
            width={64}
            height={64}
            className="rounded-full invert dark:invert-0 transition-all duration-300 hover:scale-105 hover:rotate-3 shadow-md"
            priority
          />
          <span className="text-3xl font-normal tracking-tight font-playball text-foreground mt-1">
            Ryu Medha
          </span>
          <p className="text-[13px] text-muted-foreground/80 font-medium">
            Your academics, always within reach.
          </p>
        </div>

        {/* Card */}
        <div className="w-full rounded-[24px] border border-border/50 bg-card/60 backdrop-blur-md shadow-xl overflow-hidden p-6 sm:p-8 flex flex-col gap-6 text-center">
          <div className="flex flex-col gap-1">
            <h2 className="text-[19px] font-semibold tracking-tight text-foreground">
              Welcome
            </h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Sign in with your Google account to access your workspace.
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="rounded-xl py-2.5 border-destructive/20 bg-destructive/5 text-left">
              <AlertDescription className="text-[13px] font-medium">{error}</AlertDescription>
            </Alert>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full inline-flex items-center justify-center space-x-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-6 rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
                  <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.579-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 5.922 1 1 5.922 1 12s4.922 11 11.24 11c6.593 0 11-4.643 11-11.18 0-.752-.082-1.326-.183-1.883H12.24z" />
                </svg>
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
        <main className="flex items-center justify-center py-32 bg-background">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </main>
      }
    >
      <LoginPageInner />
    </Suspense>
  )
}
