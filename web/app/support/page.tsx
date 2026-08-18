"use client"

import React, { useState } from "react"
import { Mail, MessageCircle, Send, Headphones, CheckCircle2, Clock, Loader2, Copy, Check } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { m } from "motion/react"

export function Contact() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY || "YOUR_ACCESS_KEY_HERE",
          name: e.target.name.value,
          email: e.target.email.value,
          message: e.target.message.value,
        }),
      })
      const result = await response.json()
      if (result.success) {
        console.log(result)
        setSuccess(true)
        toast.success("Message submitted successfully! We'll reach out to you shortly.")
        e.target.reset()
      } else {
        toast.error(result.message || "Something went wrong. Please try emailing us directly.")
      }
    } catch (err) {
      console.error("Form submission error:", err)
      toast.error("Network error. Please try again later or email ryumedha@gmail.com")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      {success ? (
        <div className="border-primary/20 bg-primary/5 animate-in fade-in zoom-in-95 flex flex-col items-center justify-center rounded-2xl border p-6 py-12 text-center duration-500">
          <div className="bg-primary/10 text-primary mb-4 flex h-16 w-16 items-center justify-center rounded-full shadow-inner">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h3 className="text-foreground text-xl font-bold">Message Received!</h3>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm">
            Thank you for reaching out. Our support team has received your message and will respond to your email as
            soon as possible.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setSuccess(false)}
            className="mt-6 cursor-pointer rounded-xl text-xs font-semibold"
          >
            Send another message
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-muted-foreground pl-1 text-xs font-semibold tracking-wider uppercase">
              Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              autoComplete="name"
              required
              placeholder="Your name"
              disabled={loading}
              className="border-border/50 bg-background/50 text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:bg-background/80 focus:ring-primary/10 h-12 w-full rounded-2xl border px-4 text-sm transition-all duration-200 outline-none focus:ring-4 disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-muted-foreground pl-1 text-xs font-semibold tracking-wider uppercase"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              required
              placeholder="email@example.com"
              disabled={loading}
              className="border-border/50 bg-background/50 text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:bg-background/80 focus:ring-primary/10 h-12 w-full rounded-2xl border px-4 text-sm transition-all duration-200 outline-none focus:ring-4 disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="message"
              className="text-muted-foreground pl-1 text-xs font-semibold tracking-wider uppercase"
            >
              Message
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={4}
              placeholder="Enter Message"
              disabled={loading}
              className="border-border/50 bg-background/50 text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:bg-background/80 focus:ring-primary/10 min-h-[120px] w-full resize-y rounded-2xl border p-4 text-sm transition-all duration-200 outline-none focus:ring-4 disabled:opacity-50"
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-primary-foreground shadow-primary/25 hover:bg-primary/90 mt-4 flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl text-sm font-bold shadow-lg transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                Submit Form
              </>
            )}
          </button>
        </form>
      )}
    </div>
  )
}

import { useProfile } from "@/components/dashboard/profile-context"
import { DashboardLayoutWrapper } from "@/components/dashboard/dashboard-layout-wrapper"
import { GamificationProvider } from "@/components/dashboard/gamification-context"

