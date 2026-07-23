"use client"

import React, { useState } from "react"
import { m } from "motion/react"
import { Mail, MessageCircle, Send, Headphones, CheckCircle2, Clock, Loader2, Copy, Check } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

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
        <m.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-primary/20 bg-primary/5 p-6"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4 shadow-inner">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-foreground">Message Received!</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            Thank you for reaching out. Our support team has received your message and will respond to your email as soon as possible.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setSuccess(false)}
            className="mt-6 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Send another message
          </Button>
        </m.div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-0.5">
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
              className="h-12 w-full rounded-xl border border-border/80 bg-background/60 px-4 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none transition-all duration-200 focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-0.5">
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
              className="h-12 w-full rounded-xl border border-border/80 bg-background/60 px-4 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none transition-all duration-200 focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="message" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-0.5">
              Message
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={4}
              placeholder="Enter Message"
              disabled={loading}
              className="w-full rounded-xl border border-border/80 bg-background/60 p-4 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none transition-all duration-200 focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/15 disabled:opacity-50 resize-y min-h-[110px]"
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-md transition-all duration-200 hover:bg-primary/90 hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit Form
              </>
            )}
          </button>
        </form>
      )}
    </div>
  )
}

export default function SupportPage() {
  const [copiedEmail, setCopiedEmail] = useState(false)

  function copyEmail() {
    navigator.clipboard.writeText("ryumedha@gmail.com")
    setCopiedEmail(true)
    toast.success("Email copied to clipboard!")
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  return (
    <main className="min-h-[85vh] bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      
      <div className="max-w-5xl mx-auto flex flex-col gap-12">
        {/* Header */}
        <m.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center text-center gap-3"
        >
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent">
            How can we help you?
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
            Have questions about tracking attendance, managing semesters, or experiencing issues? Send us a message or connect directly.
          </p>
        </m.div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column — Direct Contact & Info */}
          <m.div
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="lg:col-span-5 flex flex-col gap-5"
          >
            {/* Direct Email Card */}
            <div className="rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md p-6 shadow-lg flex flex-col gap-4 relative overflow-hidden group hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Direct Email</h2>
                  <p className="text-xs text-muted-foreground">Reach out to our support inbox</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3.5 py-3 border border-border/60">
                <span className="font-mono text-sm font-medium text-foreground truncate">ryumedha@gmail.com</span>
                <button
                  onClick={copyEmail}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-background text-muted-foreground hover:text-foreground shadow-sm transition-colors cursor-pointer shrink-0"
                  title="Copy email address"
                >
                  {copiedEmail ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                We typically respond to email inquiries within 24 hours on business days.
              </p>
            </div>

            {/* WhatsApp Bot Quick Help Card */}
            <div className="rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md p-6 shadow-lg flex flex-col gap-4 hover:border-green-500/40 transition-colors">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-600 dark:text-green-400">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">WhatsApp Bot</h2>
                  <p className="text-xs text-muted-foreground">Fastest way to register & verify</p>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground leading-relaxed">
                Having issues receiving your login OTP? Ensure you have sent a message to our WhatsApp bot first so we can deliver codes to your chat.
              </p>

              <a
                href="https://wa.me/message/P4QSZGK7MV2PL1"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-xs font-semibold text-white shadow transition-all hover:bg-green-700 active:scale-[0.98]"
              >
                <MessageCircle className="h-4 w-4" />
                Message WhatsApp Bot
              </a>
            </div>

            {/* Response Time Card */}
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-5 flex items-center gap-4">
              <Clock className="h-8 w-8 text-muted-foreground shrink-0" />
              <div className="text-xs">
                <p className="font-semibold text-foreground">24/7 Academic Tracking</p>
                <p className="text-muted-foreground mt-0.5">
                  Our servers actively process attendance and timers around the clock.
                </p>
              </div>
            </div>
          </m.div>

          {/* Right Column — Contact Form */}
          <m.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="lg:col-span-7 rounded-3xl border border-border/80 bg-card/80 backdrop-blur-xl p-6 sm:p-8 shadow-xl"
          >
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/60">
              <Headphones className="h-6 w-6 text-primary" />
              <div>
                <h2 className="text-lg font-bold text-foreground">Send a Message</h2>
                <p className="text-xs text-muted-foreground">Fill out the form below and our team will get in touch.</p>
              </div>
            </div>

            <Contact />
          </m.div>
        </div>
      </div>
    </main>
  )
}
