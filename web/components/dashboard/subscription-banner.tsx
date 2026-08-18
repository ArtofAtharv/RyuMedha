"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import Link from "next/link"
import { Sparkles, AlertTriangle, ArrowRight } from "lucide-react"

export interface SubscriptionData {
  id?: string
  status: "trialing" | "active" | "past_due" | "canceled" | "expired"
  plan_type?: "monthly" | "yearly" | null
  trial_end?: string | null
  current_period_end?: string | null
  scheduled_deletion_at?: string | null
}

export function SubscriptionBanner({ subscription }: { subscription: SubscriptionData | null }) {
  const pathname = usePathname()
  const router = useRouter()

  const now = new Date()

  // Calculate trial state
  const trialEnd = subscription?.trial_end ? new Date(subscription.trial_end) : null
  const isTrialing = subscription?.status === "trialing" && trialEnd && trialEnd > now
  const trialDaysLeft = trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  // Calculate active paid state
  const isActivePaid = subscription?.status === "active"

  // Calculate expired / grace period state
  const isExpired = !isActivePaid && !isTrialing
  const deletionDate = subscription?.scheduled_deletion_at ? new Date(subscription.scheduled_deletion_at) : null
  const deletionDaysLeft = deletionDate
    ? Math.max(0, Math.ceil((deletionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 60

  // Strict Feature Gating: If expired/unsubscribed and NOT on subscription or profile page, enforce redirect
  useEffect(() => {
    if (
      isExpired &&
      pathname !== "/dashboard/subscription" &&
      pathname !== "/dashboard/profile" &&
      pathname !== "/support"
    ) {
      router.push("/dashboard/subscription")
    }
  }, [isExpired, pathname, router])

  // Listen for client-side subscription updates and trigger instant router refresh
  useEffect(() => {
    const handleUpdate = () => {
      router.refresh()
    }
    window.addEventListener("subscription-updated", handleUpdate)
    return () => {
      window.removeEventListener("subscription-updated", handleUpdate)
    }
  }, [router])

  // Don't render banner if active paid subscription
  if (isActivePaid) {
    return null
  }

  // Render Red Warning Banner if Expired
  if (isExpired) {
    const formattedDeletionDate = deletionDate
      ? deletionDate.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })
      : "in 60 days"

    return (
      <div className="bg-destructive text-destructive-foreground border-destructive/30 animate-in slide-in-from-top flex items-center justify-between gap-3 border-b px-4 py-2.5 text-xs font-medium shadow-md duration-300 sm:text-sm">
        <div className="flex max-w-3xl items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 animate-bounce" />
          <p className="leading-tight">
            <span className="font-bold">Subscription Expired:</span> Access to features is locked. Your account data
            will be <span className="font-bold underline">PERMANENTLY DELETED</span> on{" "}
            <span className="font-bold">{formattedDeletionDate}</span> ({deletionDaysLeft} days left) unless you
            subscribe.
          </p>
        </div>
        {pathname !== "/dashboard/subscription" && (
          <Link
            href="/dashboard/subscription"
            className="bg-background text-foreground hover:bg-background/90 flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm transition-all"
          >
            Subscribe Now <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    )
  }

  // Render Trial Banner if Trialing
  if (isTrialing) {
    const isEndingSoon = trialDaysLeft <= 5
    const trialEndDateStr = trialEnd ? trialEnd.toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : ""

    return (
      <div
        className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-xs font-medium transition-colors sm:text-sm ${
          isEndingSoon
            ? "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400"
            : "bg-primary/10 text-primary border-primary/20"
        }`}
      >
        <div className="flex items-center gap-2">
          {isEndingSoon ? (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          ) : (
            <Sparkles className="text-primary h-4 w-4 shrink-0" />
          )}
          <p className="leading-tight">
            {isEndingSoon ? (
              <>
                <span className="font-bold">Trial Ending Soon:</span> You have{" "}
                <span className="font-bold">
                  {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"}
                </span>{" "}
                left on your 1-Month Free Trial (ends {trialEndDateStr}). Set up auto-pay to prevent service disruption.
              </>
            ) : (
              <>
                <span className="font-bold">1-Month Free Trial Active:</span> {trialDaysLeft} days remaining (ends{" "}
                {trialEndDateStr}).
              </>
            )}
          </p>
        </div>
        {pathname !== "/dashboard/subscription" && (
          <Link
            href="/dashboard/subscription"
            className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
              isEndingSoon
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            Manage Plan <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    )
  }

  return null
}
