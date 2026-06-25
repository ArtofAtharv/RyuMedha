"use client"

import { useState, useMemo, useCallback } from "react"
import { getAppClient } from "@/lib/supabase-client"
import { AttendanceCard } from "./attendance-card"
import { useRouter } from "next/navigation"
import { m, Variants } from "motion/react"
import { toast } from "sonner"
import { useGamification } from "./gamification-context"
import { getSourceCourse } from "@/lib/source-course"

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

export interface SubjectInfo {
  id: string
  name: string
  type: string
  is_active: boolean
  color_hex?: string
  expected_total_lectures?: number
  instructor_name?: string
  label?: string
  category_id?: string
  source_course_id?:
    | {
        semester_id?: string
        expected_total_lectures?: number
        instructor_name?: string
        exam_dates?: Record<string, string>
      }
    | Array<{
        semester_id?: string
        expected_total_lectures?: number
        instructor_name?: string
        exam_dates?: Record<string, string>
      }>
}

export interface AttendanceData {
  subject_id: string
  total_present: number
  total_absent: number
  total_deemed?: number
  [key: string]: unknown
}

// Delegate to the shared singleton cache in supabase-client.ts
function getSupabase(token: string) {
  return getAppClient({ global: { headers: { Authorization: `Bearer ${token}` } } })
}

export function InteractiveAttendanceGrid({ initialData, subjectsInfo, token, profileId, targetPct }: Readonly<{ initialData: AttendanceData[], subjectsInfo: SubjectInfo[], token: string, profileId: string, targetPct: number }>) {
  const [data, setData] = useState(initialData)
  const [prevInitialData, setPrevInitialData] = useState(initialData)
  if (initialData !== prevInitialData) {
    setPrevInitialData(initialData)
    setData(initialData)
  }
  const [isUpdating, setIsUpdating] = useState(false)
  const router = useRouter()
  const { addXp, incrementCombo } = useGamification()

  const supabase = getSupabase(token)

  const calculateAdvice = useCallback(function calculateAdvice(totalPresent: number, totalAbsent: number, totalDeemed: number, expectedTotal: number) {
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
      // Fix: Bunks should only be reduced by ACTUAL absences. Deemed lectures act as Presents.
      bunksRemaining = maxAllowedMisses - totalAbsent
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
      currentMisses: totalAbsent,
      remainingLectures: Math.max(0, expectedTotal - totalLogged)
    }
  }, [targetPct])

  // Merge Subjects with Attendance Data to ensure all Academic subjects show up
  // AND ensure advice is calculated for all rows on initial load and updates
  const mergedData = useMemo(() => {
    const academicSubjects = subjectsInfo.filter((s) => s.type === 'academic' && s.is_active === true)
    
    return academicSubjects.map((sub) => {
      const existingAtt = data.find((d) => d.subject_id === sub.id)
      
      const present = existingAtt ? existingAtt.total_present : 0
      const absent = existingAtt ? existingAtt.total_absent : 0
      const deemed = existingAtt ? (existingAtt.total_deemed || 0) : 0
      const expectedTotal = sub.expected_total_lectures || getSourceCourse(sub.source_course_id)?.expected_total_lectures || 0

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
    }).sort((a, b) => a.subject_name.localeCompare(b.subject_name))
  }, [data, subjectsInfo, calculateAdvice])

  const buildUpdatedRow = useCallback((item: AttendanceData, subjectId: string, isUndo: boolean, targetStatus: string) => {
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
    const expectedTotal = subInfo?.expected_total_lectures || getSourceCourse(subInfo?.source_course_id)?.expected_total_lectures || 0
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
  }, [calculateAdvice, subjectsInfo])

  const performOptimisticUpdate = useCallback((subjectId: string, isUndo: boolean, targetStatus: string) => {
    setData(prev => {
      const exists = prev.find(item => item.subject_id === subjectId)

      if (exists) {
        return prev.map(item =>
          item.subject_id === subjectId ? buildUpdatedRow(item, subjectId, isUndo, targetStatus) : item
        )
      }

      const sub = subjectsInfo.find(s => s.id === subjectId)
      if (!sub) return prev
      const synthesized: AttendanceData = {
        subject_id: subjectId,
        subject_name: sub.name,
        total_present: 0,
        total_absent: 0,
        total_deemed: 0,
        attendance_percentage: 0
      }
      return [...prev, buildUpdatedRow(synthesized, subjectId, isUndo, targetStatus)]
    })
  }, [buildUpdatedRow, subjectsInfo])

  const performDatabaseUndo = useCallback(async (subjectId: string, targetStatus: string) => {
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
    }
  }, [supabase, profileId])

  const performDatabaseLog = useCallback(async (subjectId: string, targetStatus: string) => {
    const today = new Date().toISOString().split('T')[0]
    
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
      
      if (targetStatus === 'present' || targetStatus === 'deemed') {
        addXp(10)
        incrementCombo()
        toast.success("✨ +10 XP earned!", { icon: "🏆" })
      }
    }
    
    await supabase.from('attendance_logs').insert([{
      profile_id: profileId,
      subject_id: subjectId,
      status: targetStatus,
      lecture_date: today
    }])
  }, [supabase, profileId, subjectsInfo, addXp, incrementCombo])

  async function handleLogAttendance(subjectId: string, action: 'present'|'absent'|'deemed'|'undo_present'|'undo_absent'|'undo_deemed') {
    if (isUpdating || !subjectId) return
    setIsUpdating(true)

    const isUndo = action.startsWith('undo_')
    const targetStatus = action.replace('undo_', '')

    performOptimisticUpdate(subjectId, isUndo, targetStatus)

    if (isUndo) {
      await performDatabaseUndo(subjectId, targetStatus)
    } else {
      await performDatabaseLog(subjectId, targetStatus)
    }

    setIsUpdating(false)
    router.refresh()
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
    <m.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
      {mergedData.map((item, idx) => {
        // Calculate percentage dynamically here if it was 0 from synthesis
        let pct = item.attendance_percentage
        if (pct === 0 && (item.total_present > 0 || item.total_absent > 0 || item.total_deemed > 0)) {
           pct = ((item.total_present + (item.total_deemed || 0)) / (item.total_present + item.total_absent + (item.total_deemed || 0))) * 100
        }

        const subRecord = subjectsInfo?.find((s) => s.id === item.subject_id)
        const instructorName = getSourceCourse(subRecord?.source_course_id)?.instructor_name || subRecord?.instructor_name || undefined

        return (
          <m.div key={item.subject_id || `subj-${idx}`} variants={cardVariants}>
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
          </m.div>
        )
      })}
    </m.div>
  )
}
