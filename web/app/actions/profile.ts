"use server"

import { getAppClient } from "@/lib/supabase-client"

export async function getServerSupabase(token: string) {
  return getAppClient({ global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function fetchProfileDataAction(token: string, phone: string) {
  const supabase = await getServerSupabase(token)
  
  const [{ data: prof }, { data: unis }] = await Promise.all([
    supabase.from('profiles').select('*').eq('whatsapp_number', phone).single(),
    supabase.from('universities').select('id, name').order('name')
  ])
  
  return { profile: prof, universities: unis }
}

export async function fetchUniversitiesAction(token: string) {
  const supabase = await getServerSupabase(token)
  const { data } = await supabase.from('universities').select('id, name').order('name')
  return data
}

export async function fetchProgramsAction(token: string, universityId: string) {
  const supabase = await getServerSupabase(token)
  const { data } = await supabase.from('programs').select('id, name').eq('university_id', universityId).order('name')
  return data
}

export async function fetchSemestersAction(token: string, programId: string) {
  const supabase = await getServerSupabase(token)
  const { data } = await supabase.from('semesters').select('id, name, semester_number').eq('program_id', programId).order('semester_number')
  return data
}

export async function updateProfileAction(token: string, profileId: string, updates: Record<string, unknown>) {
  const supabase = await getServerSupabase(token)
  const { error } = await supabase.from('profiles').update(updates).eq('id', profileId)
  return { success: !error, error }
}

export async function deleteAccountAction(token: string, profileId: string) {
  const supabase = await getServerSupabase(token)
  await supabase.from('study_timers').delete().eq('profile_id', profileId)
  await supabase.from('tasks').delete().eq('profile_id', profileId)
  await supabase.from('grades').delete().eq('profile_id', profileId)
  await supabase.from('attendance_logs').delete().eq('profile_id', profileId)
  await supabase.from('subjects').delete().eq('profile_id', profileId)
  await supabase.from('profiles').delete().eq('id', profileId)
  return { success: true }
}
