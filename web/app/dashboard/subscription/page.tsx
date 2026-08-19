"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getAppClient } from "@/lib/supabase-client"
import { PageHeader } from "@/components/dashboard/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  Loader2,
  ArrowRight,
  RefreshCw,
  Clock,
  Ticket,
} from "lucide-react"
import { toast } from "sonner"
import { m } from "motion/react"

interface Subscription {
  id?: string
  status: "trialing" | "active" | "past_due" | "canceled" | "expired"
  plan_type?: "monthly" | "yearly" | null
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
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("monthly")
  const [processingPay, setProcessingPay] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [inviteCode, setInviteCode] = useState("")
  const [redeemingInvite, setRedeemingInvite] = useState(false)

  const [profileData, setProfileData] = useState<{
    email?: string
    displayName?: string
    whatsappNumber?: string
  } | null>(null)

  const fetchSubscription = async () => {
    try {
      // Sync Razorpay payment status if pending
      try {
        await fetch("/api/razorpay/sync-subscription", { method: "POST" })
      } catch {
        // non-blocking
      }

      const supabase = getAppClient()
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, email, whatsapp_number")
        .single()
      if (profile) {
        setProfileData({
          email: profile.email || undefined,
          displayName: profile.display_name || undefined,
          whatsappNumber: profile.whatsapp_number || undefined,
        })

        const { data: sub } = await supabase.from("subscriptions").select("*").eq("profile_id", profile.id).single()
        if (sub) {
          setSubscription(sub as Subscription)
          if (sub.plan_type) setSelectedPlan(sub.plan_type as "monthly" | "yearly")
        }
      }
    } catch (err) {
      console.error("Error fetching subscription:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSubscription()
  }, [])

  const handleSubscribe = async () => {
    setProcessingPay(true)
    try {
      const res = await fetch("/api/razorpay/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType: selectedPlan }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        toast.error(data.error || "Failed to create Razorpay subscription")
        setProcessingPay(false)
        return
      }

      // Load Razorpay checkout script dynamically
      const script = document.createElement("script")
      script.src = "https://checkout.razorpay.com/v1/checkout.js"
      script.onload = () => {
        // @ts-expect-error Razorpay SDK attached to window
        const rzp = new window.Razorpay({
          key: data.key_id,
          subscription_id: data.subscription_id,
          name: "Ryu Medha",
          description: `Auto-Pay Subscription (${selectedPlan === "yearly" ? "₹399/yr" : "₹39/mo"})`,
          prefill: {
            name: profileData?.displayName || "",
            email: profileData?.email || "",
            contact: profileData?.whatsappNumber || "",
          },
          handler: async (response: {
            razorpay_payment_id: string
            razorpay_subscription_id: string
            razorpay_signature: string
          }) => {
            const verifyRes = await fetch("/api/razorpay/verify-subscription", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_signature: response.razorpay_signature,
                planType: selectedPlan,
              }),
            })
            if (verifyRes.ok) {
              toast.success("Subscription activated! Auto-Pay set up.")
              await fetchSubscription()
              window.dispatchEvent(new CustomEvent("subscription-updated"))
              router.refresh()
            } else {
              toast.error("Payment verification failed")
            }
            setProcessingPay(false)
          },
          modal: {
            ondismiss: () => {
              setProcessingPay(false)
            },
          },
        })
        rzp.open()
      }
      script.onerror = () => {
        toast.error("Failed to load Razorpay SDK")
        setProcessingPay(false)
      }
      document.body.appendChild(script)
    } catch (err: unknown) {
      console.error(err)
      toast.error("An unexpected error occurred")
      setProcessingPay(false)
    }
  }

  const handleCancelAutoPay = async () => {
    if (!confirm("Are you sure you want to cancel auto-pay? You can re-activate anytime.")) return
    setCanceling(true)
    try {
      const res = await fetch("/api/razorpay/cancel-subscription", {
        method: "POST",
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || "Auto-pay canceled successfully.")
        await fetchSubscription()
        window.dispatchEvent(new CustomEvent("subscription-updated"))
        router.refresh()
      } else {
        toast.error(data.error || "Failed to cancel auto-pay")
      }
    } catch (err) {
      console.error(err)
      toast.error("An error occurred")
    } finally {
      setCanceling(false)
    }
  }

  const handleRedeemInviteCode = async () => {
    if (!inviteCode.trim()) {
      toast.error("Please enter an invite code")
      return
    }
    setRedeemingInvite(true)
    try {
      const res = await fetch("/api/invite/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inviteCode.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || "Free access granted!")
        setInviteCode("")
        await fetchSubscription()
        window.dispatchEvent(new CustomEvent("subscription-updated"))
        router.refresh()
      } else {
        toast.error(data.error || "Invalid invite code")
      }
    } catch (err) {
      console.error(err)
      toast.error("An error occurred")
    } finally {
      setRedeemingInvite(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-7xl items-center justify-center px-4 py-12">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    )
  }

  const now = new Date()
  const trialEnd = subscription?.trial_end ? new Date(subscription.trial_end) : null
  const isTrialing = subscription?.status === "trialing" && trialEnd && trialEnd > now
  const trialDaysLeft = trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  const isLifetime = Boolean(
    subscription?.razorpay_subscription_id === "admin_free_lifetime" ||
    (subscription?.current_period_end && new Date(subscription.current_period_end).getFullYear() > 2090)
  )
  const is1Year = Boolean(subscription?.razorpay_subscription_id === "admin_free_1year")
  const is6Months = Boolean(subscription?.razorpay_subscription_id === "admin_free_6months")
  const is1Month = Boolean(subscription?.razorpay_subscription_id === "admin_free_1month")
  const isInvite = Boolean(subscription?.razorpay_subscription_id?.startsWith("invite_"))

  const isActive = subscription?.status === "active"
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null
  const periodEndStr = periodEnd
    ? periodEnd.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })
    : ""

  const isExpired = !isActive && !isTrialing
  const deletionDate = subscription?.scheduled_deletion_at ? new Date(subscription.scheduled_deletion_at) : null
  const deletionDateStr = deletionDate
    ? deletionDate.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })
    : ""
  const deletionDaysLeft = deletionDate
    ? Math.max(0, Math.ceil((deletionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 60

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pt-8 pb-12">
      <PageHeader
        title="Subscription & Billing"
        description="Manage your subscription plan, auto-pay settings, and data retention status."
      />

      {/* ── GRID LAYOUT ── */}
      <div className="grid items-start gap-8 lg:grid-cols-12">
        {/* ── MAIN CONTENT (LEFT COLUMN) ── */}
        <div className="space-y-6 lg:col-span-8">
          {/* ── CURRENT SUBSCRIPTION STATUS CARD ── */}
          <Card className="border-border/40 bg-card/40 overflow-hidden shadow-sm backdrop-blur-3xl">
            <CardContent className="flex flex-col gap-4 p-6">
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-serif text-2xl font-bold tracking-tight">
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
                              ? `Ryu Medha Pro (${subscription?.plan_type === "yearly" ? "Yearly Plan" : "Monthly Plan"})`
                              : isTrialing
                                ? `Free Trial Active (${trialDaysLeft} Days Remaining)`
                                : `Subscription Expired`}
                </h2>

                <Button
                  variant="outline"
                  size="icon"
                  className="bg-background/50 border-border/50 shrink-0 rounded-xl backdrop-blur-md"
                  onClick={fetchSubscription}
                  title="Refresh Subscription"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              <div className="text-muted-foreground text-sm leading-relaxed">
                {isLifetime && (
                  <p>
                    You have permanent free lifetime access to Ryu Medha! You will never be charged and setting up
                    auto-pay is not required.
                  </p>
                )}
                {(is1Year || is6Months || is1Month || isInvite) && (
                  <p>
                    Full unlimited access valid until <strong className="text-foreground">{periodEndStr}</strong>.
                    Setting up auto-pay authorizes your payment mandate today with{" "}
                    <strong className="text-foreground">₹0 charged now</strong>. Your first payment of{" "}
                    {selectedPlan === "yearly" ? "₹399/yr" : "₹39/mo"} will occur on{" "}
                    <strong className="text-foreground">{periodEndStr}</strong> when your free access ends.
                  </p>
                )}
                {isActive && !isLifetime && !is1Year && !is6Months && !is1Month && !isInvite && (
                  <p>
                    Your subscription is active and set for auto-renewal on{" "}
                    <strong className="text-foreground">{periodEndStr}</strong>.
                  </p>
                )}
                {isTrialing && (
                  <p>
                    Your 30-day trial expires on{" "}
                    <strong className="text-foreground">
                      {trialEnd?.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                    </strong>
                    . Setting up auto-pay authorizes your payment mandate today with{" "}
                    <strong className="text-foreground">₹0 charged now</strong>. Billing will start only after your
                    trial ends.
                  </p>
                )}
                {isExpired && (
                  <p>
                    Access to dashboard features is locked. Data retention active until{" "}
                    <strong className="text-foreground">{deletionDateStr}</strong> ({deletionDaysLeft} days left).
                  </p>
                )}
              </div>

              {isActive && !isLifetime && !is1Year && (
                <div className="flex justify-end pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10 bg-background/50 rounded-xl text-xs backdrop-blur-md"
                    onClick={handleCancelAutoPay}
                    disabled={canceling}
                  >
                    {canceling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cancel Auto-Pay"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── PLAN SELECTION CARDS ── */}
          <div className="space-y-4 pt-2">
            <h3 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
              Choose Plan & Set Up Auto-Pay
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Monthly Card */}
              <m.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setSelectedPlan("monthly")}
                className={`relative flex cursor-pointer flex-col justify-between rounded-2xl border p-6 transition-all duration-300 ${
                  selectedPlan === "monthly"
                    ? "border-primary/50 bg-primary/10 shadow-primary/20 ring-primary/30 shadow-[0_0_30px_-5px] ring-1 backdrop-blur-3xl"
                    : "border-border/40 bg-card/40 hover:bg-card hover:border-primary/30 backdrop-blur-3xl"
                }`}
              >
                <div>
                  <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                    Monthly Subscription
                  </p>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-foreground text-5xl font-bold tracking-tight">₹39</span>
                    <span className="text-muted-foreground text-sm font-medium">/ month</span>
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                    Automated monthly billing via Razorpay. Cancel anytime with a single click.
                  </p>
                </div>

                <ul className="border-border/50 text-muted-foreground mt-6 space-y-2 border-t pt-4 text-xs font-medium">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="text-primary h-4 w-4" /> Full Unlimited Workspace Access
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="text-primary h-4 w-4" /> WhatsApp Bot Commands & Reminders
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="text-primary h-4 w-4" /> Continuous Data Protection
                  </li>
                </ul>
              </m.div>

              {/* Yearly Card */}
              <m.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setSelectedPlan("yearly")}
                className={`relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border p-6 transition-all duration-300 ${
                  selectedPlan === "yearly"
                    ? "border-primary/50 bg-primary/10 shadow-primary/20 ring-primary/30 shadow-[0_0_30px_-5px] ring-1 backdrop-blur-3xl"
                    : "border-border/40 bg-card/40 hover:bg-card hover:border-primary/30 backdrop-blur-3xl"
                }`}
              >
                <div className="bg-primary text-primary-foreground absolute top-0 right-0 rounded-bl-xl px-4 py-1.5 text-[10px] font-bold tracking-wider uppercase shadow-sm">
                  SAVE 15%
                </div>

                <div>
                  <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                    Yearly Subscription
                  </p>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-foreground text-5xl font-bold tracking-tight">₹399</span>
                    <span className="text-muted-foreground text-sm font-medium">/ year</span>
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                    Automated annual billing. Best value for complete academic year coverage.
                  </p>
                </div>

                <ul className="border-border/50 text-muted-foreground mt-6 space-y-2 border-t pt-4 text-xs font-medium">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="text-primary h-4 w-4" /> Includes All Monthly Features
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="text-primary h-4 w-4" /> Equivalent to ₹33/month
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="text-primary h-4 w-4" /> Priority Customer Support
                  </li>
                </ul>
              </m.div>
            </div>
          </div>

          {/* ── ACTION BUTTON ── */}
          <div className="pt-4">
            <Button
              size="lg"
              className="shadow-primary/25 from-primary to-primary/80 hover:from-primary hover:to-primary flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r text-base font-bold shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99]"
              onClick={handleSubscribe}
              disabled={processingPay || isLifetime}
            >
              {processingPay ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isLifetime ? (
                <>
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  Free Lifetime Access Active
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5" />
                  {isActive && subscription?.razorpay_subscription_id?.startsWith("sub_")
                    ? "Manage Auto-Pay"
                    : "Set Up Auto-Pay"}
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ── SIDEBAR (RIGHT COLUMN) ── */}
        <div className="space-y-6 lg:sticky lg:top-6 lg:col-span-4">
          {/* ── REDEEM INVITE CODE CARD ── */}
          <Card className="border-border/40 bg-card/40 overflow-hidden shadow-sm backdrop-blur-3xl">
            <CardContent className="space-y-4 p-6">
              <div className="text-foreground flex items-center gap-2 text-sm font-bold">
                <Ticket className="text-primary h-4 w-4" /> Have an Invite Code?
              </div>
              <p className="text-muted-foreground text-xs">
                Enter an invite code to unlock premium benefits instantly.
              </p>
              <div className="flex flex-col gap-3">
                <Input
                  placeholder="e.g. RYULIFETIME"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="bg-background/50 border-border/50 h-10 rounded-xl font-mono text-xs uppercase"
                />
                <Button
                  className="h-10 w-full rounded-xl text-xs font-bold"
                  onClick={handleRedeemInviteCode}
                  disabled={redeemingInvite || !inviteCode.trim()}
                >
                  {redeemingInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : "Redeem Code"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── DATA RETENTION GUARANTEE NOTICE ── */}
          <div
            className={`flex flex-col gap-3 rounded-2xl border p-5 text-xs leading-relaxed sm:text-sm ${
              isExpired
                ? "bg-destructive/10 border-destructive/30 text-destructive-foreground"
                : "bg-card/40 border-border/40 text-muted-foreground backdrop-blur-3xl"
            }`}
          >
            <div className="text-foreground flex items-center gap-2 font-bold">
              <Clock className="text-primary h-4 w-4" /> Data Retention Policy
            </div>
            <p className="text-xs">
              If you do not subscribe, your profile data, attendance history, grades, tasks, and study timers are
              preserved safely in our database for <span className="text-foreground font-bold">60 days</span> after
              trial or subscription expiration.
              {isExpired && ` Your data is currently saved and scheduled for permanent purge on ${deletionDateStr}.`}
            </p>
          </div>

          {/* ── SECURITY TRUST BADGES ── */}
          <div className="border-border/40 bg-card/40 text-muted-foreground flex flex-col gap-4 rounded-2xl border p-5 text-xs backdrop-blur-3xl">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              <span className="font-medium">256-Bit SSL Encrypted</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CreditCard className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Secured by Razorpay</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-purple-500" />
              <span className="font-medium">Instant Cancellation Anytime</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
