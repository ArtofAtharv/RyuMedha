"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getAppClient } from "@/lib/supabase-client"
import { PageHeader } from "@/components/dashboard/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Sparkles, CheckCircle2, AlertTriangle, ShieldCheck, 
  CreditCard, Loader2, ArrowRight, RefreshCw, Clock
} from "lucide-react"
import { toast } from "sonner"
import { m } from "motion/react"

interface Subscription {
  id?: string
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'
  plan_type?: 'monthly' | 'yearly' | null
  trial_start?: string | null
  trial_end?: string | null
  current_period_end?: string | null
  scheduled_deletion_at?: string | null
}

export default function SubscriptionPage() {
  const router = useRouter()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly')
  const [processingPay, setProcessingPay] = useState(false)

  const fetchSubscription = async () => {
    try {
      const supabase = getAppClient()
      const { data: profile } = await supabase.from('profiles').select('id').single()
      if (profile) {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('profile_id', profile.id)
          .single()
        if (sub) {
          setSubscription(sub as Subscription)
          if (sub.plan_type) setSelectedPlan(sub.plan_type as 'monthly' | 'yearly')
        }
      }
    } catch (err) {
      console.error("Error fetching subscription:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubscription()
  }, [])

  const handleSubscribe = async () => {
    setProcessingPay(true)
    try {
      const res = await fetch('/api/razorpay/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planType: selectedPlan })
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        toast.error(data.error || 'Failed to create Razorpay subscription')
        setProcessingPay(false)
        return
      }

      // Load Razorpay checkout script dynamically
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => {
        // @ts-expect-error Razorpay SDK attached to window
        const rzp = new window.Razorpay({
          key: data.key_id,
          subscription_id: data.subscription_id,
          name: 'Ryu Medha',
          description: `Auto-Pay Subscription (${selectedPlan === 'yearly' ? '₹399/yr' : '₹39/mo'})`,
          handler: async (response: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
            const verifyRes = await fetch('/api/razorpay/verify-subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_signature: response.razorpay_signature,
                planType: selectedPlan
              })
            })
            if (verifyRes.ok) {
              toast.success('Subscription activated! Pro access unlocked.')
              await fetchSubscription()
              router.refresh()
            } else {
              toast.error('Payment verification failed')
            }
            setProcessingPay(false)
          },
          modal: {
            ondismiss: () => {
              setProcessingPay(false)
            }
          }
        })
        rzp.open()
      }
      script.onerror = () => {
        toast.error('Failed to load Razorpay SDK')
        setProcessingPay(false)
      }
      document.body.appendChild(script)
    } catch (err: unknown) {
      console.error(err)
      toast.error('An unexpected error occurred')
      setProcessingPay(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const now = new Date()
  const trialEnd = subscription?.trial_end ? new Date(subscription.trial_end) : null
  const isTrialing = subscription?.status === 'trialing' && trialEnd && trialEnd > now
  const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0

  const isActive = subscription?.status === 'active'
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null
  const periodEndStr = periodEnd ? periodEnd.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

  const isExpired = !isActive && !isTrialing
  const deletionDate = subscription?.scheduled_deletion_at ? new Date(subscription.scheduled_deletion_at) : null
  const deletionDateStr = deletionDate ? deletionDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
  const deletionDaysLeft = deletionDate ? Math.max(0, Math.ceil((deletionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 60

  return (
    <div className="max-w-3xl mx-auto px-4 pt-8 pb-12 space-y-6">
      
      <PageHeader 
        title="Subscription & Billing" 
        description="Manage your subscription plan, auto-pay settings, and data retention status." 
      />

      {/* ── CURRENT SUBSCRIPTION STATUS CARD ── */}
      <Card className="overflow-hidden border-border/60 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {isActive && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active Pro Plan
                  </span>
                )}
                {isTrialing && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                    <Sparkles className="w-3.5 h-3.5" /> 1-Month Free Trial
                  </span>
                )}
                {isExpired && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-destructive/10 text-destructive border border-destructive/20">
                    <AlertTriangle className="w-3.5 h-3.5" /> Subscription Expired
                  </span>
                )}
              </div>

              <h2 className="text-xl font-bold tracking-tight mt-3">
                {isActive 
                  ? `Ryu Medha Pro (${subscription?.plan_type === 'yearly' ? 'Yearly Plan' : 'Monthly Plan'})`
                  : isTrialing 
                  ? `Free Trial Active (${trialDaysLeft} Days Remaining)` 
                  : `Subscription Expired`}
              </h2>

              <p className="text-sm text-muted-foreground leading-relaxed">
                {isActive && `Your subscription is active and set for auto-renewal on ${periodEndStr}.`}
                {isTrialing && `Your 30-day trial expires on ${trialEnd?.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}. Set up auto-pay below to continue seamlessly.`}
                {isExpired && `Access to dashboard features is locked. Data retention active until ${deletionDateStr} (${deletionDaysLeft} days left).`}
              </p>
            </div>

            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={fetchSubscription}
              title="Refresh Subscription"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── DATA RETENTION GUARANTEE NOTICE ── */}
      <div className={`p-4 rounded-2xl border text-xs sm:text-sm leading-relaxed flex items-start gap-3 ${
        isExpired
          ? 'bg-destructive/10 border-destructive/30 text-destructive-foreground'
          : 'bg-muted/40 border-border/60 text-muted-foreground'
      }`}>
        <Clock className="w-5 h-5 shrink-0 text-primary mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-foreground">2-Month Data Retention Policy Guarantee</p>
          <p>
            If you do not subscribe, your profile data, attendance history, grades, tasks, and study timers are preserved in our database for <span className="font-bold text-foreground">60 days</span> after trial or subscription expiration.
            {isExpired && ` Your data is currently saved and scheduled for permanent purge on ${deletionDateStr}.`}
          </p>
        </div>
      </div>

      {/* ── PLAN SELECTION CARDS ── */}
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Choose Plan & Set Up Auto-Pay</h3>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Monthly Card */}
          <m.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setSelectedPlan('monthly')}
            className={`p-6 rounded-3xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
              selectedPlan === 'monthly'
                ? 'border-primary bg-card shadow-md'
                : 'border-border/60 bg-card/60 hover:bg-card'
            }`}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Monthly Subscription</p>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-4xl font-extrabold tracking-tight">₹39</span>
                <span className="text-sm font-medium text-muted-foreground">/ month</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Automated monthly billing via Razorpay. Cancel anytime with a single click.
              </p>
            </div>

            <ul className="space-y-2 mt-6 border-t border-border/50 pt-4 text-xs font-medium text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" /> Full Unlimited Workspace Access
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" /> WhatsApp Bot Commands & Reminders
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" /> Continuous Data Protection
              </li>
            </ul>
          </m.div>

          {/* Yearly Card */}
          <m.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setSelectedPlan('yearly')}
            className={`p-6 rounded-3xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
              selectedPlan === 'yearly'
                ? 'border-primary bg-card shadow-md'
                : 'border-border/60 bg-card/60 hover:bg-card'
            }`}
          >
            <span className="absolute -top-3 right-4 bg-primary text-primary-foreground text-xs font-bold px-3 py-0.5 rounded-full shadow-sm">
              SAVE 15%
            </span>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Yearly Subscription</p>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-4xl font-extrabold tracking-tight">₹399</span>
                <span className="text-sm font-medium text-muted-foreground">/ year</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Automated annual billing. Best value for complete academic year coverage.
              </p>
            </div>

            <ul className="space-y-2 mt-6 border-t border-border/50 pt-4 text-xs font-medium text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" /> Includes All Monthly Features
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" /> Equivalent to ₹33/month
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" /> Priority Customer Support
              </li>
            </ul>
          </m.div>
        </div>
      </div>

      {/* ── ACTION BUTTON ── */}
      <div className="pt-2">
        <Button
          size="lg"
          className="w-full h-14 rounded-2xl text-base font-bold shadow-lg flex items-center justify-center gap-2"
          onClick={handleSubscribe}
          disabled={processingPay}
        >
          {processingPay ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              {isActive ? 'Manage / Change Auto-Pay' : 'Activate Auto-Pay (Razorpay)'}
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </Button>
      </div>

      {/* ── SECURITY TRUST BADGES ── */}
      <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-green-500" />
          <span>256-Bit SSL Encrypted</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CreditCard className="w-4 h-4 text-blue-500" />
          <span>Secured by Razorpay</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-purple-500" />
          <span>Instant Cancellation Anytime</span>
        </div>
      </div>

    </div>
  )
}
