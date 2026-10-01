// Content Script for Facebook AI Slop Detector
(() => {
  'use strict';

  console.log('[Facebook AI Slop Detector] Content script loaded on', window.location.href);

  // Configuration Thresholds (matching config.js)
  const THRESHOLDS = {
    SUBTLE: 0.60,      // 60%
    PROMINENT: 0.70,   // 70%
    STAMP: 0.80        // 80%
  };

  const PROCESSED_ATTR = 'data-fbas-status';
  const MIN_TEXT_LENGTH = 35; // Minimum chars required to be evaluated as an article or project

  // IntersectionObserver to analyze only posts that become visible in viewport
  const viewportObserver = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const postElement = entry.target;
        observer.unobserve(postElement);
        processPost(postElement);
      }
    }
  }, {
    rootMargin: '150px 0px' // Pre-fetch slightly before scrolling into view
  });

  // Extract clean post body text from Facebook post container
  function extractPostText(postElement) {
    // 1. Look for known Facebook post text containers
    // Facebook frequently wraps post message in [data-ad-preview="message"] or dir="auto"
    const textNodes = postElement.querySelectorAll('div[dir="auto"], span[dir="auto"]');
    if (!textNodes || textNodes.length === 0) return '';

    const textBlocks = [];
    const ignoredPatterns = [
      /^(like|comment|share|send|reply|view more|ดูเพิ่มเติม|ถูกใจ|แสดงความคิดเห็น|แชร์)$/i,
      /^[0-9]+(\s*(hrs?|mins?|days?|w|ชม\.|นาที|วัน|สัปดาห์))$/i,
      /^(public|friends|only me|สาธารณะ|เพื่อน)$/i
    ];

    for (const node of textNodes) {
      // Skip if this node is inside our own injected overlay
      if (node.closest('.fbas-banner-subtle, .fbas-banner-prominent, .fbas-stamp-overlay')) {
        continue;
      }

      // Skip action buttons (Like, Share, etc.) or comments section
      if (node.closest('form, [role="toolbar"], ul[role="group"]')) {
        continue;
      }

      const text = (node.innerText || node.textContent || '').trim();
      if (!text || text.length < 5) continue;

      // Filter out small metadata strings
      const isNoise = ignoredPatterns.some((pattern) => pattern.test(text));
      if (!isNoise) {
        textBlocks.push(text);
      }
    }

    if (textBlocks.length === 0) return '';

    // Sort by length descending to find the main text content, or concatenate main blocks
    // Usually the largest continuous text block or the first long block is the actual post body
    const longBlocks = textBlocks.filter((t) => t.length > 25);
    if (longBlocks.length > 0) {
      // Deduplicate blocks (Facebook sometimes nests spans inside divs with identical text)
      const uniqueBlocks = [];
      for (const block of longBlocks) {
        if (!uniqueBlocks.some((existing) => existing.includes(block) || block.includes(existing))) {
          uniqueBlocks.push(block);
        }
      }
      return uniqueBlocks.join('\n\n');
    }

    return textBlocks.join('\n\n');
  }

  // Inject visual banner or stamp onto the post
  function renderSlopVerdict(postElement, score, confidence) {
    // Ensure relative positioning
    postElement.classList.add('fbas-post-container');

    // Remove any previous detector elements
    const existing = postElement.querySelectorAll('.fbas-banner-subtle, .fbas-banner-prominent, .fbas-stamp-overlay');
    existing.forEach((el) => el.remove());

    if (score < THRESHOLDS.SUBTLE) {
      // < 60%: Clean post, no banner
      postElement.setAttribute(PROCESSED_ATTR, 'clean');
      return;
    }

    if (score >= THRESHOLDS.SUBTLE && score < THRESHOLDS.PROMINENT) {
      // 60% - 70%: Subtle banner
      postElement.setAttribute(PROCESSED_ATTR, 'subtle');
      const banner = document.createElement('div');
      banner.className = 'fbas-banner-subtle';
      banner.innerHTML = `
        <div class="fbas-title">
          <span>⚠️ ข้อความนี้อาจเขียนโดย AI</span>
          <span class="fbas-score-pill">${confidence}% AI Confidence</span>
        </div>
        <div style="font-size: 11px; opacity: 0.85;">Jev System One</div>
      `;
      insertBannerAtTop(postElement, banner);
      return;
    }

    if (score >= THRESHOLDS.PROMINENT && score < THRESHOLDS.STAMP) {
      // 70% - 80%: Prominent darker banner
      postElement.setAttribute(PROCESSED_ATTR, 'prominent');
      const banner = document.createElement('div');
      banner.className = 'fbas-banner-prominent';
      banner.innerHTML = `
        <div class="fbas-title">
          <span>🚨 ตรวจพบแนวโน้มเป็น AI Slop</span>
          <span class="fbas-score-pill" style="background: rgba(234, 88, 12, 0.2); color: #9a3412;">${confidence}% Score</span>
        </div>
        <div style="font-size: 11px; opacity: 0.9; font-weight: 500;">Judged by Jev AI</div>
      `;
      insertBannerAtTop(postElement, banner);
      return;
    }

    if (score >= THRESHOLDS.STAMP) {
      // > 80%: Red Rubber Stamp Animation!
      postElement.setAttribute(PROCESSED_ATTR, 'stamp');

      const stampOverlay = document.createElement('div');
      stampOverlay.className = 'fbas-stamp-overlay';
      stampOverlay.title = 'Click to toggle post visibility';

      stampOverlay.innerHTML = `
        <div class="fbas-rubber-stamp">
          <span class="fbas-stamp-text">AI SLOP</span>
          <span class="fbas-stamp-sub">${confidence}% PROBABILITY</span>
        </div>
      `;

      // Allow user to click stamp to toggle post blur or minimize
      stampOverlay.addEventListener('click', (e) => {
        e.stopPropagation();
        postElement.classList.toggle('fbas-post-blurred');
      });

      postElement.appendChild(stampOverlay);
    }
  }

  // Insert banner at the top of the post body safely without breaking FB React structure
  function insertBannerAtTop(postElement, bannerElement) {
    if (postElement.firstChild) {
      postElement.insertBefore(bannerElement, postElement.firstChild);
    } else {
      postElement.appendChild(bannerElement);
    }
  }

  // Process an individual post container
  async function processPost(postElement) {
    if (postElement.getAttribute(PROCESSED_ATTR) === 'evaluating' ||
        postElement.getAttribute(PROCESSED_ATTR) === 'done') {
      return;
    }

    const postText = extractPostText(postElement);
    if (!postText || postText.length < MIN_TEXT_LENGTH) {
      postElement.setAttribute(PROCESSED_ATTR, 'skipped_short');
      return;
    }

    postElement.setAttribute(PROCESSED_ATTR, 'evaluating');

    try {
      chrome.runtime.sendMessage(
        { action: 'CHECK_POST', text: postText },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn('[AI Slop Detector]', chrome.runtime.lastError.message);
            postElement.removeAttribute(PROCESSED_ATTR);
            return;
          }

          if (response && response.success) {
            renderSlopVerdict(postElement, response.score, response.confidence);
          } else {
            postElement.setAttribute(PROCESSED_ATTR, 'failed');
            if (response && response.error) {
              console.warn('[AI Slop Detector] Evaluation error:', response.error);
            }
          }
        }
      );
    } catch (err) {
      console.error('[AI Slop Detector] Message error:', err);
      postElement.removeAttribute(PROCESSED_ATTR);
    }
  }

  // Find all post containers on Facebook
  function scanPosts() {
    // Selectors for Facebook feed post cards
    // 1. role="feed" > div: Feed child containers
    // 2. [role="article"]: Facebook standard post container
    // 3. div[data-pagelet^="FeedUnit_"]: Pagelet feed units
    const selectors = [
      'div[role="feed"] > div:not([' + PROCESSED_ATTR + '])',
      'div[role="article"]:not([' + PROCESSED_ATTR + '])',
      'div[data-pagelet^="FeedUnit_"]:not([' + PROCESSED_ATTR + '])'
    ];

    const candidates = document.querySelectorAll(selectors.join(', '));

    for (const el of candidates) {
      // Verify element is a meaningful post container (has height, contains text/links)
      if (el.offsetHeight > 80 && !el.hasAttribute(PROCESSED_ATTR)) {
        el.setAttribute(PROCESSED_ATTR, 'observed');
        viewportObserver.observe(el);
      }
    }
  }

  // MutationObserver to watch for newly loaded feed items as user scrolls
  const domObserver = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        shouldScan = true;
        break;
      }
    }
    if (shouldScan) {
      scanPosts();
    }
  });

  // Start observing
  function init() {
    scanPosts();

    domObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('[Facebook AI Slop Detector] Observing Facebook feed mutations.');
  }

  // Wait until document is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
