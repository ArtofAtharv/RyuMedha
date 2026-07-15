"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  Plus,
  Moon,
  Sun,
  Search,
  CheckCircle,
  Circle,
  Calendar as CalendarIcon,
  Trash2,
  Edit2,
  RefreshCw,
  Clock,
  Menu,
  Check,
  Loader2,
  ListTodo,
  Bell
} from "lucide-react"
import { useProfile } from "@/components/dashboard/profile-context"
import { toast } from "sonner"
import {
  fetchTaskLists,
  fetchReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  type Reminder,
  type TaskList
} from "@/app/actions/google-tasks"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getAppClient } from "@/lib/supabase-client"

export default function TasksPage() {
  const { profile } = useProfile()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [taskLists, setTaskLists] = useState<TaskList[]>([])
  const [activeListId, setActiveListId] = useState("@default")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  
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

  // Notifications states
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "default">("default")
  const [togglingNotifications, setTogglingNotifications] = useState(false)

  // Initialize notifications status
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission)
      const stored = localStorage.getItem("tasks_notifications_enabled") === "true"
      
      if (Notification.permission === "denied") {
        setNotificationsEnabled(false)
        localStorage.setItem("tasks_notifications_enabled", "false")
      } else {
        setNotificationsEnabled(stored && Notification.permission === "granted")
      }
    }
  }, [])

  // Initialize sidebar state based on screen size on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.innerWidth < 768) {
        setSidebarOpen(false)
      }
    }
  }, [])

  // Auto-register service worker on mount if notifications are enabled
  useEffect(() => {
    async function reregister() {
      if (typeof window !== "undefined" && "serviceWorker" in navigator && "Notification" in window) {
        const stored = localStorage.getItem("tasks_notifications_enabled") === "true"
        if (stored && Notification.permission === "granted") {
          try {
            await navigator.serviceWorker.register('/sw.js')
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
        setNotificationsEnabled(false)
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
          setNotificationsEnabled(false)
          localStorage.setItem("tasks_notifications_enabled", "false")
          toast.error("Notification permission denied. Please allow notifications in site settings.")
        }
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to update notification settings.")
    } finally {
      setTogglingNotifications(false)
    }
  }

  // Initialize and fetch lists
  useEffect(() => {
    async function init() {
      try {
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
  }, [])

  // Sync reminders with server
  const handleSync = async (listId = activeListId) => {
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
  }

  // Trigger sync on list switch
  const handleListSelect = (listId: string) => {
    setActiveListId(listId)
    handleSync(listId)
  }

  const handleToggleComplete = async (reminder: Reminder) => {
    const nextCompleted = !reminder.completed
    // Optimistic UI update
    setReminders(prev =>
      prev.map(r =>
        r.id === reminder.id ? { ...r, completed: nextCompleted } : r
      )
    )

    try {
      await updateReminder(reminder.id, { completed: nextCompleted }, activeListId)
      toast.success(nextCompleted ? "Task completed!" : "Task marked active.")
    } catch (err) {
      console.error(err)
      toast.error("Failed to update task.")
      // Revert on error
      setReminders(prev =>
        prev.map(r =>
          r.id === reminder.id ? { ...r, completed: !nextCompleted } : r
        )
      )
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return

    const previousReminders = [...reminders]
    setReminders(prev => prev.filter(r => r.id !== id))

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
      setCustomReminderUnit((reminder.reminderSettings.customUnit as any) || "hours")
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
        customUnit: customReminderUnit
      }

      if (editingReminder) {
        // Edit mode
        const updated = await updateReminder(
          editingReminder.id,
          { title, notes, due: finalDue, reminderSettings },
          activeListId
        )
        if (updated) {
          setReminders(prev => prev.map(r => (r.id === editingReminder.id ? updated : r)))
          toast.success("Task updated.")
        }
      } else {
        // Create mode
        const created = await createReminder({
          title,
          notes,
          due: finalDue,
          listId: activeListId,
          reminderSettings
        })
        if (created) {
          setReminders(prev => [created, ...prev])
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
      list = list.filter(
        r =>
          r.title.toLowerCase().includes(query) ||
          r.notes?.toLowerCase().includes(query)
      )
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
      noDate: [] as Reminder[],
      completed: [] as Reminder[],
    }

    filteredReminders.forEach(r => {
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
        result.noDate.push(r)
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="relative flex h-[80vh] border rounded-3xl overflow-hidden bg-card/60 backdrop-blur-md shadow-xl border-border/50 max-w-6xl mx-auto px-2 mt-4 md:px-4 md:mt-6">
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-35 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Task Lists */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 md:z-auto md:relative
          bg-background md:bg-transparent h-full
          ${sidebarOpen ? "w-64 translate-x-0 border-r" : "w-0 -translate-x-full md:translate-x-0 md:w-0"}
          transition-all duration-300 flex-shrink-0 border-border/50 flex flex-col overflow-hidden
        `}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/50">
          <div className="flex items-center space-x-2">
            <div className="bg-primary/10 text-primary p-2 rounded-xl flex items-center justify-center shadow-sm">
              <ListTodo className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">My Tasks</h1>
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                Google Account Sync
              </span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
            aria-label="Close sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto px-3 space-y-1">
          {taskLists.map(list => (
            <button
              key={list.id}
              onClick={() => {
                handleListSelect(list.id)
                if (window.innerWidth < 768) {
                  setSidebarOpen(false)
                }
              }}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                activeListId === list.id
                  ? "bg-primary/10 text-primary font-semibold"
                  : "hover:bg-muted/50 text-muted-foreground"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  activeListId === list.id ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              />
              <span className="truncate">{list.title}</span>
            </button>
          ))}
        </nav>

        {/* Notifications Toggle */}
        <div className="p-4 border-t border-border/50 bg-muted/20 flex flex-col space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-primary" /> Desktop Reminders
            </span>
            <button
              type="button"
              onClick={handleToggleNotifications}
              disabled={togglingNotifications}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                notificationsEnabled ? "bg-primary" : "bg-muted-foreground/30"
              } ${togglingNotifications ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                  notificationsEnabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          {notificationPermission === "denied" && (
            <p className="text-[10px] text-destructive leading-tight font-medium">
              Notifications blocked. Enable them in site settings.
            </p>
          )}
        </div>

        <div className="p-4 border-t border-border/50 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <span>Google Sync Status</span>
          <button
            onClick={() => handleSync(activeListId)}
            disabled={isSyncing}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Sync Tasks"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-primary" : ""}`} />
          </button>
        </div>
      </aside>

      {/* Main Task List */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border/50 flex items-center justify-between px-4 sm:px-6 z-10 flex-shrink-0 gap-3 sm:gap-4">
          <div className="flex items-center space-x-2 sm:space-x-4 flex-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Search */}
            <div className="relative max-w-sm w-full">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                <Search className="w-4 h-4" />
              </span>
              <Input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-muted/40 border-border/50 rounded-xl pl-10 pr-4 text-sm h-9"
              />
            </div>
          </div>

          <Button onClick={handleOpenAddModal} size="sm" className="gap-1.5 rounded-xl font-bold h-9 px-3 sm:px-4">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Task</span>
          </Button>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Overdue */}
          {groups.overdue.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-destructive flex items-center space-x-1.5">
                <span>Overdue</span>
                <span className="px-1.5 py-0.5 rounded-full bg-destructive/10 text-[10px]">
                  {groups.overdue.length}
                </span>
              </h3>
              <div className="bg-card rounded-2xl overflow-hidden shadow-sm border border-border/50 divide-y divide-border/50">
                {groups.overdue.map(r => (
                  <ReminderRow
                    key={r.id}
                    reminder={r}
                    onToggle={handleToggleComplete}
                    onEdit={handleOpenEditModal}
                    onDelete={handleDelete}
                    formatDate={formatReminderDate}
                    isOverdue
                  />
                ))}
              </div>
            </section>
          )}

          {/* Today */}
          {groups.today.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                Today
              </h3>
              <div className="bg-card rounded-2xl overflow-hidden shadow-sm border border-border/50 divide-y divide-border/50">
                {groups.today.map(r => (
                  <ReminderRow
                    key={r.id}
                    reminder={r}
                    onToggle={handleToggleComplete}
                    onEdit={handleOpenEditModal}
                    onDelete={handleDelete}
                    formatDate={formatReminderDate}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Tomorrow */}
          {groups.tomorrow.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Tomorrow
              </h3>
              <div className="bg-card rounded-2xl overflow-hidden shadow-sm border border-border/50 divide-y divide-border/50">
                {groups.tomorrow.map(r => (
                  <ReminderRow
                    key={r.id}
                    reminder={r}
                    onToggle={handleToggleComplete}
                    onEdit={handleOpenEditModal}
                    onDelete={handleDelete}
                    formatDate={formatReminderDate}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming */}
          {groups.upcoming.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Upcoming (Next 7 Days)
              </h3>
              <div className="bg-card rounded-2xl overflow-hidden shadow-sm border border-border/50 divide-y divide-border/50">
                {groups.upcoming.map(r => (
                  <ReminderRow
                    key={r.id}
                    reminder={r}
                    onToggle={handleToggleComplete}
                    onEdit={handleOpenEditModal}
                    onDelete={handleDelete}
                    formatDate={formatReminderDate}
                  />
                ))}
              </div>
            </section>
          )}

          {/* No Date */}
          {groups.noDate.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                No Date / Later
              </h3>
              <div className="bg-card rounded-2xl overflow-hidden shadow-sm border border-border/50 divide-y divide-border/50">
                {groups.noDate.map(r => (
                  <ReminderRow
                    key={r.id}
                    reminder={r}
                    onToggle={handleToggleComplete}
                    onEdit={handleOpenEditModal}
                    onDelete={handleDelete}
                    formatDate={formatReminderDate}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Empty State */}
          {filteredReminders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <Check className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground">
                  All caught up!
                </h4>
                <p className="text-sm text-muted-foreground max-w-xs">
                  No active tasks in this list. Tap Add Task to create a reminder.
                </p>
              </div>
            </div>
          )}

          {/* Completed */}
          {groups.completed.length > 0 && (
            <section className="space-y-2 pt-6 border-t border-border/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Completed ({groups.completed.length})
              </h3>
              <div className="bg-card/40 rounded-2xl overflow-hidden shadow-sm border border-border/55 divide-y divide-border/50 opacity-70">
                {groups.completed.map(r => (
                  <ReminderRow
                    key={r.id}
                    reminder={r}
                    onToggle={handleToggleComplete}
                    onEdit={handleOpenEditModal}
                    onDelete={handleDelete}
                    formatDate={formatReminderDate}
                  />
                ))}
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Add / Edit Task Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md p-6 outline-none border-border/50 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b border-border/50">
            <DialogTitle>{editingReminder ? "Edit Task" : "Add Task"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveReminder} className="space-y-4 pt-4">
            <div className="space-y-1">
              <Label htmlFor="title" className="text-xs font-bold text-muted-foreground uppercase">What needs doing?</Label>
              <Input
                id="title"
                type="text"
                placeholder="Remind me to..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                className="bg-muted/40 border-border/50 h-10"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="notes" className="text-xs font-bold text-muted-foreground uppercase">Details</Label>
              <textarea
                id="notes"
                placeholder="Add notes..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-muted/40 border border-border/50 rounded-xl p-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary outline-none resize-none placeholder-muted-foreground/60 text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase block">Due Date</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "none", label: "No Date" },
                  { id: "today", label: "Today" },
                  { id: "tomorrow", label: "Tomorrow" },
                  { id: "next-week", label: "Next Week" },
                ].map(item => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setDateType(item.id as any)}
                    className={`py-1.5 px-2 text-xs font-medium rounded-lg border transition-all ${
                      dateType === item.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/60 hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setDateType("custom")
                    if (!customDate) {
                      setCustomDate(new Date().toISOString().split("T")[0])
                    }
                  }}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                    dateType === "custom"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 hover:bg-muted text-muted-foreground"
                  }`}
                >
                  Choose Custom Date
                </button>
                {dateType === "custom" && (
                  <div className="mt-3 p-3 bg-muted/20 border border-border/50 rounded-xl space-y-2">
                    <Input
                      type="date"
                      value={customDate}
                      onChange={e => setCustomDate(e.target.value)}
                      className="bg-card border-border/50"
                    />
                  </div>
                )}
              </div>
            </div>

            {dateType !== "none" && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <Label className="text-xs font-bold text-muted-foreground uppercase block">Time</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "all-day", label: "All Day" },
                    { id: "morning", label: "Morning (8 AM)" },
                    { id: "evening", label: "Evening (6 PM)" },
                  ].map(item => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setTimePreset(item.id as any)}
                      className={`py-1.5 px-2 text-xs font-medium rounded-lg border transition-all ${
                        timePreset === item.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/60 hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTimePreset("custom")
                      if (!customTime) setCustomTime("12:00")
                    }}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                      timePreset === "custom"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/60 hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    Choose Custom Time
                  </button>
                  {timePreset === "custom" && (
                    <div className="mt-3 p-3 bg-muted/20 border border-border/50 rounded-xl">
                      <Input
                        type="time"
                        value={customTime}
                        onChange={e => setCustomTime(e.target.value)}
                        className="bg-card border-border/50"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {dateType !== "none" && (
              <div className="space-y-3 pt-3 border-t border-border/50">
                <Label className="text-xs font-bold text-muted-foreground uppercase block">Reminders</Label>
                
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <label className="flex items-center space-x-2 text-sm text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={reminderDueTime}
                      onChange={e => setReminderDueTime(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4 bg-muted/40"
                    />
                    <span>At due time</span>
                  </label>
                  
                  <label className="flex items-center space-x-2 text-sm text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={reminder1Day}
                      onChange={e => setReminder1Day(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4 bg-muted/40"
                    />
                    <span>1 day prior</span>
                  </label>

                  <label className="flex items-center space-x-2 text-sm text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={reminder2Days}
                      onChange={e => setReminder2Days(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4 bg-muted/40"
                    />
                    <span>2 days prior</span>
                  </label>

                  <label className="flex items-center space-x-2 text-sm text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={reminder1Week}
                      onChange={e => setReminder1Week(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4 bg-muted/40"
                    />
                    <span>1 week prior</span>
                  </label>

                  <label className="flex items-center space-x-2 text-sm text-foreground cursor-pointer select-none col-span-2">
                    <input
                      type="checkbox"
                      checked={reminder2Weeks}
                      onChange={e => setReminder2Weeks(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4 bg-muted/40"
                    />
                    <span>2 weeks prior</span>
                  </label>
                </div>

                <div className="pt-2 border-t border-border/30">
                  <label className="flex items-center space-x-2 text-sm text-foreground cursor-pointer select-none mb-2">
                    <input
                      type="checkbox"
                      checked={reminderCustom}
                      onChange={e => setReminderCustom(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4 bg-muted/40"
                    />
                    <span className="font-medium">Custom prior reminder</span>
                  </label>
                  
                  {reminderCustom && (
                    <div className="flex items-center space-x-2 mt-2 p-2.5 bg-muted/20 border border-border/50 rounded-xl">
                      <Input
                        type="number"
                        min={1}
                        value={customReminderValue}
                        onChange={e => setCustomReminderValue(parseInt(e.target.value) || 1)}
                        className="w-20 bg-card border-border/50 h-8 text-sm"
                      />
                      <select
                        value={customReminderUnit}
                        onChange={e => setCustomReminderUnit(e.target.value as any)}
                        className="bg-card border border-border/50 rounded-lg text-sm p-1.5 focus:ring-1 focus:ring-primary outline-none text-foreground h-8"
                      >
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                        <option value="weeks">Weeks</option>
                      </select>
                      <span className="text-xs text-muted-foreground">prior</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border/50">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !title.trim()}
                className="rounded-xl px-5 h-9 font-bold"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
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
  isOverdue?: boolean
}

function ReminderRow({
  reminder,
  onToggle,
  onEdit,
  onDelete,
  formatDate,
  isOverdue,
}: ReminderRowProps) {
  return (
    <div className="group flex items-center justify-between px-3 py-3 sm:px-5 sm:py-3.5 hover:bg-muted/40 transition-colors">
      <div className="flex items-start space-x-2.5 sm:space-x-3.5 flex-1 min-w-0">
        <button
          onClick={() => onToggle(reminder)}
          className="mt-0.5 text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
        >
          {reminder.completed ? (
            <CheckCircle className="w-5 h-5 text-primary fill-primary/10" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(reminder)}>
          <p
            className={`text-sm font-medium truncate text-foreground ${
              reminder.completed ? "line-through text-muted-foreground" : ""
            }`}
          >
            {reminder.title}
          </p>
          
          {reminder.notes && (
            <p className="text-xs text-muted-foreground truncate mt-0.5 font-normal">
              {reminder.notes}
            </p>
          )}

          {reminder.due && (
            <div className="flex items-center space-x-1.5 mt-1.5">
              {isOverdue ? (
                <span className="inline-flex items-center text-[10px] font-semibold text-destructive space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(reminder.due)} (Overdue)</span>
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] font-medium text-primary space-x-1">
                  <CalendarIcon className="w-3 h-3" />
                  <span>{formatDate(reminder.due)}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pl-2 sm:pl-4">
        <button
          onClick={() => onEdit(reminder)}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Edit"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(reminder.id)}
          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
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
