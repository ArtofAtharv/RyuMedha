"use server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function pullCloudData() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      program: {
        include: {
          semesters: {
            include: {
              subjects: {
                include: { tasks: true, grades: true, attendance: true }
              }
            }
          }
        }
      }
    }
  });
}

export async function pushSyncAction(payload: any) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) return { success: false, message: "Unauthorized", timestamp: null };

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { id: userId },
        update: {
          name: payload.user.name,
          college: payload.user.college,
          programId: payload.user.programId,
          currentSemId: payload.user.currentSemId,
          lastSynced: new Date()
        },
        create: {
          id: userId,
          email: session.user?.email || "",
          name: payload.user.name,
          college: payload.user.college,
          programId: payload.user.programId,
          currentSemId: payload.user.currentSemId,
          lastSynced: new Date()
        }
      });

      for (const subject of payload.subjects) {
        const { id, tasks, grades, attendance, ...fields } = subject;
        await tx.subject.upsert({
          where: { id },
          update: fields,
          create: { id, ...fields }
        });

        // Hierarchy Cleanup: Sync children by replacing them
        await tx.task.deleteMany({ where: { subjectId: id } });
        if (tasks?.length) await tx.task.createMany({ data: tasks });

        await tx.attendance.deleteMany({ where: { subjectId: id } });
        if (attendance?.length) await tx.attendance.createMany({ data: attendance });

        await tx.grade.deleteMany({ where: { subjectId: id } });
        if (grades?.length) await tx.grade.createMany({ data: grades });
      }
      return { success: true, message: "Sync Success", timestamp: new Date() };
    });
    return result;
  } catch (err) {
    return { success: false, message: "Sync Failed", timestamp: null };
  }
}