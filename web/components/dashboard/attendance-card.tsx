
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react"

interface AttendanceCardProps {
  subjectName: string
  present: number
  absent: number
  percentage: number
  colorHex?: string
}

export function AttendanceCard({ 
  subjectName, 
  present, 
  absent, 
  percentage,
  colorHex = "#8b5cf6" 
}: AttendanceCardProps) {
  
  // Decide color based on percentage
  const getStatusColor = (p: number) => {
    if (p >= 85) return "text-green-500"
    if (p >= 75) return "text-yellow-500"
    return "text-red-500"
  }
  
  const statusColor = getStatusColor(percentage)
  const total = present + absent

  return (
    <Card className="overflow-hidden border-l-4" style={{ borderLeftColor: colorHex }}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
            <CardTitle className="text-lg font-bold truncate pr-2">{subjectName}</CardTitle>
            <span className={`text-xl font-black ${statusColor}`}>
            {percentage}%
            </span>
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress Bar */}
        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden mb-4">
          <div 
            className="h-full transition-all duration-500 ease-out"
            style={{ 
              width: `${percentage}%`,
              backgroundColor: percentage >= 75 ? colorHex : '#ef4444' 
            }}
          />
        </div>
        
        <div className="flex justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>{present} Present</span>
          </div>
           <div className="flex items-center gap-1">
            <XCircle className="h-4 w-4 text-red-500" />
            <span>{absent} Absent</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
