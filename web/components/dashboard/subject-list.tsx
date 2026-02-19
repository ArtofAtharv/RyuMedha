
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen } from "lucide-react"

interface Subject {
  id: string
  name: string
  color_hex?: string
}

interface SubjectListProps {
  subjects: Subject[]
}

export function SubjectList({ subjects }: SubjectListProps) {
  if (subjects.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          <p>No subjects found.</p>
          <p className="text-xs">Add subjects via the WhatsApp bot.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Your Subjects
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {subjects.map((sub) => (
            <div 
              key={sub.id} 
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-3 h-3 rounded-full shadow-sm" 
                  style={{ backgroundColor: sub.color_hex || '#8b5cf6' }} 
                />
                <span className="font-semibold">{sub.name}</span>
              </div>
            </div>
        ))}
      </CardContent>
    </Card>
  )
}
