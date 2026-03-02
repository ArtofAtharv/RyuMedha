"use client"

import { useMemo } from "react"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"

export function StudyAnalyticsChart({ timersData }: { timersData: any[] }) {
  const chartData = useMemo(() => {
    if (!timersData || timersData.length === 0) return []

    // 1. Get last 7 days keys
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - i)
      return {
        dateString: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('en-US', { weekday: 'short' }), // Mon, Tue, etc.
        pomodoro: 0,
        stopwatch: 0
      }
    }).reverse() // Chronological order

    // 2. Aggregate data
    timersData.forEach(t => {
      const dbDate = new Date(t.ended_at).toISOString().split('T')[0]
      const dayIndex = days.findIndex(d => d.dateString === dbDate)
      
      if (dayIndex !== -1) {
        const type = t.timer_type || 'stopwatch'
        // convert net seconds to hours
        const start = new Date(t.started_at).getTime()
        const end = new Date(t.ended_at).getTime()
        const grossSecs = Math.floor((end - start) / 1000)
        const netSecs = Math.max(0, grossSecs - (t.total_pause_seconds || 0))
        const hours = netSecs / 3600

        if (type === 'pomodoro') {
          days[dayIndex].pomodoro += hours
        } else {
          days[dayIndex].stopwatch += hours
        }
      }
    })

    // 3. Format strictly to 1 decimal place
    return days.map(d => ({
      ...d,
      pomodoro: Number(d.pomodoro.toFixed(1)),
      stopwatch: Number(d.stopwatch.toFixed(1))
    }))
  }, [timersData])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 backdrop-blur-md border border-border/50 p-3 rounded-xl shadow-xl text-slate-900 dark:text-slate-100">
          <p className="font-bold mb-2 text-slate-900 dark:text-slate-100">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm font-medium">
              <div className="w-3 h-3 rounded-full border border-border/20 shadow-sm" style={{ backgroundColor: entry.color }} />
              <span className="capitalize text-slate-600 dark:text-slate-400">{entry.name}:</span>
              <span className="text-slate-900 dark:text-slate-100">{entry.value}h</span>
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-border/50 flex justify-between text-sm font-black text-slate-900 dark:text-slate-100">
            <span>Total:</span>
            <span>{Number(payload.reduce((sum: number, entry: any) => sum + entry.value, 0)).toFixed(1)}h</span>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="h-full bg-card/60 backdrop-blur-md border-border/50 shadow-sm overflow-hidden flex flex-col">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Weekly Focus Trends
          </CardTitle>
          <CardDescription>Time invested over the last 7 days</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 min-h-[300px]">
        <div className="w-full h-full p-4 pt-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPomodoro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.2}/>
                </linearGradient>
                <linearGradient id="colorStopwatch" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.2}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis 
                dataKey="label" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                dx={-10}
                tickFormatter={(val) => `${val}h`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.5)', radius: 8 }} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar 
                dataKey="pomodoro" 
                name="Pomodoro Focus" 
                stackId="a" 
                fill="url(#colorPomodoro)" 
                radius={[0, 0, 4, 4]} 
                maxBarSize={40}
              />
              <Bar 
                dataKey="stopwatch" 
                name="Stopwatch Flow" 
                stackId="a" 
                fill="url(#colorStopwatch)" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
