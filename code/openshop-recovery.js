/**
 * Open-Shop Crash Recovery & Autosave Engine
 * Automatically preserves active document states in IndexedDB for seamless crash restoration.
 */
(function() {
  'use strict';

  const DB_NAME = 'openshop_storage';
  const DB_VERSION = 1;
  const STORE_NAME = 'crash_recovery';
  const AUTOSAVE_INTERVAL_MS = 45000; // 45 seconds

  let dbPromise = null;
  let autosaveTimer = null;

  // Open / Initialize IndexedDB
  function getDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function(e) {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        req.onsuccess = function(e) {
          resolve(e.target.result);
        };
        req.onerror = function(e) {
          console.warn('[Open-Shop Recovery] IndexedDB error:', e);
          resolve(null);
        };
      } catch (err) {
        console.warn('[Open-Shop Recovery] IndexedDB not available:', err);
        resolve(null);
      }
    });
    return dbPromise;
  }

  // Save active document state
  async function saveSessionSnapshot(buffer, meta) {
    try {
      const db = await getDB();
      if (!db) return;

      const record = {
        id: 'last_active_session',
        name: meta.name || 'Untitled-Recovered.psd',
        timestamp: Date.now(),
        size: buffer.byteLength,
        buffer: buffer
      };

      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(record);
    } catch (err) {
      console.warn('[Open-Shop Recovery] Failed to save session snapshot:', err);
    }
  }

  // Retrieve saved snapshot
  async function getSavedSession() {
    try {
      const db = await getDB();
      if (!db) return null;

      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get('last_active_session');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (err) {
      return null;
    }
  }

  // Clear saved snapshot
  async function clearSavedSession() {
    try {
      const db = await getDB();
      if (!db) return;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete('last_active_session');
    } catch (err) {}
  }

  // UI Banner for Session Recovery
  function showRecoveryBanner(session) {
    const timeAgo = formatTimeAgo(session.timestamp);
    const banner = document.createElement('div');
    banner.id = 'openshop-recovery-banner';
    banner.style.cssText = [
      'position: fixed',
      'bottom: 24px',
      'right: 24px',
      'z-index: 999999',
      'background: #1e293b',
      'color: #f8fafc',
      'border: 1px solid #3b82f6',
      'border-radius: 8px',
      'padding: 14px 20px',
      'box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'font-size: 13px',
      'display: flex',
      'align-items: center',
      'gap: 16px',
      'animation: openshop-fade-in 0.3s ease-out'
    ].join(';');

    const textSpan = document.createElement('div');
    textSpan.innerHTML = `<strong>Auto-Recovery:</strong> Unsaved project <em>"${escapeHtml(session.name)}"</em> (${timeAgo})`;

    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '8px';

    const restoreBtn = document.createElement('button');
    restoreBtn.textContent = 'Restore Project';
    restoreBtn.style.cssText = [
      'background: #2563eb',
      'color: #ffffff',
      'border: none',
      'border-radius: 4px',
      'padding: 6px 12px',
      'font-size: 12px',
      'font-weight: 600',
      'cursor: pointer',
      'transition: background 0.15s'
    ].join(';');
    restoreBtn.onmouseover = () => restoreBtn.style.background = '#1d4ed8';
    restoreBtn.onmouseout = () => restoreBtn.style.background = '#2563eb';
    restoreBtn.onclick = () => {
      if (session.buffer) {
        window.postMessage(session.buffer, '*');
      }
      banner.remove();
    };

    const dismissBtn = document.createElement('button');
    dismissBtn.textContent = 'Dismiss';
    dismissBtn.style.cssText = [
      'background: transparent',
      'color: #94a3b8',
      'border: 1px solid #475569',
      'border-radius: 4px',
      'padding: 6px 10px',
      'font-size: 12px',
      'cursor: pointer'
    ].join(';');
    dismissBtn.onclick = () => {
      clearSavedSession();
      banner.remove();
    };

    btnGroup.appendChild(restoreBtn);
    btnGroup.appendChild(dismissBtn);

    banner.appendChild(textSpan);
    banner.appendChild(btnGroup);

    document.body.appendChild(banner);
  }

  function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return 'earlier';
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, function(m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // Periodic Autosave Check
  function triggerAutosave() {
    try {
      if (typeof window.app !== 'undefined' && window.app.activeDocument) {
        const doc = window.app.activeDocument;
        if (typeof window.JP !== 'undefined' && typeof window.JP.YL === 'function' && doc.R) {
          const buffer = window.JP.YL(doc.R, 'PSD');
          if (buffer && buffer.byteLength > 0) {
            saveSessionSnapshot(buffer, { name: doc.R.name || 'Project.psd' });
          }
        }
      }
    } catch (e) {
      // Safe non-blocking catch
    }
  }

  // Initialization
  async function init() {
    try {
      // Check for previously saved crashed/unsaved session
      const savedSession = await getSavedSession();
      if (savedSession && savedSession.buffer && (Date.now() - savedSession.timestamp < 7 * 24 * 60 * 60 * 1000)) {
        setTimeout(() => showRecoveryBanner(savedSession), 1500);
      }

      // Start periodic autosave timer
      autosaveTimer = setInterval(triggerAutosave, AUTOSAVE_INTERVAL_MS);

      // Expose recovery methods
      window.OpenShopRecovery = {
        saveNow: triggerAutosave,
        clear: clearSavedSession,
        getSavedSession: getSavedSession
      };
    } catch (err) {
      console.warn('[Open-Shop Recovery] Init failed:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
