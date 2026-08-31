/**
 * Open-Shop Diagnostics & Error Logging Engine (window.OpenShopLogger)
 * Captures JS runtime errors, unhandled rejections, console messages, network failures,
 * and memory events with an interactive debug overlay and copy/export capabilities.
 */
(function () {
  'use strict';

  const MAX_LOG_ENTRIES = 500;
  const logs = [];
  const listeners = new Set();

  function addLog(entry) {
    const logItem = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      timestamp: new Date().toISOString(),
      time: new Date().toLocaleTimeString(),
      type: entry.type || 'info', // 'error', 'warn', 'info', 'network', 'agent'
      source: entry.source || 'runtime',
      message: entry.message || '',
      stack: entry.stack || null,
      details: entry.details || null
    };

    logs.push(logItem);
    if (logs.length > MAX_LOG_ENTRIES) {
      logs.shift();
    }

    listeners.forEach((fn) => {
      try {
        fn(logItem, logs);
      } catch (e) {}
    });

    updateBadge();
  }

  // 1. Capture Unhandled Global Errors
  window.addEventListener('error', function (event) {
    addLog({
      type: 'error',
      source: 'GlobalError',
      message: event.message || 'Unknown Error',
      stack: event.error ? event.error.stack : `${event.filename}:${event.lineno}:${event.colno}`,
      details: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    });
  });

  // 2. Capture Unhandled Promise Rejections
  window.addEventListener('unhandledrejection', function (event) {
    const reason = event.reason;
    addLog({
      type: 'error',
      source: 'UnhandledRejection',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : null,
      details: reason
    });
  });

  // 3. Intercept Console Outputs
  const origConsole = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    log: console.log
  };

  console.error = function (...args) {
    origConsole.error.apply(console, args);
    const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    const err = args.find((a) => a instanceof Error);
    addLog({
      type: 'error',
      source: 'console.error',
      message: msg,
      stack: err ? err.stack : new Error().stack
    });
  };

  console.warn = function (...args) {
    origConsole.warn.apply(console, args);
    const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    addLog({
      type: 'warn',
      source: 'console.warn',
      message: msg
    });
  };

  // 4. Intercept Fetch & Network Requests for Errors
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || 'unknown';
    try {
      const response = await origFetch.apply(this, args);
      if (!response.ok) {
        addLog({
          type: 'network',
          source: 'fetch',
          message: `HTTP ${response.status} (${response.statusText}) on ${url}`,
          details: { url, status: response.status, statusText: response.statusText }
        });
      }
      return response;
    } catch (err) {
      addLog({
        type: 'error',
        source: 'fetch (Network Failure)',
        message: `Network request to ${url} failed: ${err.message}`,
        stack: err.stack,
        details: { url }
      });
      throw err;
    }
  };

  // 5. Intercept XMLHttpRequest for Errors
  const origXHR = {
    open: XMLHttpRequest.prototype.open,
    send: XMLHttpRequest.prototype.send
  };

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._reqUrl = url;
    this._reqMethod = method;
    return origXHR.open.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', () => {
      if (this.status >= 400) {
        addLog({
          type: 'network',
          source: 'XHR',
          message: `HTTP ${this.status} on ${this._reqMethod} ${this._reqUrl}`,
          details: { method: this._reqMethod, url: this._reqUrl, status: this.status }
        });
      }
    });
    this.addEventListener('error', () => {
      addLog({
        type: 'error',
        source: 'XHR (Network Failure)',
        message: `XHR request failed on ${this._reqMethod} ${this._reqUrl}`,
        details: { method: this._reqMethod, url: this._reqUrl }
      });
    });
    return origXHR.send.apply(this, args);
  };

  // 6. UI: Diagnostics Badge & Slide-over Drawer
  let badgeEl = null;
  let panelEl = null;
  let activeFilter = 'all';
  let searchQuery = '';

  function createUI() {
    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      #openshop-logs-badge {
        display: none !important;
      }
      #openshop-logs-badge.has-errors {
        background: #991b1b;
        color: #fecaca;
        border-color: #ef4444;
        animation: pulse-glow 2s infinite;
      }
      @keyframes pulse-glow {
        0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
        50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
      }

      #openshop-logs-panel {
        position: fixed;
        bottom: 0;
        right: 0;
        width: 620px;
        max-width: 95vw;
        height: 480px;
        max-height: 80vh;
        background: #0f172a;
        color: #f8fafc;
        border-top-left-radius: 10px;
        border-left: 1px solid rgba(255,255,255,0.12);
        border-top: 1px solid rgba(255,255,255,0.12);
        z-index: 1000000;
        box-shadow: -4px 0 24px rgba(0,0,0,0.6);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
        font-size: 12px;
        display: none;
        flex-direction: column;
        overflow: hidden;
      }
      #openshop-logs-panel.open {
        display: flex;
      }
      .osl-header {
        background: #1e293b;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .osl-title {
        font-weight: 700;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 8px;
        color: #38bdf8;
      }
      .osl-actions {
        display: flex;
        gap: 6px;
      }
      .osl-btn {
        background: rgba(255,255,255,0.08);
        color: #cbd5e1;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 4px;
        padding: 3px 8px;
        font-size: 11px;
        cursor: pointer;
        transition: background 0.12s;
      }
      .osl-btn:hover {
        background: rgba(255,255,255,0.18);
        color: #fff;
      }
      .osl-controls {
        background: #182234;
        padding: 8px 12px;
        display: flex;
        gap: 8px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        align-items: center;
      }
      .osl-filter-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        padding: 3px 8px;
        font-size: 11px;
        border-radius: 4px;
        cursor: pointer;
      }
      .osl-filter-btn.active {
        background: #2563eb;
        color: #ffffff;
        font-weight: 600;
      }
      .osl-search {
        margin-left: auto;
        background: #0f172a;
        border: 1px solid rgba(255,255,255,0.15);
        color: #f8fafc;
        border-radius: 4px;
        padding: 3px 8px;
        font-size: 11px;
        width: 150px;
        outline: none;
      }
      .osl-search:focus {
        border-color: #38bdf8;
      }
      .osl-content {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .osl-item {
        background: rgba(255,255,255,0.03);
        border-left: 3px solid #64748b;
        padding: 8px 10px;
        border-radius: 4px;
        font-family: Consolas, Monaco, "Courier New", monospace;
        font-size: 11px;
        line-height: 1.45;
      }
      .osl-item.type-error {
        border-left-color: #ef4444;
        background: rgba(239, 68, 68, 0.08);
      }
      .osl-item.type-warn {
        border-left-color: #f59e0b;
        background: rgba(245, 158, 11, 0.06);
      }
      .osl-item.type-network {
        border-left-color: #3b82f6;
        background: rgba(59, 130, 246, 0.06);
      }
      .osl-meta {
        display: flex;
        justify-content: space-between;
        color: #64748b;
        font-size: 10px;
        margin-bottom: 3px;
      }
      .osl-source {
        color: #cbd5e1;
        font-weight: 600;
      }
      .osl-msg {
        color: #e2e8f0;
        word-break: break-all;
      }
      .osl-stack {
        margin-top: 6px;
        padding: 6px;
        background: rgba(0,0,0,0.3);
        border-radius: 3px;
        color: #f87171;
        font-size: 10px;
        white-space: pre-wrap;
        max-height: 120px;
        overflow-y: auto;
      }
      .osl-empty {
        text-align: center;
        color: #64748b;
        padding: 40px 0;
        font-style: italic;
      }
    `;
    document.head.appendChild(style);

    // Create Badge
    badgeEl = document.createElement('div');
    badgeEl.id = 'openshop-logs-badge';
    badgeEl.title = 'Click to open Diagnostics & Error Logs (Ctrl+Shift+L)';
    badgeEl.innerHTML = `<span>🐞</span><span>Logs</span><span id="osl-count">0</span>`;
    badgeEl.addEventListener('click', togglePanel);
    document.body.appendChild(badgeEl);

    // Create Drawer Panel
    panelEl = document.createElement('div');
    panelEl.id = 'openshop-logs-panel';
    panelEl.innerHTML = `
      <div class="osl-header">
        <div class="osl-title"><span>🛡️ Open-Shop Diagnostics & Logs</span></div>
        <div class="osl-actions">
          <button class="osl-btn" id="osl-copy-btn" title="Copy all logs to clipboard">📋 Copy</button>
          <button class="osl-btn" id="osl-clear-btn" title="Clear all logs">🗑️ Clear</button>
          <button class="osl-btn" id="osl-close-btn" title="Close Panel">✕</button>
        </div>
      </div>
      <div class="osl-controls">
        <button class="osl-filter-btn active" data-filter="all">All</button>
        <button class="osl-filter-btn" data-filter="error">Errors</button>
        <button class="osl-filter-btn" data-filter="warn">Warnings</button>
        <button class="osl-filter-btn" data-filter="network">Network</button>
        <input type="text" class="osl-search" placeholder="Search logs..." id="osl-search-input" />
      </div>
      <div class="osl-content" id="osl-content">
        <div class="osl-empty">No log entries recorded yet.</div>
      </div>
    `;
    document.body.appendChild(panelEl);

    // Event listeners
    panelEl.querySelector('#osl-close-btn').addEventListener('click', togglePanel);
    panelEl.querySelector('#osl-clear-btn').addEventListener('click', () => {
      logs.length = 0;
      renderLogs();
      updateBadge();
    });
    panelEl.querySelector('#osl-copy-btn').addEventListener('click', () => {
      const exportText = JSON.stringify(logs, null, 2);
      navigator.clipboard.writeText(exportText).then(() => {
        const btn = panelEl.querySelector('#osl-copy-btn');
        btn.textContent = '✅ Copied!';
        setTimeout(() => (btn.textContent = '📋 Copy'), 1500);
      });
    });

    panelEl.querySelectorAll('.osl-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        panelEl.querySelectorAll('.osl-filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.getAttribute('data-filter');
        renderLogs();
      });
    });

    panelEl.querySelector('#osl-search-input').addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase();
      renderLogs();
    });

    // Keyboard shortcut (Ctrl+Shift+L)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        togglePanel();
      }
    });

    listeners.add(renderLogs);
  }

  function togglePanel() {
    if (!panelEl) return;
    const isOpen = panelEl.classList.toggle('open');
    if (isOpen) {
      renderLogs();
    }
  }

  function updateBadge() {
    if (!badgeEl) return;
    const countEl = badgeEl.querySelector('#osl-count');
    const errors = logs.filter((l) => l.type === 'error').length;
    if (countEl) countEl.textContent = logs.length;

    if (errors > 0) {
      badgeEl.classList.add('has-errors');
      badgeEl.querySelector('span:nth-child(2)').textContent = `${errors} Error${errors > 1 ? 's' : ''}`;
    } else {
      badgeEl.classList.remove('has-errors');
      badgeEl.querySelector('span:nth-child(2)').textContent = 'Logs';
    }
  }

  function renderLogs() {
    if (!panelEl || !panelEl.classList.contains('open')) return;
    const container = panelEl.querySelector('#osl-content');
    if (!container) return;

    let filtered = logs;
    if (activeFilter !== 'all') {
      filtered = filtered.filter((l) => l.type === activeFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(
        (l) =>
          l.message.toLowerCase().includes(searchQuery) ||
          l.source.toLowerCase().includes(searchQuery) ||
          (l.stack && l.stack.toLowerCase().includes(searchQuery))
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `<div class="osl-empty">No logs matching filter "${activeFilter}".</div>`;
      return;
    }

    container.innerHTML = filtered
      .map(
        (l) => `
      <div class="osl-item type-${l.type}">
        <div class="osl-meta">
          <span class="osl-source">[${l.source}]</span>
          <span>${l.time}</span>
        </div>
        <div class="osl-msg">${escapeHtml(l.message)}</div>
        ${l.stack ? `<div class="osl-stack">${escapeHtml(l.stack)}</div>` : ''}
      </div>
    `
      )
      .join('');

    container.scrollTop = container.scrollHeight;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Initialize UI once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createUI);
  } else {
    createUI();
  }

  // Programmatic API
  window.OpenShopLogger = {
    getLogs: () => [...logs],
    getErrors: () => logs.filter((l) => l.type === 'error'),
    clear: () => {
      logs.length = 0;
      renderLogs();
      updateBadge();
    },
    export: () => JSON.stringify(logs, null, 2),
    open: () => {
      if (panelEl && !panelEl.classList.contains('open')) togglePanel();
    },
    close: () => {
      if (panelEl && panelEl.classList.contains('open')) togglePanel();
    },
    log: (type, source, message, stack, details) => {
      addLog({ type, source, message, stack, details });
    }
  };

  addLog({
    type: 'info',
    source: 'OpenShopLogger',
    message: 'Diagnostics & error monitoring engine initialized.'
  });
})();
