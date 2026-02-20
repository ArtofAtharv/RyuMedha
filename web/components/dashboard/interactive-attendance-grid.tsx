"use client"

import { useState, useMemo } from "react"
import { createClient } from "@supabase/supabase-js"
import { AttendanceCard } from "./attendance-card"
import { useRouter } from "next/navigation"
import { motion, Variants } from "motion/react"

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 15 }
  },
}

export function InteractiveAttendanceGrid({ initialData, subjectsInfo, token, profileId }: { initialData: any[], subjectsInfo: any[], token: string, profileId: string }) {
  const [data, setData] = useState(initialData)
  const [isUpdating, setIsUpdating] = useState(false)
  const router = useRouter()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  // Merge Subjects with Attendance Data to ensure all Academic subjects show up
  const mergedData = useMemo(() => {
    const academicSubjects = subjectsInfo.filter((s: any) => s.type === 'academic' && s.is_active === true)
    
    return academicSubjects.map((sub: any) => {
      const existingAtt = data.find((d: any) => d.subject_id === sub.id)
      if (existingAtt) return existingAtt

      // Synthesize blank attendance if none exists
      return {
        subject_id: sub.id,
        subject_name: sub.name,
        total_present: sub.legacy_attended_lectures || 0,
        total_absent: sub.legacy_missed_lectures || 0,
        attendance_percentage: 0 // Will auto-calc if legacy vars exist, but 0 is safe start
      }
    })
  }, [data, subjectsInfo])

  async function handleLogAttendance(subjectId: string, action: 'present'|'absent'|'undo_present'|'undo_absent') {
    if (isUpdating || !subjectId) return
    setIsUpdating(true)

    const isUndo = action.startsWith('undo_')
    const targetStatus = action.replace('undo_', '')

    // Optimistic UI Update directly on the data array so mergedData recalculates
    setData(prev => {
      const exists = prev.find(item => item.subject_id === subjectId)
      
      const updateRow = (item: any) => {
        let newPresent = item.total_present
        let newAbsent = item.total_absent

        if (isUndo) {
          if (targetStatus === 'present' && newPresent > 0) newPresent -= 1
          if (targetStatus === 'absent' && newAbsent > 0) newAbsent -= 1
        } else {
          if (targetStatus === 'present') newPresent += 1
          if (targetStatus === 'absent') newAbsent += 1
        }

        const total = newPresent + newAbsent
        const newPct = total > 0 ? (newPresent / total) * 100 : 0
        return { ...item, total_present: newPresent, total_absent: newAbsent, attendance_percentage: newPct }
      }

      if (exists) {
        return prev.map(item => item.subject_id === subjectId ? updateRow(item) : item)
      } else {
        // Find subject info to synthesize initial log
        const sub = subjectsInfo.find(s => s.id === subjectId)
        if (!sub) return prev
        const synthesized = {
          subject_id: subjectId,
          subject_name: sub.name,
          total_present: sub.legacy_attended_lectures || 0,
          total_absent: sub.legacy_missed_lectures || 0,
          attendance_percentage: 0
        }
        return [...prev, updateRow(synthesized)]
      }
    })

    // Database Update
    if (isUndo) {
      // Find the most recent log of this status
      const { data: latest } = await supabase
        .from('attendance_logs')
        .select('id')
        .eq('profile_id', profileId)
        .eq('subject_id', subjectId)
        .eq('status', targetStatus)
        .order('lecture_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latest) {
        await supabase.from('attendance_logs').delete().eq('id', latest.id)
      } else {
        // Fallback: decrement legacy counters if no logs exist
        const sub = subjectsInfo.find(s => s.id === subjectId)
        if (sub) {
          if (targetStatus === 'present' && (sub.legacy_attended_lectures || 0) > 0) {
            await supabase.from('subjects').update({ legacy_attended_lectures: sub.legacy_attended_lectures - 1 }).eq('id', subjectId)
          } else if (targetStatus === 'absent' && (sub.legacy_missed_lectures || 0) > 0) {
            await supabase.from('subjects').update({ legacy_missed_lectures: sub.legacy_missed_lectures - 1 }).eq('id', subjectId)
          }
        }
      }
    } else {
      // Insert: The backend does not enforce a unique constraint on lecture_date
      await supabase.from('attendance_logs').insert([{
        profile_id: profileId,
        subject_id: subjectId,
        status: targetStatus,
        lecture_date: new Date().toISOString().split('T')[0]
      }])
    }

    setIsUpdating(false)
    router.refresh() // Trigger a server re-fetch to sync overall stats
  }

  if (!mergedData || mergedData.length === 0) {
    return (
      <div className="py-10 text-center text-muted-foreground border rounded-xl bg-card">
        <p>No academic subjects found.</p>
        <p className="text-xs mt-1">Add an academic subject to start tracking attendance.</p>
      </div>
    )
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {mergedData.map((item: any, idx: number) => {
        // Calculate percentage dynamically here if it was 0 from synthesis
        let pct = item.attendance_percentage
        if (pct === 0 && (item.total_present > 0 || item.total_absent > 0)) {
           pct = (item.total_present / (item.total_present + item.total_absent)) * 100
        }

        return (
          <motion.div key={item.subject_id || `subj-${idx}`} variants={cardVariants}>
            <AttendanceCard
              subjectId={item.subject_id}
              subjectName={item.subject_name}
              present={item.total_present}
              absent={item.total_absent}
              percentage={pct}
              accentColor={subjectsInfo?.find((s: any) => s.id === item.subject_id)?.color_hex ?? undefined}
              onLog={handleLogAttendance}
            />
          </motion.div>
        )
      })}
    </motion.div>
  )
}
