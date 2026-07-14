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

  return oauth2Client
}

export async function fetchTaskLists(): Promise<TaskList[]> {
  try {
    const auth = await getAuthenticatedClient()
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
    const auth = await getAuthenticatedClient()
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
        notes: item.notes || "",
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
    const auth = await getAuthenticatedClient()
    const service = google.tasks({ version: "v1", auth })
    const listId = data.listId || "@default"
    
    const response = await service.tasks.insert({
      tasklist: listId,
      requestBody: {
        title: data.title,
        notes: data.notes,
        due: data.due,
      },
    })
    
    const item = response.data
    
    revalidatePath("/dashboard/tasks")
    return {
      id: item.id || "",
      title: item.title || "",
      notes: item.notes || "",
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
    const auth = await getAuthenticatedClient()
    const service = google.tasks({ version: "v1", auth })
    
    // Get the current task state first to preserve other fields
    const currentTask = await service.tasks.get({
      tasklist: listId,
      task: id,
    })
    
    const requestBody = {
      ...currentTask.data,
      ...(data.title !== undefined && { title: data.title }),
      ...(data.notes !== undefined && { notes: data.notes }),
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
      notes: item.notes || "",
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
    const auth = await getAuthenticatedClient()
    const service = google.tasks({ version: "v1", auth })
    
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
