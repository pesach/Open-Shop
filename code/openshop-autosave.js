/**
 * Open-Shop IndexedDB Auto-Save & Crash Recovery Engine (window.OpenShopAutoSave)
 * Periodically saves binary project snapshots to browser IndexedDB, protects against
 * accidental tab closes, power loss, and crashes, and provides 1-click session restoration.
 */
(function () {
  'use strict';

  const DB_NAME = 'OpenShopDB';
  const DB_VERSION = 1;
  const STORE_SESSIONS = 'sessions';
  const STORE_RECENTS = 'recent_projects';
  const AUTOSAVE_INTERVAL_MS = 45000; // 45 seconds

  let db = null;
  let autoSaveTimer = null;
  let lastSavedHash = null;

  // 1. Initialize IndexedDB
  function initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(STORE_SESSIONS)) {
          database.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(STORE_RECENTS)) {
          const recentsStore = database.createObjectStore(STORE_RECENTS, { keyPath: 'id' });
          recentsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        db = e.target.result;
        resolve(db);
      };

      request.onerror = (e) => {
        console.warn('[OpenShopAutoSave] IndexedDB opening error:', e);
        reject(e);
      };
    });
  }

  // 2. Database Operations
  async function putSession(sessionData) {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SESSIONS], 'readwrite');
      const store = tx.objectStore(STORE_SESSIONS);
      const req = store.put(sessionData);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e);
    });
  }

  async function getSession(id = 'active_session') {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SESSIONS], 'readonly');
      const store = tx.objectStore(STORE_SESSIONS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e);
    });
  }

  async function deleteSession(id = 'active_session') {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SESSIONS], 'readwrite');
      const store = tx.objectStore(STORE_SESSIONS);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e);
    });
  }

  async function addRecentProject(project) {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_RECENTS], 'readwrite');
      const store = tx.objectStore(STORE_RECENTS);
      store.put(project);
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e);
    });
  }

  async function getRecentProjects(limit = 10) {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_RECENTS], 'readonly');
      const store = tx.objectStore(STORE_RECENTS);
      const req = store.getAll();
      req.onsuccess = () => {
        const sorted = (req.result || []).sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
        resolve(sorted);
      };
      req.onerror = (e) => reject(e);
    });
  }

  // 3. Auto-Save Snapshot Logic
  async function performAutoSave() {
    try {
      if (!window.app || !window.app.e7 || window.app.e7.length === 0) {
        return; // No active document
      }

      const activeDoc = window.app.e7[window.app.jG || 0];
      if (!activeDoc) return;

      const docName = activeDoc.name || 'Untitled.psd';
      let previewUrl = null;

      // Extract quick thumbnail if canvas is available
      const canvas = document.querySelector('.mainblock canvas');
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        try {
          const thumbCanvas = document.createElement('canvas');
          thumbCanvas.width = 160;
          thumbCanvas.height = 100;
          const ctx = thumbCanvas.getContext('2d');
          ctx.drawImage(canvas, 0, 0, 160, 100);
          previewUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);
        } catch (e) {}
      }

      // Serialize PSD buffer via OpenShopAgent if available
      let fileBuffer = null;
      if (window.OpenShopAgent && typeof window.OpenShopAgent.exportDocument === 'function') {
        try {
          const res = await window.OpenShopAgent.exportDocument('psd');
          if (res && res.data) {
            fileBuffer = res.data;
          }
        } catch (e) {}
      }

      const sessionObj = {
        id: 'active_session',
        name: docName,
        timestamp: Date.now(),
        timeFormatted: new Date().toLocaleTimeString(),
        buffer: fileBuffer,
        preview: previewUrl,
        layersCount: activeDoc.Z ? activeDoc.Z.length : 1
      };

      await putSession(sessionObj);
      await addRecentProject({
        id: 'recent-' + docName + '-' + Date.now(),
        name: docName,
        timestamp: Date.now(),
        timeFormatted: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
        preview: previewUrl
      });

      if (window.OpenShopLogger) {
        window.OpenShopLogger.info('AutoSave', `Snapshot saved for "${docName}"`);
      }
    } catch (err) {
      console.warn('[OpenShopAutoSave] Auto-save error:', err);
    }
  }

  // 4. UI Recovery Banner
  function showRecoveryBanner(session) {
    const existing = document.getElementById('openshop-recovery-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'openshop-recovery-banner';
    banner.setAttribute('style', `
      position: fixed;
      top: 42px;
      left: 50%;
      transform: translateX(-50%);
      background: #1e293b;
      border: 1px solid #3b82f6;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.6);
      padding: 10px 18px;
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 14px;
      font-family: 'Open Sans', sans-serif;
      font-size: 13px;
      color: #f1f5f9;
      animation: osSlideDown 0.3s ease-out;
    `);

    const style = document.createElement('style');
    style.textContent = `
      @keyframes osSlideDown {
        from { transform: translate(-50%, -20px); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
      }
      .os-rec-btn {
        padding: 5px 12px;
        border-radius: 5px;
        border: none;
        cursor: pointer;
        font-weight: 600;
        font-size: 12px;
        transition: background 0.15s ease;
      }
      .os-rec-restore { background: #2563eb; color: #ffffff; }
      .os-rec-restore:hover { background: #1d4ed8; }
      .os-rec-discard { background: #334155; color: #cbd5e1; }
      .os-rec-discard:hover { background: #475569; }
    `;
    document.head.appendChild(style);

    const timeDiff = Math.round((Date.now() - session.timestamp) / 60000);
    const timeText = timeDiff <= 1 ? 'just now' : `${timeDiff} minutes ago`;

    banner.innerHTML = `
      <span style="font-size: 16px;">💾</span>
      <div>
        <strong>Unsaved Work Detected:</strong> "${session.name}" 
        <span style="color: #94a3b8; font-size: 11px; margin-left: 4px;">(${timeText})</span>
      </div>
      <button class="os-rec-btn os-rec-restore" id="os-btn-restore">Restore Session</button>
      <button class="os-rec-btn os-rec-discard" id="os-btn-discard">Discard</button>
    `;

    document.body.appendChild(banner);

    document.getElementById('os-btn-restore').onclick = async () => {
      banner.remove();
      await restoreActiveSession(session);
    };

    document.getElementById('os-btn-discard').onclick = async () => {
      banner.remove();
      await deleteSession('active_session');
    };
  }

  async function restoreActiveSession(session) {
    if (session.buffer && window.OpenShopAgent) {
      await window.OpenShopAgent.openFile(session.buffer, session.name);
    } else {
      console.log('[OpenShopAutoSave] Restored session meta:', session);
    }
  }

  // 5. Lifecycle Initialization
  async function init() {
    try {
      await initDB();
      const savedSession = await getSession('active_session');
      if (savedSession && savedSession.timestamp && Date.now() - savedSession.timestamp < 24 * 3600 * 1000) {
        // Show banner after app DOM mounts
        setTimeout(() => {
          showRecoveryBanner(savedSession);
        }, 1500);
      }

      // Start periodic auto-save
      autoSaveTimer = setInterval(performAutoSave, AUTOSAVE_INTERVAL_MS);

      // Also save before tab closes
      window.addEventListener('beforeunload', () => {
        performAutoSave();
      });
    } catch (e) {
      console.warn('[OpenShopAutoSave] Init failed:', e);
    }
  }

  // Expose API
  window.OpenShopAutoSave = {
    saveNow: performAutoSave,
    getSession,
    deleteSession,
    getRecentProjects,
    init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
