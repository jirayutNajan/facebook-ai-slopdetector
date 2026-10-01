// Popup script for Facebook AI Slop Detector
document.addEventListener('DOMContentLoaded', () => {
  const toggleActive = document.getElementById('toggle-active');
  const statusCard = document.getElementById('status-card');
  const statusText = document.getElementById('status-text');

  const statScanned = document.getElementById('stat-scanned');
  const statSlop = document.getElementById('stat-slop');
  const statSubtle = document.getElementById('stat-subtle');
  const statStamp = document.getElementById('stat-stamp');

  const apiKeyInput = document.getElementById('api-key-input');
  const toggleKeyVisibility = document.getElementById('toggle-key-visibility');
  const saveKeyBtn = document.getElementById('save-key-btn');
  const keyBadge = document.getElementById('key-badge');
  const keyMessage = document.getElementById('key-message');

  const clearCacheBtn = document.getElementById('clear-cache-btn');

  // Update UI status card
  function updateStatusUI(isEnabled) {
    if (isEnabled) {
      statusCard.className = 'status-card active';
      statusText.textContent = 'Active & Monitoring Feed';
      toggleActive.checked = true;
    } else {
      statusCard.className = 'status-card paused';
      statusText.textContent = 'Paused';
      toggleActive.checked = false;
    }
  }

  // Load config & stats from Background
  chrome.runtime.sendMessage({ action: 'GET_CONFIG' }, (response) => {
    if (!response || !response.success) return;

    updateStatusUI(response.isEnabled);

    // Update stats
    const stats = response.stats || {};
    statScanned.textContent = stats.scanned || 0;
    statSlop.textContent = stats.slopDetected || 0;
    statSubtle.textContent = stats.subtle || 0;
    statStamp.textContent = stats.stamp || 0;

    // API Key status
    if (response.hasBuiltinKey) {
      keyBadge.textContent = 'Built-in .env Key Ready';
      keyBadge.className = 'badge-builtin';
    } else {
      keyBadge.textContent = 'No Built-in Key';
      keyBadge.style.background = '#fef2f2';
      keyBadge.style.color = '#991b1b';
    }

    if (response.customApiKey) {
      apiKeyInput.value = response.customApiKey;
    }
  });

  // Toggle active state
  toggleActive.addEventListener('change', () => {
    const isEnabled = toggleActive.checked;
    updateStatusUI(isEnabled);
    chrome.runtime.sendMessage({ action: 'SAVE_SETTINGS', isEnabled });
  });

  // Toggle key visibility
  toggleKeyVisibility.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleKeyVisibility.textContent = '🔒';
    } else {
      apiKeyInput.type = 'password';
      toggleKeyVisibility.textContent = '👁️';
    }
  });

  // Save custom API key
  saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    chrome.runtime.sendMessage({ action: 'SAVE_SETTINGS', customApiKey: key }, () => {
      keyMessage.className = 'message-text success';
      keyMessage.textContent = 'API Key saved successfully!';
      setTimeout(() => {
        keyMessage.textContent = '';
      }, 3000);
    });
  });

  // Clear cache
  clearCacheBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'CLEAR_CACHE' }, (res) => {
      if (res && res.success) {
        clearCacheBtn.textContent = `Cleared (${res.count})`;
        setTimeout(() => {
          clearCacheBtn.textContent = 'Clear Cache';
        }, 2000);
      }
    });
  });
});
