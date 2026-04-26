import nlp from 'https://esm.sh/compromise@14.10.1';
// --- INTENT DICTIONARY (Replicated from nlp_worker.js) ---
const INTENT_DICTIONARY = {
  'stats': {
    keywords: [
      'stat',
      'attendance',
      'percent',
      'progress',
      'perform',
      'summary',
      'record',
      'bunk',
      'report',
      'doing',
      'track',
      'situation',
      'standing',
      'how am i doing',
      'progress report',
      'attendance progress',
      'attendance summary'
    ],
    weight: 1.0
  },
  'profile': {
    keywords: [
      'profile',
      'university',
      'college',
      'uni',
      'program',
      'course',
      'semester',
      'setup',
      'setting',
      'detail',
      'account',
      'identity',
      'personal',
      'college info',
      'university info'
    ],
    weight: 1.0
  },
  'subjects': {
    keywords: [
      'subject',
      'class',
      'lecture',
      'list',
      'track',
      'active',
      'module',
      'learning',
      'classes'
    ],
    weight: 1.0
  },
  'help': {
    keywords: [
      'help',
      'guide',
      'instruction',
      'command',
      'manual',
      'support',
      'tutorial',
      'how to',
      'explain',
      'do i use',
      'guide me',
      'what can you do'
    ],
    weight: 1.1
  },
  'tasks': {
    keywords: [
      'task',
      'todo',
      'pending',
      'item',
      'assignment',
      'remind',
      'homework',
      'project',
      'deadline',
      'pending items'
    ],
    weight: 1.0
  }
};
const STOP_WORDS = new Set([
  'i',
  'me',
  'my',
  'the',
  'a',
  'an',
  'is',
  'am',
  'are',
  'was',
  'were',
  'to',
  'for',
  'in',
  'on',
  'at',
  'about',
  'want',
  'please',
  'give',
  'could',
  'would',
  'where',
  'what',
  'which',
  'how',
  'do',
  'can',
  'see',
  'tell',
  'show'
]);
/** Custom Logical Scoring Engine (Synchronous Port) */ function scoreIntent(text) {
  const raw = text.toLowerCase().trim();
  // 1. High-priority Exact Keyword/Phrase Matches
  for (const [intent, config] of Object.entries(INTENT_DICTIONARY)){
    if (config.keywords.some((k)=>raw.includes(k))) {
      return {
        intent,
        score: 1.1,
        threshold: 0.1
      };
    }
  }
  // 2. Token Matching (Fallback)
  const tokens = raw.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").split(/\s+/).filter((t)=>t && !STOP_WORDS.has(t));
  if (tokens.length === 0) return {
    intent: null,
    score: 0
  };
  let bestIntent = null;
  let maxOverallScore = 0;
  for (const [intent, config] of Object.entries(INTENT_DICTIONARY)){
    let matchCount = 0;
    for (const token of tokens){
      if (config.keywords.some((k)=>token === k || token.length > 3 && token.includes(k) || k.length > 3 && k.includes(token))) {
        matchCount++;
      }
    }
    if (matchCount > 0) {
      const score = matchCount / tokens.length * config.weight;
      if (score > maxOverallScore) {
        maxOverallScore = score;
        bestIntent = intent;
      }
    }
  }
  return {
    intent: bestIntent,
    score: maxOverallScore,
    threshold: 0.25
  };
}
/** Splits lists of subjects intelligently */ function extractSubjectList(text, actionWord) {
  let doc = nlp(text);
  doc.remove(actionWord);
  doc.remove('(i|me|my|the|a|an|we|us|our)');
  doc.remove('(class|subject|today|now|please|lecture|session|module|learning)');
  const raw = doc.text();
  const parts = raw.split(/,|&|\+/).map((p)=>p.trim()).filter(Boolean);
  return parts;
}
/** 
 * Hybrid NLP Parser (Consolidated)
 * Logic exactly as it was in smartRyuma.js
 */ export async function parseIntent(text) {
  if (!text || text.length < 2) return null;
  const doc = nlp(text.trim().toLowerCase());
  const raw = text.trim();
  // --- Layer 1: Pattern Matching ---
  if (doc.has('(reset|redo|start over|recreate) profile') || doc.text() === 'setup') return 'setup';
  if (doc.has('(show|view) (my )?profile') || doc.text() === 'profile') return 'profile';
  if (doc.has('(help|menu|commands|what can you do|how to use)')) return 'help';
  if (doc.has('(add|create|new) (a )?(the )?category #Noun')) {
    let tempDoc = nlp(raw);
    tempDoc.remove('(add|create|new|a|the|category|cat)');
    return `add category ${tempDoc.text().trim()}`;
  }
  if (doc.has('(show|see|list|view) (my )?(the )?(list of )?(categories|cats)')) return 'category';
  if (doc.has('(delete|remove) category #Noun')) {
    let tempDoc = nlp(raw);
    tempDoc.remove('(delete|remove|category|cat)');
    return `delete category ${tempDoc.text().trim()}`;
  }
  if (doc.has('(rename) #Noun to #Noun')) {
    const parts = raw.split(/rename|to/i).map((p)=>p.trim()).filter(Boolean);
    if (parts.length >= 2) return `rename subject ${parts[0]}, ${parts[1]}`;
  }
  if (doc.has('(add|track|new|create) (me )?(a )?(the )?(academic|personal )?(subject|class )?#Noun') && !doc.has('task')) {
    let type = "1";
    if (doc.has('personal')) type = "2";
    const categoryMatch = raw.match(/(?:to|in|under|into)\s+(?:the\s+)?(?:category|cat)\s+(.+)$/i);
    let category = "";
    let cleanText = raw;
    if (categoryMatch) {
      category = categoryMatch[1].trim();
      cleanText = raw.replace(/(?:to|in|under|into)\s+(?:the\s+)?(?:category|cat)\s+(.+)$/i, '').trim();
    }
    let tempDoc = nlp(cleanText);
    tempDoc.remove('(add|track|new|create|me|a|the|academic|personal|subject|class)');
    const subjectName = tempDoc.text().trim();
    if (category) return `add ${subjectName}, ${type}, ${category}`;
    return `add ${subjectName}, ${type}`;
  }
  if (doc.has('(delete|remove) #Noun')) {
    let tempDoc = nlp(raw);
    tempDoc.remove('(delete|remove|subject)');
    return `delete subject ${tempDoc.text().trim()}`;
  }
  if (doc.has('(show|see|list) (me )?(the )?(list of )?subjects')) return 'subjects';
  if (doc.has('#Noun has total #Value lectures')) {
    let val = doc.values().toNumber().out('array')[0];
    let subject = raw.split(/has total/i)[0].trim();
    return `setup total ${subject}, ${val}`;
  }
  if (doc.has('i missed #Value lectures of #Noun')) {
    let val = doc.values().toNumber().out('array')[0];
    let subject = raw.split(/lectures of/i)[1].trim();
    return `setup missed ${subject}, ${val}`;
  }
  if (doc.has('(attended|went to|present in|at|marked present)')) {
    if (doc.has('all lectures today')) return 'present all';
    const subjects = extractSubjectList(raw, '(attended|went to|present in|at|marked present)');
    if (subjects.length > 0) return `attended ${subjects.join(', ')}`;
  }
  if (doc.has('(missed|skipped|absent|not in|away from|marked absent)')) {
    if (doc.has('(all lectures today|today)')) return 'absent all';
    const subjects = extractSubjectList(raw, '(missed|skipped|absent|not in|away from|marked absent)');
    if (subjects.length > 0) return `missed ${subjects.join(', ')}`;
  }
  if (doc.has('(deemed|cancelled|holiday|off for)')) {
    if (doc.has('the whole day')) return 'deemed all';
    const subjects = extractSubjectList(raw, '(deemed|cancelled|holiday|off for)');
    if (subjects.length > 0) return `deemed ${subjects.join(', ')}`;
  }
  if (doc.has('(undo|remove last|forget|unmark)')) {
    if (doc.has('all')) return 'undo all';
    const subjects = extractSubjectList(raw, '(undo|remove last|forget|unmark)');
    if (subjects.length > 0) return `undo ${subjects.join(', ')}`;
  }
  if (doc.has('(start|starting|study|timer for) #Noun') && !doc.has('task')) {
    let tempDoc = nlp(raw);
    tempDoc.remove('(start|starting|study|timer for)');
    return `start ${tempDoc.text().trim()}`;
  }
  if (doc.has('(stop|break) study') || doc.has('finished studying') || doc.text() === 'stop' || doc.text() === 'finished') return 'stop';
  if (doc.has('(add task|remind me to|todo|need to)')) {
    let tempDoc = nlp(raw);
    tempDoc.remove('(add task|remind me to|todo|need to)');
    const taskText = tempDoc.text().trim();
    return `add task ${taskText}`;
  }
  if (doc.has('(mark|done|complete|finished) task #Value (as complete)?')) {
    let num = doc.values().toNumber().out('array')[0];
    if (num) return `done ${num}`;
  }
  if (doc.text() === 'tasks') return 'tasks';
  // --- Layer 2: Logical Intent Fallback ---
  const result = scoreIntent(raw);
  const logicalIntent = result.score >= result.threshold ? result.intent : null;
  if (logicalIntent) return logicalIntent;
  if (doc.has('(stats|attendance|percentage)')) return 'stats';
  if (doc.has('(subjects|list|classes)')) return 'subjects';
  return null;
}
