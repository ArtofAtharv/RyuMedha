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
  if (!accessToken) {
    throw new Error("Unauthorized")
  }

  // Fetch the user's profile to get Google tokens
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, google_access_token, google_refresh_token, google_token_expiry')
    .single()

  if (error || !profile || !profile.google_access_token) {
    throw new Error("Google account not linked or authenticated")
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )

  oauth2Client.setCredentials({
    access_token: profile.google_access_token,
    refresh_token: profile.google_refresh_token || undefined,
    expiry_date: profile.google_token_expiry ? Number(profile.google_token_expiry) * 1000 : undefined
  })

  // Listen for refresh tokens and save them back to database
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      const updates: any = {
        google_access_token: tokens.access_token
      }
      if (tokens.expiry_date) {
        updates.google_token_expiry = Math.floor(tokens.expiry_date / 1000)
      }
      
      await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id)
    }
  })

  return { oauth2Client, profileId: profile.id, supabase }
}

function stripGoogleMarkers(notes?: string): string {
  if (!notes) return ""
  return notes
    .replace(/\s*\[task_id:\s*[a-f0-9\-]+\]/gi, '')
    .replace(/\s*\[calendar_event_id:\s*[^\]]+\]/gi, '')
    .trim()
}

function extractTaskId(notes?: string): string | null {
  if (!notes) return null
  const match = notes.match(/\[task_id:\s*([a-f0-9\-]+)\]/i)
  return match ? match[1] : null
}

