/**
 * similarity-engine.js
 *
 * Semantic similarity engine using @huggingface/transformers (all-MiniLM-L6-v2).
 * Runs fully locally — no API key, no internet after first model download.
 *
 * The model (~22 MB) is cached automatically to:
 *   ~/.cache/huggingface/hub/  (Linux/Mac)
 *   %USERPROFILE%\.cache\huggingface\hub\  (Windows)
 *
 * On first run it downloads the model from HuggingFace Hub.
 * On subsequent runs it loads from the local cache instantly.
 */

'use strict';

/* ------------------------------------------------------------------ */
/*  State                                                               */
/* ------------------------------------------------------------------ */

let _pipeline      = null;   // the loaded feature-extraction pipeline
let _pipelineReady = false;  // true once fully loaded
let _loading       = false;  // guard against concurrent loads
let _loadError     = null;   // set if model load permanently failed

/* ------------------------------------------------------------------ */
/*  Generic stopwords to strip before embedding                         */
/*  (prevents common filler words from dominating cosine similarity)   */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Stopwords & Generic Capstone Boilerplate Words                      */
/*  Strips function words AND generic suffix boilerplate (management,   */
/*  system, web-based, platform, portal, analytics, tracking, etc.)      */
/*  so embeddings focus strictly on the core domain topic.              */
/* ------------------------------------------------------------------ */

const _EMBED_STOP = new Set([
    // Articles
    'the', 'a', 'an',
    // Conjunctions
    'and', 'or', 'but', 'nor', 'yet', 'so',
    // Prepositions
    'in', 'on', 'at', 'to', 'for', 'with', 'of', 'by', 'as', 'into',
    'about', 'from', 'over', 'under', 'above', 'below', 'off', 'out',
    // Pronouns
    'it', 'its', 'this', 'that', 'these', 'those',
    'we', 'you', 'your', 'our', 'they', 'their', 'he', 'she', 'him', 'her', 'us',
    // Auxiliary / modal verbs
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'shall', 'can', 'might',
    'was', 'were',
    // Short fillers (no domain meaning)
    'not', 'also', 'such', 'each', 'all', 'any', 'both', 'few',
    'more', 'other', 'same', 'than', 'too', 'very', 'just',
    'while', 'where', 'when', 'which', 'who', 'how', 'what',
    'already', 'still', 'even', 'only', 'then', 'thus', 'hence',
    // Pure filler verbs
    'get', 'gets', 'got', 'put', 'set', 'run', 'runs', 'keep', 'kept',
    'come', 'comes', 'came', 'go', 'goes', 'went', 'give', 'gives', 'given',
    'show', 'shows', 'find', 'finds', 'need', 'needs', 'want', 'wants',
    'make', 'makes', 'made', 'take', 'takes', 'taken',
    // Short common words with no domain meaning
    'are', 'per', 'main', 'real', 'own', 'low', 'new', 'old', 'big', 'key',
    'via', 'vs', 'etc', 'ie', 'eg',
    'based', 'using', 'used', 'use', 'uses', 'like', 'see', 'let',
    'among', 'within', 'across', 'along', 'during', 'before', 'after', 'between',
    'through', 'including', 'included', 'include', 'includes',
    'part', 'parts', 'area', 'areas', 'level', 'levels', 'type', 'types',
    'way', 'ways', 'case', 'cases', 'point', 'points', 'term', 'terms',
    'sign', 'signed', 'view', 'views', 'post', 'posts', 'lead', 'lack',
    'final', 'scattered', 'delayed', 'integrity', 'logic', 'backend', 'adopt', 'adopted',
    // Generic capstone boilerplate words (prevents false matches like Hospital vs OJT)
    'management', 'system', 'systems',
    'web', 'web-based',
    'application', 'applications', 'app', 'apps',
    'platform', 'platforms',
    'portal', 'portals',
    'analytics',
    'tracking', 'tracker',
    'monitoring', 'monitor',
    'automated', 'automatic',
    'project', 'projects',
    'study', 'studies',
    'software', 'tool', 'tools',
    'solution', 'solutions',
    'information',
    'team', 'teams',
    'data',
    'report', 'reports', 'reporting',
    'service', 'services'
]);

