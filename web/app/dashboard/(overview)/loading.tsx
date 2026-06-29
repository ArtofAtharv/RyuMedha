import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-20 animate-in fade-in duration-500">
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        
        {/* Greeting Skeleton */}
        <div className="space-y-2">
          <div className="h-9 w-64 bg-muted animate-pulse rounded-md" />
          <div className="h-4 w-32 bg-muted/60 animate-pulse rounded-md" />
        </div>

        {/* Section Header */}
        <div className="pt-2">
          <div className="flex items-center gap-3 border-b pb-2">
            <div className="w-5 h-5 rounded-md bg-muted animate-pulse" />
            <div className="h-6 w-48 bg-muted animate-pulse rounded-md" />
          </div>

          {/* 4 Cards Grid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">
            {['skel-c-1', 'skel-c-2', 'skel-c-3', 'skel-c-4'].map((key) => (
              <Card key={key} className="overflow-hidden">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded-full bg-muted animate-pulse" />
                    <div className="h-4 w-20 bg-muted animate-pulse rounded-md" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-16 bg-muted animate-pulse rounded-md mt-1" />
                  <div className="h-3 w-24 bg-muted/60 animate-pulse rounded-md mt-3" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Large Interactive Grid Skeleton Segment */}
          <div className="mt-8 space-y-4">
            <div className="h-20 w-full bg-card/60 backdrop-blur-2xl shadow-sm rounded-3xl border border-none rounded-xl animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {['skel-g-1', 'skel-g-2', 'skel-g-3'].map((key) => (
                <Card key={key} className="h-32 bg-muted/20 animate-pulse border-border/50" />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
