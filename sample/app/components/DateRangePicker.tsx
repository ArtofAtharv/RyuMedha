"use client";
import { useState } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval, startOfWeek, endOfWeek, isToday } from "date-fns";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";

export default function DateRangePicker({ onRangeSelect }: { onRangeSelect: (range: Date[]) => void }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selection, setSelection] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end: endOfWeek(endOfMonth(currentMonth)),
  });

  const handleDateClick = (date: Date) => {
    if (!selection.start || (selection.start && selection.end)) {
      setSelection({ start: date, end: null });
    } else {
      const start = selection.start < date ? selection.start : date;
      const end = selection.start < date ? date : selection.start;
      setSelection({ start, end });
      
      // Send the full array of dates back to the modal
      onRangeSelect(eachDayOfInterval({ start, end }));
    }
  };

  const isInRange = (date: Date) => {
    if (!selection.start || !selection.end) return false;
    return isWithinInterval(date, { start: selection.start, end: selection.end });
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-3xl p-4 w-full shadow-inner">
      <div className="flex justify-between items-center mb-4 px-2">
        <h4 className="font-bold text-sm dark:text-white">{format(currentMonth, "MMMM yyyy")}</h4>
        <div className="flex gap-1">
          <button type="button" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"><HiChevronLeft /></button>
          <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"><HiChevronRight /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-[10px] font-bold text-zinc-400 text-center py-1">{d}</div>
        ))}
        {days.map((day, i) => {
          const isSelected = (selection.start && isSameDay(day, selection.start)) || (selection.end && isSameDay(day, selection.end));
          const rangeActive = isInRange(day);
          const isCurrentMonth = isSameDay(startOfMonth(day), startOfMonth(currentMonth));

          return (
            <button
              key={i}
              type="button"
              onClick={() => handleDateClick(day)}
              className={`
                aspect-square text-xs rounded-xl transition-all relative
                ${!isCurrentMonth ? "text-zinc-300 dark:text-zinc-700" : "text-zinc-600 dark:text-zinc-300"}
                ${rangeActive ? "bg-purple-100 dark:bg-purple-900/40 text-purple-600 rounded-none! first:rounded-l-xl last:rounded-r-xl" : ""}
                ${isSelected ? "bg-purple-600 text-white! rounded-xl! z-10 shadow-lg shadow-purple-500/30" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}
                ${isToday(day) && !isSelected ? "border border-purple-500" : ""}
              `}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
      
      {selection.start && !selection.end && (
        <p className="text-[10px] text-purple-500 mt-3 text-center animate-pulse font-medium">Select end date...</p>
      )}
    </div>
  );
}