/**
 * Strips stopwords and generic boilerplate before embedding.
 * Returns a cleaned string where core domain terms (ojt, internship, hospital, coffee) remain.
 */
function _cleanForEmbed(text) {
    if (!text) return '';
    return String(text)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !_EMBED_STOP.has(w))
        .join(' ');
}

/* ------------------------------------------------------------------ */
/*  Model loader (called once at server startup)                        */
/* ------------------------------------------------------------------ */

async function loadModel() {
    if (_pipelineReady) return;
    if (_loading) {
        // Wait for current loader to finish
        while (_loading) {
            await new Promise(r => setTimeout(r, 100));
        }
        return;
    }
    _loading = true;

    try {
        console.log('[HF-CHECK] Loading @huggingface/transformers model: Xenova/all-MiniLM-L6-v2...');

        // @huggingface/transformers is an ESM-only package, so we
        // must import it dynamically from this CommonJS module.
        const { pipeline, env } = await import('@huggingface/transformers');

        // Allow the ONNX runtime to use all available CPU threads
        env.backends.onnx.wasm.numThreads = 4;

        _pipeline = await pipeline(
            'feature-extraction',
            'Xenova/all-MiniLM-L6-v2',
            { revision: 'main' }
        );

        _pipelineReady = true;
        console.log('[HF-CHECK] Using @huggingface/transformers model: Xenova/all-MiniLM-L6-v2 (READY - Semantic similarity active)');
    } catch (err) {
        _loadError = err;
        console.error('[HF-CHECK] Failed to load @huggingface/transformers model:', err.message);
        console.warn('[HF-CHECK] Falling back to keyword-based similarity.');
    } finally {
        _loading = false;
    }
}

/* ------------------------------------------------------------------ */
/*  Embedding helper                                                    */
/* ------------------------------------------------------------------ */

/**
 * Returns the mean-pooled, L2-normalised embedding for a text string.
 * Strips stopwords first so domain-specific terms dominate cosine scores.
 * @param {string} text
 * @returns {Promise<Float32Array>}
 */
async function embed(text) {
    // Clean + truncate to ~512 tokens to avoid ONNX memory issues on long PDFs
    const cleaned = _cleanForEmbed(text).slice(0, 2000);

    const output = await _pipeline(cleaned, {
        pooling: 'mean',
        normalize: true
    });

    // output.data is a flat Float32Array of length 384 (all-MiniLM-L6-v2)
    return output.data;
}

/* ------------------------------------------------------------------ */
/*  Cosine similarity                                                   */
/* ------------------------------------------------------------------ */

function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot   += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/* ------------------------------------------------------------------ */
/*  Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Returns semantic similarity score between 0 and 1.
 * Falls back to 0 if the model is not ready.
 *
 * @param {string} text1
 * @param {string} text2
 * @returns {Promise<number>} 0–1
 */
async function computeSemanticSimilarity(text1, text2) {
    if (!_pipelineReady || !text1 || !text2) return 0;

    try {
        const [e1, e2] = await Promise.all([embed(text1), embed(text2)]);
        const sim = cosineSimilarity(e1, e2);
        return Math.max(0, Math.min(1, sim)); // clamp to [0,1]
    } catch (err) {
        console.error('[SimilarityEngine] embed error:', err.message);
        return 0;
    }
}

/**
 * True once the HuggingFace model is loaded and ready.
 * @returns {boolean}
 */
function isModelReady() {
    return _pipelineReady;
}

/* ------------------------------------------------------------------ */
/*  Exports                                                             */
/* ------------------------------------------------------------------ */

module.exports = {
    loadModel,
    computeSemanticSimilarity,
    isModelReady,
    embed,
    cosineSimilarity
};
