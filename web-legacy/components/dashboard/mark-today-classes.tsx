"use client"

import { useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"

export function MarkTodayClasses({ subjectsInfo, token, profileId }: { subjectsInfo: any[], token: string, profileId: string }) {
  const [isMarking, setIsMarking] = useState(false)
  const router = useRouter()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  async function handleMarkAll() {
    if (!subjectsInfo || subjectsInfo.length === 0) return
    setIsMarking(true)

    const inserts = subjectsInfo.map(sub => ({
      profile_id: profileId,
      subject_id: sub.id,
      status: 'present',
      lecture_date: new Date().toISOString().split('T')[0]
    }))

    // Batch insert
    await supabase.from('attendance_logs').insert(inserts)
    
    setIsMarking(false)
    router.refresh()
  }

  return (
    <Button 
      onClick={handleMarkAll}
      disabled={isMarking || subjectsInfo.length === 0}
      className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all font-bold gap-2"
    >
      <CheckCircle2 className={`w-4 h-4 ${isMarking ? "animate-spin" : ""}`} />
      {isMarking ? "Marking..." : "Mark All Present"}
    </Button>
  )
}
