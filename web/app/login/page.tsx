'use client'

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, ChevronDown, Loader2, MessageCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type CountryOption = {
  code: string
  flag: string
  name: string
  label: string
  groups: number[]
  placeholder: string
}

const COUNTRIES: CountryOption[] = [
  { code: '91',  flag: '🇮🇳', name: 'India',         label: 'India', groups: [5, 5],      placeholder: '98765 43210' },
  { code: '1',   flag: '🇺🇸', name: 'United States', label: 'USA',   groups: [3, 3, 4],   placeholder: '202 555 0198' },
  { code: '44',  flag: '🇬🇧', name: 'United Kingdom',label: 'UK',    groups: [4, 3, 4],   placeholder: '7400 123 456' },
  { code: '81',  flag: '🇯🇵', name: 'Japan',         label: 'Japan', groups: [2, 4, 4],   placeholder: '90 1234 5678' },
  { code: '82',  flag: '🇰🇷', name: 'South Korea',   label: 'Korea', groups: [2, 4, 4],   placeholder: '10 1234 5678' },
]

function useCountdown(seconds: number, active: boolean) {
  const [remaining, setRemaining] = useState(seconds)
  const secondsRef = useRef(seconds)

  useEffect(() => { secondsRef.current = seconds }, [seconds])

  useEffect(() => {
    if (!active) { setRemaining(secondsRef.current); return }
    setRemaining(secondsRef.current)
    const id = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [active])

  return remaining
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  return `${m}:${(seconds % 60).toString().padStart(2, '0')}`
}

function onlyDigits(value: string, max = 15) {
  return value.replace(/\D/g, '').slice(0, max)
}

function groupDigits(value: string, groups: number[]) {
  const parts: string[] = []
  let i = 0
  for (const size of groups) {
    if (i >= value.length) break
    parts.push(value.slice(i, i + size))
    i += size
  }
  if (i < value.length) parts.push(value.slice(i))
  return parts.filter(Boolean).join(' ')
}

function getCountry(code: string) {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0]
}

function maxDigits(country: CountryOption) {
  return country.groups.reduce((t, g) => t + g, 0)
}

function getPhoneValidation(country: CountryOption, digits: string) {
  const expected = maxDigits(country)
  const compact = `+${country.code}${digits}`
  const total = country.code.length + digits.length
  if (!digits) return { compact, valid: false, message: 'Enter your WhatsApp number.' }
  if (digits.length < 6) return { compact, valid: false, message: 'Enter the full number.' }
  if (digits.length !== expected) return { compact, valid: false, message: `${expected} digits required for ${country.name}.` }
  if (total < 8 || total > 15) return { compact, valid: false, message: 'Use a valid international phone number.' }
  if (/^(\d)\1+$/.test(digits)) return { compact, valid: false, message: 'Use a real WhatsApp number.' }
  return { compact, valid: true, message: '' }
}

// ─── Phone Input ─────────────────────────────────────────────────────────────
// BUG FIX: Store raw digits only. Format for display, but never store spaces.
// Previously localPhone stored the formatted string with spaces, so backspacing
// mid-string would delete a space (no visible change) causing erratic edits.

