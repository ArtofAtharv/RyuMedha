const { performance } = require('perf_hooks');

// Mock logAttendance simulating DB latency
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function logAttendance(user, subjectName, status) {
  await delay(100); // 100ms latency per query
  return `Logged ${subjectName} as ${status}`;
}

async function handleMissedBaseline(user, rawText) {
  const subjects = rawText.split(',').map(s => s.trim()).filter(Boolean);
  const responses = [];
  for (const s of subjects) {
    responses.push(await logAttendance(user, s, 'absent'));
  }
  return responses.join('\n\n');
}

async function handleMissedOptimized(user, rawText) {
  const subjects = rawText.split(',').map(s => s.trim()).filter(Boolean);
  const responses = await Promise.all(
    subjects.map(s => logAttendance(user, s, 'absent'))
  );
  return responses.join('\n\n');
}

async function run() {
  const user = { id: 1 };
  const rawText = "Math, Physics, Chemistry, Biology, History, Computer Science, English, Art";

  console.log("Subjects to log:", rawText.split(',').length);

  const start1 = performance.now();
  await handleMissedBaseline(user, rawText);
  const end1 = performance.now();
  const baselineTime = (end1 - start1).toFixed(2);
  console.log(`Baseline time: ${baselineTime} ms`);

  const start2 = performance.now();
  await handleMissedOptimized(user, rawText);
  const end2 = performance.now();
  const optimizedTime = (end2 - start2).toFixed(2);
  console.log(`Optimized time: ${optimizedTime} ms`);
  console.log(`Improvement: ${((baselineTime - optimizedTime) / baselineTime * 100).toFixed(2)}% faster`);
}

run();