export default function SupportPage() {
  const [copiedEmail, setCopiedEmail] = useState(false)
  const { profile } = useProfile()

  function copyEmail() {
    navigator.clipboard.writeText("ryumedha@gmail.com")
    setCopiedEmail(true)
    toast.success("Email copied to clipboard!")
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  const content = (
    <main className="bg-background text-foreground relative min-h-[85dvh] flex-1 overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      {/* Background glow effects */}
      <div className="bg-primary/15 pointer-events-none absolute top-1/4 left-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px]" />
      <div className="pointer-events-none absolute right-0 bottom-0 -z-10 h-[500px] w-[500px] rounded-full bg-purple-500/10 blur-[140px]" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-12">
        {/* Header */}
        <div className="animate-in fade-in flex flex-col items-center gap-4 text-center duration-700">
          <h1 className="from-foreground via-foreground/90 to-muted-foreground bg-gradient-to-br bg-clip-text font-serif text-4xl font-bold tracking-tight text-transparent sm:text-6xl">
            How can we help you?
          </h1>
          <p className="text-muted-foreground max-w-xl text-sm leading-relaxed sm:text-base">
            Have questions about tracking attendance, managing semesters, or experiencing issues? Send us a message or
            connect directly.
          </p>
        </div>

        {/* Content Bento Grid */}
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Main Column — Contact Form (Left Side) */}
          <div className="flex h-full lg:col-span-7">
            <div className="border-border/40 bg-card/40 animate-in fade-in flex h-full w-full flex-col rounded-3xl border p-8 shadow-lg backdrop-blur-3xl duration-700">
              <div className="border-border/40 mb-8 flex items-center gap-4 border-b pb-6">
                <div className="bg-primary/10 text-primary flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl">
                  <Headphones className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-foreground font-serif text-2xl font-bold tracking-tight">Send a Message</h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Fill out the form below and our team will get in touch.
                  </p>
                </div>
              </div>

              <div className="flex flex-1 flex-col justify-center">
                <Contact />
              </div>
            </div>
          </div>

          {/* Side Column — Quick Help (Right Side) */}
          <div className="animate-in fade-in flex h-full flex-col gap-6 delay-100 duration-700 lg:col-span-5">
            {/* WhatsApp Bot Quick Help Card (Priority) */}
            <m.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="border-border/40 bg-card/40 flex flex-1 flex-col gap-6 rounded-3xl border p-8 shadow-lg backdrop-blur-3xl transition-all hover:border-green-500/40"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-green-500/10 text-green-600 dark:text-green-400">
                  <MessageCircle className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-foreground text-lg font-bold">WhatsApp Bot</h2>
                  <p className="text-muted-foreground text-sm">Fastest way to register & verify</p>
                </div>
              </div>

              <p className="text-muted-foreground flex-1 text-sm leading-relaxed">
                Having issues receiving your login OTP? Ensure you have sent a message to our WhatsApp bot first so we
                can deliver codes to your chat seamlessly.
              </p>

              <a
                href="https://wa.me/message/P4QSZGK7MV2PL1"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-green-600 px-6 py-4 text-sm font-bold text-white shadow-xl shadow-green-600/20 transition-all hover:bg-green-700 active:scale-[0.98]"
              >
                <MessageCircle className="h-5 w-5" />
                Message on WhatsApp
              </a>
            </m.div>

            {/* Direct Email Card */}
            <m.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="border-border/40 bg-card/40 group hover:border-primary/40 relative flex flex-col gap-5 overflow-hidden rounded-3xl border p-6 shadow-lg backdrop-blur-3xl transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-foreground text-base font-bold">Direct Email</h2>
                  <p className="text-muted-foreground text-xs">ryumedha@gmail.com</p>
                </div>
              </div>

              <div className="bg-background/50 border-border/50 flex items-center justify-between rounded-2xl border px-4 py-3">
                <span className="text-foreground truncate font-mono text-sm font-medium select-all">
                  ryumedha@gmail.com
                </span>
                <button
                  onClick={copyEmail}
                  className="bg-card text-muted-foreground hover:text-foreground flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl shadow-sm transition-colors"
                  title="Copy email address"
                >
                  {copiedEmail ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </m.div>

            {/* Response Time Card */}
            <div className="border-border/40 bg-card/40 flex items-center gap-5 rounded-3xl border p-6 shadow-lg backdrop-blur-3xl">
              <div className="bg-muted/50 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
                <Clock className="text-foreground h-6 w-6" />
              </div>
              <div>
                <p className="text-foreground text-sm font-bold">24/7 Processing</p>
                <p className="text-muted-foreground mt-1 text-xs">Servers actively track attendance and timers.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )

  if (profile) {
    return (
      <GamificationProvider>
        <DashboardLayoutWrapper subscription={{ status: "active" }}>{content}</DashboardLayoutWrapper>
      </GamificationProvider>
    )
  }

  return content
}
