"use client";
import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HiChevronDown, HiCheck, HiPlus, HiX, HiPencil } from "react-icons/hi";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { addSemester, deleteSemester, renameSemester, setCurrentSemester } from "@/app/actions/academic";

interface Props {
  semesters: any[];
  programId: string;
}

export default function Semester({ semesters, programId }: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempNo, setTempNo] = useState<number | "">(1);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeSemId = searchParams.get("sem") || "";
  const activeSemData = semesters.find((s) => s.id === activeSemId);
  const activeSemName = activeSemData ? activeSemData.name : "Select Semester";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
        setEditingId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const startEditing = (e: React.MouseEvent, sem: any) => {
    e.stopPropagation();
    setEditingId(sem.id);
    setTempNo(sem.number);
  };

  const handleRename = async (id: string) => {
    if (tempNo === "" || isNaN(tempNo) || tempNo <= 0) {
      setEditingId(null);
      return;
    }

    if (tempNo !== semesters.find(s => s.id === id)?.number) {
       // Check for duplicate locally
       if (semesters.some(s => s.number === tempNo && s.id !== id)) {
           alert("This semester number already exists!");
           setEditingId(null);
           return;
       }
       await renameSemester(id, tempNo);
       
       if (activeSemId === id) {
        // We need to reload or let the server action revalidate update the UI
        // But the ID might change if we relied on number for ID?
        // My schema uses fixed ID `${programId}-sem-${number}`... 
        // Wait, if I rename number, the ID doesn't change in Prisma unless I force it. 
        // But my ID generation logic in `addSemester` uses number.
        // It's better NOT to change ID. Just change Name and Number field.
       }
    }
    setEditingId(null);
  };

  const handleSemChange = (id: string) => {
    if (editingId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("sem", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setDropdownOpen(false);
  };

  const handleSetGlobalActive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await setCurrentSemester(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("sem", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setDropdownOpen(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure? This will permanently delete this Semester and all its data.")) {
        await deleteSemester(id);
        if (activeSemId === id) {
            const params = new URLSearchParams(searchParams.toString());
            params.delete("sem");
            router.replace(`${pathname}?${params.toString()}`);
        }
    }
  };

  const handleAddSemester = async () => {
     await addSemester(programId);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center justify-between gap-2 px-4 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-full text-sm font-medium transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 w-full md:w-auto min-w-35"
      >
        <span className="truncate">{activeSemName}</span>
        <HiChevronDown className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {dropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute mt-2 w-full md:w-64 bg-white dark:bg-zinc-950 border dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-1"
          >
            <div className="space-y-1 mb-2 max-h-60 overflow-y-auto">
              {semesters.map((sem) => (
                <div
                  key={sem.id}
                  onClick={() => handleSemChange(sem.id)}
                  className={`group w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm cursor-pointer transition-colors ${
                    activeSemId === sem.id && !editingId
                      ? "bg-zinc-100 dark:bg-zinc-800"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1">
                    {editingId === sem.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          autoFocus
                          className="bg-transparent border-b border-purple-500 outline-none w-12 text-black dark:text-white"
                          value={tempNo}
                          onChange={(e) => setTempNo(e.target.value === "" ? "" : parseInt(e.target.value))}
                          onBlur={() => handleRename(sem.id)}
                          onKeyDown={(e) => e.key === "Enter" && handleRename(sem.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    ) : (
                      <>
                        <span className="truncate">{sem.name}</span>
                        {activeSemId === sem.id && <HiCheck className="text-purple-500" />}
                      </>
                    )}
                  </div>

                  {!editingId && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {activeSemId !== sem.id && (
                        <button 
                          onClick={(e) => handleSetGlobalActive(e, sem.id)}
                          className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 rounded-md"
                          title="Set as Active"
                        >
                          <HiCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={(e) => startEditing(e, sem)} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md">
                        <HiPencil className="w-3.5 h-3.5 text-zinc-400" />
                      </button>
                      <button onClick={(e) => handleDelete(e, sem.id)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-400 hover:text-red-500 rounded-md">
                        <HiX className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleAddSemester}
              className="w-full flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3 py-2 rounded-xl text-sm font-medium border border-dashed border-zinc-200 dark:border-zinc-800"
            >
              <HiPlus /> Add Semester
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}