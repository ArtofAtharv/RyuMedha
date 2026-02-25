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
    const parts = raw.split(/,|and|&|\+/).map(p => p.trim()).filter(Boolean);
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
    if (doc.has('(setup|reset|redo|start over|recreate profile)')) return 'setup';
    if (doc.has('(profile|who am i|my info|my settings)')) return 'profile';
    if (doc.has('(archive|empty|finish|end) semester')) return 'archive semester';
    if (doc.has('(export|download|csv|raw data)')) return 'export';
    if (doc.has('(help|menu|commands|what can you do|how to use)')) return 'help';

    // Attendance Lists (e.g., "attended math and physics")
    if (doc.has('(attended|went to|present in|at|marked present)')) {
        const subjects = extractSubjectList(raw, '(attended|went to|present in|at|marked present)');
        if (subjects.length > 0) return `attended ${subjects.join(', ')}`;
    }
    if (doc.has('(missed|skipped|absent|not in|away from|marked absent)')) {
        const subjects = extractSubjectList(raw, '(missed|skipped|absent|not in|away from|marked absent)');
        if (subjects.length > 0) return `missed ${subjects.join(', ')}`;
    }
    if (doc.has('(deemed|cancelled|holiday|off for)')) {
        const subjects = extractSubjectList(raw, '(deemed|cancelled|holiday|off for)');
        if (subjects.length > 0) return `deemed ${subjects.join(', ')}`;
    }
    if (doc.has('(undo|remove last|forget|unmark)')) {
        const subjects = extractSubjectList(raw, '(undo|remove last|forget|unmark)');
        if (subjects.length > 0) return `undo ${subjects.join(', ')}`;
    }

    // Grades (e.g., "I got 25/30 in math")
    if (doc.has('(grade|mark|score|got|result)')) {
        const marksMatch = raw.match(/(\d+)(?:\s+out of\s+|\s*\/\s*)(\d+)/i) || raw.match(/(\d+)\s+(\d+)/);
        if (marksMatch) {
            const marks = marksMatch[1];
            const max = marksMatch[2];
            let tempDoc = nlp(raw);
            tempDoc.remove('(grade|mark|score|got|result|in|for|today|of|out)');
            tempDoc.remove(marksMatch[0]);
            let subject = tempDoc.text().trim();
            let type = 'other';
            if (subject.includes('midsem')) { type = 'mid_sem'; subject = subject.replace('midsem', ''); }
            else if (subject.includes('endsem')) { type = 'end_sem'; subject = subject.replace('endsem', ''); }
            return `add grade ${subject.trim()}, ${type}, ${marks}, ${max}`;
        }
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
        return `add task ${tempDoc.text().trim()}`;
    }
    if (doc.has('(done|complete|finished) task #Value')) {
        let num = doc.values().toNumber().out('array')[0];
        if (num) return `done ${num}`;
    }

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
