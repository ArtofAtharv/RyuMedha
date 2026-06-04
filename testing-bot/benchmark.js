const { performance } = require('perf_hooks');

// Mock logAttendance
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function logAttendance(user, item, status) {
  await sleep(100); // simulate 100ms DB latency
  if (item === 'notfound') return null;
  return `Logged ${status} for ${item}`;
}

const MESSAGES = {
  attendance: {
    missedPrompt: "Missed prompt",
    notFound: (item) => `Not found ${item}`
  }
};

// Original
async function handleMissedOriginal(user, rawText) {
  if (!rawText) return MESSAGES.attendance.missedPrompt;
  const items = rawText.split(',').map(s => s.trim()).filter(Boolean);
  const results = [];
  for (const item of items) {
    let res = await logAttendance(user, item, 'absent');
    if (res === null && item.toLowerCase().includes(' and ')) {
      const parts = item.split(/\s+and\s+/i);
      const subs = [];
      for (const p of parts) {
        const subRes = await logAttendance(user, p, 'absent');
        if (subRes) subs.push(subRes);
      }
      if (subs.length) results.push(subs.join('\n\n'));
      else results.push(MESSAGES.attendance.notFound(item));
    } else results.push(res || MESSAGES.attendance.notFound(item));
  }
  return results.join('\n\n');
}

// Optimized
async function handleMissedOptimized(user, rawText) {
  if (!rawText) return MESSAGES.attendance.missedPrompt;
  const items = rawText.split(',').map(s => s.trim()).filter(Boolean);
  const promises = items.map(async (item) => {
    let res = await logAttendance(user, item, 'absent');
    if (res === null && item.toLowerCase().includes(' and ')) {
      const parts = item.split(/\s+and\s+/i);
      const subPromises = parts.map(async (p) => {
        const subRes = await logAttendance(user, p, 'absent');
        return subRes;
      });
      const subResults = await Promise.all(subPromises);
      const validSubs = subResults.filter(Boolean);
      if (validSubs.length) return validSubs.join('\n\n');
      return MESSAGES.attendance.notFound(item);
    }
    return res || MESSAGES.attendance.notFound(item);
  });
  const results = await Promise.all(promises);
  return results.join('\n\n');
}

async function run() {
  const user = { id: 1 };
  const input = "math, science, history, english, art, music, notfound and physics";

  console.log("Measuring Original...");
  const start1 = performance.now();
  await handleMissedOriginal(user, input);
  const end1 = performance.now();
  console.log(`Original: ${(end1 - start1).toFixed(2)} ms`);

  console.log("Measuring Optimized...");
  const start2 = performance.now();
  await handleMissedOptimized(user, input);
  const end2 = performance.now();
  console.log(`Optimized: ${(end2 - start2).toFixed(2)} ms`);
}

run();