function extractCalendarEventId(notes?: string): string | null {
  if (!notes) return null
  const match = notes.match(/\[calendar_event_id:\s*([^\]]+)\]/i)
  return match ? match[1] : null
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

    // Fetch local tasks to get precise due dates (with times)
    const { data: localTasks } = await supabase
      .from('tasks')
      .select('id, due_date')
      .eq('profile_id', profileId)

    // Fetch local task reminders to map settings
    const { data: localReminders } = await supabase
      .from('task_reminders')
      .select('task_id, reminder_type')
      .eq('profile_id', profileId)

    const localTasksMap = new Map<string, string | null>()
    if (localTasks) {
      localTasks.forEach(t => {
        localTasksMap.set(t.id, t.due_date)
      })
    }

    const localRemindersMap = new Map<string, any[]>()
    if (localReminders) {
      localReminders.forEach(r => {
        if (!localRemindersMap.has(r.task_id)) {
          localRemindersMap.set(r.task_id, [])
        }
        localRemindersMap.get(r.task_id)!.push(r.reminder_type)
      })
    }
    
    return (
      response.data.items?.map((item) => {
        const taskId = extractTaskId(item.notes || "")
        let finalDue = item.due || undefined
        if (taskId && localTasksMap.has(taskId)) {
          const localDue = localTasksMap.get(taskId)
          if (localDue) {
            finalDue = localDue
          }
        }

        let reminderSettings = undefined
        if (taskId) {
          const types = localRemindersMap.get(taskId) || []
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
        
        return {
          id: item.id || "",
          title: item.title || "",
          notes: stripGoogleMarkers(item.notes || ""),
          due: finalDue,
          completed: item.status === "completed",
          completedAt: item.completed || undefined,
          listId,
          reminderSettings
        }
      }) || []
    )
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
    
    // 1. Create task in local database first
    const { data: localTask, error: insertErr } = await supabase
      .from('tasks')
      .insert({
        profile_id: profileId,
        title: data.title,
        description: data.notes || '',
        due_date: data.due || null,
        is_completed: false
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

    if (localTask) {
      // 2. Schedule reminders in local database if due date exists
      if (data.due) {
        const scheduledList = calculateReminderTimes(data.due, finalSettings)
        for (const item of scheduledList) {
          const { error: reminderErr } = await supabase
            .from('task_reminders')
            .insert({
              task_id: localTask.id,
              profile_id: profileId,
              scheduled_for: item.time.toISOString(),
              reminder_type: item.type,
              whatsapp_sent: false,
              push_sent: false
            })
          if (reminderErr) {
            console.error("Local database reminder insert error:", reminderErr)
          }
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
    }

    // 4. Create task on Google Tasks with markers in notes
    let notesWithMarkers = data.notes || ""
    if (localTask) {
      notesWithMarkers = `${notesWithMarkers}\n\n[task_id: ${localTask.id}]`.trim()
    }
    if (calendarEventId) {
      notesWithMarkers = `${notesWithMarkers}\n\n[calendar_event_id: ${calendarEventId}]`.trim()
    }
    
    const response = await service.tasks.insert({
      tasklist: listId,
      requestBody: {
        title: data.title,
        notes: notesWithMarkers,
        due: data.due ? data.due.split("T")[0] + "T00:00:00.000Z" : undefined, // Google Tasks normalized date
      },
    })
    
    const item = response.data
    
    revalidatePath("/dashboard/tasks")
    return {
      id: item.id || "",
      title: item.title || "",
      notes: stripGoogleMarkers(item.notes || ""),
      due: data.due || undefined,
      completed: item.status === "completed",
      completedAt: item.completed || undefined,
      listId,
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
    
    // Get the current task state
    const currentTask = await service.tasks.get({
      tasklist: listId,
      task: id,
    })
    
    const currentNotes = currentTask.data.notes || ""
    let taskId = extractTaskId(currentNotes)
    let calendarEventId = extractCalendarEventId(currentNotes)

    let localTask = null
    if (taskId) {
      const { data: foundTask } = await supabase
        .from('tasks')
        .select('due_date')
        .eq('id', taskId)
        .single()
      localTask = foundTask
    } else {
      const { data: insertedTask } = await supabase
        .from('tasks')
        .insert({
          profile_id: profileId,
          title: data.title !== undefined ? data.title : currentTask.data.title || "",
          description: data.notes !== undefined ? data.notes : stripGoogleMarkers(currentNotes),
          due_date: data.due !== undefined ? (data.due || null) : (currentTask.data.due || null),
          is_completed: data.completed !== undefined ? data.completed : (currentTask.data.status === "completed")
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
    
    // Get active settings or default
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
      // Update local task
      const updateData: any = {}
      if (data.title !== undefined) updateData.title = data.title
      if (data.notes !== undefined) updateData.description = data.notes
      if (data.due !== undefined) updateData.due_date = data.due || null
      if (data.completed !== undefined) {
        updateData.is_completed = data.completed
        updateData.completed_at = data.completed ? new Date().toISOString() : null
      }

      await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)

      // Delete existing reminders
      await supabase
        .from('task_reminders')
        .delete()
        .eq('task_id', taskId)

      // Re-schedule reminders if not completed and due date exists
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

    // Sync to Google Calendar (Update, create or delete the event)
    if (finalCompleted) {
      // If task is completed, we delete calendar event to clear agenda
      if (calendarEventId) {
        await deleteGoogleCalendarEvent(auth, calendarEventId)
        calendarEventId = null
      }
    } else {
      calendarEventId = await syncGoogleCalendarEvent(
        auth,
        data.title !== undefined ? data.title : currentTask.data.title || "",
        data.notes !== undefined ? data.notes : stripGoogleMarkers(currentNotes),
        finalDue,
        finalSettings,
        calendarEventId
      )
    }

    // Prepare updated notes for Google Tasks
    let cleanNotes = data.notes !== undefined ? data.notes : stripGoogleMarkers(currentNotes)
    if (taskId) {
      cleanNotes = `${cleanNotes}\n\n[task_id: ${taskId}]`.trim()
    }
    if (calendarEventId) {
      cleanNotes = `${cleanNotes}\n\n[calendar_event_id: ${calendarEventId}]`.trim()
    }

    const requestBody = {
      ...currentTask.data,
      ...(data.title !== undefined && { title: data.title }),
      notes: cleanNotes,
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
      notes: stripGoogleMarkers(item.notes || ""),
      due: finalDue || undefined,
      completed: item.status === "completed",
      completedAt: item.completed || undefined,
      listId,
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
    const service = google.tasks({ version: "v1", auth })
    
    // Get the task first
    const currentTask = await service.tasks.get({
      tasklist: listId,
      task: id,
    })
    
    const currentNotes = currentTask.data.notes || ""
    const taskId = extractTaskId(currentNotes)
    const calendarEventId = extractCalendarEventId(currentNotes)

    if (taskId) {
      await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
    }

    if (calendarEventId) {
      await deleteGoogleCalendarEvent(auth, calendarEventId)
    }

    await service.tasks.delete({
      tasklist: listId,
      task: id,
    })
    
    revalidatePath("/dashboard/tasks")
    return true
  } catch (error) {
    console.error("Error deleting reminder:", error)
    return false
  }
}
