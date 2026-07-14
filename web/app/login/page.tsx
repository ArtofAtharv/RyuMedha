'use client'

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, m } from 'motion/react'
import { ArrowRight, Check, ChevronDown, Loader2, MessageCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp'
import Image from 'next/image'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ─── Types & Data ─────────────────────────────────────────────────────────────

type CountryOption = {
  code: string
  flag: string
  name: string
  label: string
  groups: number[]
  placeholder: string
}

const COUNTRIES: CountryOption[] = [
  { code: '91', flag: '🇮🇳', name: 'India', label: 'India', groups: [5, 5], placeholder: '98765 43210' },
  { code: '1', flag: '🇺🇸', name: 'United States', label: 'USA', groups: [3, 3, 4], placeholder: '202 555 0198' },
  { code: '44', flag: '🇬🇧', name: 'United Kingdom', label: 'UK', groups: [4, 3, 4], placeholder: '7400 123 456' },
  { code: '81', flag: '🇯🇵', name: 'Japan', label: 'Japan', groups: [2, 4, 4], placeholder: '90 1234 5678' },
  { code: '82', flag: '🇰🇷', name: 'South Korea', label: 'Korea', groups: [2, 4, 4], placeholder: '10 1234 5678' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maxDigits(country: CountryOption) {
  return country.groups.reduce((t, g) => t + g, 0)
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

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(seconds: number, active: boolean) {
  const [remaining, setRemaining] = useState(seconds)
  const ref = useRef(seconds)
  useEffect(() => { ref.current = seconds }, [seconds])
  useEffect(() => {
    if (!active) { setRemaining(ref.current); return }
    setRemaining(ref.current)
    const id = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [active])
  return remaining
}

// ─── Phone Input (bug-fixed: stores raw digits, restores cursor) ──────────────

function PhoneInput({
  digits,
  country,
  onChange,
  onBlur,
  disabled,
  hasError,
}: Readonly<{
  digits: string
  country: CountryOption
  onChange: (d: string) => void
  onBlur: () => void
  disabled: boolean
  hasError: boolean
}>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const cursorRef = useRef<number | null>(null)
  const displayed = groupDigits(digits, country.groups)

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
    const newDigits = onlyDigits(raw, maxDigits(country))
    const newFmt = groupDigits(newDigits, country.groups)

    const rawBefore = raw.slice(0, cursorPos).replace(/\D/g, '').length
    let digitsSeen = 0
    let newCursor = newFmt.length
    for (let i = 0; i < newFmt.length; i++) {
      if (newFmt[i] !== ' ') digitsSeen++
      if (digitsSeen === rawBefore) { newCursor = i + 1; break }
    }
    if (newFmt[newCursor - 1] === ' ') newCursor++

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
      className="flex-1 min-w-0 bg-transparent px-3 py-3.5 font-mono text-[17px] text-foreground outline-none placeholder:text-muted-foreground/35 disabled:opacity-50 disabled:cursor-not-allowed"
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
  const [digits, setDigits] = useState('')
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

  async function handleRequestOTP(e: React.SyntheticEvent) {
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

  async function handleVerifyOTP(e: React.SyntheticEvent) {
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
    <main className="flex items-center justify-center px-4 py-16 bg-background text-foreground min-h-[85vh]">
      <m.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-95 flex flex-col items-center gap-6"
      >
        {/* Brand block — Sleek, modern logo + name stacked */}
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
        <div className="w-full rounded-[24px] border border-border/50 bg-card/60 backdrop-blur-md shadow-xl overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {/* ── Phone step ── */}
            {step === 'phone' && (
              <m.form
                key="phone"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                onSubmit={handleRequestOTP}
                noValidate
                className="px-6 py-7 sm:px-8 sm:py-8 flex flex-col gap-5"
              >
                <div className="flex flex-col gap-1 text-center">
                  <h2 className="text-[19px] font-semibold tracking-tight text-foreground">
                    Sign In
                  </h2>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    Enter your WhatsApp number to receive a secure login code.
                  </p>
                </div>

                {/* Important WhatsApp Notice */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/5 p-3.5 flex items-start gap-3 text-left">
                  <MessageCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-[13px] leading-snug text-foreground/90">
                    <span className="font-semibold text-foreground">Important:</span> To receive your OTP, you must first message our{' '}
                    <a
                      href="https://wa.me/message/P4QSZGK7MV2PL1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary font-semibold underline underline-offset-2 hover:opacity-80 inline-flex items-center gap-0.5"
                    >
                      WhatsApp Bot
                    </a>{' '}
                    (send &ldquo;Hi&rdquo;) before clicking continue below.
                  </div>
                </div>

                {/* Phone field */}
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="phone"
                    className="text-[12px] font-medium text-muted-foreground/90 pl-0.5"
                  >
                    WhatsApp Number
                  </Label>

                  <div className={[
                    'flex items-center rounded-xl border bg-background/50 transition-all duration-200',
                    showPhoneError
                      ? 'border-destructive ring-1 ring-destructive/20'
                      : 'border-border focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15 focus-within:bg-background',
                  ].join(' ')}>
                    {/* Country picker */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild disabled={loading}>
                        <button
                          type="button"
                          className="flex items-center gap-1.5 pl-3 pr-2.5 py-3 border-r border-border/60 rounded-l-xl font-mono text-[14px] text-foreground outline-none hover:bg-muted/40 transition-colors disabled:opacity-50 disabled:pointer-events-none shrink-0"
                          aria-label="Select country"
                        >
                          <span className="text-[15px] leading-none">{country.flag}</span>
                          <span>+{country.code}</span>
                          <ChevronDown className="h-3 w-3 text-muted-foreground/80 ml-0.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48 rounded-2xl p-1.5 shadow-lg border border-border/60">
                        {COUNTRIES.map((opt) => (
                          <DropdownMenuItem
                            key={opt.code}
                            onSelect={() => handleCountryChange(opt.code)}
                            className="flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer focus:bg-primary/5 focus:text-primary"
                          >
                            <span className="text-sm leading-none">{opt.flag}</span>
                            <span className="text-sm font-medium">{opt.label}</span>
                            <span className="ml-auto font-mono text-xs text-muted-foreground">+{opt.code}</span>
                            {opt.code === countryCode && <Check className="h-3.5 w-3.5 text-primary" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Phone number input */}
                    <PhoneInput
                      digits={digits}
                      country={country}
                      onChange={(d) => { setDigits(d); if (error) setError('') }}
                      onBlur={() => setPhoneTouched(true)}
                      disabled={loading}
                      hasError={showPhoneError}
                    />
                  </div>

                  {/* Inline hint / error */}
                  <div className="min-h-4 pl-0.5">
                    {showPhoneError && (
                      <p className="text-[12px] text-destructive font-medium">{phoneValidation.message}</p>
                    )}
                    {!showPhoneError && digits && (
                      <p className="text-[12px] text-muted-foreground/90">
                        Code will be sent to {displayPhone}
                      </p>
                    )}
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive" className="rounded-xl py-2.5 border-destructive/20 bg-destructive/5">
                    <AlertDescription className="text-[13px] font-medium">{error}</AlertDescription>
                  </Alert>
                )}

                {/* CTA */}
                <Button
                  type="submit"
                  disabled={loading || !phoneValidation.valid}
                  className="h-11 w-full rounded-xl font-semibold text-[14px] shadow-sm cursor-pointer transition-all active:scale-[0.98]"
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</>
                  ) : (
                    <>Continue <ArrowRight className="ml-1.5 h-4 w-4" /></>
                  )}
                </Button>

                {/* Create account link */}
                <p className="text-center text-[13px] text-muted-foreground/90">
                  Don&apos;t have an account?{' '}
                  <a
                    href="https://wa.me/message/P4QSZGK7MV2PL1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary font-semibold hover:underline"
                  >
                    Create one
                  </a>
                </p>
              </m.form>
            )}

            {/* ── OTP step ── */}
            {step === 'otp' && (
              <m.form
                key="otp"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                onSubmit={handleVerifyOTP}
                noValidate
                className="px-6 py-7 sm:px-8 sm:py-8 flex flex-col gap-5"
              >
                <div className="flex flex-col gap-1 text-center">
                  <h2 className="text-[19px] font-semibold tracking-tight text-foreground">
                    Verify Code
                  </h2>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    Enter the 6-digit code sent to <span className="text-foreground font-semibold">{displayPhone}</span>
                  </p>
                </div>

                {/* Reminder for OTP receipt */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-2.5 text-left text-[12px] text-muted-foreground">
                  <MessageCircle className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    Didn&apos;t get the code? Ensure you sent a message to our{' '}
                    <a
                      href="https://wa.me/message/P4QSZGK7MV2PL1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary font-semibold underline underline-offset-2"
                    >
                      WhatsApp Bot
                    </a>{' '}
                    first.
                  </span>
                </div>

                {/* OTP slots */}
                <div className="flex flex-col items-center gap-2">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(v) => { setOtp(onlyDigits(v, 6)); if (error) setError('') }}
                    disabled={loading || expired}
                    onBlur={() => setOtpTouched(true)}
                    containerClassName="justify-center"
                    autoComplete="one-time-code"
                    autoFocus
                  >
                    <InputOTPGroup className="gap-2">
                      <InputOTPSlot index={0} className="h-12 w-10 sm:h-13 sm:w-11 rounded-xl border border-border/80 bg-background text-lg font-semibold transition-all duration-200" />
                      <InputOTPSlot index={1} className="h-12 w-10 sm:h-13 sm:w-11 rounded-xl border border-border/80 bg-background text-lg font-semibold transition-all duration-200" />
                      <InputOTPSlot index={2} className="h-12 w-10 sm:h-13 sm:w-11 rounded-xl border border-border/80 bg-background text-lg font-semibold transition-all duration-200" />
                    </InputOTPGroup>
                    <InputOTPSeparator className="text-muted-foreground/35 mx-0.5 shrink-0" />
                    <InputOTPGroup className="gap-2">
                      <InputOTPSlot index={3} className="h-12 w-10 sm:h-13 sm:w-11 rounded-xl border border-border/80 bg-background text-lg font-semibold transition-all duration-200" />
                      <InputOTPSlot index={4} className="h-12 w-10 sm:h-13 sm:w-11 rounded-xl border border-border/80 bg-background text-lg font-semibold transition-all duration-200" />
                      <InputOTPSlot index={5} className="h-12 w-10 sm:h-13 sm:w-11 rounded-xl border border-border/80 bg-background text-lg font-semibold transition-all duration-200" />
                    </InputOTPGroup>
                  </InputOTP>

                  {/* Timer / expired / error */}
                  <div className="min-h-4 text-center">
                    {showOtpError && (
                      <p className="text-[12px] text-destructive font-medium">Enter the 6-digit code.</p>
                    )}
                    {!showOtpError && expired && (
                      <p className="text-[12px] text-muted-foreground/90">
                        Code expired.{' '}
                        <button type="button" onClick={handleBack} className="text-primary font-semibold hover:underline">
                          Request new code
                        </button>
                      </p>
                    )}
                    {!showOtpError && !expired && (
                      <p className="text-[12px] text-muted-foreground/90">
                        Expires in{' '}
                        <span className="font-mono text-foreground font-semibold">{formatTime(countdown)}</span>
                      </p>
                    )}
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive" className="rounded-xl py-2.5 border-destructive/20 bg-destructive/5">
                    <AlertDescription className="text-[13px] font-medium">{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={loading || !otpValid || expired}
                  className="h-11 w-full rounded-xl font-semibold text-[14px] shadow-sm cursor-pointer transition-all active:scale-[0.98]"
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</>
                  ) : 'Sign in'}
                </Button>

                {/* Secondary actions */}
                <div className="flex items-center justify-between text-[13px] px-1">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="text-primary font-semibold hover:underline cursor-pointer"
                  >
                    Change number
                  </button>
                  <button
                    type="button"
                    onClick={handleBack}
                    className="text-primary font-semibold hover:underline cursor-pointer"
                  >
                    Resend code
                  </button>
                </div>
              </m.form>
            )}
          </AnimatePresence>
        </div>
      </m.div>

      {/* ── Not-registered overlay ── */}
      <AnimatePresence>
        {showSignupOverlay && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/75 backdrop-blur-xl p-5"
          >
            <m.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-85 rounded-3xl border border-border bg-card px-8 py-8 text-center shadow-2xl"
            >
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <MessageCircle className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-[19px] font-semibold tracking-tight text-foreground">
                Not registered
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                This number isn&apos;t in our system. Open WhatsApp to create your account.
              </p>
              <div className="mt-6 flex flex-col gap-2.5">
                <Button
                  onClick={() => window.open('https://wa.me/message/P4QSZGK7MV2PL1', '_blank', 'noopener,noreferrer')}
                  className="h-11 w-full rounded-xl text-[14px] font-semibold cursor-pointer"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Open WhatsApp
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowSignupOverlay(false)}
                  className="h-10 w-full rounded-xl text-[14px] text-muted-foreground cursor-pointer"
                >
                  Go back
                </Button>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
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
