import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function DashboardLoading() {
  return (
    <div className="bg-background text-foreground animate-in fade-in min-h-dvh pb-20 duration-500">
      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        {/* Greeting Skeleton */}
        <div className="space-y-2">
          <div className="bg-muted h-12 w-80 animate-pulse rounded-md" />
          <div className="bg-muted/60 h-4 w-32 animate-pulse rounded-md" />
        </div>

        {/* Section Header */}
        <div className="pt-2">
          <div className="flex items-center gap-3 border-b pb-2">
            <div className="bg-muted h-5 w-5 animate-pulse rounded-md" />
            <div className="bg-muted h-6 w-48 animate-pulse rounded-md" />
          </div>

          {/* 4 Cards Grid Skeleton */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            {["skel-c-1", "skel-c-2", "skel-c-3", "skel-c-4"].map((key) => (
              <Card key={key} className="overflow-hidden">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center space-x-2">
                    <div className="bg-muted h-4 w-4 animate-pulse rounded-full" />
                    <div className="bg-muted h-4 w-20 animate-pulse rounded-md" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted mt-1 h-8 w-16 animate-pulse rounded-md" />
                  <div className="bg-muted/60 mt-3 h-3 w-24 animate-pulse rounded-md" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Large Interactive Grid Skeleton Segment */}
          <div className="mt-8 space-y-4">
            <div className="bg-card/60 h-20 w-full animate-pulse rounded-3xl rounded-xl border border-none shadow-sm backdrop-blur-2xl" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {["skel-g-1", "skel-g-2", "skel-g-3"].map((key) => (
                <Card key={key} className="bg-muted/20 border-border/50 h-32 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
