"use client";
import { useState } from "react"; 
import { HiPlus, HiTrash, HiCheckCircle, HiCalendar, HiTag } from "react-icons/hi";
import { motion, AnimatePresence } from "motion/react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

export default function TasksTab({ subjects, tasksData, token, profileId }: { subjects: any[], tasksData: any[], token?: string, profileId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    subjectId: "",
    dueDate: "",
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}
  );

  // Derived from the mapped Supabase Data
  const pendingTasks = tasksData.filter((t: any) => !t.is_completed).sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  const completedTasks = tasksData.filter((t: any) => t.is_completed).sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !newTask.subjectId) return;

    setIsSubmitting(true);

    const newTaskObj = {
        profile_id: profileId,
        subject_id: newTask.subjectId,
        title: newTask.title,
        description: "",
        due_date: new Date(newTask.dueDate || Date.now()).toISOString().split('T')[0],
        priority: "medium",
        is_completed: false
    };

    // 1. Live Supabase Insert
    await supabase.from('tasks').insert([newTaskObj]);
    
    setNewTask({ title: "", subjectId: "", dueDate: "" });
    setIsSubmitting(false);
    router.refresh();
  };

  return (
    <div className="w-full space-y-8">
      {/* Quick Add Bar */}
      <form
        onSubmit={handleAddTask}
        className="bg-white dark:bg-zinc-900 p-4 rounded-4xl border dark:border-zinc-800 shadow-sm flex flex-wrap gap-3 items-center"
      >
        <div className="flex-1 min-w-[200px]">
          <input
            required
            disabled={isSubmitting}
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            placeholder="What needs to be done?"
            className="w-full bg-transparent px-4 py-2 outline-none dark:text-white font-medium disabled:opacity-50"
          />
        </div>
        <select
          required
          disabled={isSubmitting}
          value={newTask.subjectId}
          onChange={(e) =>
            setNewTask({ ...newTask, subjectId: e.target.value })
          }
          className="bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-2xl text-xs font-bold outline-none dark:text-white border-none disabled:opacity-50"
        >
          <option value="">Select Subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          disabled={isSubmitting}
          value={newTask.dueDate}
          onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
          className="bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-2xl text-xs font-bold outline-none dark:text-white border-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-purple-600 text-white p-3 rounded-2xl hover:bg-purple-500 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50"
        >
          <HiPlus className="text-xl" />
        </button>
      </form>

      {/* --- PENDING TASKS SECTION --- */}
      <div className="space-y-4">
        <h3 className="text-sm font-black uppercase text-zinc-400 tracking-widest ml-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          Pending Tasks ({pendingTasks.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {pendingTasks.map((task: any) => (
              <TaskCard key={task.id} task={task} subjects={subjects} supabase={supabase} router={router} />
            ))}
          </AnimatePresence>
        </div>
        {pendingTasks.length === 0 && (
          <p className="text-center py-10 text-zinc-500 font-medium">
            All caught up! No pending tasks.
          </p>
        )}
      </div>

      {/* --- COMPLETED TASKS SECTION --- */}
      {completedTasks.length > 0 && (
        <div className="space-y-4 pt-4 border-t dark:border-zinc-800">
          <h3 className="text-sm font-black uppercase text-zinc-500 tracking-widest ml-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-zinc-400" />
            Completed ({completedTasks.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {completedTasks.map((task: any) => (
                <TaskCard key={task.id} task={task} subjects={subjects} supabase={supabase} router={router} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, subjects, supabase, router }: { task: any; subjects: any[], supabase: any, router: any }) {
  const subject = subjects.find((s) => s.id === task.subject_id);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async () => {
    setIsUpdating(true);
    const newStatus = !task.is_completed;
    
    // Live Supabase Update
    await supabase.from('tasks').update({ is_completed: newStatus, updated_at: new Date().toISOString() }).eq('id', task.id);
    
    setIsUpdating(false);
    router.refresh();
  };

  const handleDelete = async () => {
     if(!confirm('Delete this task forever?')) return;
     setIsUpdating(true);

     // Live Supabase Delete
     await supabase.from('tasks').delete().eq('id', task.id);
     
     setIsUpdating(false);
     router.refresh();
  };

  const priorityColors = {
    low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: isUpdating ? 0.5 : 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -10, transition: { duration: 0.2 } }}
      whileHover={{ y: -2 }}
      className={`bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-5 rounded-3xl shadow-sm flex items-start gap-4 transition-colors ${
        task.is_completed ? "opacity-60 grayscale hover:grayscale-0" : ""
      }`}
    >
      <button
        onClick={handleToggle}
        disabled={isUpdating}
        className={`mt-1 text-2xl shrink-0 transition-colors ${
          task.is_completed
            ? "text-purple-500 dark:text-purple-400"
            : "text-zinc-300 dark:text-zinc-600 hover:text-purple-400"
        }`}
      >
        <HiCheckCircle />
      </button>

      <div className="flex-1 min-w-0">
        <h4
          className={`font-bold text-zinc-900 dark:text-zinc-50 truncate ${
            task.is_completed ? "line-through text-zinc-500" : ""
          }`}
        >
          {task.title}
        </h4>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          {subject && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
              <HiTag />
              {subject.name}
            </span>
          )}
          {task.due_date && (
            <span
              className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                new Date(task.due_date) < new Date() && !task.is_completed
                  ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              <HiCalendar />
              {format(new Date(task.due_date), "MMM d")}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={handleDelete}
        disabled={isUpdating}
        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors shrink-0 disabled:opacity-50"
      >
        <HiTrash />
      </button>
    </motion.div>
  );
}
