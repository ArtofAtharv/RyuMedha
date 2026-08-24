import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ArrowLeft, Calendar, Trophy, Clock, Target } from "lucide-react"

export default function SubjectDetailLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-500">
        
        {/* Back Link & Header Skeleton */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground/60">
            <ArrowLeft className="w-4 h-4 animate-pulse" />
            <div className="h-4 w-28 bg-muted/60 animate-pulse rounded-md" />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="h-9 w-64 bg-muted animate-pulse rounded-2xl" />
              <div className="flex items-center gap-2">
                <div className="h-4 w-36 bg-muted/60 animate-pulse rounded-md" />
                <div className="h-4 w-4 bg-muted/40 animate-pulse rounded-full" />
                <div className="h-4 w-24 bg-muted/60 animate-pulse rounded-md" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-28 bg-muted/80 animate-pulse rounded-xl" />
              <div className="h-10 w-28 bg-muted/80 animate-pulse rounded-xl" />
            </div>
          </div>
        </div>

        {/* Goal Banner Skeleton */}
        <Card className="border-none bg-card/60 backdrop-blur-2xl shadow-sm rounded-3xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-muted-foreground/40 animate-pulse" />
                <div className="h-5 w-44 bg-muted animate-pulse rounded-md" />
              </div>
              <div className="h-4 w-72 bg-muted/60 animate-pulse rounded-md" />
            </div>
            <div className="h-10 w-36 bg-muted/80 animate-pulse rounded-2xl shrink-0" />
          </div>
        </Card>

        {/* 4 Stat Metric Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Calendar, label: "Total Conducted" },
            { icon: Target, label: "Attendance Rate" },
            { icon: Trophy, label: "Target Goal" },
            { icon: Clock, label: "Lectures Safe" },
          ].map((item, idx) => (
            <Card key={`stat-skel-${idx}`} className="border-none bg-card/60 backdrop-blur-2xl shadow-sm rounded-3xl p-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-24 bg-muted/60 animate-pulse rounded-md" />
                  <item.icon className="w-4 h-4 text-muted-foreground/40 animate-pulse" />
                </div>
                <div className="h-8 w-20 bg-muted animate-pulse rounded-xl" />
                <div className="h-3 w-16 bg-muted/40 animate-pulse rounded-md" />
              </div>
            </Card>
          ))}
        </div>

        {/* Calendar Card Skeleton */}
        <Card className="border-none bg-card/60 backdrop-blur-2xl shadow-sm rounded-3xl">
          <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/40">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-muted-foreground/40 animate-pulse" />
              <div className="h-6 w-40 bg-muted animate-pulse rounded-lg" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-muted/80 animate-pulse rounded-lg" />
              <div className="h-8 w-8 bg-muted/80 animate-pulse rounded-lg" />
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-2 text-center">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="h-4 w-8 mx-auto bg-muted/40 animate-pulse rounded-md" />
              ))}
            </div>

            {/* 5-week Calendar Grid Skeleton */}
            <div className="grid grid-cols-7 gap-2 sm:gap-3">
              {Array.from({ length: 35 }).map((_, i) => (
                <div 
                  key={`day-cell-${i}`} 
                  className="aspect-square bg-muted/40 animate-pulse rounded-2xl flex flex-col items-center justify-between p-2"
                >
                  <div className="h-3 w-4 bg-muted/60 rounded-md self-end" />
                  <div className="h-6 w-6 bg-muted/80 rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </main>
    </div>
  )
}
