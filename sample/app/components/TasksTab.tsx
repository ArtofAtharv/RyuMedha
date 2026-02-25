"use client";
import { useState } from "react"; 
import { addTask, toggleTask, deleteTask } from "@/app/actions/academic";
import { HiPlus, HiTrash, HiCheckCircle, HiCalendar, HiTag } from "react-icons/hi";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";

export default function TasksTab({ subjects }: { subjects: any[] }) {
  const [newTask, setNewTask] = useState({
    title: "",
    subjectId: "",
    dueDate: "",
  });

  // Derived from Props
  const allTasks = subjects.flatMap(s => s.tasks || []);
  const pendingTasks = allTasks.filter((t: any) => !t.completed).sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const completedTasks = allTasks.filter((t: any) => t.completed);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !newTask.subjectId) return;

    // Dynamic Imports
    const { db } = await import("@/lib/db");
    const { queueMutation } = await import("@/lib/sync");

    const newTaskObj = {
        id: crypto.randomUUID(),
        subjectId: newTask.subjectId,
        title: newTask.title,
        description: "",
        dueDate: new Date(newTask.dueDate || Date.now()),
        priority: "medium",
        completed: false
    };

    // 1. Local Add
    await db.tasks.add(newTaskObj);

    // 2. Queue Mutation
    await queueMutation('tasks', 'create', newTaskObj);

    setNewTask({ title: "", subjectId: "", dueDate: "" });
  };

  return (
    <div className="w-full space-y-8">
      {/* Quick Add Bar */}
      <form
        onSubmit={handleAddTask}
        className="bg-white dark:bg-zinc-900 p-4 rounded-4xl border dark:border-zinc-800 shadow-sm flex flex-wrap gap-3 items-center"
      >
        <div className="flex-1 min-w-50">
          <input
            required
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            placeholder="What needs to be done?"
            className="w-full bg-transparent px-4 py-2 outline-none dark:text-white font-medium"
          />
        </div>
        <select
          required
          value={newTask.subjectId}
          onChange={(e) =>
            setNewTask({ ...newTask, subjectId: e.target.value })
          }
          className="bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-2xl text-xs font-bold outline-none dark:text-white border-none"
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
          value={newTask.dueDate}
          onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
          className="bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-2xl text-xs font-bold outline-none dark:text-white border-none"
        />
        <button
          type="submit"
          className="bg-purple-600 text-white p-3 rounded-2xl hover:bg-purple-500 transition-all shadow-lg shadow-purple-500/20"
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
              <TaskCard key={task.id} task={task} subjects={subjects} />
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
                <TaskCard key={task.id} task={task} subjects={subjects} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, subjects }: { task: any; subjects: any[] }) {
  const subject = subjects.find((s) => s.id === task.subjectId);

  const handleToggle = async () => {
    // Dynamic Imports
    const { db } = await import("@/lib/db");
    const { queueMutation } = await import("@/lib/sync");

    const newStatus = !task.completed;
    
    // 1. Local Update
    await db.tasks.update(task.id, { completed: newStatus });

    // 2. Queue Mutation
    await queueMutation('tasks', 'update', { id: task.id, completed: newStatus });
  };

  const handleDelete = async () => {
     // Dynamic Imports
    const { db } = await import("@/lib/db");
    const { queueMutation } = await import("@/lib/sync");

    // 1. Local Delete
    await db.tasks.delete(task.id);

    // 2. Queue Mutation
    await queueMutation('tasks', 'delete', { id: task.id });
  };

  return (
    <motion.div
      layout
      className={`group flex items-center gap-4 p-5 rounded-[28px] border ${
        task.completed
          ? "bg-zinc-50 dark:bg-zinc-900/40 border-transparent opacity-60"
          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm"
      }`}
    >
      <button
        onClick={handleToggle}
        className={`text-2xl ${task.completed ? "text-green-500" : "text-zinc-300 hover:text-purple-500"}`}
      >
        <HiCheckCircle />
      </button>

      <div className="flex-1 min-w-0">
        <h4
          className={`font-bold truncate dark:text-white ${task.completed ? "line-through text-zinc-400" : ""}`}
        >
          {task.title}
        </h4>
        <div className="flex items-center gap-3 mt-1">
          <span className="flex items-center gap-1 text-[10px] font-black uppercase text-purple-600 dark:text-purple-400">
            <HiTag /> {subject?.name || "General"}
          </span>
          <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-400">
            <HiCalendar /> {format(new Date(task.dueDate), "dd MMM")}
          </span>
        </div>
      </div>

      <button
        onClick={handleDelete}
        className="p-2 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
      >
        <HiTrash />
      </button>
    </motion.div>
  );
}
