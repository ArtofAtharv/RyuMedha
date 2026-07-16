"use server"

import { google } from "googleapis"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

export interface Reminder {
  id: string
  title: string
  notes?: string
  due?: string // RFC3339 Timestamp
  completed: boolean
  completedAt?: string
  listId: string
  subjectId?: string
  reminderSettings?: {
    dueTime: boolean
    oneDayPrior: boolean
    twoDaysPrior: boolean
    oneWeekPrior: boolean
    twoWeeksPrior: boolean
    customPrior: boolean
    customValue?: number
    customUnit?: string
  }
}

export interface TaskList {
  id: string
  title: string
}

async function getAuthenticatedClient() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get("sb-access-token")?.value
  const refreshToken = cookieStore.get("sb-refresh-token")?.value

  if (!accessToken) {
    throw new Error("Unauthorized")
  }

  // Initialize a clean, non-persisted client to verify/refresh the session
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        detectSessionInUrl: false
      },
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' })
      }
    }
  )

  // Set the session using cookies. If expired, it will automatically refresh using the refresh token.
  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken || ''
  })

  if (sessionError || !sessionData.session) {
    console.error("getAuthenticatedClient: setSession failed", sessionError)
    throw new Error("Unauthorized")
  }

  const activeSession = sessionData.session
  const validAccessToken = activeSession.access_token

  // If the session was refreshed, update cookies so the browser gets the new session
  if (validAccessToken !== accessToken) {
    try {
      cookieStore.set('sb-access-token', validAccessToken, {
        path: '/',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: activeSession.expires_in,
      })
      if (activeSession.refresh_token) {
        cookieStore.set('sb-refresh-token', activeSession.refresh_token, {
          path: '/',
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30,
        })
      }
    } catch (cookieErr) {
      console.warn("Failed to set refreshed cookies in Server Action:", cookieErr)
    }
  }

  // Create an authenticated client to fetch/update profile
  const authSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${validAccessToken}` },
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' })
      }
    }
  )

  const { data: profile, error } = await authSupabase
    .from('profiles')
    .select('id, google_access_token, google_refresh_token, google_token_expiry')
    .single()

  if (error || !profile || !profile.google_access_token) {
    throw new Error("Google account not linked or authenticated")
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.warn("WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing in environment variables. Google token refresh will fail when tokens expire.")
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret
  )

  oauth2Client.setCredentials({
    access_token: profile.google_access_token,
    refresh_token: profile.google_refresh_token || undefined,
    expiry_date: profile.google_token_expiry ? Number(profile.google_token_expiry) * 1000 : undefined
  })

  // Proactively refresh the Google token if it is expired or close to expiring (within 5 minutes)
  const now = Math.floor(Date.now() / 1000)
  const expiry = profile.google_token_expiry ? Number(profile.google_token_expiry) : 0
  if ((expiry <= now + 300) && profile.google_refresh_token) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken()
      if (credentials.access_token) {
        const updates: any = {
          google_access_token: credentials.access_token
        }
        if (credentials.expiry_date) {
          updates.google_token_expiry = Math.floor(credentials.expiry_date / 1000)
        }
        
        await authSupabase
          .from('profiles')
          .update(updates)
          .eq('id', profile.id)

        oauth2Client.setCredentials(credentials)
      }
    } catch (refreshError) {
      console.error("Error proactively refreshing Google token:", refreshError)
    }
  }

  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      const updates: any = {
        google_access_token: tokens.access_token
      }
      if (tokens.expiry_date) {
        updates.google_token_expiry = Math.floor(tokens.expiry_date / 1000)
      }
      
      try {
        await authSupabase
          .from('profiles')
          .update(updates)
          .eq('id', profile.id)
      } catch (updateErr) {
        console.error("Error updating tokens in event listener:", updateErr)
      }
    }
  })

  return { oauth2Client, profileId: profile.id, supabase: authSupabase }
}

async function findCalendarEvent(auth: any, title: string, dueStr: string | null | undefined): Promise<string | null> {
  try {
    const calendar = google.calendar({ version: "v3", auth })
    const query = `[Ryu Medha] Task: ${title}`
    
    const params: any = {
      calendarId: 'primary',
      q: query,
      maxResults: 10,
    }
    if (dueStr) {
      const date = new Date(dueStr)
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0)
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
      params.timeMin = startOfDay.toISOString()
      params.timeMax = endOfDay.toISOString()
    }
    
    const res = await calendar.events.list(params)
    const event = res.data.items?.find(e => e.summary === query)
    return event?.id || null
  } catch (error) {
    console.error("Error finding calendar event:", error)
    return null
  }
}

function calculateCalendarOverrides(settings: any) {
  const overrides: { method: 'popup'; minutes: number }[] = []
  
  if (settings.dueTime) {
    overrides.push({ method: 'popup', minutes: 0 })
  }
  if (settings.oneDayPrior) {
    overrides.push({ method: 'popup', minutes: 1440 })
  }
  if (settings.twoDaysPrior) {
    overrides.push({ method: 'popup', minutes: 2880 })
  }
  if (settings.oneWeekPrior) {
    overrides.push({ method: 'popup', minutes: 10080 })
  }
  if (settings.twoWeeksPrior) {
    overrides.push({ method: 'popup', minutes: 20160 })
  }
  if (settings.customPrior && settings.customValue && settings.customUnit) {
    let minutes = settings.customValue
    if (settings.customUnit === 'hours') minutes = settings.customValue * 60
    else if (settings.customUnit === 'days') minutes = settings.customValue * 1440
    else if (settings.customUnit === 'weeks') minutes = settings.customValue * 10080
    
    overrides.push({ method: 'popup', minutes })
  }
  
  return overrides.slice(0, 5)
}

async function syncGoogleCalendarEvent(
  auth: any,
  title: string,
  description: string,
  dueStr: string | null | undefined,
  settings: any,
  existingEventId?: string | null
): Promise<string | null> {
  if (!dueStr) {
    if (existingEventId) {
      try {
        const calendar = google.calendar({ version: "v3", auth })
        await calendar.events.delete({
          calendarId: 'primary',
          eventId: existingEventId,
        })
      } catch (e) {
        console.error("Error deleting calendar event:", e)
      }
    }
    return null
  }

  try {
    const calendar = google.calendar({ version: "v3", auth })
    const overrides = calculateCalendarOverrides(settings)
    
    const requestBody = {
      summary: `[Ryu Medha] Task: ${title}`,
      description: description,
      start: {
        dateTime: dueStr,
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: new Date(new Date(dueStr).getTime() + 30 * 60 * 1000).toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      reminders: {
        useDefault: false,
        overrides: overrides,
      }
    }

    if (existingEventId) {
      try {
        const response = await calendar.events.patch({
          calendarId: 'primary',
          eventId: existingEventId,
          requestBody,
        })
        return response.data.id || null
      } catch (err: any) {
        if (err.status === 404 || err.statusCode === 404) {
          const response = await calendar.events.insert({
            calendarId: 'primary',
            requestBody,
          })
          return response.data.id || null
        }
        throw err;
      }
    } else {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody,
      })
      return response.data.id || null
    }
  } catch (error) {
    console.error("Error syncing Google Calendar event:", error)
    return existingEventId || null
  }
}

async function deleteGoogleCalendarEvent(auth: any, eventId: string) {
  try {
    const calendar = google.calendar({ version: "v3", auth })
    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    })
  } catch (error) {
    console.error("Error deleting Google Calendar event:", error)
  }
}

function calculateReminderTimes(dueStr: string, settings: any) {
  const dueDate = new Date(dueStr)
  const list: { time: Date; type: string }[] = []
  
  if (settings.dueTime) {
    list.push({ time: dueDate, type: 'due_date' })
  }
  if (settings.oneDayPrior) {
    const t = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000)
    list.push({ time: t, type: '1_day_prior' })
  }
  if (settings.twoDaysPrior) {
    const t = new Date(dueDate.getTime() - 2 * 24 * 60 * 60 * 1000)
    list.push({ time: t, type: '2_days_prior' })
  }
  if (settings.oneWeekPrior) {
    const t = new Date(dueDate.getTime() - 7 * 24 * 60 * 60 * 1000)
    list.push({ time: t, type: '1_week_prior' })
  }
  if (settings.twoWeeksPrior) {
    const t = new Date(dueDate.getTime() - 14 * 24 * 60 * 60 * 1000)
    list.push({ time: t, type: '2_weeks_prior' })
  }
  if (settings.customPrior && settings.customValue && settings.customUnit) {
    let multiplier = 60 * 1000
    if (settings.customUnit === 'hours') multiplier = 60 * 60 * 1000
    else if (settings.customUnit === 'days') multiplier = 24 * 60 * 60 * 1000
    else if (settings.customUnit === 'weeks') multiplier = 7 * 24 * 60 * 60 * 1000
    
    const t = new Date(dueDate.getTime() - settings.customValue * multiplier)
    list.push({ time: t, type: `custom:${settings.customValue}:${settings.customUnit}` })
  }
  
  return list
}

export async function fetchTaskLists(): Promise<TaskList[]> {
  try {
    const { oauth2Client: auth } = await getAuthenticatedClient()
    const service = google.tasks({ version: "v1", auth })
    const response = await service.tasklists.list({
      maxResults: 50,
    })
    
    return (
      response.data.items?.map((item) => ({
        id: item.id || "",
        title: item.title || "",
      })) || []
    )
  } catch (error) {
    console.error("Error fetching task lists:", error)
    return []
  }
}

export async function fetchReminders(listId = "@default"): Promise<Reminder[]> {
  try {
    const { oauth2Client: auth, supabase, profileId } = await getAuthenticatedClient()
    const service = google.tasks({ version: "v1", auth })
    
    const response = await service.tasks.list({
      tasklist: listId,
      showCompleted: true,
      showHidden: true,
      maxResults: 100,
    })

    const { data: localTasks } = await supabase
      .from('tasks')
      .select('id, title, due_date, subject_id, is_exam, description, is_completed, completed_at')
      .eq('profile_id', profileId)

    const { data: localReminders } = await supabase
      .from('task_reminders')
      .select('task_id, reminder_type')
      .eq('profile_id', profileId)

    const localRemindersMap = new Map<string, any[]>()
    if (localReminders) {
      localReminders.forEach(r => {
        if (!localRemindersMap.has(r.task_id)) {
          localRemindersMap.set(r.task_id, [])
        }
        localRemindersMap.get(r.task_id)!.push(r.reminder_type)
      })
    }
    
    const matchedLocalIds = new Set<string>()
    
    const googleReminders = response.data.items?.map((item) => {
      let finalDue = item.due || undefined
      const itemTitleNormalized = item.title?.trim().toLowerCase() || ""
      const itemDatePart = item.due ? item.due.split("T")[0] : null

      // Match Google task with local task by title & due date-only (checking clean titles)
      const matchedLocal = localTasks?.find(t => {
        const cleanLocalTitle = t.title.replace("[Exam] ", "").trim().toLowerCase()
        const cleanGoogleTitle = item.title?.replace("[Exam] ", "").trim().toLowerCase() || ""
        if (cleanLocalTitle !== cleanGoogleTitle) return false
        if (!t.due_date && !itemDatePart) return true
        if (t.due_date && itemDatePart) {
          return t.due_date.split("T")[0] === itemDatePart
        }
        return false
      })

      if (matchedLocal) {
        matchedLocalIds.add(matchedLocal.id)
        if (matchedLocal.due_date) {
          finalDue = matchedLocal.due_date
        }
      }

      let reminderSettings = undefined
      if (matchedLocal) {
        const types = localRemindersMap.get(matchedLocal.id) || []
        const hasCustom = types.some(t => t.startsWith('custom:'))
        let customValue = 3
        let customUnit = 'hours'
        
        if (hasCustom) {
          const customType = types.find(t => t.startsWith('custom:'))
          if (customType) {
            const parts = customType.split(':')
            if (parts.length === 3) {
              customValue = parseInt(parts[1]) || 3
              customUnit = parts[2]
            }
          }
        }

        reminderSettings = {
          dueTime: types.includes('due_date'),
          oneDayPrior: types.includes('1_day_prior'),
          twoDaysPrior: types.includes('2_days_prior'),
          oneWeekPrior: types.includes('1_week_prior'),
          twoWeeksPrior: types.includes('2_weeks_prior'),
          customPrior: hasCustom,
          customValue,
          customUnit
        }
      }
      
      const isExam = item.title?.startsWith("[Exam]") || matchedLocal?.is_exam || matchedLocal?.title.startsWith("[Exam]")
      const displayTitle = isExam && !item.title?.startsWith("[Exam]") ? `[Exam] ${item.title}` : item.title || ""

      return {
        id: item.id || "",
        title: displayTitle,
        notes: item.notes || "",
        due: finalDue,
        completed: item.status === "completed",
        completedAt: item.completed || undefined,
        listId,
        subjectId: matchedLocal?.subject_id || undefined,
        reminderSettings
      }
    }) || []

    const unmatchedLocal = localTasks?.filter(t => !matchedLocalIds.has(t.id)) || []
    
    const unmatchedReminders = unmatchedLocal.map(t => {
      const types = localRemindersMap.get(t.id) || []
      const hasCustom = types.some(x => x.startsWith('custom:'))
      let customValue = 3
      let customUnit = 'hours'
      
      if (hasCustom) {
        const customType = types.find(x => x.startsWith('custom:'))
        if (customType) {
          const parts = customType.split(':')
          if (parts.length === 3) {
            customValue = parseInt(parts[1]) || 3
            customUnit = parts[2]
          }
        }
      }

      const reminderSettings = {
        dueTime: types.includes('due_date'),
        oneDayPrior: types.includes('1_day_prior'),
        twoDaysPrior: types.includes('2_days_prior'),
        oneWeekPrior: types.includes('1_week_prior'),
        twoWeeksPrior: types.includes('2_weeks_prior'),
        customPrior: hasCustom,
        customValue,
        customUnit
      }

      return {
        id: t.id,
        title: t.title,
        notes: t.description || "",
        due: t.due_date || undefined,
        completed: t.is_completed || false,
        completedAt: t.completed_at || undefined,
        listId,
        subjectId: t.subject_id || undefined,
        reminderSettings
      }
    })

    try {
      require('fs').writeFileSync('c:\\Users\\athar\\Documents\\RyuMedha\\web\\scratch_debug.json', JSON.stringify({
        localTasks: localTasks?.map(t => ({ id: t.id, title: t.title, due_date: t.due_date, subject_id: t.subject_id })),
        googleTasks: response.data.items?.map(t => ({ id: t.id, title: t.title, due: t.due, status: t.status })),
        matchedLocalIds: Array.from(matchedLocalIds)
      }, null, 2))
    } catch (e) {}

    return [...googleReminders, ...unmatchedReminders]
  } catch (error) {
    console.error("Error fetching reminders:", error)
    return []
  }
}

export async function createReminder(data: {
  title: string
  notes?: string
  due?: string // RFC3339 Timestamp
  listId?: string
  subjectId?: string
  reminderSettings?: {
    dueTime: boolean
    oneDayPrior: boolean
    twoDaysPrior: boolean
    oneWeekPrior: boolean
    twoWeeksPrior: boolean
    customPrior: boolean
    customValue?: number
    customUnit?: string
  }
}): Promise<Reminder | null> {
  try {
    const { oauth2Client: auth, profileId, supabase } = await getAuthenticatedClient()
    const service = google.tasks({ version: "v1", auth })
    const listId = data.listId || "@default"
    
    // 1. Create task in local database
    const { data: localTask, error: insertErr } = await supabase
      .from('tasks')
      .insert({
        profile_id: profileId,
        title: data.title,
        description: data.notes || '',
        due_date: data.due || null,
        is_completed: false,
        subject_id: data.subjectId || null
      })
      .select()
      .single()

    if (insertErr) {
      console.error("Local database task insert error:", insertErr)
    }

    let calendarEventId: string | null = null
    const defaultSettings = {
      dueTime: true,
      oneDayPrior: true,
      twoDaysPrior: true,
      oneWeekPrior: true,
      twoWeeksPrior: true,
      customPrior: true,
      customValue: 3,
      customUnit: 'hours'
    }
    const finalSettings = data.reminderSettings || defaultSettings

    if (localTask && data.due) {
      // 2. Schedule reminders in local database
      const scheduledList = calculateReminderTimes(data.due, finalSettings)
      for (const item of scheduledList) {
        await supabase
          .from('task_reminders')
          .insert({
            task_id: localTask.id,
            profile_id: profileId,
            scheduled_for: item.time.toISOString(),
            reminder_type: item.type,
            whatsapp_sent: false,
            push_sent: false
          })
      }

      // 3. Sync to Google Calendar
      calendarEventId = await syncGoogleCalendarEvent(
        auth,
        data.title,
        data.notes || '',
        data.due,
        finalSettings
      )
    }

    // 4. Create task on Google Tasks (completely clean notes)
    const response = await service.tasks.insert({
      tasklist: listId,
      requestBody: {
        title: data.title,
        notes: data.notes || "",
        due: data.due ? data.due.split("T")[0] + "T00:00:00.000Z" : undefined,
      },
    })
    
    const item = response.data
    
    revalidatePath("/dashboard/tasks")
    return {
      id: item.id || "",
      title: item.title || "",
      notes: item.notes || "",
      due: data.due || undefined,
      completed: item.status === "completed",
      completedAt: item.completed || undefined,
      listId,
      subjectId: data.subjectId,
      reminderSettings: finalSettings
    }
  } catch (error) {
    console.error("Error creating reminder:", error)
    return null
  }
}

export async function updateReminder(
  id: string,
  data: {
    title?: string
    notes?: string
    due?: string // RFC3339 Timestamp
    completed?: boolean
    subjectId?: string | null
    reminderSettings?: {
      dueTime: boolean
      oneDayPrior: boolean
      twoDaysPrior: boolean
      oneWeekPrior: boolean
      twoWeeksPrior: boolean
      customPrior: boolean
      customValue?: number
      customUnit?: string
    }
  },
  listId = "@default"
): Promise<Reminder | null> {
  try {
    const { oauth2Client: auth, profileId, supabase } = await getAuthenticatedClient()
    const service = google.tasks({ version: "v1", auth })
    
    // Get current Google Task state
    const currentTask = await service.tasks.get({
      tasklist: listId,
      task: id,
    })
    
    const currentTitle = currentTask.data.title || ""
    const currentDatePart = currentTask.data.due ? currentTask.data.due.split("T")[0] : null

    // Look up local task by old title and date
    const { data: localTasks } = await supabase
      .from('tasks')
      .select('id, title, due_date, subject_id')
      .eq('profile_id', profileId)

    const matchedLocal = localTasks?.find(t => {
      if (t.title.trim().toLowerCase() !== currentTitle.trim().toLowerCase()) return false
      if (!t.due_date && !currentDatePart) return true
      if (t.due_date && currentDatePart) {
        return t.due_date.split("T")[0] === currentDatePart
      }
      return false
    })

    let taskId = matchedLocal?.id || null
    let localTask = matchedLocal || null

    if (!taskId) {
      const { data: insertedTask } = await supabase
        .from('tasks')
        .insert({
          profile_id: profileId,
          title: data.title !== undefined ? data.title : currentTask.data.title || "",
          description: data.notes !== undefined ? data.notes : (currentTask.data.notes || ""),
          due_date: data.due !== undefined ? (data.due || null) : (currentTask.data.due || null),
          is_completed: data.completed !== undefined ? data.completed : (currentTask.data.status === "completed"),
          subject_id: data.subjectId !== undefined ? data.subjectId : null
        })
        .select()
        .single()
      localTask = insertedTask
      if (localTask) {
        taskId = localTask.id
      }
    }

    const finalCompleted = data.completed !== undefined ? data.completed : (currentTask.data.status === "completed")
    const finalDue = data.due !== undefined ? (data.due || null) : (localTask ? localTask.due_date : null)
    
    const existingSettings = {
      dueTime: true,
      oneDayPrior: true,
      twoDaysPrior: true,
      oneWeekPrior: true,
      twoWeeksPrior: true,
      customPrior: true,
      customValue: 3,
      customUnit: 'hours'
    }
    const finalSettings = data.reminderSettings !== undefined ? data.reminderSettings : existingSettings

    if (taskId) {
      const updateData: any = {}
      if (data.title !== undefined) updateData.title = data.title
      if (data.notes !== undefined) updateData.description = data.notes
      if (data.due !== undefined) updateData.due_date = data.due || null
      if (data.subjectId !== undefined) updateData.subject_id = data.subjectId
      if (data.completed !== undefined) {
        updateData.is_completed = data.completed
        updateData.completed_at = data.completed ? new Date().toISOString() : null
      }

      await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)

      await supabase
        .from('task_reminders')
        .delete()
        .eq('task_id', taskId)

      if (!finalCompleted && finalDue) {
        const scheduledList = calculateReminderTimes(finalDue, finalSettings)
        for (const item of scheduledList) {
          await supabase
            .from('task_reminders')
            .insert({
              task_id: taskId,
              profile_id: profileId,
              scheduled_for: item.time.toISOString(),
              reminder_type: item.type,
              whatsapp_sent: false,
              push_sent: false
            })
        }
      }
    }

    // Find the calendar event by old title & date
    let calendarEventId = await findCalendarEvent(auth, currentTitle, localTask?.due_date)

    if (finalCompleted) {
      if (calendarEventId) {
        await deleteGoogleCalendarEvent(auth, calendarEventId)
      }
    } else {
      await syncGoogleCalendarEvent(
        auth,
        data.title !== undefined ? data.title : currentTask.data.title || "",
        data.notes !== undefined ? data.notes : (currentTask.data.notes || ""),
        finalDue,
        finalSettings,
        calendarEventId
      )
    }

    const requestBody = {
      ...currentTask.data,
      ...(data.title !== undefined && { title: data.title }),
      notes: data.notes !== undefined ? data.notes : (currentTask.data.notes || ""),
      ...(data.due !== undefined && { due: data.due ? data.due.split("T")[0] + "T00:00:00.000Z" : null }),
      ...(data.completed !== undefined && {
        status: data.completed ? "completed" : "needsAction",
        completed: data.completed ? new Date().toISOString() : null,
      }),
    }
    
    const response = await service.tasks.update({
      tasklist: listId,
      task: id,
      requestBody,
    })
    
    const item = response.data
    
    revalidatePath("/dashboard/tasks")
    return {
      id: item.id || "",
      title: item.title || "",
      notes: item.notes || "",
      due: finalDue || undefined,
      completed: item.status === "completed",
      completedAt: item.completed || undefined,
      listId,
      subjectId: data.subjectId !== undefined ? (data.subjectId || undefined) : (localTask?.subject_id || undefined),
      reminderSettings: finalSettings
    }
  } catch (error) {
    console.error("Error updating reminder:", error)
    return null
  }
}

export async function deleteReminder(id: string, listId = "@default"): Promise<boolean> {
  try {
    const { oauth2Client: auth, supabase } = await getAuthenticatedClient()

    // 1. Try to delete local task by UUID
    const { data: deletedLocal } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .select('title, due_date, subject_id')
      .single()

    let localTitle = deletedLocal?.title || ""
    let localDueDate = deletedLocal?.due_date || null
    let subjectId = deletedLocal?.subject_id || null

    if (!deletedLocal) {
      // 2. If it wasn't matched by UUID, it's a Google Task ID deletion. Retrieve it first to find title/date
      try {
        const service = google.tasks({ version: "v1", auth })
        const currentTask = await service.tasks.get({
          tasklist: listId,
          task: id,
        })
        localTitle = currentTask.data.title || ""
        const currentDatePart = currentTask.data.due ? currentTask.data.due.split("T")[0] : null

        // Look up local task by title & date
        const { data: localTasks } = await supabase
          .from('tasks')
          .select('id, due_date, subject_id')
          .eq('title', localTitle)

        const matchedLocal = localTasks?.find(t => {
          if (!t.due_date && !currentDatePart) return true
          if (t.due_date && currentDatePart) {
            return t.due_date.split("T")[0] === currentDatePart
          }
          return false
        })

        if (matchedLocal) {
          localDueDate = matchedLocal.due_date
          subjectId = matchedLocal.subject_id
          await supabase
            .from('tasks')
            .delete()
            .eq('id', matchedLocal.id)
        }

        // Delete from Google Tasks
        await service.tasks.delete({
          tasklist: listId,
          task: id,
        })
      } catch (googleErr) {
        console.warn("Google Task lookup/delete failed or not found:", googleErr)
      }
    } else {
      // 3. It was a local task deleted by UUID. Try to find and delete matching Google Task if connected
      try {
        const service = google.tasks({ version: "v1", auth })
        const response = await service.tasks.list({
          tasklist: listId,
          maxResults: 100,
        })
        const matchedGoogleTask = response.data.items?.find(item => {
          const titleMatch = item.title?.trim().toLowerCase() === localTitle.trim().toLowerCase()
          if (!titleMatch) return false
          const itemDatePart = item.due ? item.due.split("T")[0] : null
          if (!localDueDate && !itemDatePart) return true
          if (localDueDate && itemDatePart) {
            return localDueDate.split("T")[0] === itemDatePart
          }
          return false
        })
        if (matchedGoogleTask?.id) {
          await service.tasks.delete({
            tasklist: listId,
            task: matchedGoogleTask.id
          })
        }
      } catch (googleErr) {
        console.warn("Google Tasks matching delete skipped or failed:", googleErr)
      }
    }

    // 4. Clean up shared course exam dates if it was an exam task
    if (subjectId && localTitle) {
      try {
        const { data: subjectData } = await supabase
          .from('subjects')
          .select('type, source_course_id')
          .eq('id', subjectId)
          .single()

        if (subjectData?.type === 'academic' && subjectData.source_course_id) {
          const courseId = typeof subjectData.source_course_id === 'object' 
            ? (subjectData.source_course_id as { id?: string })?.id 
            : (subjectData.source_course_id as string)

          if (courseId) {
            const { data: courseData } = await supabase
              .from('academic_courses')
              .select('id, exam_dates')
              .eq('id', courseId)
              .single()

            if (courseData?.exam_dates) {
              const cleanTitleLabel = localTitle.startsWith("[Exam] ") 
                ? localTitle.replace("[Exam] ", "") 
                : localTitle

              const newDates = { ...courseData.exam_dates }
              let deletedAny = false
              for (const key of Object.keys(newDates)) {
                if (key.trim().toLowerCase() === cleanTitleLabel.trim().toLowerCase()) {
                  delete newDates[key]
                  deletedAny = true
                }
              }

              if (deletedAny) {
                await supabase
                  .from('academic_courses')
                  .update({ exam_dates: newDates })
                  .eq('id', courseId)
              }
            }
          }
        }
      } catch (courseErr) {
        console.warn("Failed to delete shared course exam date on delete:", courseErr)
      }
    }

    // 5. Try to delete the linked Google Calendar event
    try {
      const calendarEventId = await findCalendarEvent(auth, localTitle, localDueDate)
      if (calendarEventId) {
        await deleteGoogleCalendarEvent(auth, calendarEventId)
      }
    } catch (calErr) {
      console.warn("Google Calendar event delete skipped or failed:", calErr)
    }

    revalidatePath("/dashboard/tasks")
    return true
  } catch (error) {
    console.error("Error deleting reminder:", error)
    return false
  }
}

export async function createTaskList(title: string): Promise<TaskList | null> {
  try {
    const { oauth2Client: auth } = await getAuthenticatedClient()
    const service = google.tasks({ version: "v1", auth })
    const response = await service.tasklists.insert({
      requestBody: { title }
    })
    revalidatePath("/dashboard/tasks")
    return {
      id: response.data.id || "",
      title: response.data.title || "",
    }
  } catch (error) {
    console.error("Error creating task list:", error)
    return null
  }
}

export async function updateTaskList(listId: string, title: string): Promise<TaskList | null> {
  try {
    const { oauth2Client: auth } = await getAuthenticatedClient()
    const service = google.tasks({ version: "v1", auth })
    const response = await service.tasklists.patch({
      tasklist: listId,
      requestBody: { title }
    })
    revalidatePath("/dashboard/tasks")
    return {
      id: response.data.id || "",
      title: response.data.title || "",
    }
  } catch (error) {
    console.error("Error updating task list:", error)
    return null
  }
}

export async function deleteTaskList(listId: string): Promise<boolean> {
  try {
    const { oauth2Client: auth } = await getAuthenticatedClient()
    const service = google.tasks({ version: "v1", auth })
    await service.tasklists.delete({
      tasklist: listId
    })
    revalidatePath("/dashboard/tasks")
    return true
  } catch (error) {
    console.error("Error deleting task list:", error)
    return false
  }
}
