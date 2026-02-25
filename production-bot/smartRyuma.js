/**
 * smartRyuma.js — Ryu Medha Hybrid NLP Brain
 * 
 * Layers:
 * 1. Pattern Matching (Compromise.js) - Instant
 * 2. Logical Scoring Engine (Pure-JS Worker) - Async Weighted Logic
 */

const nlp = require('compromise');
const { Worker } = require('worker_threads');
const path = require('path');

// --- Layer 2: Logical Worker Setup ---
let nlpWorker;
let workerReady = false;

function initWorker() {
    try {
        nlpWorker = new Worker(path.join(__dirname, 'nlp_worker.js'));
        nlpWorker.on('message', (msg) => {
            if (msg.type === 'ready') {
                workerReady = true;
                console.log('🧠 Logical NLP Worker Ready');
            }
            if (msg.type === 'error') console.error('🧠 Worker Error:', msg.error);
        });
        nlpWorker.postMessage({ type: 'init' });
    } catch (err) {
        console.error('🧠 Failed to start NLP Worker:', err);
    }
}

/** Wrapper to get logical best-fit from worker thread */
function getLogicalIntent(text) {
    return new Promise((resolve) => {
        if (!workerReady) return resolve(null);

        const timeout = setTimeout(() => {
            nlpWorker.removeListener('message', handleMessage);
            resolve(null);
        }, 1000); // 1s timeout for safety

        const handleMessage = (msg) => {
            if (msg.type === 'result') {
                clearTimeout(timeout);
                nlpWorker.removeListener('message', handleMessage);
                resolve(msg.intent);
            }
        };

        nlpWorker.on('message', handleMessage);
        nlpWorker.postMessage({ type: 'parse', text });
    });
}

// Boot the worker
initWorker();

/** 
 * Splits lists of subjects intelligently (e.g. "Math, Physics and Chemistry") 
 */
function extractSubjectList(text, actionWord) {
    let doc = nlp(text);
    doc.remove(actionWord);
    // Remove pronouns and small filler words
    doc.remove('(i|me|my|the|a|an|we|us|our)');
    doc.remove('(class|subject|today|now|please|lecture|session|module|learning)');
    const raw = doc.text();
    // Split by common delimiters and conjunctions
    const parts = raw.split(/,|&|\+/).map(p => p.trim()).filter(Boolean);
    return parts;
}

/**
 * Hybrid NLP Parser
 * Translates natural speech into structured bot commands using a 2-layer approach.
 */
async function parseIntent(text) {
    if (!text || text.length < 2) return null;

    // Normalize slightly for Layer 1
    const doc = nlp(text.trim().toLowerCase());
    const raw = text.trim();

    // --- Layer 1: Pattern Matching (Compromise.js) ---
    // Instant detection of common keywords and structural commands

    // Settings & Profile
    if (doc.has('(reset|redo|start over|recreate) profile') || doc.text() === 'setup') return 'setup';
    if (doc.has('(show|view) (my )?profile') || doc.text() === 'profile') return 'profile';
    if (doc.has('(help|menu|commands|what can you do|how to use)')) return 'help';

    // Category Management (Must come before broad "add" or "list" rules)
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

    // Subject Management
    if (doc.has('(rename) #Noun to #Noun')) {
        const parts = raw.split(/rename|to/i).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) return `rename subject ${parts[0]}, ${parts[1]}`;
    }
    // "Add academic subject Family Law I" or "Add Family Law I in Category Law"
    if (doc.has('(add|track|new|create) (me )?(a )?(the )?(academic|personal )?(subject|class )?#Noun') && !doc.has('task')) {
        let type = "1"; // Default academic
        if (doc.has('personal')) type = "2";

        // Extract category if specified using "to/in/under/into (the) category X"
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

    // Setup Subject (Lectures)
    // "Family Law II has total 60 lectures"
    if (doc.has('#Noun has total #Value lectures')) {
        let val = doc.values().toNumber().out('array')[0];
        let subject = raw.split(/has total/i)[0].trim();
        return `setup total ${subject}, ${val}`;
    }
    // "I missed 3 lectures of Family Law II"
    if (doc.has('i missed #Value lectures of #Noun')) {
        let val = doc.values().toNumber().out('array')[0];
        let subject = raw.split(/lectures of/i)[1].trim();
        return `setup missed ${subject}, ${val}`;
    }

    // Attendance Lists (e.g., "attended math and physics")
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

    // Timer related
    if (doc.has('(start|starting|study|timer for) #Noun') && !doc.has('task')) {
        let tempDoc = nlp(raw);
        tempDoc.remove('(start|starting|study|timer for)');
        return `start ${tempDoc.text().trim()}`;
    }
    if (doc.has('(stop|break) study') || doc.has('finished studying') || doc.text() === 'stop' || doc.text() === 'finished') return 'stop';

    // Tasks related
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

    // --- Layer 2: Logical Intent Fallback (Worker) ---
    // If Layer 1 was too strict, ask the worker for a logical keyword-based match.
    const logicalIntent = await getLogicalIntent(raw);
    if (logicalIntent) {
        console.log(`🧠 Logical Brain Match: "${raw}" -> ${logicalIntent}`);
        return logicalIntent;
    }

    // Final direct fallbacks (legacy support)
    if (doc.has('(stats|attendance|percentage)')) return 'stats';
    if (doc.has('(subjects|list|classes)')) return 'subjects';

    return null;
}

module.exports = { parseIntent };
