"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  Plus,
  Search,
  CheckCircle,
  Circle,
  Trash2,
  Edit2,
  RefreshCw,
  Loader2,
  ListTodo,
  Bell,
  Settings,
} from "lucide-react"
import { useProfile } from "@/components/dashboard/profile-context"
import { toast } from "sonner"
import {
  fetchTaskLists,
  fetchReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  createTaskList,
  updateTaskList,
  deleteTaskList,
  type Reminder,
  type TaskList,
} from "@/app/actions/google-tasks"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getAppClient } from "@/lib/supabase-client"

export default function TasksPage() {
  const {} = useProfile()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [taskLists, setTaskLists] = useState<TaskList[]>([])
  const [subjects, setSubjects] = useState<any /* eslint-disable-line @typescript-eslint/no-explicit-any */[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("none")
  const [activeListId, setActiveListId] = useState("@default")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)

  // New task modal states
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [dateType, setDateType] = useState<"none" | "today" | "tomorrow" | "next-week" | "custom">("none")
  const [customDate, setCustomDate] = useState("")
  const [timePreset, setTimePreset] = useState<"all-day" | "morning" | "evening" | "custom">("all-day")
  const [customTime, setCustomTime] = useState("")
  const [saving, setSaving] = useState(false)

  // Reminder settings states
  const [reminderDueTime, setReminderDueTime] = useState(true)
  const [reminder1Day, setReminder1Day] = useState(true)
  const [reminder2Days, setReminder2Days] = useState(true)
  const [reminder1Week, setReminder1Week] = useState(true)
  const [reminder2Weeks, setReminder2Weeks] = useState(true)
  const [reminderCustom, setReminderCustom] = useState(true)
  const [customReminderValue, setCustomReminderValue] = useState(3)
  const [customReminderUnit, setCustomReminderUnit] = useState<"minutes" | "hours" | "days" | "weeks">("hours")

  // List Modal states
  const [isListModalOpen, setIsListModalOpen] = useState(false)
  const [editingList, setEditingList] = useState<TaskList | null>(null)
  const [listTitle, setListTitle] = useState("")
  const [listSaving, setListSaving] = useState(false)

  // Sync reminders with server
  const handleSync = useCallback(
    async (listId = activeListId) => {
      setIsSyncing(true)
      try {
        const fresh = await fetchReminders(listId)
        setReminders(fresh)
      } catch (error) {
        console.error("Sync error:", error)
        toast.error("Failed to sync with Google Tasks.")
      } finally {
        setIsSyncing(false)
      }
    },
    [activeListId]
  )

  const handleOpenCreateListModal = () => {
    setEditingList(null)
    setListTitle("")
    setIsListModalOpen(true)
  }

  const handleOpenEditListModal = (list: TaskList) => {
    setEditingList(list)
    setListTitle(list.title)
    setIsListModalOpen(true)
  }

  const handleSaveList = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!listTitle.trim()) return
    setListSaving(true)
    try {
      if (editingList) {
        const updated = await updateTaskList(editingList.id, listTitle.trim())
        if (updated) {
          setTaskLists((prev) => prev.map((l) => (l.id === editingList.id ? updated : l)))
          toast.success("List renamed.")
        }
      } else {
        const created = await createTaskList(listTitle.trim())
        if (created) {
          setTaskLists((prev) => [...prev, created])
          setActiveListId(created.id)
          await handleSync(created.id)
          toast.success("List created.")
        }
      }
      setIsListModalOpen(false)
    } catch (err) {
      console.error(err)
      toast.error("Failed to save list.")
    } finally {
      setListSaving(false)
    }
  }

  const handleDeleteList = async (listId: string) => {
    if (!confirm("Are you sure you want to delete this list and all its tasks?")) return
    try {
      const success = await deleteTaskList(listId)
      if (success) {
        setTaskLists((prev) => prev.filter((l) => l.id !== listId))
        if (activeListId === listId) {
          const remaining = taskLists.filter((l) => l.id !== listId)
          if (remaining.length > 0) {
            setActiveListId(remaining[0].id)
            await handleSync(remaining[0].id)
          }
        }
        toast.success("List deleted.")
      } else {
        toast.error("Failed to delete list.")
      }
    } catch (err) {
      console.error(err)
      toast.error("Failed to delete list.")
    }
  }

  // Notifications states
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "default">("default")
  const [togglingNotifications, setTogglingNotifications] = useState(false)

  // Initialize notifications status
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setTimeout(() => setNotificationPermission(Notification.permission), 0)
      const stored = localStorage.getItem("tasks_notifications_enabled") === "true"

      if (Notification.permission === "denied") {
        setTimeout(() => setNotificationsEnabled(false), 0)
        localStorage.setItem("tasks_notifications_enabled", "false")
      } else {
        setTimeout(() => setNotificationsEnabled(stored && Notification.permission === "granted"), 0)
      }
    }
  }, [])

  // Initialize modal state on mount
  useEffect(() => {
    // Modal starts closed by default.
  }, [])

  // Auto-register service worker on mount if notifications are enabled
  useEffect(() => {
    async function reregister() {
      if (typeof window !== "undefined" && "serviceWorker" in navigator && "Notification" in window) {
        const stored = localStorage.getItem("tasks_notifications_enabled") === "true"
        if (stored && Notification.permission === "granted") {
          try {
            await navigator.serviceWorker.register("/sw.js")
          } catch (e) {
            console.error("Failed to re-register service worker on mount:", e)
          }
        }
      }
    }
    reregister()
  }, [])

  const handleToggleNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Notifications are not supported by this browser.")
      return
    }

    setTogglingNotifications(true)
    try {
      if (notificationsEnabled) {
        await unsubscribeFromPush()
        setTimeout(() => setNotificationsEnabled(false), 0)
        localStorage.setItem("tasks_notifications_enabled", "false")
        toast.success("Desktop reminders disabled.")
      } else {
        let perm = Notification.permission
        if (perm === "default") {
          perm = await Notification.requestPermission()
          setNotificationPermission(perm)
        }

        if (perm === "granted") {
          await subscribeToPush()
          setNotificationsEnabled(true)
          localStorage.setItem("tasks_notifications_enabled", "true")
          toast.success("Desktop reminders enabled! You'll receive popups when due.")
        } else {
          setTimeout(() => setNotificationsEnabled(false), 0)
          localStorage.setItem("tasks_notifications_enabled", "false")
          toast.error("Notification permission denied. Please allow notifications in site settings.")
        }
      }
    } catch (err: unknown) {
      console.error(err)
      toast.error((err as Error).message || "Failed to update notification settings.")
    } finally {
      setTogglingNotifications(false)
    }
  }

  // Initialize and fetch lists
  useEffect(() => {
    async function init() {
      try {
        const supabase = getAppClient()
        const { data: subs } = await supabase.from("subjects").select("id, name, type").eq("is_active", true)
        setSubjects(subs || [])

        const lists = await fetchTaskLists()
        setTaskLists(lists)
        if (lists.length > 0) {
          setActiveListId(lists[0].id)
        }
        await handleSync(lists[0]?.id || "@default")
      } catch (err) {
        console.error(err)
        toast.error("Connect your Google account to manage tasks.")
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [handleSync])

  // Trigger sync on list switch
  const handleListSelect = (listId: string) => {
    setActiveListId(listId)
    handleSync(listId)
  }

  const handleToggleComplete = async (reminder: Reminder) => {
    const nextCompleted = !reminder.completed
    // Optimistic UI update
    setReminders((prev) => prev.map((r) => (r.id === reminder.id ? { ...r, completed: nextCompleted } : r)))

    try {
      await updateReminder(reminder.id, { completed: nextCompleted }, activeListId)
      toast.success(nextCompleted ? "Task completed!" : "Task marked active.")
    } catch (err) {
      console.error(err)
      toast.error("Failed to update task.")
      // Revert on error
      setReminders((prev) => prev.map((r) => (r.id === reminder.id ? { ...r, completed: !nextCompleted } : r)))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return

    const previousReminders = [...reminders]
    setReminders((prev) => prev.filter((r) => r.id !== id))

    try {
      const success = await deleteReminder(id, activeListId)
      if (!success) throw new Error("Delete failed")
      toast.success("Task deleted successfully.")
    } catch (err) {
      console.error(err)
      toast.error("Failed to delete task.")
      setReminders(previousReminders)
    }
  }

  const handleOpenAddModal = () => {
    setEditingReminder(null)
    setTitle("")
    setNotes("")
    setSelectedSubjectId("none")
    setDateType("today")
    setTimePreset("all-day")
    setCustomDate("")
    setCustomTime("")
    setReminderDueTime(true)
    setReminder1Day(true)
    setReminder2Days(true)
    setReminder1Week(true)
    setReminder2Weeks(true)
    setReminderCustom(true)
    setCustomReminderValue(3)
    setCustomReminderUnit("hours")
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (reminder: Reminder) => {
    setEditingReminder(reminder)
    setTitle(reminder.title)
    setNotes(reminder.notes || "")
    setSelectedSubjectId(reminder.subjectId || "none")

    if (reminder.due) {
      const dateObj = new Date(reminder.due)
      const datePart = dateObj.toISOString().split("T")[0]
      const todayStr = new Date().toISOString().split("T")[0]

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split("T")[0]

      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)
      const nextWeekStr = nextWeek.toISOString().split("T")[0]

      if (datePart === todayStr) setDateType("today")
      else if (datePart === tomorrowStr) setDateType("tomorrow")
      else if (datePart === nextWeekStr) setDateType("next-week")
      else {
        setDateType("custom")
        setCustomDate(datePart)
      }

      const hours = dateObj.getHours()
      const minutes = dateObj.getMinutes()

      if (hours === 0 && minutes === 0 && reminder.due.endsWith("T00:00:00.000Z")) {
        setTimePreset("all-day")
      } else {
        setTimePreset("custom")
        setCustomTime(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`)
      }
    } else {
      setDateType("none")
      setTimePreset("all-day")
    }

    if (reminder.reminderSettings) {
      setReminderDueTime(reminder.reminderSettings.dueTime)
      setReminder1Day(reminder.reminderSettings.oneDayPrior)
      setReminder2Days(reminder.reminderSettings.twoDaysPrior)
      setReminder1Week(reminder.reminderSettings.oneWeekPrior)
      setReminder2Weeks(reminder.reminderSettings.twoWeeksPrior)
      setReminderCustom(reminder.reminderSettings.customPrior)
      setCustomReminderValue(reminder.reminderSettings.customValue || 3)
      setCustomReminderUnit(
        (reminder.reminderSettings.customUnit as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ ||
          "hours"
      )
    } else {
      setReminderDueTime(true)
      setReminder1Day(true)
      setReminder2Days(true)
      setReminder1Week(true)
      setReminder2Weeks(true)
      setReminderCustom(true)
      setCustomReminderValue(3)
      setCustomReminderUnit("hours")
    }

    setIsModalOpen(true)
  }

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    try {
      let finalDue: string | undefined = undefined

      if (dateType !== "none") {
        let datePart = ""
        const today = new Date()

        if (dateType === "today") {
          datePart = today.toISOString().split("T")[0]
        } else if (dateType === "tomorrow") {
          const tomorrow = new Date()
          tomorrow.setDate(today.getDate() + 1)
          datePart = tomorrow.toISOString().split("T")[0]
        } else if (dateType === "next-week") {
          const nextWeek = new Date()
          nextWeek.setDate(today.getDate() + 7)
          datePart = nextWeek.toISOString().split("T")[0]
        } else if (dateType === "custom" && customDate) {
          datePart = customDate
        }

        if (datePart) {
          if (timePreset === "all-day") {
            finalDue = `${datePart}T00:00:00.000Z`
          } else {
            let timePart = "09:00"
            if (timePreset === "morning") timePart = "08:00"
            else if (timePreset === "evening") timePart = "18:00"
            else if (timePreset === "custom" && customTime) {
              timePart = customTime
            }

            const [hours, mins] = timePart.split(":")
            const combined = new Date(datePart)
            combined.setHours(parseInt(hours), parseInt(mins), 0, 0)
            finalDue = combined.toISOString()
          }
        }
      }

      const reminderSettings = {
        dueTime: reminderDueTime,
        oneDayPrior: reminder1Day,
        twoDaysPrior: reminder2Days,
        oneWeekPrior: reminder1Week,
        twoWeeksPrior: reminder2Weeks,
        customPrior: reminderCustom,
        customValue: customReminderValue,
        customUnit: customReminderUnit,
      }

      if (editingReminder) {
        // Edit mode
        const updated = await updateReminder(
          editingReminder.id,
          {
            title,
            notes,
            due: finalDue,
            reminderSettings,
            subjectId: selectedSubjectId === "none" ? null : selectedSubjectId,
          },
          activeListId
        )
        if (updated) {
          setReminders((prev) => prev.map((r) => (r.id === editingReminder.id ? updated : r)))
          toast.success("Task updated.")
        }
      } else {
        // Create mode
        const created = await createReminder({
          title,
          notes,
          due: finalDue,
          listId: activeListId,
          reminderSettings,
          subjectId: selectedSubjectId === "none" ? undefined : selectedSubjectId,
        })
        if (created) {
          setReminders((prev) => [created, ...prev])
          toast.success("Task created.")
        }
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error(err)
      toast.error("Failed to save task.")
    } finally {
      setSaving(false)
    }
  }

  // Filters
  const filteredReminders = useMemo(() => {
    let list = reminders

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      list = list.filter((r) => r.title.toLowerCase().includes(query) || r.notes?.toLowerCase().includes(query))
    }
    return list
  }, [reminders, searchQuery])

  // Sorting
  const groups = useMemo(() => {
    const now = new Date()
    const todayStr = now.toISOString().split("T")[0]

    const tomorrow = new Date()
    tomorrow.setDate(now.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split("T")[0]

    const nextWeek = new Date()
    nextWeek.setDate(now.getDate() + 7)

    const result = {
      overdue: [] as Reminder[],
      today: [] as Reminder[],
      tomorrow: [] as Reminder[],
      upcoming: [] as Reminder[],
      later: [] as Reminder[],
      noDate: [] as Reminder[],
      completed: [] as Reminder[],
    }

    filteredReminders.forEach((r) => {
      if (r.completed) {
        result.completed.push(r)
        return
      }

      if (!r.due) {
        result.noDate.push(r)
        return
      }

      const duePart = r.due.split("T")[0]
      const dueDate = new Date(r.due)

      if (duePart < todayStr) {
        result.overdue.push(r)
      } else if (duePart === todayStr) {
        result.today.push(r)
      } else if (duePart === tomorrowStr) {
        result.tomorrow.push(r)
      } else if (dueDate <= nextWeek) {
        result.upcoming.push(r)
      } else {
        result.later.push(r)
      }
    })

    // Sort completed by date
    result.completed.sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0
      return bTime - aTime
    })

    return result
  }, [filteredReminders])

  const formatReminderDate = (isoStr?: string) => {
    if (!isoStr) return ""
    const date = new Date(isoStr)
    const isAllDay = isoStr.endsWith("T00:00:00.000Z")

    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
    }

    let formatted = date.toLocaleDateString("en-US", options)

    if (!isAllDay) {
      const timeOptions: Intl.DateTimeFormatOptions = {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }
      formatted += `, ${date.toLocaleTimeString("en-US", timeOptions)}`
    }

    return formatted
  }

  if (loading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-[1600px]">
      {/* Main Task List */}
      <div className="flex h-full flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="border-border/40 z-10 flex h-16 flex-shrink-0 items-center border-b px-4 sm:px-8 md:px-12">
          <div className="flex w-full items-center justify-between gap-3 sm:gap-4">
            {/* Left: Settings */}
            <div className="flex flex-1 justify-start">
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="hover:bg-muted text-muted-foreground rounded-full p-2 transition-colors"
                aria-label="Open settings"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>

            {/* Center: Search */}
            <div className="flex flex-1 justify-center">
              <div className="relative w-full max-w-sm sm:max-w-md">
                <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4" />
                </span>
                <Input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-muted/40 placeholder:text-muted-foreground/60 focus-visible:ring-primary/50 h-9 w-full rounded-full border-0 pr-4 pl-9 text-sm shadow-none focus-visible:ring-1"
                />
              </div>
            </div>

            {/* Right: Add Task */}
            <div className="flex flex-1 justify-end">
              <Button
                onClick={handleOpenAddModal}
                size="sm"
                className="hover:shadow-primary/20 h-9 gap-1.5 rounded-full px-4 text-sm font-medium shadow-sm transition-all hover:shadow-md"
              >
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add Task</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto px-4 py-8 pb-32 sm:px-8 md:px-12">
          <div className="mx-auto w-full max-w-5xl space-y-10">
            {/* Overdue */}
            {groups.overdue.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-destructive border-border/40 flex items-center space-x-1.5 border-b py-2 text-xs font-semibold tracking-wider uppercase">
                  <span>Overdue</span>
                  <span className="bg-destructive/10 rounded px-1.5 py-0.5 text-[10px]">{groups.overdue.length}</span>
                </h3>
                <div className="flex flex-col">
                  {groups.overdue.map((r) => (
                    <ReminderRow
                      key={r.id}
                      reminder={r}
                      onToggle={handleToggleComplete}
                      onEdit={handleOpenEditModal}
                      onDelete={handleDelete}
                      formatDate={formatReminderDate}
                      subjects={subjects}
                      isOverdue
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Today */}
            {groups.today.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-primary border-border/40 border-b py-2 text-xs font-semibold tracking-wider uppercase">
                  Today
                </h3>
                <div className="flex flex-col">
                  {groups.today.map((r) => (
                    <ReminderRow
                      key={r.id}
                      reminder={r}
                      onToggle={handleToggleComplete}
                      onEdit={handleOpenEditModal}
                      onDelete={handleDelete}
                      formatDate={formatReminderDate}
                      subjects={subjects}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Tomorrow */}
            {groups.tomorrow.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-muted-foreground border-border/40 border-b py-2 text-xs font-semibold tracking-wider uppercase">
                  Tomorrow
                </h3>
                <div className="flex flex-col">
                  {groups.tomorrow.map((r) => (
                    <ReminderRow
                      key={r.id}
                      reminder={r}
                      onToggle={handleToggleComplete}
                      onEdit={handleOpenEditModal}
                      onDelete={handleDelete}
                      formatDate={formatReminderDate}
                      subjects={subjects}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming */}
            {groups.upcoming.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-muted-foreground border-border/40 border-b py-2 text-xs font-semibold tracking-wider uppercase">
                  Upcoming
                </h3>
                <div className="flex flex-col">
                  {groups.upcoming.map((r) => (
                    <ReminderRow
                      key={r.id}
                      reminder={r}
                      onToggle={handleToggleComplete}
                      onEdit={handleOpenEditModal}
                      onDelete={handleDelete}
                      formatDate={formatReminderDate}
                      subjects={subjects}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Later / Future */}
            {groups.later.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-muted-foreground border-border/40 border-b py-2 text-xs font-semibold tracking-wider uppercase">
                  Later
                </h3>
                <div className="flex flex-col">
                  {groups.later.map((r) => (
                    <ReminderRow
                      key={r.id}
                      reminder={r}
                      onToggle={handleToggleComplete}
                      onEdit={handleOpenEditModal}
                      onDelete={handleDelete}
                      formatDate={formatReminderDate}
                      subjects={subjects}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* No Date */}
            {groups.noDate.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-muted-foreground border-border/40 border-b py-2 text-xs font-semibold tracking-wider uppercase">
                  No Date
                </h3>
                <div className="flex flex-col">
                  {groups.noDate.map((r) => (
                    <ReminderRow
                      key={r.id}
                      reminder={r}
                      onToggle={handleToggleComplete}
                      onEdit={handleOpenEditModal}
                      onDelete={handleDelete}
                      formatDate={formatReminderDate}
                      subjects={subjects}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Empty State */}
            {filteredReminders.length === 0 && (
              <div className="animate-in fade-in zoom-in-95 flex flex-col items-center justify-center space-y-6 py-28 text-center duration-500">
                <div className="bg-primary/5 text-primary border-primary/10 flex h-24 w-24 items-center justify-center rounded-full border shadow-[0_0_40px_-10px_rgba(var(--primary),0.3)]">
                  <CheckCircle className="h-10 w-10 opacity-80" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-foreground text-2xl font-bold tracking-tight">All caught up!</h4>
                  <p className="text-muted-foreground mx-auto max-w-sm text-sm leading-relaxed">
                    You have no active tasks matching this view. Enjoy your free time or click{" "}
                    <span className="text-foreground font-semibold">Add Task</span> to stay productive.
                  </p>
                </div>
              </div>
            )}

            {/* Completed */}
            {groups.completed.length > 0 && (
              <section className="border-border/50 space-y-2 border-t pt-6">
                <h3 className="text-muted-foreground border-border/40 flex items-center space-x-1.5 border-b py-2 text-xs font-semibold tracking-wider uppercase">
                  <span>Completed</span>
                  <span className="bg-muted rounded px-1.5 py-0.5 text-[10px]">{groups.completed.length}</span>
                </h3>
                <div className="flex flex-col opacity-60 transition-opacity hover:opacity-100">
                  {groups.completed.map((r) => (
                    <ReminderRow
                      key={r.id}
                      reminder={r}
                      onToggle={handleToggleComplete}
                      onEdit={handleOpenEditModal}
                      onDelete={handleDelete}
                      formatDate={formatReminderDate}
                      subjects={subjects}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      {/* Add / Edit Task Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="border-border/40 max-h-[90dvh] gap-0 overflow-y-auto rounded-lg p-0 outline-none sm:max-w-md">
          <DialogHeader className="border-border/30 border-b px-5 py-4">
            <DialogTitle className="text-base font-semibold">{editingReminder ? "Edit Task" : "Add Task"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveReminder} className="space-y-5 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-muted-foreground text-xs font-medium">
                What needs doing?
              </Label>
              <Input
                id="title"
                type="text"
                placeholder="Remind me to..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="border-border/40 focus-visible:ring-primary/50 h-9 bg-transparent shadow-none focus-visible:ring-1"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-muted-foreground text-xs font-medium">
                Details
              </Label>
              <textarea
                id="notes"
                placeholder="Add notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="border-border/40 focus-visible:ring-primary/50 placeholder-muted-foreground/50 text-foreground w-full resize-none rounded-md border bg-transparent p-2 text-sm outline-none focus-visible:ring-1 focus-visible:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subject" className="text-muted-foreground text-xs font-medium">
                Link to Subject
              </Label>
              <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                <SelectTrigger className="border-border/40 focus:ring-primary/50 h-9 w-full bg-transparent shadow-none focus:ring-1">
                  <SelectValue placeholder="None (General Task)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (General Task)</SelectItem>
                  {subjects.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.name} ({sub.type === "academic" ? "Academic" : "Personal"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground block text-xs font-medium">Due Date</Label>
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
                {[
                  { id: "none", label: "No Date" },
                  { id: "today", label: "Today" },
                  { id: "tomorrow", label: "Tomorrow" },
                  { id: "next-week", label: "Next Week" },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() =>
                      setDateType(item.id as any /* eslint-disable-line @typescript-eslint/no-explicit-any */)
                    }
                    className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition-all ${
                      dateType === item.id
                        ? "border-primary/30 bg-primary/5 text-primary shadow-sm"
                        : "border-border/40 hover:bg-muted text-muted-foreground bg-transparent"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setDateType("custom")
                    if (!customDate) {
                      setCustomDate(new Date().toISOString().split("T")[0])
                    }
                  }}
                  className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition-all ${
                    dateType === "custom"
                      ? "border-primary/30 bg-primary/5 text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground border-transparent"
                  }`}
                >
                  Custom Date
                </button>
                {dateType === "custom" && (
                  <div className="bg-muted/20 border-border/40 mt-2 rounded-md border p-2">
                    <Input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="border-border/40 h-8 bg-transparent text-xs shadow-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {dateType !== "none" && (
              <div className="border-border/30 space-y-2 border-t pt-4">
                <Label className="text-muted-foreground block text-xs font-medium">Time</Label>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  {[
                    { id: "all-day", label: "All Day" },
                    { id: "morning", label: "Morning" },
                    { id: "evening", label: "Evening" },
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() =>
                        setTimePreset(item.id as any /* eslint-disable-line @typescript-eslint/no-explicit-any */)
                      }
                      className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition-all ${
                        timePreset === item.id
                          ? "border-primary/30 bg-primary/5 text-primary shadow-sm"
                          : "border-border/40 hover:bg-muted text-muted-foreground bg-transparent"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setTimePreset("custom")
                      if (!customTime) setCustomTime("12:00")
                    }}
                    className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition-all ${
                      timePreset === "custom"
                        ? "border-primary/30 bg-primary/5 text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground border-transparent"
                    }`}
                  >
                    Custom Time
                  </button>
                  {timePreset === "custom" && (
                    <div className="bg-muted/20 border-border/40 mt-2 rounded-md border p-2">
                      <Input
                        type="time"
                        value={customTime}
                        onChange={(e) => setCustomTime(e.target.value)}
                        className="border-border/40 h-8 bg-transparent text-xs shadow-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {dateType !== "none" && (
              <div className="border-border/30 space-y-3 border-t pt-4">
                <Label className="text-muted-foreground block text-xs font-medium">Reminders</Label>

                <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                  <label className="text-foreground flex cursor-pointer items-center space-x-2 text-sm select-none">
                    <input
                      type="checkbox"
                      checked={reminderDueTime}
                      onChange={(e) => setReminderDueTime(e.target.checked)}
                      className="border-border text-primary focus:ring-primary h-3.5 w-3.5 rounded-sm bg-transparent"
                    />
                    <span className="text-[13px]">At due time</span>
                  </label>

                  <label className="text-foreground flex cursor-pointer items-center space-x-2 text-sm select-none">
                    <input
                      type="checkbox"
                      checked={reminder1Day}
                      onChange={(e) => setReminder1Day(e.target.checked)}
                      className="border-border text-primary focus:ring-primary h-3.5 w-3.5 rounded-sm bg-transparent"
                    />
                    <span className="text-[13px]">1 day prior</span>
                  </label>

                  <label className="text-foreground flex cursor-pointer items-center space-x-2 text-sm select-none">
                    <input
                      type="checkbox"
                      checked={reminder2Days}
                      onChange={(e) => setReminder2Days(e.target.checked)}
                      className="border-border text-primary focus:ring-primary h-3.5 w-3.5 rounded-sm bg-transparent"
                    />
                    <span className="text-[13px]">2 days prior</span>
                  </label>

                  <label className="text-foreground flex cursor-pointer items-center space-x-2 text-sm select-none">
                    <input
                      type="checkbox"
                      checked={reminder1Week}
                      onChange={(e) => setReminder1Week(e.target.checked)}
                      className="border-border text-primary focus:ring-primary h-3.5 w-3.5 rounded-sm bg-transparent"
                    />
                    <span className="text-[13px]">1 week prior</span>
                  </label>

                  <label className="text-foreground col-span-2 flex cursor-pointer items-center space-x-2 text-sm select-none">
                    <input
                      type="checkbox"
                      checked={reminder2Weeks}
                      onChange={(e) => setReminder2Weeks(e.target.checked)}
                      className="border-border text-primary focus:ring-primary h-3.5 w-3.5 rounded-sm bg-transparent"
                    />
                    <span className="text-[13px]">2 weeks prior</span>
                  </label>
                </div>

                <div className="border-border/20 border-t pt-2">
                  <label className="text-foreground flex cursor-pointer items-center space-x-2 text-sm select-none">
                    <input
                      type="checkbox"
                      checked={reminderCustom}
                      onChange={(e) => setReminderCustom(e.target.checked)}
                      className="border-border text-primary focus:ring-primary h-3.5 w-3.5 rounded-sm bg-transparent"
                    />
                    <span className="text-[13px] font-medium">Custom prior reminder</span>
                  </label>

                  {reminderCustom && (
                    <div className="mt-2 flex items-center space-x-2">
                      <Input
                        type="number"
                        min={1}
                        value={customReminderValue}
                        onChange={(e) => setCustomReminderValue(parseInt(e.target.value) || 1)}
                        className="border-border/40 h-8 w-16 bg-transparent px-2 text-xs shadow-none"
                      />
                      <select
                        value={customReminderUnit}
                        onChange={(e) =>
                          setCustomReminderUnit(
                            e.target.value as any /* eslint-disable-line @typescript-eslint/no-explicit-any */
                          )
                        }
                        className="border-border/40 focus:ring-primary/50 text-foreground h-8 rounded-md border bg-transparent p-1 text-xs shadow-none outline-none focus:ring-1"
                      >
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                        <option value="weeks">Weeks</option>
                      </select>
                      <span className="text-muted-foreground text-[11px]">prior</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border-border/30 mt-2 flex items-center justify-end space-x-2 border-t pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsModalOpen(false)}
                className="h-8 rounded-md px-3 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !title.trim()}
                className="h-8 rounded-md px-4 text-xs font-semibold"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Task List Modal */}
      <Dialog open={isListModalOpen} onOpenChange={setIsListModalOpen}>
        <DialogContent className="border-border/40 rounded-lg p-0 outline-none sm:max-w-sm">
          <DialogHeader className="border-border/30 border-b px-5 py-4">
            <DialogTitle className="text-base font-semibold">{editingList ? "Rename List" : "Create List"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveList} className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="listTitle" className="text-muted-foreground text-xs font-medium">
                List Title
              </Label>
              <Input
                id="listTitle"
                type="text"
                placeholder="e.g. Work, Groceries..."
                value={listTitle}
                onChange={(e) => setListTitle(e.target.value)}
                required
                className="border-border/40 focus-visible:ring-primary/50 h-9 bg-transparent shadow-none focus-visible:ring-1"
              />
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsListModalOpen(false)}
                className="h-8 rounded-md px-3 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={listSaving || !listTitle.trim()}
                className="h-8 rounded-md px-4 text-xs font-semibold"
              >
                {listSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tasks Settings Modal */}
      <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
        <DialogContent className="border-border/40 bg-background/95 gap-0 overflow-hidden p-0 backdrop-blur-xl sm:max-w-[425px]">
          <DialogHeader className="border-border/40 border-b px-5 py-4">
            <DialogTitle className="flex items-center gap-2">
              <ListTodo className="text-primary h-5 w-5" />
              <div>
                <div className="text-left text-base font-semibold">My Tasks</div>
                <div className="text-muted-foreground text-left text-[10px] font-medium uppercase">
                  Google Tasks Sync
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[60vh] flex-col overflow-hidden">
            <div className="border-border/40 flex shrink-0 items-center justify-between border-b px-5 py-3">
              <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Lists</span>
              <button
                onClick={handleOpenCreateListModal}
                className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1 transition-colors"
                title="Create New List"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
              {taskLists.length === 0 ? (
                <div className="animate-in fade-in flex flex-col items-center justify-center py-8 text-center duration-500">
                  <div className="bg-muted/50 text-muted-foreground mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                    <ListTodo className="h-6 w-6 opacity-50" />
                  </div>
                  <p className="text-foreground text-sm font-medium">No lists yet</p>
                  <p className="text-muted-foreground mt-1 text-xs">Create a list to organize tasks.</p>
                </div>
              ) : (
                taskLists.map((list) => (
                  <div
                    key={list.id}
                    className={`group/list flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-all ${
                      activeListId === list.id
                        ? "bg-muted text-foreground"
                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <button
                      onClick={() => {
                        handleListSelect(list.id)
                        setIsSettingsModalOpen(false)
                      }}
                      className="flex flex-1 items-center space-x-3 truncate py-0.5 text-left"
                    >
                      <div
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          activeListId === list.id ? "bg-primary" : "border-muted-foreground/40 border bg-transparent"
                        }`}
                      />
                      <span className="truncate">{list.title}</span>
                    </button>
                    <div className="flex items-center space-x-1 opacity-0 transition-opacity group-hover/list:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenEditListModal(list)
                        }}
                        className="text-muted-foreground hover:bg-primary/20 hover:text-foreground rounded p-1"
                        title="Rename List"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {taskLists.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteList(list.id)
                          }}
                          className="text-muted-foreground hover:bg-destructive/15 hover:text-destructive rounded p-1"
                          title="Delete List"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </nav>

            <div className="border-border/40 flex shrink-0 flex-col space-y-3 border-t px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="text-foreground flex items-center gap-2 text-sm font-medium">
                  <Bell className="text-muted-foreground h-4 w-4" /> Reminders
                </span>
                <button
                  type="button"
                  onClick={handleToggleNotifications}
                  disabled={togglingNotifications}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    notificationsEnabled ? "bg-primary" : "bg-muted"
                  } ${togglingNotifications ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <span
                    className={`bg-background pointer-events-none inline-block h-4 w-4 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                      notificationsEnabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              {notificationPermission === "denied" && (
                <p className="text-destructive text-[11px] leading-tight font-medium">Blocked in site settings.</p>
              )}
            </div>

            <div className="border-border/40 bg-muted/10 flex shrink-0 items-center justify-between border-t px-5 py-4">
              <span className="text-muted-foreground text-sm font-medium">Sync Status</span>
              <button
                onClick={() => handleSync(activeListId)}
                disabled={isSyncing}
                className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1.5 transition-colors"
                title="Sync Tasks"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? "text-primary animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Subcomponent: Reminder Row
interface ReminderRowProps {
  reminder: Reminder
  onToggle: (reminder: Reminder) => void
  onEdit: (reminder: Reminder) => void
  onDelete: (id: string) => void
  formatDate: (isoStr?: string) => string
  subjects: any /* eslint-disable-line @typescript-eslint/no-explicit-any */[]
  isOverdue?: boolean
}

function ReminderRow({ reminder, onToggle, onEdit, onDelete, formatDate, subjects, isOverdue }: ReminderRowProps) {
  const isExam = reminder.title.startsWith("[Exam]")
  const cleanTitle = isExam ? reminder.title.replace("[Exam] ", "") : reminder.title
  const linkedSub = reminder.subjectId ? subjects.find((s) => s.id === reminder.subjectId) : null

  return (
    <div className="group hover:bg-muted/40 border-border/20 mx-0 flex items-center rounded-lg border-b px-2 py-2 transition-colors last:border-0 sm:-mx-1 sm:rounded-xl sm:px-3 sm:py-2.5">
      {/* Checkbox */}
      <button
        onClick={() => onToggle(reminder)}
        className="text-muted-foreground hover:text-primary mr-3 flex-shrink-0 transition-colors focus:outline-none"
      >
        {reminder.completed ? (
          <CheckCircle className="text-primary fill-primary/10 h-4 w-4" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </button>

      {/* Main Content (Title & Badges) */}
      <div
        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3"
        onClick={() => onEdit(reminder)}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`truncate text-sm font-medium ${
              reminder.completed ? "text-muted-foreground line-through" : "text-foreground"
            }`}
          >
            {cleanTitle}
          </span>
          {isExam && (
            <span className="border-destructive/30 text-destructive/90 inline-flex flex-shrink-0 items-center rounded border px-1.5 py-0.5 text-[9px] font-bold select-none">
              EXAM
            </span>
          )}
          {reminder.notes && (
            <span className="text-muted-foreground hidden max-w-[200px] truncate text-[11px] font-normal sm:inline-block">
              — {reminder.notes}
            </span>
          )}
        </div>

        {reminder.notes && (
          <p className="text-muted-foreground truncate text-[11px] font-normal sm:hidden">{reminder.notes}</p>
        )}
      </div>

      {/* Right side Metadata & Actions */}
      <div className="ml-auto flex flex-shrink-0 items-center gap-3 pl-3">
        <div className="flex items-center gap-2">
          {linkedSub && (
            <span
              className="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: `${linkedSub.color_hex}10`,
                borderColor: `${linkedSub.color_hex}20`,
                color: linkedSub.color_hex,
              }}
            >
              {linkedSub.name}
            </span>
          )}

          {reminder.due && (
            <span
              className={`inline-flex items-center text-[11px] ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}
            >
              {formatDate(reminder.due)}
            </span>
          )}
        </div>

        {/* Actions (visible on hover) */}
        <div className="flex items-center space-x-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(reminder)
            }}
            className="hover:bg-muted text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
            title="Edit"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(reminder.id)
            }}
            className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded p-1 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push notifications are not supported by this browser.")
  }

  const registration = await navigator.serviceWorker.register("/sw.js")
  await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidPublicKey) {
      throw new Error("VAPID public key is missing in environment.")
    }
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey)
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey,
    })
  }

  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      action: "subscribe",
    }),
  })

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.error || "Failed to save push subscription.")
  }
}

async function unsubscribeFromPush() {
  if (!("serviceWorker" in navigator)) return

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()

  if (subscription) {
    await subscription.unsubscribe()

    await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        action: "unsubscribe",
      }),
    })
  }
}
