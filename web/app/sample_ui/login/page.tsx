'use client'

// app/login/page.tsx — theme-aware WhatsApp OTP login page

import { Suspense, useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ArrowLeft, MessageCircle, CheckCircle2, ShieldAlert } from 'lucide-react'
import { motion } from 'motion/react'

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
  const callbackUrl = searchParams.get('callbackUrl') ?? '/sample_ui/dashboard'

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
    <div className="min-h-screen bg-[#050510] flex flex-col relative font-sans text-white overflow-hidden">
      
      {/* ── Premium Background Orbs ────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden mix-blend-screen">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute left-[20%] top-[10%] h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-indigo-500/15 blur-[100px]" 
        />
        <motion.div 
          animate={{ scale: [1, 1.3, 1], rotate: [0, -90, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute right-[10%] bottom-[10%] h-[400px] w-[400px] rounded-full bg-violet-600/15 blur-[80px]" 
        />
      </div>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none"></div>

      {/* Page content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-12 z-10">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="w-full max-w-sm space-y-6"
        >
          {/* Brand */}
          <div className="text-center space-y-3">
            <motion.div 
              whileHover={{ scale: 1.1, rotate: 5 }}
              className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black mx-auto shadow-[0_0_30px_-5px_var(--color-indigo-500)]"
            >
              R
            </motion.div>
            <h1 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Ryu Medha</h1>
            <p className="text-sm font-medium text-indigo-200/60 tracking-wider uppercase">Access Your Dashboard</p>
          </div>

          {/* Card */}
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />

            {/* ── Step 1: Phone ── */}
            {step === 'phone' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="space-y-1">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                    <MessageCircle className="h-5 w-5 text-indigo-400" />
                    Login with WhatsApp
                  </h2>
                  <p className="text-sm text-indigo-200/60">
                    We'll send a one-time code to your WhatsApp.
                  </p>
                </div>
                
                <form onSubmit={handleRequestOTP} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-indigo-100/80">WhatsApp Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      placeholder="+919876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={loading}
                      className="font-mono text-base h-12 bg-black/20 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-indigo-500 rounded-xl"
                      autoFocus
                      required
                    />
                    <p className="text-xs text-indigo-200/50">
                      Include country code, e.g. +91 for India
                    </p>
                  </div>

                  {error && (
                    <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-200">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || !/^\+\d{7,15}$/.test(phone.trim())}
                    className="w-full h-12 font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98]"
                  >
                    {loading
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending OTP…</>
                      : 'Send OTP'}
                  </Button>

                  <p className="text-center text-xs text-indigo-200/50 pt-2">
                    First time?{' '}
                    <a
                      href="https://wa.me/message/P4QSZGK7MV2PL1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Sign up via WhatsApp bot
                    </a>
                  </p>
                </form>
              </motion.div>
            )}

            {/* ── Step 2: OTP ── */}
            {step === 'otp' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleBack}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-indigo-200"
                      aria-label="Go back"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                      Enter the code
                    </h2>
                  </div>
                  <p className="pl-10 text-sm text-indigo-200/60">
                    Sent to <span className="font-semibold text-white">{phone}</span>
                  </p>
                </div>

                <form onSubmit={handleVerifyOTP} className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={6}
                        value={otp}
                        onChange={setOtp}
                        disabled={loading || expired}
                        autoFocus
                      >
                        <InputOTPGroup className="flex gap-2">
                          {[0, 1, 2, 3, 4, 5].map((idx) => (
                            <InputOTPSlot 
                              key={idx} 
                              index={idx} 
                              className="w-10 h-12 text-lg font-bold bg-black/20 border-white/10 rounded-xl focus:ring-indigo-500 text-white" 
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>

                    <div className="text-center">
                      {expired ? (
                        <p className="text-sm text-red-400 font-medium bg-red-500/10 py-1.5 rounded-lg border border-red-500/20 inline-block px-3">
                          Code expired —{' '}
                          <button
                            type="button"
                            onClick={handleBack}
                            className="underline hover:text-red-300"
                          >
                            request a new one
                          </button>
                        </p>
                      ) : (
                        <p className="text-sm font-medium text-indigo-200/70 bg-indigo-500/10 py-1.5 px-3 rounded-lg border border-indigo-500/20 inline-block">
                          Expires in{' '}
                          <span className={`font-mono font-bold ${countdown < 60 ? 'text-red-400' : 'text-indigo-300'}`}>
                            {fmt(countdown)}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  {error && (
                    <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-200">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || otp.length !== 6 || expired}
                    className="w-full h-12 font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98]"
                  >
                    {loading
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</>
                      : 'Verify & Enter'}
                  </Button>

                  <p className="text-center text-xs text-indigo-200/50">
                    Didn't receive it?{' '}
                    <button
                      type="button"
                      onClick={handleBack}
                      className="font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Resend code
                    </button>
                  </p>
                </form>
              </motion.div>
            )}
          </div>

          <p className="text-center text-sm font-medium">
            <Link href="/sample_ui" className="text-indigo-200/60 hover:text-indigo-300 transition-colors">
              ← Return to landing page
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Signup Overlay */}
      {showSignupOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm bg-[#101018] border border-white/10 shadow-2xl rounded-3xl p-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            
            <div className="text-center space-y-3 mb-6 relative z-10">
              <div className="w-16 h-16 bg-purple-500/10 border border-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <ShieldAlert className="h-8 w-8 text-purple-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Access Denied</h2>
              <p className="text-sm text-indigo-200/70">
                You need to register your profile via our WhatsApp bot before accessing the premium dashboard.
              </p>
            </div>
            
            <div className="space-y-3 relative z-10">
              <Button 
                onClick={() => window.open('https://wa.me/message/P4QSZGK7MV2PL1', '_blank')}
                className="w-full h-12 text-base font-bold gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl border-0 shadow-lg shadow-purple-500/25"
              >
                <MessageCircle className="h-5 w-5" />
                Register on WhatsApp
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setShowSignupOverlay(false)}
                className="w-full h-11 text-indigo-200/50 hover:text-white hover:bg-white/5 rounded-xl"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
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
