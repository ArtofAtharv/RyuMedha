"use client";
import { HiX } from "react-icons/hi";

export default function AddSubjectModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-md shadow-xl relative text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-red-500 bg-zinc-100 dark:bg-zinc-800 rounded-full transition-colors"
        >
          <HiX />
        </button>
        <h2 className="text-xl font-black mb-4 dark:text-white">Add Subject</h2>
        <p className="text-zinc-500 text-sm">
           This modal was mocked for the sample UI. To add a subject securely, please use the main Subjects tab.
        </p>
      </div>
    </div>
  );
}
