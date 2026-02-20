import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen } from 'lucide-react'

interface Subject {
  id: string
  name: string
  color_hex?: string | null
}

interface SubjectListProps {
  subjects: Subject[]
}

export function SubjectList({ subjects }: SubjectListProps) {
  if (subjects.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
          <BookOpen className="h-8 w-8 opacity-30" />
          <p className="font-medium">No subjects yet</p>
          <p className="text-xs text-center">
            Add subjects via the WhatsApp bot to see them here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          Active Subjects
        </CardTitle>
      </CardHeader>
      <CardContent className="grid">
        {subjects.map((sub) => (
          <div
            key={sub.id}
            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors"
          >
            {/* Subject accent dot — user-defined color stored per-row in DB */}
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 bg-primary"
            />
            <span className="text-sm font-medium">{sub.name}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
