"use client"

import { useState, useMemo } from "react"
import { createClient } from "@supabase/supabase-js"
import { AttendanceCard } from "./attendance-card"
import { useRouter } from "next/navigation"
import { motion, Variants } from "motion/react"
import { toast } from "sonner"

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

export function InteractiveAttendanceGrid({ initialData, subjectsInfo, token, profileId, targetPct }: { initialData: any[], subjectsInfo: any[], token: string, profileId: string, targetPct: number }) {
  const [data, setData] = useState(initialData)
  const [isUpdating, setIsUpdating] = useState(false)
  const router = useRouter()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  function calculateAdvice(totalPresent: number, totalAbsent: number, totalDeemed: number, expectedTotal: number) {
    const totalLogged = totalPresent + totalAbsent + totalDeemed
    const pct = totalLogged > 0 ? ((totalPresent + totalDeemed) / totalLogged) * 100 : 0
    
    let bunksRemaining = undefined
    let neededToRecover = undefined
    let maxPossiblePct = undefined
    let isPossibleToRecover = true
    let maxAllowedMisses = undefined

    if (expectedTotal > 0) {
      const t = targetPct / 100
      maxAllowedMisses = Math.floor(expectedTotal * (1 - t))
      const netAbsent = Math.max(0, totalAbsent - totalDeemed)
      bunksRemaining = maxAllowedMisses - netAbsent
      const remaining = Math.max(0, expectedTotal - totalLogged)
      
      const totalPresentsNeededForGoal = Math.ceil(expectedTotal * t)
      neededToRecover = Math.max(0, totalPresentsNeededForGoal - (totalPresent + totalDeemed))

      if (bunksRemaining < 0) {
        if (neededToRecover > remaining) {
          isPossibleToRecover = false
          maxPossiblePct = ((totalPresent + totalDeemed + remaining) / expectedTotal) * 100
        }
      }
    } else {
      // Fallback for subjects with no expected total (dynamic floating calculation)
      const t = targetPct / 100
      if (pct < targetPct) {
        neededToRecover = Math.ceil((t * totalLogged - (totalPresent + totalDeemed)) / (1 - t))
      }
    }

    return { 
      pct, 
      bunksRemaining, 
      neededToRecover, 
      maxPossiblePct, 
      isPossibleToRecover, 
      maxAllowedMisses, 
      currentMisses: Math.max(0, totalAbsent - totalDeemed),
      remainingLectures: Math.max(0, expectedTotal - totalLogged)
    }
  }

  // Merge Subjects with Attendance Data to ensure all Academic subjects show up
  // AND ensure advice is calculated for all rows on initial load and updates
  const mergedData = useMemo(() => {
    const academicSubjects = subjectsInfo.filter((s: any) => s.type === 'academic' && s.is_active === true)
    
    return academicSubjects.map((sub: any) => {
      const existingAtt = data.find((d: any) => d.subject_id === sub.id)
      
      const present = existingAtt ? existingAtt.total_present : (sub.legacy_attended_lectures || 0)
      const absent = existingAtt ? existingAtt.total_absent : (sub.legacy_missed_lectures || 0)
      const deemed = existingAtt ? (existingAtt.total_deemed || 0) : 0
      const expectedTotal = sub.expected_total_lectures || sub.source_course_id?.expected_total_lectures || 0

      const { 
        pct, 
        bunksRemaining, 
        neededToRecover, 
        maxPossiblePct, 
        isPossibleToRecover, 
        maxAllowedMisses, 
        currentMisses, 
        remainingLectures 
      } = calculateAdvice(present, absent, deemed, expectedTotal)

      return {
        subject_id: sub.id,
        subject_name: sub.name,
        total_present: present,
        total_absent: absent,
        total_deemed: deemed,
        attendance_percentage: pct,
        bunks_remaining: bunksRemaining,
        needed_to_recover: neededToRecover,
        max_possible_pct: maxPossiblePct,
        is_possible_to_recover: isPossibleToRecover,
        max_allowed_misses: maxAllowedMisses,
        current_misses: currentMisses,
        remaining_lectures: remainingLectures
      }
    }).sort((a: any, b: any) => a.attendance_percentage - b.attendance_percentage)
  }, [data, subjectsInfo, targetPct])

  async function handleLogAttendance(subjectId: string, action: 'present'|'absent'|'deemed'|'undo_present'|'undo_absent'|'undo_deemed') {
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
        let newDeemed = item.total_deemed ?? 0

        if (isUndo) {
          if (targetStatus === 'present' && newPresent > 0) newPresent -= 1
          if (targetStatus === 'absent' && newAbsent > 0) newAbsent -= 1
          if (targetStatus === 'deemed' && newDeemed > 0) newDeemed -= 1
        } else {
          if (targetStatus === 'present') newPresent += 1
          if (targetStatus === 'absent') newAbsent += 1
          if (targetStatus === 'deemed') newDeemed += 1
        }

        const subInfo = subjectsInfo.find(s => s.id === subjectId)
        const expectedTotal = subInfo?.expected_total_lectures || subInfo?.source_course_id?.expected_total_lectures || 0
        const { pct, bunksRemaining, neededToRecover, maxPossiblePct, isPossibleToRecover, maxAllowedMisses, currentMisses, remainingLectures } = calculateAdvice(newPresent, newAbsent, newDeemed, expectedTotal)

        return { 
          ...item, 
          total_present: newPresent, 
          total_absent: newAbsent, 
          total_deemed: newDeemed, 
          attendance_percentage: pct, 
          bunks_remaining: bunksRemaining, 
          needed_to_recover: neededToRecover,
          max_possible_pct: maxPossiblePct,
          is_possible_to_recover: isPossibleToRecover,
          max_allowed_misses: maxAllowedMisses,
          current_misses: currentMisses,
          remaining_lectures: remainingLectures
        }
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
          total_deemed: 0,
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
      const today = new Date().toISOString().split('T')[0]
      
      // Check if trying to mark multiple times today
      const { data: existingToday } = await supabase
        .from('attendance_logs')
        .select('id')
        .eq('profile_id', profileId)
        .eq('subject_id', subjectId)
        .eq('lecture_date', today)
        .limit(1)
        
      if (existingToday && existingToday.length > 0) {
        toast.success("✅ Attendance recorded! You can mark multiple lectures for the same day if needed.")
      } else {
        const sub = subjectsInfo.find(s => s.id === subjectId)
        toast.success(`✅ Marked ${targetStatus} for ${sub?.name || 'subject'}`)
      }
      
      // Insert: The backend does not enforce a unique constraint on lecture_date anymore due to our fix
      await supabase.from('attendance_logs').insert([{
        profile_id: profileId,
        subject_id: subjectId,
        status: targetStatus,
        lecture_date: today
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
    <>
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
      {mergedData.map((item: any, idx: number) => {
        // Calculate percentage dynamically here if it was 0 from synthesis
        let pct = item.attendance_percentage
        if (pct === 0 && (item.total_present > 0 || item.total_absent > 0 || item.total_deemed > 0)) {
           pct = ((item.total_present + (item.total_deemed || 0)) / (item.total_present + item.total_absent + (item.total_deemed || 0))) * 100
        }

        const subRecord = subjectsInfo?.find((s: any) => s.id === item.subject_id)
        const instructorName = subRecord?.source_course_id?.instructor_name || subRecord?.instructor_name || undefined

        return (
          <motion.div key={item.subject_id || `subj-${idx}`} variants={cardVariants}>
            <AttendanceCard
              subjectId={item.subject_id}
              subjectName={item.subject_name}
              present={item.total_present}
              absent={item.total_absent}
              deemed={item.total_deemed || 0}
              percentage={pct}
              accentColor={subRecord?.color_hex ?? undefined}
              instructorName={instructorName}
              label={subRecord?.label ?? undefined}
              targetPct={targetPct}
              
              // Granular Advice Props
              bunksRemaining={item.bunks_remaining}
              maxAllowedSkips={item.max_allowed_misses}
              currentSkips={item.current_misses}
              neededToRecover={item.needed_to_recover}
              maxPossiblePct={item.max_possible_pct}
              isPossibleToRecover={item.is_possible_to_recover}
              remainingLectures={item.remaining_lectures}
              
              onLog={handleLogAttendance}
            />
          </motion.div>
        )
      })}
    </motion.div>
    </>
  )
}
