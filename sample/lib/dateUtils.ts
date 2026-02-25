import { addDays, isWeekend, isSameDay, parseISO, startOfDay, differenceInCalendarWeeks } from "date-fns";
// import { ExamEntry } from "./db"; // Removed

type ExamEntry = {
    name: string;
    date: Date;
};

/**
 * Normalizes any input to Local Midnight.
 * Essential for consistent grid alignment.
 */
export const toLocalMidnight = (date: Date | string) => {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
};

export const calculateEndDate = (
  startDate: Date | string,
  totalLectures: number,
  holidays: (Date | string)[],
  exams: ExamEntry[],
  schedule: string[],
  scheduleType: string = "weekly"
): Date => {
  let currentDate = toLocalMidnight(startDate);
  let lecturesCounted = 0;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // For alternate weeks, we calculate difference in calendar weeks relative to the start date
  
  while (lecturesCounted < totalLectures) {
    const dayName = dayNames[currentDate.getDay()];
    const isHoliday = holidays.some((h) => isSameDay(toLocalMidnight(h as Date), currentDate));
    const isExam = exams.some((e) => isSameDay(toLocalMidnight(e.date), currentDate));
    const isScheduledDay = schedule.includes(dayName);

    let shouldCount = isScheduledDay && !isWeekend(currentDate) && !isHoliday && !isExam;

    if (shouldCount && scheduleType === "alternate") {
        const weekDiff = differenceInCalendarWeeks(currentDate, toLocalMidnight(startDate), { weekStartsOn: 0 });
        if (weekDiff % 2 !== 0) {
            shouldCount = false;
        }
    }

    if (shouldCount) {
      lecturesCounted++;
    }

    if (lecturesCounted < totalLectures) {
      currentDate = addDays(currentDate, 1);
    }
  }
  return currentDate;
};