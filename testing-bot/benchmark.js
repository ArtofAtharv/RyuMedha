const { performance } = require('perf_hooks');

// Mock data
const activeSubjects = Array.from({ length: 20 }, (_, i) => ({ id: `sub_${i}`, name: `Subject ${i}` }));

const mockClient = {
  from: (table) => {
    return {
      select: (cols) => {
        let chain = {
          eq: () => chain,
          in: () => chain,
          maybeSingle: async () => {
            await new Promise(resolve => setTimeout(resolve, 10)); // 10ms network delay
            return { data: null };
          },
          then: async (resolve) => {
            await new Promise(r => setTimeout(r, 10)); // 10ms network delay
            resolve({ data: [] });
          }
        };
        return chain;
      },
      insert: async (data) => {
        await new Promise(resolve => setTimeout(resolve, 20)); // 20ms network delay
        return { data, error: null };
      }
    };
  }
};

async function handleMarkAll_Old(user, status, uc) {
  const today = new Date().toISOString().split('T')[0];
  let count = 0;
  for (const s of activeSubjects) {
    const { data: existing } = await uc.from('attendance_logs').select('id').eq('profile_id', user.id).eq('subject_id', s.id).eq('lecture_date', today).maybeSingle();
    if (!existing) {
      await uc.from('attendance_logs').insert([{ profile_id: user.id, subject_id: s.id, lecture_date: today, status }]);
      count++;
    }
  }
  return count;
}

async function handleMarkAll_New(user, status, uc) {
  const today = new Date().toISOString().split('T')[0];

  // Single query to get existing logs
  const { data: existingLogs } = await uc.from('attendance_logs')
    .select('subject_id')
    .eq('profile_id', user.id)
    .eq('lecture_date', today)
    .in('subject_id', activeSubjects.map(s => s.id));

  const existingSubjectIds = new Set(existingLogs?.map(log => log.subject_id) || []);
  const subjectsToInsert = activeSubjects.filter(s => !existingSubjectIds.has(s.id));

  if (subjectsToInsert.length > 0) {
    const logsToInsert = subjectsToInsert.map(s => ({
      profile_id: user.id,
      subject_id: s.id,
      lecture_date: today,
      status
    }));
    await uc.from('attendance_logs').insert(logsToInsert);
  }

  return subjectsToInsert.length;
}

async function runBenchmark() {
  const user = { id: 'user_123' };

  console.log("Running baseline (Old N+1)...");
  const startOld = performance.now();
  await handleMarkAll_Old(user, 'present', mockClient);
  const endOld = performance.now();
  console.log(`Old time: ${(endOld - startOld).toFixed(2)}ms`);

  console.log("Running optimized (New Bulk)...");
  const startNew = performance.now();
  await handleMarkAll_New(user, 'present', mockClient);
  const endNew = performance.now();
  console.log(`New time: ${(endNew - startNew).toFixed(2)}ms`);
}

runBenchmark();
