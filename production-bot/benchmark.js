const { performance } = require('perf_hooks');

const MESSAGES = {
  attendance: {
    attendedPrompt: 'prompt',
    notFound: (item) => `not found ${item}`
  }
};

async function mockLogAttendance(user, item, status) {
  // Simulate 100ms DB latency
  await new Promise(resolve => setTimeout(resolve, 100));
  return `Logged ${item} as ${status}`;
}

async function handleAttendedSequential(user, rawText) {
  if (!rawText) return MESSAGES.attendance.attendedPrompt;
  const items = rawText.split(',').map(s => s.trim()).filter(Boolean);
  const results = [];
  for (const item of items) {
    let res = await mockLogAttendance(user, item, 'present');
    if (res === null && item.toLowerCase().includes(' and ')) {
      const parts = item.split(/\s+and\s+/i);
      const subs = [];
      for (const p of parts) {
        const subRes = await mockLogAttendance(user, p, 'present');
        if (subRes) subs.push(subRes);
      }
      if (subs.length) results.push(subs.join('\n\n'));
      else results.push(MESSAGES.attendance.notFound(item));
    } else results.push(res || MESSAGES.attendance.notFound(item));
  }
  return results.join('\n\n');
}

async function handleAttendedConcurrent(user, rawText) {
  if (!rawText) return MESSAGES.attendance.attendedPrompt;
  const items = rawText.split(',').map(s => s.trim()).filter(Boolean);
  const results = await Promise.all(items.map(async (item) => {
    let res = await mockLogAttendance(user, item, 'present');
    if (res === null && item.toLowerCase().includes(' and ')) {
      const parts = item.split(/\s+and\s+/i);
      const subs = await Promise.all(parts.map(p => mockLogAttendance(user, p, 'present')));
      const validSubs = subs.filter(Boolean);
      if (validSubs.length) return validSubs.join('\n\n');
      else return MESSAGES.attendance.notFound(item);
    } else return res || MESSAGES.attendance.notFound(item);
  }));
  return results.join('\n\n');
}

async function run() {
  const user = {};
  const input = "Math, Science, History, Art, P.E.";

  console.log("Running Sequential Baseline...");
  const t0 = performance.now();
  await handleAttendedSequential(user, input);
  const t1 = performance.now();
  const seqTime = t1 - t0;
  console.log(`Sequential took: ${seqTime.toFixed(2)} ms`);

  console.log("Running Concurrent Optimization...");
  const t2 = performance.now();
  await handleAttendedConcurrent(user, input);
  const t3 = performance.now();
  const conTime = t3 - t2;
  console.log(`Concurrent took: ${conTime.toFixed(2)} ms`);

  const improvement = ((seqTime - conTime) / seqTime * 100).toFixed(2);
  console.log(`Improvement: ${improvement}% (${(seqTime/conTime).toFixed(2)}x faster)`);
}

run();
