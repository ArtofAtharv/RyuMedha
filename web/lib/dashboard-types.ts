import type { SourceCourseInfo } from "@/lib/source-course"

export interface StudyTimer {
  id: string
  profile_id: string
  subject_id: string
  started_at: string
  ended_at?: string | null
  pause_started_at?: string | null
  total_pause_seconds?: number
  duration_seconds?: number
  timer_type: string
  is_synced?: boolean
  events?: Array<{ type: string; timestamp: string }>
  subjects?: {
    id?: string
    name?: string
    type?: string
    source_course_id?: SourceCourseInfo | SourceCourseInfo[]
  }
}

export interface DashboardSubject {
  id: string
  name: string
  type: string
  color_hex?: string
  label?: string
  is_active?: boolean
  category_id?: string | null
  expected_total_lectures?: number
  instructor_name?: string
  source_course_id?: SourceCourseInfo | SourceCourseInfo[] | null
}

export interface TaskSubject {
  id?: string
  name?: string
  color_hex?: string
  type?: string
}

export interface TaskReminder {
  id?: string
  scheduled_for?: string
  reminder_type?: string
}

export interface TaskItem {
  id: string
  title: string
  priority: string
  due_date?: string | null
  subject_id?: string | null
  is_completed?: boolean
  is_exam?: boolean
  has_reminder?: boolean
  reminder_time?: string | null
  created_at: string
  completed_at?: string | null
  subjects?: TaskSubject | null
  task_reminders?: TaskReminder[]
}
