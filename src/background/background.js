// Background Service Worker for Facebook AI Slop Detector
import { CONFIG } from '../config.js';

// Fast SHA-256 hash helper for cache keys
async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Concurrency Queue to prevent throttling & avoid overwhelming Jev API
class RequestQueue {
  constructor(maxConcurrency = 3) {
    this.maxConcurrency = maxConcurrency;
    this.running = 0;
    this.queue = [];
  }

  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.dequeue();
    });
  }

  async dequeue() {
    if (this.running >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { fn, resolve, reject } = this.queue.shift();

    try {
      const result = await fn();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.running--;
      this.dequeue();
    }
  }
}

const queue = new RequestQueue(CONFIG.MAX_CONCURRENCY);

// Fetch current active API Key
async function getApiKey() {
  const data = await chrome.storage.local.get(['customApiKey']);
  if (data.customApiKey && data.customApiKey.trim() !== '') {
    return data.customApiKey.trim();
  }
  return CONFIG.JEV_API_KEY;
}

// Call Jev API
async function evaluatePostWithJev(text, apiKey) {
  const promptCriteria = [
    'Determine if this Facebook post is AI Slop based on these criteria:',
    '1) The post is an article, knowledge, or news written by AI (generic AI generated style/tone, structured AI headings, emojis).',
    '2) The post is self-promoting or showcasing a project generated/created entirely by AI (e.g. AI-generated software, AI-generated video, low-effort AI apps).',
    '3) Exclude: Real personal posts, genuine human opinions, or real news reporting on AI companies/tech, unless the article text itself was clearly written by AI.'
  ].join(' ');

  const payload = {
    model: CONFIG.MODEL,
    state: text.slice(0, 4000), // Max text length safety
    questions: {
      is_ai_slop: {
        type: 'noul',
        instructions: promptCriteria
      }
    }
  };

  const response = await fetch(CONFIG.API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jev API Error (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const noulScore = json.answers?.is_ai_slop?.noul;

  if (typeof noulScore !== 'number') {
    throw new Error('Invalid response structure from Jev API');
  }

  return {
    score: noulScore,
    confidence: Math.round(noulScore * 100)
  };
}

// Update stats in chrome.storage.local
async function recordStats(score) {
  const store = await chrome.storage.local.get(['stats']);
  const stats = store.stats || {
    scanned: 0,
    slopDetected: 0,
    subtle: 0,
    prominent: 0,
    stamp: 0
  };

  stats.scanned++;
  if (score >= CONFIG.THRESHOLDS.STAMP) {
    stats.slopDetected++;
    stats.stamp++;
  } else if (score >= CONFIG.THRESHOLDS.PROMINENT) {
    stats.slopDetected++;
    stats.prominent++;
  } else if (score >= CONFIG.THRESHOLDS.SUBTLE) {
    stats.slopDetected++;
    stats.subtle++;
  }

  await chrome.storage.local.set({ stats });
}

// Handle messages from content script & popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'CHECK_POST') {
    (async () => {
      try {
        const text = message.text;
        if (!text || text.trim().length < 20) {
          sendResponse({ success: false, reason: 'Text too short' });
          return;
        }

        // Check if extension is enabled
        const settings = await chrome.storage.local.get(['isEnabled']);
        if (settings.isEnabled === false) {
          sendResponse({ success: false, reason: 'Extension paused' });
          return;
        }

        const hash = await sha256(text);
        const cacheKey = `cache_${hash}`;

        // 1. Check Cache
        const cached = await chrome.storage.local.get([cacheKey]);
        if (cached[cacheKey]) {
          const item = cached[cacheKey];
          // Check expiration
          if (Date.now() - item.timestamp < CONFIG.CACHE_EXPIRY_MS) {
            sendResponse({
              success: true,
              score: item.score,
              confidence: item.confidence,
              cached: true
            });
            return;
          }
        }

        // 2. Queue API call
        const apiKey = await getApiKey();
        if (!apiKey || apiKey === '__JEV_API_KEY_PLACEHOLDER__') {
          sendResponse({
            success: false,
            error: 'No JEV_API_KEY configured. Please set your key in the extension popup.'
          });
          return;
        }

        const result = await queue.enqueue(() => evaluatePostWithJev(text, apiKey));

        // 3. Cache verdict
        await chrome.storage.local.set({
          [cacheKey]: {
            score: result.score,
            confidence: result.confidence,
            timestamp: Date.now()
          }
        });

        // 4. Update Stats
        await recordStats(result.score);

        sendResponse({
          success: true,
          score: result.score,
          confidence: result.confidence,
          cached: false
        });
      } catch (err) {
        console.error('[AI Slop Detector BG Error]', err);
        sendResponse({ success: false, error: err.message });
      }
    })();

    return true; // Keep message channel open for async response
  }

  if (message.action === 'GET_CONFIG') {
    (async () => {
      const data = await chrome.storage.local.get(['customApiKey', 'isEnabled', 'stats']);
      sendResponse({
        success: true,
        hasBuiltinKey: CONFIG.JEV_API_KEY && CONFIG.JEV_API_KEY !== '__JEV_API_KEY_PLACEHOLDER__',
        customApiKey: data.customApiKey || '',
        isEnabled: data.isEnabled !== false,
        stats: data.stats || { scanned: 0, slopDetected: 0, subtle: 0, prominent: 0, stamp: 0 },
        thresholds: CONFIG.THRESHOLDS
      });
    })();
    return true;
  }

  if (message.action === 'SAVE_SETTINGS') {
    (async () => {
      const updates = {};
      if (typeof message.isEnabled === 'boolean') {
        updates.isEnabled = message.isEnabled;
      }
      if (typeof message.customApiKey === 'string') {
        updates.customApiKey = message.customApiKey.trim();
      }
      await chrome.storage.local.set(updates);
      sendResponse({ success: true });
    })();
    return true;
  }

  if (message.action === 'CLEAR_CACHE') {
    (async () => {
      const all = await chrome.storage.local.get(null);
      const cacheKeys = Object.keys(all).filter((k) => k.startsWith('cache_'));
      await chrome.storage.local.remove(cacheKeys);
      sendResponse({ success: true, count: cacheKeys.length });
    })();
    return true;
  }
});

console.log('[Facebook AI Slop Detector] Background Service Worker initialized.');
