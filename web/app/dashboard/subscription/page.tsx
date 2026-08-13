"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getAppClient } from "@/lib/supabase-client"
import { PageHeader } from "@/components/dashboard/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Sparkles, CheckCircle2, AlertTriangle, ShieldCheck, 
  CreditCard, Loader2, ArrowRight, RefreshCw, Clock, Ticket
} from "lucide-react"
import { toast } from "sonner"
import { m } from "motion/react"

interface Subscription {
  id?: string
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'
  plan_type?: 'monthly' | 'yearly' | null
  razorpay_subscription_id?: string | null
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
  const [canceling, setCanceling] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [redeemingInvite, setRedeemingInvite] = useState(false)

  const [profileData, setProfileData] = useState<{ email?: string; displayName?: string; whatsappNumber?: string } | null>(null)

  const fetchSubscription = async () => {
    try {
      // Sync Razorpay payment status if pending
      try {
        await fetch('/api/razorpay/sync-subscription', { method: 'POST' })
      } catch {
        // non-blocking
      }

      const supabase = getAppClient()
      const { data: profile } = await supabase.from('profiles').select('id, display_name, email, whatsapp_number').single()
      if (profile) {
        setProfileData({
          email: profile.email || undefined,
          displayName: profile.display_name || undefined,
          whatsappNumber: profile.whatsapp_number || undefined
        })

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
          prefill: {
            name: profileData?.displayName || '',
            email: profileData?.email || '',
            contact: profileData?.whatsappNumber || ''
          },
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
              toast.success('Subscription activated! Auto-Pay set up.')
              await fetchSubscription()
              window.dispatchEvent(new CustomEvent('subscription-updated'))
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

  const handleCancelAutoPay = async () => {
    if (!confirm("Are you sure you want to cancel auto-pay? You can re-activate anytime.")) return
    setCanceling(true)
    try {
      const res = await fetch('/api/razorpay/cancel-subscription', {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || 'Auto-pay canceled successfully.')
        await fetchSubscription()
        window.dispatchEvent(new CustomEvent('subscription-updated'))
        router.refresh()
      } else {
        toast.error(data.error || 'Failed to cancel auto-pay')
      }
    } catch (err) {
      console.error(err)
      toast.error('An error occurred')
    } finally {
      setCanceling(false)
    }
  }

  const handleRedeemInviteCode = async () => {
    if (!inviteCode.trim()) {
      toast.error('Please enter an invite code')
      return
    }
    setRedeemingInvite(true)
    try {
      const res = await fetch('/api/invite/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode.trim() })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || 'Free access granted!')
        setInviteCode('')
        await fetchSubscription()
        window.dispatchEvent(new CustomEvent('subscription-updated'))
        router.refresh()
      } else {
        toast.error(data.error || 'Invalid invite code')
      }
    } catch (err) {
      console.error(err)
      toast.error('An error occurred')
    } finally {
      setRedeemingInvite(false)
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

  const isLifetime = Boolean(subscription?.razorpay_subscription_id === 'admin_free_lifetime' || (subscription?.current_period_end && new Date(subscription.current_period_end).getFullYear() > 2090))
  const is1Year = Boolean(subscription?.razorpay_subscription_id === 'admin_free_1year')
  const is6Months = Boolean(subscription?.razorpay_subscription_id === 'admin_free_6months')
  const is1Month = Boolean(subscription?.razorpay_subscription_id === 'admin_free_1month')
  const isInvite = Boolean(subscription?.razorpay_subscription_id?.startsWith('invite_'))

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
                {isLifetime && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    <Sparkles className="w-3.5 h-3.5" /> Free Lifetime Access
                  </span>
                )}
                {is1Year && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    <Sparkles className="w-3.5 h-3.5" /> Free 1-Year Access
                  </span>
                )}
                {is6Months && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                    <Sparkles className="w-3.5 h-3.5" /> Free 6-Months Access
                  </span>
                )}
                {is1Month && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    <Sparkles className="w-3.5 h-3.5" /> Free 1-Month Access
                  </span>
                )}
                {isInvite && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <Sparkles className="w-3.5 h-3.5" /> Invite Code Unlocked
                  </span>
                )}
                {isActive && !isLifetime && !is1Year && !is6Months && !is1Month && !isInvite && (
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
                {isLifetime
                  ? `Ryu Medha Pro (Lifetime Unlocked)`
                  : is1Year
                  ? `Ryu Medha Pro (1-Year Unlocked)`
                  : is6Months
                  ? `Ryu Medha Pro (6-Months Unlocked)`
                  : is1Month
                  ? `Ryu Medha Pro (1-Month Unlocked)`
                  : isInvite
                  ? `Ryu Medha Pro (Invite Access Unlocked)`
                  : isActive 
                  ? `Ryu Medha Pro (${subscription?.plan_type === 'yearly' ? 'Yearly Plan' : 'Monthly Plan'})`
                  : isTrialing 
                  ? `Free Trial Active (${trialDaysLeft} Days Remaining)` 
                  : `Subscription Expired`}
              </h2>

              <p className="text-sm text-muted-foreground leading-relaxed">
                {isLifetime && `Full unlimited access granted for life.`}
                {(is1Year || is6Months || is1Month || isInvite) && `Full unlimited access valid until ${periodEndStr}.`}
                {isActive && !isLifetime && !is1Year && !is6Months && !is1Month && !isInvite && `Your subscription is active and set for auto-renewal on ${periodEndStr}.`}
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

          {/* Cancel Auto-Pay option if active auto-pay */}
          {isActive && !isLifetime && !is1Year && (
            <div className="mt-4 pt-4 border-t flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10 rounded-xl"
                onClick={handleCancelAutoPay}
                disabled={canceling}
              >
                {canceling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Cancel Auto-Pay'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── REDEEM INVITE CODE CARD ── */}
      <Card className="overflow-hidden border-border/60 shadow-sm bg-card/60">
        <CardContent className="p-4 sm:p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Ticket className="w-4 h-4 text-primary" /> Have an Invite Code?
          </div>
          <p className="text-xs text-muted-foreground">
            Enter an invite code to get the benifits
          </p>
          <div className="flex gap-2 max-w-md">
            <Input
              placeholder="e.g. RYULIFETIME"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="h-10 text-xs font-mono uppercase bg-background"
            />
            <Button
              className="h-10 px-5 font-bold text-xs rounded-xl shrink-0"
              onClick={handleRedeemInviteCode}
              disabled={redeemingInvite || !inviteCode.trim()}
            >
              {redeemingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Redeem Code'}
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
        {isLifetime ? (
          <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-xs flex items-center gap-3 mb-2">
            <Sparkles className="w-5 h-5 text-purple-500 shrink-0" />
            <div>
              <p className="font-bold">Lifetime Free Access Active</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                You have permanent free lifetime access to Ryu Medha! You will never be charged and setting up auto-pay is not required.
              </p>
            </div>
          </div>
        ) : is1Year ? (
          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-3 mb-2">
            <Sparkles className="w-5 h-5 text-blue-500 shrink-0" />
            <div>
              <p className="font-bold">Free 1-Year Access Active (Expires: {periodEndStr})</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Setting up auto-pay authorizes your payment mandate today with <strong className="text-foreground">₹0 charged now</strong>. Your first payment of {selectedPlan === 'yearly' ? '₹399/yr' : '₹39/mo'} will occur on <strong className="text-foreground">{periodEndStr}</strong> when your free year ends.
              </p>
            </div>
          </div>
        ) : isTrialing ? (
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-primary text-xs flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="font-bold">Free Trial Active ({trialDaysLeft} Days Left)</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Setting up auto-pay authorizes your payment mandate today with <strong className="text-foreground">₹0 charged now</strong>. Billing will start only after your trial ends on <strong className="text-foreground">{trialEnd?.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>.
              </p>
            </div>
          </div>
        ) : null}

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
          disabled={processingPay || isLifetime}
        >
          {processingPay ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isLifetime ? (
            <>
              <Sparkles className="w-5 h-5 text-purple-400" />
              Free Lifetime Access Active
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              {isActive ? (is1Year ? 'Set Up Auto-Pay Mandate (Deferred)' : 'Manage / Change Auto-Pay') : 'Activate Auto-Pay (Razorpay)'}
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
