const fs = require('fs');

async function logAttendance(user, subjectName, status) {
  return new Promise(resolve => setTimeout(() => resolve(`Logged ${status} for ${subjectName}`), 10));
}

const MESSAGES = {
  attendance: {
    deemedPrompt: "deemedPrompt",
    notFound: (item) => `Not found: ${item}`
  }
};

async function handleDeemedCurrent(user, rawText) {
  if (!rawText) return MESSAGES.attendance.deemedPrompt;
  const items = rawText.split(',').map(s => s.trim()).filter(Boolean);
  const results = [];
  for (const item of items) {
    let res = await logAttendance(user, item, 'deemed');
    if (res === null && item.toLowerCase().includes(' and ')) {
      const parts = item.split(/\s+and\s+/i);
      const subs = [];
      for (const p of parts) {
        const subRes = await logAttendance(user, p, 'deemed');
        if (subRes) subs.push(subRes);
      }
      if (subs.length) results.push(subs.join('\n\n'));
      else results.push(MESSAGES.attendance.notFound(item));
    } else results.push(res || MESSAGES.attendance.notFound(item));
  }
  return results.join('\n\n');
}

async function handleDeemedOptimized(user, rawText) {
  if (!rawText) return MESSAGES.attendance.deemedPrompt;
  const items = rawText.split(',').map(s => s.trim()).filter(Boolean);

  const promises = items.map(async (item) => {
    let res = await logAttendance(user, item, 'deemed');
    if (res === null && item.toLowerCase().includes(' and ')) {
      const parts = item.split(/\s+and\s+/i);
      const subPromises = parts.map(async (p) => {
        const subRes = await logAttendance(user, p, 'deemed');
        return subRes;
      });
      const subResArray = await Promise.all(subPromises);
      const subs = subResArray.filter(Boolean);

      if (subs.length) return subs.join('\n\n');
      else return MESSAGES.attendance.notFound(item);
    } else {
      return res || MESSAGES.attendance.notFound(item);
    }
  });

  const results = await Promise.all(promises);
  return results.join('\n\n');
}

async function run() {
  const user = {};
  const text = "item1, item2, item3, item4, item5, item6, item7, item8, item9, item10, item11 and item12, item13 and item14 and item15, item16, item17, item18, item19, item20";

  // Warmup
  await handleDeemedCurrent(user, text);
  await handleDeemedOptimized(user, text);

  const iterations = 10;

  let currentTotal = 0;
  for (let i = 0; i < iterations; i++) {
    let start = Date.now();
    await handleDeemedCurrent(user, text);
    currentTotal += (Date.now() - start);
  }

  let optimizedTotal = 0;
  for (let i = 0; i < iterations; i++) {
    let start = Date.now();
    await handleDeemedOptimized(user, text);
    optimizedTotal += (Date.now() - start);
  }

  console.log(`Current avg: ${currentTotal / iterations}ms`);
  console.log(`Optimized avg: ${optimizedTotal / iterations}ms`);
}

run();
