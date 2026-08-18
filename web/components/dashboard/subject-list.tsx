import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen } from "lucide-react"
import { getAccentGradient } from "@/lib/gradient"

interface Subject {
  id: string
  name: string
  color_hex?: string | null
}

interface SubjectListProps {
  subjects: Subject[]
}

export function SubjectList({ subjects }: Readonly<SubjectListProps>) {
  if (subjects.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-10">
          <BookOpen className="h-8 w-8 opacity-30" />
          <p className="font-medium">No subjects yet</p>
          <p className="text-center text-xs">Add subjects via the WhatsApp bot to see them here.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <BookOpen className="text-primary h-4 w-4" />
          Active Subjects
        </CardTitle>
      </CardHeader>
      <CardContent className="grid">
        {subjects.map((sub) => (
          <div key={sub.id} className="hover:bg-accent flex items-center gap-3 rounded-lg p-2.5 transition-colors">
            {/* Subject accent dot — hex gradient or theme gradient */}
            {(() => {
              const g = getAccentGradient(sub.color_hex)
              return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${g.className}`} style={g.style} />
            })()}
            <span className="text-sm font-medium">{sub.name}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
