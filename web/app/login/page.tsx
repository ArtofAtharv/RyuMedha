'use client'

// app/login/page.tsx — WhatsApp OTP login, Apple HIG polish

import { Suspense, useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ArrowLeft, MessageCircle, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

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
import Image from 'next/image'


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
  const [showSignupOverlay, setShowSignupOverlay] = useState(false)

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
      
      const isNotRegistered = 
        data.not_registered === true || 
        (res.status === 404 && (data.status === 'not_registered' || data.error?.toLowerCase().includes('not registered')))

      if (isNotRegistered) {
        setShowSignupOverlay(true)
        return
      }
      if (!res.ok) { setError(data.error ?? 'Failed to send OTP.'); return }
      setExpiresIn(data.expiresIn ?? 300)
      setStep('otp')
    } catch {
      setError('Network error. Please check your connection and try again.')
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
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-12">
        <div className="w-full max-w-sm space-y-6">

          {/* ── Brand ── */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="text-center space-y-3"
          >
            <div className="flex flex-col items-center gap-2.5 group transition-transform hover:scale-95">
            <Image
              src="/badge.png"
              alt="Ryu Medha"
              width={56}
              height={56}
              className="rounded-full invert dark:invert-0"
            />
            <span className="text-3xl tracking-tight font-playball">Ryu Medha</span>
          </div>
              <p className="text-sm text-muted-foreground mt-1">
                Your academics, always within reach.
              </p>
          </motion.div>

          {/* ── Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.08 }}
          >
            <Card className="overflow-hidden border-border/60 bg-background/60 backdrop-blur-xl shadow-sm">
              <AnimatePresence mode="wait">

                {/* ── Step 1: Phone ── */}
                {step === 'phone' && (
                  <motion.div
                    key="phone-step"
                    initial={{ opacity: 0, x: -18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 18 }}
                    transition={{ type: "spring", stiffness: 300, damping: 26 }}
                  >
                    <CardHeader className="space-y-1 pb-4">
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-primary" />
                        Sign in with WhatsApp
                      </CardTitle>
                      <CardDescription>
                        We'll send a 6-digit code to your WhatsApp. No password needed.
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
                            Include your country code — e.g. <span className="font-medium text-foreground">+91</span> for India.
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
                            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending code…</>
                            : 'Send Code'}
                        </Button>

                        <p className="text-center text-xs text-muted-foreground pt-1">
                          New here?{' '}
                          <a
                            href="https://wa.me/message/P4QSZGK7MV2PL1"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-primary hover:opacity-80 transition-opacity"
                          >
                            Create an account via WhatsApp →
                          </a>
                        </p>
                      </form>
                    </CardContent>
                  </motion.div>
                )}

                {/* ── Step 2: OTP ── */}
                {step === 'otp' && (
                  <motion.div
                    key="otp-step"
                    initial={{ opacity: 0, x: -18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 18 }}
                    transition={{ type: "spring", stiffness: 300, damping: 26 }}
                  >
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
                          Check your WhatsApp
                        </CardTitle>
                      </div>
                      <CardDescription className="pl-8">
                        We sent a 6-digit code to{' '}
                        <span className="font-semibold text-foreground">{phone}</span>
                      </CardDescription>
                    </CardHeader>

                    <CardContent>
                      <form onSubmit={handleVerifyOTP} className="space-y-5">
                        <div className="space-y-3">
                          <Label>Enter the 6-digit code</Label>
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
                                Code expired —{' '}
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
                                Code expires in{' '}
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
                          Didn't get it?{' '}
                          <button
                            type="button"
                            onClick={handleBack}
                            className="font-semibold text-primary hover:opacity-80 transition-opacity"
                          >
                            Resend code
                          </button>
                        </p>
                      </form>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center text-xs text-muted-foreground"
          >
            <Link href="/" className="text-foreground hover:text-primary transition-colors">
              ← Back to home
            </Link>
          </motion.p>
        </div>
      </div>

      {/* ── Signup Overlay ── */}
      {showSignupOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
          <Card className="w-full max-w-sm border-border/60 shadow-xl animate-in zoom-in-95 duration-300">
            <CardHeader className="text-center space-y-3">
              <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto">
                <MessageCircle className="h-8 w-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">Let's get you set up</CardTitle>
                <CardDescription className="text-sm mt-2 leading-relaxed">
                  Your number isn't registered yet. Start a quick chat with our WhatsApp bot to create your account — it only takes a minute.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => window.open('https://wa.me/message/P4QSZGK7MV2PL1', '_blank')}
                className="w-full h-12 text-base font-bold gap-2"
              >
                <MessageCircle className="h-5 w-5" />
                Open WhatsApp to Sign Up
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowSignupOverlay(false)}
                className="w-full h-11 text-muted-foreground"
              >
                Go back
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
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
