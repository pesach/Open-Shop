/**
 * Open-Shop Memory Guard & History Resource Monitor
 * Proactively monitors buffer allocation and memory pressure to prevent browser OOM tab crashes.
 */
(function() {
  'use strict';

  const MEMORY_CHECK_INTERVAL_MS = 30000; // 30s
  const WARN_HEAP_MB = 650; // Alert if JS heap exceeds 650MB
  const MAX_RECOMMENDED_PIXELS = 4096 * 4096; // 16 MP baseline

  let hasWarnedMemory = false;

  class OpenShopMemoryGuard {
    constructor() {
      this.checkInterval = null;
      this.init();
    }

    init() {
      this.checkInterval = setInterval(() => this.checkMemoryHealth(), MEMORY_CHECK_INTERVAL_MS);
    }

    checkMemoryHealth() {
      if (!window.performance || !window.performance.memory) return;

      const usedMB = window.performance.memory.usedJSHeapSize / (1024 * 1024);
      const limitMB = window.performance.memory.jsHeapSizeLimit / (1024 * 1024);

      if (usedMB > WARN_HEAP_MB && !hasWarnedMemory) {
        hasWarnedMemory = true;
        this.notifyMemoryPressure(usedMB, limitMB);
      } else if (usedMB < WARN_HEAP_MB * 0.7) {
        hasWarnedMemory = false; // reset warning if memory was garbage collected
      }
    }

    notifyMemoryPressure(usedMB, limitMB) {
      const toast = document.createElement('div');
      toast.id = 'openshop-memory-toast';
      toast.style.cssText = [
        'position: fixed',
        'top: 48px',
        'right: 24px',
        'z-index: 999999',
        'background: #78350f',
        'color: #fef3c7',
        'border: 1px solid #f59e0b',
        'border-radius: 6px',
        'padding: 12px 18px',
        'box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4)',
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        'font-size: 12px',
        'display: flex',
        'align-items: center',
        'gap: 12px',
        'animation: openshop-fade-in 0.3s ease-out'
      ].join(';');

      toast.innerHTML = `
        <span>⚠️ <strong>High Memory Usage:</strong> Editor is using ~${Math.round(usedMB)} MB. Consider saving your work to avoid browser tab refresh.</span>
        <button style="background:transparent;border:none;color:#fef3c7;font-weight:bold;cursor:pointer;font-size:14px;" onclick="this.parentElement.remove()">✕</button>
      `;

      document.body.appendChild(toast);
      setTimeout(() => {
        if (toast.parentElement) toast.remove();
      }, 8000);
    }

    getStats() {
      if (window.performance && window.performance.memory) {
        return {
          usedMB: +(window.performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(2),
          totalMB: +(window.performance.memory.totalJSHeapSize / (1024 * 1024)).toFixed(2),
          limitMB: +(window.performance.memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(2)
        };
      }
      return { usedMB: null, totalMB: null, limitMB: null };
    }
  }

  window.OpenShopMemory = new OpenShopMemoryGuard();
})();
