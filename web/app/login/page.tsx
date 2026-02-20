'use client'

// app/login/page.tsx — theme-aware WhatsApp OTP login page

import { Suspense, useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ArrowLeft, MessageCircle, CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import { ThemeToggle } from '@/components/theme-toggle'
import { ThemeSelector } from '@/components/theme-selector'

// ─── Countdown hook ───────────────────────────────────────────────────────────
function useCountdown(seconds: number, active: boolean) {
  const [remaining, setRemaining] = useState(seconds)
  useEffect(() => {
    if (!active) { setRemaining(seconds); return }
    setRemaining(seconds)
    const id = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [active, seconds])
  return remaining
}

function fmt(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

// ─── Inner (uses useSearchParams — must be inside Suspense) ───────────────────
function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard'

  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('+91')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expiresIn, setExpiresIn] = useState(300)

  const countdown = useCountdown(expiresIn, step === 'otp')
  const expired = countdown === 0 && step === 'otp'

  async function handleRequestOTP(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to send OTP.'); return }
      setExpiresIn(data.expiresIn ?? 300)
      setStep('otp')
    } catch {
      setError('Network error. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault()
    if (otp.length !== 6) return
    setError('')
    setLoading(true)
    try {
      const result = await signIn('whatsapp-otp', {
        phone_number: phone.trim(),
        otp,
        redirect: false,
      })
      if (result?.error) { setError(result.error); setOtp(''); return }
      if (result?.ok) { router.push(callbackUrl); router.refresh() }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleBack() {
    setStep('phone'); setOtp(''); setError('')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Page content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-12">
        {/* Subtle background radial */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-1/3 h-125 w-125 -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="w-full max-w-sm space-y-6">
          {/* Brand */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground text-2xl font-black mx-auto shadow-lg">
              R
            </div>
            <h1 className="text-2xl font-black tracking-tight">Ryu Medha</h1>
            <p className="text-sm text-muted-foreground">Sign in to your dashboard</p>
          </div>

          {/* Card */}
          <Card>
            {/* ── Step 1: Phone ── */}
            {step === 'phone' && (
              <>
                <CardHeader className="space-y-1 pb-4">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    Login with WhatsApp
                  </CardTitle>
                  <CardDescription>
                    We'll send a one-time code to your WhatsApp.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRequestOTP} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">WhatsApp Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        inputMode="tel"
                        placeholder="+919876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={loading}
                        className="font-mono text-base h-11"
                        autoFocus
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Include country code, e.g. +91 for India
                      </p>
                    </div>

                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      disabled={loading || !/^\+\d{7,15}$/.test(phone.trim())}
                      className="w-full h-11 font-bold"
                    >
                      {loading
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending OTP…</>
                        : 'Send OTP'}
                    </Button>

                    <p className="text-center text-xs text-muted-foreground pt-1">
                      First time?{' '}
                      <a
                        href="https://wa.me/message/P4QSZGK7MV2PL1"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary hover:opacity-80 transition-opacity"
                      >
                        Sign up via WhatsApp bot
                      </a>
                    </p>
                  </form>
                </CardContent>
              </>
            )}

            {/* ── Step 2: OTP ── */}
            {step === 'otp' && (
              <>
                <CardHeader className="space-y-1 pb-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleBack}
                      className="p-1 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
                      aria-label="Go back"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      Enter the code
                    </CardTitle>
                  </div>
                  <CardDescription className="pl-8">
                    Sent to{' '}
                    <span className="font-semibold text-foreground">{phone}</span>
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <form onSubmit={handleVerifyOTP} className="space-y-5">
                    <div className="space-y-3">
                      <Label>6-digit code</Label>
                      <div className="flex justify-center">
                        <InputOTP
                          maxLength={6}
                          value={otp}
                          onChange={setOtp}
                          disabled={loading || expired}
                          autoFocus
                        >
                          <InputOTPGroup className="grid grid-cols-6 gap-2">
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>

                      <div className="text-center">
                        {expired ? (
                          <p className="text-sm text-destructive font-medium">
                            OTP expired —{' '}
                            <button
                              type="button"
                              onClick={handleBack}
                              className="underline hover:opacity-80"
                            >
                              request a new one
                            </button>
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Expires in{' '}
                            <span className={`font-mono font-semibold ${countdown < 60 ? 'text-destructive' : 'text-foreground'}`}>
                              {fmt(countdown)}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      disabled={loading || otp.length !== 6 || expired}
                      className="w-full h-11 font-bold"
                    >
                      {loading
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</>
                        : 'Verify & Sign In'}
                    </Button>

                    <p className="text-center text-xs text-muted-foreground">
                      Didn't receive it?{' '}
                      <button
                        type="button"
                        onClick={handleBack}
                        className="font-semibold text-primary hover:opacity-80 transition-opacity"
                      >
                        Resend OTP
                      </button>
                    </p>
                  </form>
                </CardContent>
              </>
            )}
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/" className="text-foreground hover:text-primary transition-colors">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Page export (Suspense required for useSearchParams) ──────────────────────
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  )
}
