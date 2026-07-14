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

function stripTaskId(notes?: string): string {
  if (!notes) return ""
  return notes.replace(/\s*\[task_id:\s*[a-f0-9\-]+\]/gi, '').trim()
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
    const { oauth2Client: auth } = await getAuthenticatedClient()
    const service = google.tasks({ version: "v1", auth })
    
    const response = await service.tasks.list({
      tasklist: listId,
      showCompleted: true,
      showHidden: true,
      maxResults: 100,
    })
    
    return (
      response.data.items?.map((item) => ({
        id: item.id || "",
        title: item.title || "",
        notes: stripTaskId(item.notes || ""),
        due: item.due || undefined,
        completed: item.status === "completed",
        completedAt: item.completed || undefined,
        listId,
      })) || []
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

    let notesWithTaskId = data.notes || ""
    if (localTask) {
      // 2. Schedule reminder in local database if due date exists
      if (data.due) {
        const { error: reminderErr } = await supabase
          .from('task_reminders')
          .insert({
            task_id: localTask.id,
            profile_id: profileId,
            scheduled_for: data.due,
            reminder_type: 'due_date',
            whatsapp_sent: false,
            push_sent: false
          })
        if (reminderErr) {
          console.error("Local database reminder insert error:", reminderErr)
        }
      }
      notesWithTaskId = `${notesWithTaskId}\n\n[task_id: ${localTask.id}]`.trim()
    }
    
    // 3. Create task on Google Tasks with notes containing the task_id marker
    const response = await service.tasks.insert({
      tasklist: listId,
      requestBody: {
        title: data.title,
        notes: notesWithTaskId,
        due: data.due,
      },
    })
    
    const item = response.data
    
    revalidatePath("/dashboard/tasks")
    return {
      id: item.id || "",
      title: item.title || "",
      notes: stripTaskId(item.notes || ""),
      due: item.due || undefined,
      completed: item.status === "completed",
      completedAt: item.completed || undefined,
      listId,
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
  },
  listId = "@default"
): Promise<Reminder | null> {
  try {
    const { oauth2Client: auth, profileId, supabase } = await getAuthenticatedClient()
    const service = google.tasks({ version: "v1", auth })
    
    // Get the current task state first to preserve other fields and read notes
    const currentTask = await service.tasks.get({
      tasklist: listId,
      task: id,
    })
    
    const currentNotes = currentTask.data.notes || ""
    const match = currentNotes.match(/\[task_id:\s*([a-f0-9\-]+)\]/i)
    let taskId = match ? match[1] : null

    // If no local task exists, create one
    if (!taskId) {
      const { data: localTask } = await supabase
        .from('tasks')
        .insert({
          profile_id: profileId,
          title: data.title !== undefined ? data.title : currentTask.data.title || "",
          description: data.notes !== undefined ? data.notes : stripTaskId(currentNotes),
          due_date: data.due !== undefined ? (data.due || null) : (currentTask.data.due || null),
          is_completed: data.completed !== undefined ? data.completed : (currentTask.data.status === "completed")
        })
        .select()
        .single()
      if (localTask) {
        taskId = localTask.id
      }
    }

    const finalCompleted = data.completed !== undefined ? data.completed : (currentTask.data.status === "completed")
    const finalDue = data.due !== undefined ? (data.due || null) : (currentTask.data.due || null)

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

      // Delete existing reminders for this task
      await supabase
        .from('task_reminders')
        .delete()
        .eq('task_id', taskId)

      // Re-schedule reminder if not completed and due date exists
      if (!finalCompleted && finalDue) {
        await supabase
          .from('task_reminders')
          .insert({
            task_id: taskId,
            profile_id: profileId,
            scheduled_for: finalDue,
            reminder_type: 'due_date',
            whatsapp_sent: false,
            push_sent: false
          })
      }
    }

    // Prepare updated notes for Google Tasks
    let cleanNotes = data.notes !== undefined ? data.notes : stripTaskId(currentNotes)
    if (taskId) {
      cleanNotes = `${cleanNotes}\n\n[task_id: ${taskId}]`.trim()
    }

    const requestBody = {
      ...currentTask.data,
      ...(data.title !== undefined && { title: data.title }),
      notes: cleanNotes,
      ...(data.due !== undefined && { due: data.due || null }),
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
      notes: stripTaskId(item.notes || ""),
      due: item.due || undefined,
      completed: item.status === "completed",
      completedAt: item.completed || undefined,
      listId,
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
    
    // Get the task first to read the task_id from its notes
    const currentTask = await service.tasks.get({
      tasklist: listId,
      task: id,
    })
    
    const currentNotes = currentTask.data.notes || ""
    const match = currentNotes.match(/\[task_id:\s*([a-f0-9\-]+)\]/i)
    const taskId = match ? match[1] : null

    if (taskId) {
      // Delete from local tasks (cascade deletes reminders)
      await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
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
