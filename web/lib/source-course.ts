export interface SourceCourseInfo {
  id?: string
  semester_id?: string
  expected_total_lectures?: number
  instructor_name?: string
  exam_dates?: Record<string, string>
}

export function getSourceCourse(
  sourceCourseId: SourceCourseInfo | SourceCourseInfo[] | null | undefined
): SourceCourseInfo | undefined {
  if (!sourceCourseId) return undefined
  return Array.isArray(sourceCourseId) ? sourceCourseId[0] : sourceCourseId
}