function PhoneInput({
  digits,          // raw digits, no spaces
  country,
  onChange,
  onBlur,
  disabled,
  hasError,
}: {
  digits: string
  country: CountryOption
  onChange: (digits: string) => void
  onBlur: () => void
  disabled: boolean
  hasError: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  // Display value: formatted with spaces
  const displayed = groupDigits(digits, country.groups)
  // We track cursor so we can restore it after React re-render
  const cursorRef = useRef<number | null>(null)

  useEffect(() => {
    const el = inputRef.current
    if (el && cursorRef.current !== null) {
      el.setSelectionRange(cursorRef.current, cursorRef.current)
      cursorRef.current = null
    }
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    const cursorPos = e.target.selectionStart ?? raw.length

    // Extract only digits from what was typed
    const newDigits = onlyDigits(raw, maxDigits(country))
    // Re-format so we can compute correct cursor position
    const newFormatted = groupDigits(newDigits, country.groups)

    // Map cursor from raw input position to formatted position:
    // count digits before cursor in raw, then find same digit-count position in formatted
    const rawBefore = raw.slice(0, cursorPos).replace(/\D/g, '').length
    let digitsSeen = 0
    let newCursor = newFormatted.length
    for (let i = 0; i < newFormatted.length; i++) {
      if (newFormatted[i] !== ' ') digitsSeen++
      if (digitsSeen === rawBefore) { newCursor = i + 1; break }
    }
    // If cursor is right after a space, nudge it forward
    if (newFormatted[newCursor - 1] === ' ') newCursor++

    cursorRef.current = newCursor
    onChange(newDigits)
  }

  return (
    <input
      ref={inputRef}
      id="phone"
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      placeholder={country.placeholder}
      value={displayed}
      onChange={handleChange}
      onBlur={onBlur}
      disabled={disabled}
      aria-invalid={hasError || undefined}
      autoFocus
      className={[
        'h-14 flex-1 min-w-0 bg-transparent px-4 font-mono text-[18px] outline-none',
        'placeholder:text-muted-foreground/40',
        'disabled:opacity-50 disabled:cursor-not-allowed',
      ].join(' ')}
    />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard'

  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [countryCode, setCountryCode] = useState('91')
  const [digits, setDigits] = useState('')        // raw digits only — the fix
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expiresIn, setExpiresIn] = useState(300)
  const [showSignupOverlay, setShowSignupOverlay] = useState(false)
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [otpTouched, setOtpTouched] = useState(false)

  const country = useMemo(() => getCountry(countryCode), [countryCode])
  const phoneValidation = getPhoneValidation(country, digits)
  const displayPhone = `+${country.code} ${groupDigits(digits, country.groups)}`.trim()
  const countdown = useCountdown(expiresIn, step === 'otp')
  const expired = countdown === 0 && step === 'otp'
  const otpValid = /^\d{6}$/.test(otp)
  const showPhoneError = phoneTouched && !phoneValidation.valid
  const showOtpError = otpTouched && otp.length > 0 && !otpValid

  function handleCountryChange(code: string) {
    const next = getCountry(code)
    setCountryCode(code)
    setDigits((d) => d.slice(0, maxDigits(next)))
    setPhoneTouched(false)
    setError('')
  }

  async function handleRequestOTP(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setPhoneTouched(true)
    if (!phoneValidation.valid) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneValidation.compact }),
      })
      const data = await res.json()
      const isNotRegistered =
        data.not_registered === true ||
        (res.status === 404 && (data.status === 'not_registered' || data.error?.toLowerCase().includes('not registered')))
      if (isNotRegistered) { setShowSignupOverlay(true); return }
      if (!res.ok) { setError(data.error ?? 'Failed to send code.'); return }
      setExpiresIn(data.expiresIn ?? 300)
      setStep('otp')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault()
    setOtpTouched(true)
    if (!otpValid) return
    setError('')
    setLoading(true)
    try {
      const result = await signIn('whatsapp-otp', { phone_number: phoneValidation.compact, otp, redirect: false })
      if (result?.error) { setError(result.error); setOtp(''); setOtpTouched(false); return }
      if (result?.ok) { router.push(callbackUrl); router.refresh() }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleBack() {
    setStep('phone')
    setOtp('')
    setError('')
    setOtpTouched(false)
  }

  return (
    <main className="min-h-[calc(100vh-73px)] bg-background text-foreground flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px] space-y-6">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-3 pb-2"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-primary text-primary-foreground text-lg font-bold shadow-md shadow-primary/20">
            R
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground/70">Ryu Medha</span>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.04 }}
          className="rounded-3xl border border-border/60 bg-card shadow-xl shadow-black/[0.06] dark:shadow-black/20 overflow-hidden"
        >
          <AnimatePresence mode="wait" initial={false}>
            {step === 'phone' ? (
              <motion.form
                key="phone"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                onSubmit={handleRequestOTP}
                noValidate
                className="p-7 space-y-5"
              >
                <div className="space-y-1">
                  <h1 className="text-[22px] font-semibold tracking-tight leading-tight">Sign in</h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Enter your WhatsApp number to continue.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    WhatsApp number
                  </Label>
                  <div
                    className={[
                      'flex items-center rounded-2xl border bg-background/60 dark:bg-input/20 transition-all duration-150',
                      showPhoneError
                        ? 'border-destructive ring-1 ring-destructive/30'
                        : 'border-border/70 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10',
                    ].join(' ')}
                  >
                    {/* Country picker */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild disabled={loading}>
                        <button
                          type="button"
                          className="flex h-14 items-center gap-1.5 pl-4 pr-3 border-r border-border/60 rounded-l-2xl font-mono text-sm outline-none hover:bg-muted/30 transition-colors disabled:opacity-50 disabled:pointer-events-none shrink-0"
                        >
                          <span className="text-[17px] leading-none">{country.flag}</span>
                          <span className="text-foreground/80">+{country.code}</span>
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-52 rounded-2xl p-1.5">
                        {COUNTRIES.map((opt) => (
                          <DropdownMenuItem
                            key={opt.code}
                            onSelect={() => handleCountryChange(opt.code)}
                            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer"
                          >
                            <span className="text-base leading-none">{opt.flag}</span>
                            <span className="font-medium text-sm">{opt.label}</span>
                            <span className="ml-auto font-mono text-xs text-muted-foreground">+{opt.code}</span>
                            {opt.code === countryCode && <Check className="h-3.5 w-3.5 text-primary" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Fixed phone input — stores only raw digits */}
                    <PhoneInput
                      digits={digits}
                      country={country}
                      onChange={(d) => { setDigits(d); if (error) setError('') }}
                      onBlur={() => setPhoneTouched(true)}
                      disabled={loading}
                      hasError={showPhoneError}
                    />
                  </div>

                  <div className="h-4">
                    {showPhoneError ? (
                      <p className="text-xs text-destructive">{phoneValidation.message}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {digits ? `We'll send a code to ${displayPhone}` : 'Your registered WhatsApp number'}
                      </p>
                    )}
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive" className="rounded-xl py-3">
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={loading || !phoneValidation.valid}
                  className="h-12 w-full rounded-full font-semibold text-[15px] shadow-sm shadow-primary/15"
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</>
                  ) : (
                    <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  New here?{' '}
                  <a
                    href="https://wa.me/message/P4QSZGK7MV2PL1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    Create account
                  </a>
                </p>
              </motion.form>
            ) : (
              <motion.form
                key="otp"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                onSubmit={handleVerifyOTP}
                noValidate
                className="p-7 space-y-5"
              >
                <div className="space-y-1">
                  <h1 className="text-[22px] font-semibold tracking-tight leading-tight">Check WhatsApp</h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We sent a 6-digit code to{' '}
                    <span className="font-medium text-foreground">{displayPhone}</span>.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Verification code
                  </Label>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={otp}
                      onChange={(v) => { setOtp(onlyDigits(v, 6)); if (error) setError('') }}
                      disabled={loading || expired}
                      onBlur={() => setOtpTouched(true)}
                      autoFocus
                    >
                      <InputOTPGroup className="grid grid-cols-6 gap-2">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <InputOTPSlot
                            key={i}
                            index={i}
                            className="h-12 w-full rounded-xl border-border/70 bg-background/70 text-base dark:bg-input/20"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <div className="h-4 text-center">
                    {showOtpError ? (
                      <p className="text-xs text-destructive">Enter the 6-digit code.</p>
                    ) : expired ? (
                      <span className="text-xs text-muted-foreground">
                        Code expired.{' '}
                        <button type="button" onClick={handleBack} className="text-primary font-medium hover:underline">
                          Request another
                        </button>
                      </span>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Expires in{' '}
                        <span className="font-mono font-medium text-foreground">{formatTime(countdown)}</span>
                      </p>
                    )}
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive" className="rounded-xl py-3">
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={loading || !otpValid || expired}
                  className="h-12 w-full rounded-full font-semibold text-[15px] shadow-sm shadow-primary/15"
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</>
                  ) : 'Sign in'}
                </Button>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ← Change number
                  </button>
                  <button
                    type="button"
                    onClick={handleBack}
                    className="font-medium text-primary hover:underline"
                  >
                    Resend code
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-center text-xs text-muted-foreground/60"
        >
          Your academic workspace by Ryu Medha
        </motion.p>
      </div>

      {/* Signup overlay */}
      <AnimatePresence>
        {showSignupOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xl p-5"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm rounded-3xl border border-border bg-card p-7 text-center shadow-2xl shadow-foreground/5"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <MessageCircle className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">Not registered yet</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                This number isn't in our system. Start a quick WhatsApp chat to create your account.
              </p>
              <div className="mt-6 space-y-2.5">
                <Button
                  onClick={() => window.open('https://wa.me/message/P4QSZGK7MV2PL1', '_blank')}
                  className="h-12 w-full rounded-full text-sm font-semibold"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Open WhatsApp
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowSignupOverlay(false)}
                  className="h-11 w-full rounded-full text-sm"
                >
                  Go back
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </main>
      }
    >
      <LoginPageInner />
    </Suspense>
  )
}
