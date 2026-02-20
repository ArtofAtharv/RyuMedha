"use client";
import { useState } from "react";
import {
  HiUser,
  HiOutlineCalendar,
  HiDotsVertical,
  HiPencil,
  HiTrash,
} from "react-icons/hi";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// Dummy modal placeholder until we port it
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
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", mass: 0.8, stiffness: 100, damping: 15 },
  },
};

export default function SubjectGrid({ subjects, token }: { subjects: any[], token?: string }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);

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
      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl w-full">
        <p className="text-zinc-500">No subjects active this semester.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
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
            token={token}
          />
        ))}
      </motion.div>

      <AddSubjectModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}

function SubjectCard({
  subject,
  onEdit,
  token
}: {
  subject: any;
  onEdit: () => void;
  token?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showOptions, setShowOptions] = useState(false);
  
  const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}
  );

  const handleDeleteSubject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete ${subject.name}? This will wipe all attendance data.`)) {
      // 1. Live Supabase Delete
      await supabase.from('subjects').delete().eq('id', subject.id);
      router.refresh();
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
      className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-6 rounded-3xl shadow-sm hover:shadow-xl relative w-full"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-bold px-2 py-1 rounded-lg tracking-wider uppercase">
          {subject.type || "Academic"}
        </div>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowOptions(!showOptions);
            }}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            <HiDotsVertical className="text-zinc-400" />
          </button>

          <AnimatePresence>
            {showOptions && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, transformOrigin: "top right" }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-800 rounded-2xl shadow-xl dark:shadow-none border dark:border-zinc-700 py-2 z-50 overflow-hidden"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOptions(false);
                    onEdit();
                  }}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-sm font-medium transition-colors"
                >
                  <HiPencil className="text-zinc-400" />
                  Edit Subject
                </button>
                <button
                  onClick={handleDeleteSubject}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 text-sm font-medium transition-colors"
                >
                  <HiTrash className="text-red-400" />
                  Delete Subject
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div onClick={viewAttendance} className="cursor-pointer">
        <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight leading-tight">
          {subject.name}
        </h3>
        
        {subject.instructor_name && (
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2 flex items-center gap-2">
            <HiUser className="text-zinc-400" />
            {subject.instructor_name}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
         {/* Render any visual tags if present in our schema */}
         <div className="bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
           <HiOutlineCalendar className="text-sm" />
           {subject.expected_total_lectures || "?"} Lectures
         </div>
      </div>

      {/* Decorative Gradient Line */}
      <div 
        className="absolute bottom-0 left-6 right-6 h-1 rounded-t-full opacity-50 transition-opacity group-hover:opacity-100"
        style={{ backgroundColor: subject.color_hex || '#8b5cf6' }}
      />
    </motion.div>
  );
}
