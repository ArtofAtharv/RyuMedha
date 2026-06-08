'use client'

import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, ChevronDown, Loader2, MessageCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'
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
  { code: '91', flag: '🇮🇳', name: 'India', label: 'India', groups: [5, 5], placeholder: '98765 43210' },
  { code: '1', flag: '🇺🇸', name: 'United States', label: 'USA', groups: [3, 3, 4], placeholder: '202 555 0198' },
  { code: '44', flag: '🇬🇧', name: 'United Kingdom', label: 'UK', groups: [4, 3, 4], placeholder: '7400 123 456' },
  { code: '81', flag: '🇯🇵', name: 'Japan', label: 'Japan', groups: [2, 4, 4], placeholder: '90 1234 5678' },
  { code: '82', flag: '🇰🇷', name: 'South Korea', label: 'Korea', groups: [2, 4, 4], placeholder: '10 1234 5678' },
]

function useCountdown(seconds: number, active: boolean) {
  const [remaining, setRemaining] = useState(seconds)
  const secondsRef = React.useRef(seconds)

  useEffect(() => {
    secondsRef.current = seconds
  }, [seconds])

  useEffect(() => {
    if (!active) {
      setRemaining(secondsRef.current)
      return
    }

    setRemaining(secondsRef.current)
    const id = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [active])

  return remaining
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`
}

function onlyDigits(value: string, max = 15) {
  return value.replace(/\D/g, '').slice(0, max)
}

function groupDigits(value: string, groups: number[]) {
  const parts: string[] = []
  let index = 0

  for (const size of groups) {
    if (index >= value.length) break
    parts.push(value.slice(index, index + size))
    index += size
  }

  if (index < value.length) parts.push(value.slice(index))
  return parts.filter(Boolean).join(' ')
}

function getCountry(code: string) {
  return COUNTRIES.find((country) => country.code === code) ?? COUNTRIES[0]
}

function getPhoneValidation(country: CountryOption, localDigits: string) {
  const expectedLength = country.groups.reduce((total, group) => total + group, 0)
  const compact = `+${country.code}${localDigits}`
  const totalDigits = country.code.length + localDigits.length

  if (!localDigits) return { compact, valid: false, message: 'Enter your WhatsApp number.' }
  if (localDigits.length < 6) return { compact, valid: false, message: 'Enter the full number.' }
  if (localDigits.length !== expectedLength) {
    return {
      compact,
      valid: false,
      message: `Enter ${expectedLength} digits for ${country.name}.`,
    }
  }
  if (totalDigits < 8 || totalDigits > 15) {
    return { compact, valid: false, message: 'Use a valid international phone number.' }
  }
  if (/^(\d)\1+$/.test(localDigits)) {
    return { compact, valid: false, message: 'Use a real WhatsApp number.' }
  }

  return { compact, valid: true, message: '' }
}

function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span className={`flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-sm shadow-primary/20 ${className}`}>
      R
    </span>
  )
}

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard'

  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [countryCode, setCountryCode] = useState('91')
  const [localPhone, setLocalPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expiresIn, setExpiresIn] = useState(300)
  const [showSignupOverlay, setShowSignupOverlay] = useState(false)
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [otpTouched, setOtpTouched] = useState(false)

  const country = useMemo(() => getCountry(countryCode), [countryCode])
  const localDigits = onlyDigits(localPhone, country.groups.reduce((total, group) => total + group, 0))
  const formattedLocalPhone = groupDigits(localDigits, country.groups)
  const phoneValidation = getPhoneValidation(country, localDigits)
  const displayPhone = `+${country.code} ${formattedLocalPhone}`.trim()
  const countdown = useCountdown(expiresIn, step === 'otp')
  const expired = countdown === 0 && step === 'otp'
  const otpValid = /^\d{6}$/.test(otp)
  const showPhoneError = phoneTouched && !phoneValidation.valid
  const showOtpError = otpTouched && otp.length > 0 && !otpValid

  function handleCountryChange(value: string) {
    const nextCountry = getCountry(value)
    const maxLength = nextCountry.groups.reduce((total, group) => total + group, 0)
    setCountryCode(value)
    setLocalPhone(groupDigits(onlyDigits(localPhone, maxLength), nextCountry.groups))
    setPhoneTouched(false)
    setError('')
  }

  function handleLocalPhoneChange(value: string) {
    const maxLength = country.groups.reduce((total, group) => total + group, 0)
    setLocalPhone(groupDigits(onlyDigits(value, maxLength), country.groups))
    if (error) setError('')
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
        (res.status === 404 &&
          (data.status === 'not_registered' ||
            data.error?.toLowerCase().includes('not registered')))

      if (isNotRegistered) {
        setShowSignupOverlay(true)
        return
      }

      if (!res.ok) {
        setError(data.error ?? 'Failed to send code.')
        return
      }

      setExpiresIn(data.expiresIn ?? 300)
      setStep('otp')
    } catch (_err) {
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
      const result = await signIn('whatsapp-otp', {
        phone_number: phoneValidation.compact,
        otp,
        redirect: false,
      })

      if (result?.error) {
        setError(result.error)
        setOtp('')
        setOtpTouched(false)
        return
      }

      if (result?.ok) {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch (_err) {
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
    <main className="relative min-h-[calc(100vh-73px)] overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/8 to-transparent" />

      <section className="relative mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-5xl items-center justify-center px-5 py-12 sm:px-8 lg:py-16">
        <div className="grid w-full items-center gap-14 lg:grid-cols-[minmax(0,1fr)_392px] lg:gap-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 30 }}
            className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left"
          >
            <div className="mb-8 flex items-center justify-center gap-2.5 lg:justify-start">
              <BrandMark />
              <span className="text-sm font-semibold tracking-tight">Ryu Medha</span>
            </div>
            <h1 className="text-5xl font-semibold leading-[1.04] tracking-tight text-balance sm:text-6xl">
              Sign in to <span className="text-primary">Ryu Medha</span>.
            </h1>
            <p className="mx-auto mt-5 max-w-md text-base leading-7 text-muted-foreground sm:text-lg lg:mx-0">
              Your academic workspace, unlocked with one WhatsApp code.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 30, delay: 0.05 }}
            className="mx-auto w-full max-w-[390px]"
          >
            <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6 shadow-2xl shadow-foreground/5 backdrop-blur-xl dark:bg-card/70 dark:shadow-black/25 sm:p-8">
              <AnimatePresence mode="wait">
                {step === 'phone' && (
                  <motion.form
                    key="phone-step"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    onSubmit={handleRequestOTP}
                    className="space-y-6"
                    noValidate
                  >
                    <div className="space-y-3 text-center">
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/80 text-primary shadow-sm">
                        <MessageCircle className="h-5 w-5" />
                      </div>
                      <h2 className="text-[28px] font-semibold leading-tight tracking-tight">
                        Enter your WhatsApp number.
                      </h2>
                    </div>

                    <div className="space-y-2.5">
                      <Label htmlFor="phone" className="sr-only">
                        WhatsApp number
                      </Label>
                      <div
                        className={`grid grid-cols-[116px_minmax(0,1fr)] overflow-visible rounded-2xl border bg-background/80 shadow-inner shadow-foreground/[0.025] transition-colors dark:bg-input/20 ${
                          showPhoneError ? 'border-destructive' : 'border-border/80 focus-within:border-ring'
                        }`}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild disabled={loading}>
                            <button
                              type="button"
                              className="flex h-14 w-full items-center justify-between gap-2 rounded-l-2xl border-r border-border/70 bg-transparent px-3 text-left font-mono text-[15px] outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary/25 disabled:pointer-events-none disabled:opacity-50"
                              aria-label="Select country code"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="text-base leading-none">{country.flag}</span>
                                <span>+{country.code}</span>
                              </span>
                              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56 rounded-2xl p-1.5">
                            {COUNTRIES.map((option) => (
                              <DropdownMenuItem
                                key={option.code}
                                onSelect={() => handleCountryChange(option.code)}
                                className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5"
                              >
                                <span className="text-base leading-none">{option.flag}</span>
                                <span className="font-medium">{option.label}</span>
                                <span className="ml-auto font-mono text-xs text-muted-foreground">
                                  +{option.code}
                                </span>
                                {option.code === countryCode && (
                                  <Check className="ml-1 h-4 w-4 text-primary" />
                                )}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Input
                          id="phone"
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          placeholder={country.placeholder}
                          value={formattedLocalPhone}
                          onChange={(e) => handleLocalPhoneChange(e.target.value)}
                          onBlur={() => setPhoneTouched(true)}
                          disabled={loading}
                          aria-invalid={showPhoneError || undefined}
                          aria-describedby={showPhoneError ? 'phone-error' : undefined}
                          className="h-14 rounded-none border-0 bg-transparent px-4 text-left font-mono text-[18px] shadow-none placeholder:text-muted-foreground/45 focus-visible:ring-0 dark:bg-transparent"
                          autoFocus
                          required
                        />
                      </div>
                      <div className="min-h-5 text-center">
                        {showPhoneError ? (
                          <p id="phone-error" className="text-xs font-medium text-destructive">
                            {phoneValidation.message}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            We will send the code to {displayPhone || `+${country.code}`}.
                          </p>
                        )}
                      </div>
                    </div>

                    {error && (
                      <Alert variant="destructive" className="rounded-xl">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      disabled={loading || !phoneValidation.valid}
                      className="h-12 w-full rounded-full text-[15px] font-semibold shadow-sm shadow-primary/15"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending
                        </>
                      ) : (
                        <>
                          Continue
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
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
                        Create an account
                      </a>
                    </p>
                  </motion.form>
                )}

                {step === 'otp' && (
                  <motion.form
                    key="otp-step"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    onSubmit={handleVerifyOTP}
                    className="space-y-6"
                    noValidate
                  >
                    <div className="space-y-3 text-center">
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/80 text-primary shadow-sm">
                        <MessageCircle className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Sent to {displayPhone}
                      </p>
                      <h2 className="text-[28px] font-semibold leading-tight tracking-tight">
                        Enter the code.
                      </h2>
                    </div>

                    <div className="space-y-3">
                      <Label className="sr-only">Verification code</Label>
                      <div className="flex justify-center">
                        <InputOTP
                          maxLength={6}
                          value={otp}
                          onChange={(value) => {
                            setOtp(onlyDigits(value, 6))
                            if (error) setError('')
                          }}
                          disabled={loading || expired}
                          onBlur={() => setOtpTouched(true)}
                          autoFocus
                        >
                          <InputOTPGroup className="grid grid-cols-6 gap-2">
                            {[0, 1, 2, 3, 4, 5].map((index) => (
                              <InputOTPSlot
                                key={index}
                                index={index}
                                className="h-12 w-10 rounded-xl border-border/80 bg-background/80 text-base shadow-inner shadow-foreground/[0.025] dark:bg-input/20 sm:w-11"
                              />
                            ))}
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <div className="min-h-5 text-center">
                        {showOtpError ? (
                          <p className="text-xs font-medium text-destructive">
                            Enter the 6-digit code.
                          </p>
                        ) : expired ? (
                          <>
                            <span className="text-sm text-muted-foreground">Code expired. </span>
                            <button
                              type="button"
                              onClick={handleBack}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              Request another
                            </button>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Expires in{' '}
                            <span className="font-mono font-medium text-foreground">
                              {formatTime(countdown)}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    {error && (
                      <Alert variant="destructive" className="rounded-xl">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      disabled={loading || !otpValid || expired}
                      className="h-12 w-full rounded-full text-[15px] font-semibold shadow-sm shadow-primary/15"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying
                        </>
                      ) : (
                        'Sign in'
                      )}
                    </Button>

                    <button
                      type="button"
                      onClick={handleBack}
                      className="mx-auto block w-fit text-sm font-medium text-primary hover:underline"
                    >
                      Resend code
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </section>

      {showSignupOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-5 backdrop-blur-xl">
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-sm rounded-[1.65rem] border border-border bg-card p-6 text-center shadow-lg"
          >
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-[#25d366]/10 text-[#128c4a]">
              <MessageCircle className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Create your account</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              This number is not registered yet. Start a quick WhatsApp chat to set it up.
            </p>
            <div className="mt-6 space-y-3">
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
                className="h-11 w-full rounded-full text-sm font-medium"
              >
                Back
              </Button>
            </div>
          </motion.div>
        </div>
      )}
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
