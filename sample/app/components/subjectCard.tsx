"use client";
import { useState } from "react";
import {
  HiUser,
  HiOutlineCalendar,
  HiDotsVertical,
  HiPencil,
  HiTrash,
} from "react-icons/hi";
import { motion, AnimatePresence, Variants } from "motion/react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { deleteSubject } from "@/app/actions/academic";
import AddSubjectModal from "./AddSubjectModal";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      mass: 0.8,
      stiffness: 100,
      damping: 15,
    },
  },
};

export default function SubjectGrid({ subjects }: { subjects: any[] }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const activeSemId = searchParams.get("sem") || "";

  const handleCloseModal = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("edit");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setIsModalOpen(false);
  };

  const handleOpenEdit = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("edit", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setIsModalOpen(true);
  };

  if (!subjects || subjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
        <p className="text-zinc-500">No subjects added yet.</p>
      </div>
    );
  }

  return (
    <>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full"
      >
        {subjects.map((subject) => (
          <SubjectCard
            key={subject.id}
            subject={subject}
            onEdit={() => handleOpenEdit(subject.id)}
          />
        ))}
      </motion.div>

      <AddSubjectModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        semId={activeSemId}
      />
    </>
  );
}

function SubjectCard({
  subject,
  onEdit,
}: {
  subject: any;
  onEdit: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showOptions, setShowOptions] = useState(false);

  const handleDeleteSubject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      confirm(`Delete ${subject.name}? This will wipe all attendance data.`)
    ) {
      // Dynamic imports
      const { db } = await import("@/lib/db");
      const { queueMutation } = await import("@/lib/sync");
      
      // Local Delete
      await db.subjects.delete(subject.id);
      
      // Delete related data locally
      await db.attendance.where('subjectId').equals(subject.id).delete();
      await db.tasks.where('subjectId').equals(subject.id).delete();
      await db.grades.where('subjectId').equals(subject.id).delete();

      // Queue Mutation
      await queueMutation('subjects', 'delete', { id: subject.id });
    }
    setShowOptions(false);
  };

  const viewAttendance = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "attendance");
    params.set("subject", subject.id);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -5 }}
      className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-6 rounded-3xl shadow-sm hover:shadow-xl relative"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-bold px-2 py-1 rounded-lg tracking-wider uppercase">
          {subject.code || "No Code"}
        </div>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowOptions(!showOptions);
            }}
            className="text-zinc-400 hover:text-zinc-600 p-1"
          >
            <HiDotsVertical />
          </button>

          <AnimatePresence>
            {showOptions && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute right-0 mt-2 w-32 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                    setShowOptions(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                >
                  <HiPencil className="text-blue-500" /> Edit
                </button>
                <button
                  onClick={handleDeleteSubject}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition-colors"
                >
                  <HiTrash /> Delete
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">
        {subject.name}
      </h3>
      <div className="flex items-center gap-2 text-zinc-500 text-sm mb-6">
        <HiUser className="text-zinc-400" />
        <span>{subject.professor}</span>
      </div>

      <button
        onClick={viewAttendance}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-purple-600 hover:text-white rounded-2xl text-sm font-semibold transition-all"
      >
        <HiOutlineCalendar className="text-lg" />
        Attendance
      </button>
    </motion.div>
  );
}
