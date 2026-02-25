import { db, Mutation } from './db';
import * as actions from '@/app/actions/academic';
import { toast } from 'sonner';

// --- MUTATION QUEUE ---

export async function queueMutation(
  table: string,
  type: 'create' | 'update' | 'delete',
  data: any
) {
  await db.mutationQueue.add({
    table,
    type,
    data,
    status: 'pending',
    createdAt: Date.now(),
  });
  
  // Trigger sync immediately if online
  if (navigator.onLine) {
    syncPush();
  }
}

// --- PUSH: Local -> Server ---

export async function syncPush() {
  const pending = await db.mutationQueue
    .where('status')
    .equals('pending')
    .sortBy('createdAt');

  if (pending.length === 0) return;
  
  let hasError = false;
  for (const mutation of pending) {
    try {
      await processMutation(mutation);
      await db.mutationQueue.delete(mutation.id!); // Remove on success
    } catch (error: any) {
      hasError = true;
      // Check for "Record to delete does not exist" (Prisma P2025)
      const isRecordNotFound = error.message?.includes('Record to delete does not exist') || 
                               error.code === 'P2025' ||
                               String(error).includes('No record was found');

      if (isRecordNotFound && mutation.type === 'delete') {
         console.warn(`Skipping delete for missing record: ${mutation.id}`);
         await db.mutationQueue.delete(mutation.id!); // Treat as success
         hasError = false; // Reset error flag for this specific safe case
      } else {
        console.error('Sync failed for mutation:', JSON.stringify(mutation), error);
        await db.mutationQueue.update(mutation.id!, { 
          status: 'error', 
          error: String(error) 
        });
      }
    }
  }

  // 3. Chain Pull after Push (if no errors occurred that would block pull)
  if (!hasError) {
    console.log('Push complete, triggering pull...');
    await syncPull();
  }
}

async function processMutation(mutation: Mutation) {
  const { table, type, data } = mutation;

  switch (table) {
    case 'subjects':
      if (type === 'create') await actions.addSubject(data);
      if (type === 'update') {
          const { id, ...rest } = data;
          await actions.updateSubject(id, rest); // Pass ID separately, rest as data
      }
      if (type === 'delete') await actions.deleteSubject(data.id);
      break;
      
    case 'tasks':
      if (type === 'create') await actions.addTask(data);
      if (type === 'update') {
          // Special case for tasks: check if it's just toggling completion or full update
          if ('completed' in data && Object.keys(data).length === 2) { 
              // Assuming data is { id, completed }
              await actions.toggleTask(data.id, data.completed);
          } else {
              // Current actions don't support generic task update, skipping or implementing later
              console.warn("Generic task update not implemented on server");
          }
      }
      if (type === 'delete') await actions.deleteTask(data.id);
      break;

    case 'attendance':
      if (type === 'update') {
          const { id, ...rest } = data;
          await actions.updateAttendance(id, rest);
      }
      break;
      
    case 'grades':
        if (type === 'update') {
            const { subjectId, ...rest } = data;
            // Grades action expects subjectId to find the grade record, but updateGrade logic:
            // "where: { subjectId }"
            // Actually app/actions/academic.ts:updateGrade uses findFirst({ where: { subjectId } })
            // So we pass subjectId as first arg, and rest as data. 
            // BUT rest should NOT contain ID if possible.
            // If data has ID, strip it too.
            const { id, ...cleanData } = rest;
            await actions.updateGrade(subjectId, cleanData);
        }
        break;

    // Add other cases as needed
  }
}

// --- PULL: Server -> Local ---

export async function syncPull() {
  try {
    const data = await actions.fetchDashboardData();
    if (!data) return;

    await db.transaction('rw', [db.users, db.programs, db.semesters, db.subjects, db.tasks, db.grades, db.attendance], async () => {
      // 1. User
      await db.users.put({
          id: data.id,
          name: data.name,
          email: data.email,
          college: data.college,
          programId: data.programId,
          currentSemId: data.currentSemId
      });

      // 2. Program
      if (data.program) {
           await db.programs.put({
               id: data.program.id,
               name: data.program.name,
               totalSemesters: data.program.totalSemesters
           });

           // 3. Semesters
           if (data.program.semesters) {
               await db.semesters.bulkPut(data.program.semesters.map((s: any) => ({
                   id: s.id,
                   programId: s.programId,
                   number: s.number,
                   name: s.name,
                   no: s.no,
                   holidays: s.holidays,
               })));

               // 4. Subjects
               const allSubjects: any[] = [];
               const allTasks: any[] = [];
               const allGrades: any[] = [];
               const allAttendance: any[] = [];

               data.program.semesters.forEach((sem: any) => {
                   if (sem.subjects) {
                       sem.subjects.forEach((sub: any) => {
                           allSubjects.push({
                               id: sub.id,
                               semId: sub.semId,
                               name: sub.name,
                               code: sub.code,
                               professor: sub.professor,
                               credits: sub.credits
                           });

                           if (sub.tasks) allTasks.push(...sub.tasks);
                           if (sub.grades) allGrades.push(...sub.grades);
                           if (sub.attendance) {
                               allAttendance.push(...sub.attendance.map((att: any) => ({
                                   ...att,
                                   scheduleType: att.scheduleType || null // Ensure scheduleType is present, default to null if missing
                               })));
                           }
                       });
                   }
               });

               await db.subjects.bulkPut(allSubjects);
               await db.tasks.bulkPut(allTasks);
               await db.grades.bulkPut(allGrades);
               await db.attendance.bulkPut(allAttendance);
           }
      }
    });

    console.log('Sync Pull Complete');
  } catch (error) {
    console.error('Sync Pull Failed:', error);
  }
}
