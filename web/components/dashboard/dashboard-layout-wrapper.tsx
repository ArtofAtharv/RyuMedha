"use client"

import { useState } from "react"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"
import { SubscriptionBanner } from "@/components/dashboard/subscription-banner"
import type { SubscriptionData } from "@/components/dashboard/subscription-banner"
import { cn } from "@/lib/utils"

export function DashboardLayoutWrapper({
  children,
  subscription,
}: {
  children: React.ReactNode
  subscription: SubscriptionData | null
}) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true)

  return (
    <div className="bg-background text-foreground flex min-h-[calc(100dvh-3.5rem)] w-full">
      {/* Animated Dashboard Navigation (Sidebar + Mobile Bottom) */}
      <DashboardNav isExpanded={isSidebarExpanded} onToggle={() => setIsSidebarExpanded(!isSidebarExpanded)} />

      {/* Main Content Area (shifted on desktop based on sidebar state) */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-all duration-300",
          isSidebarExpanded ? "md:pl-64" : "md:pl-[4.5rem]"
        )}
      >
        {/* Subscription Notice Banner */}
        <SubscriptionBanner subscription={subscription} />

        <div className="relative z-0 flex-1 pb-24 md:pb-6">{children}</div>
      </div>
    </div>
  )
}
