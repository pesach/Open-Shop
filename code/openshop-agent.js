/**
 * Open-Shop Agent & Tool Automation API (window.OpenShopAgent)
 * Provides a structured, programmatic interface for AI agents, automation scripts, and extensions.
 */
(function() {
  'use strict';

  const AGENT_VERSION = '1.0.0';

  class OpenShopAgentAPI {
    constructor() {
      this.version = AGENT_VERSION;
      this.executionQueue = [];
      this.activeExecution = null;
      this.executionChannelDesynchronized = false;
      this.exportFallbackTail = Promise.resolve();
      this.responseWindow = this.getResponseWindow();
      this.initListeners();
    }

    initListeners() {
      window.addEventListener('message', (e) => {
        if (!e.data || !this.isTrustedCommandEvent(e)) return;

        // Structured Agent Command Request
        if (typeof e.data === 'object' && e.data.type === 'openshop:agent-command') {
          this.handleAgentCommand(e);
        }
      });

      this.responseWindow.addEventListener('message', (e) => {
        if (!this.isTrustedEngineResponse(e)) return;

        // Script completion "done" notification
        if (e.data === 'done' || e.data === 'saved') {
          this.completeActiveExecution(e.data);
        }
      });
    }

    getResponseWindow() {
      if (window.parent === window) return window;

      try {
        if (window.parent.location.origin === window.location.origin) {
          return window.parent;
        }
      } catch (e) {
        // Cross-origin parents are intentionally not trusted.
      }

      return window;
    }

    isTrustedCommandEvent(event) {
      const ownOrigin = window.location.origin;
      if (ownOrigin === 'null' || event.origin === 'null' || event.origin !== ownOrigin) {
        return false;
      }

      return event.source === window ||
        event.source === window.parent ||
        (window.opener && event.source === window.opener);
    }

    isTrustedEngineResponse(event) {
      const ownOrigin = window.location.origin;
      return ownOrigin !== 'null' &&
        event.origin !== 'null' &&
        event.origin === ownOrigin &&
        event.source === window;
    }

    async handleAgentCommand(event) {
      const { id, command, params } = event.data;
      const source = event.source;
      const origin = event.origin;

      try {
        let result = null;
        switch (command) {
          case 'ping':
            result = { pong: true, version: this.version };
            break;
          case 'getDocument':
            result = this.getActiveDocument();
            break;
          case 'getLayers':
            result = this.getLayers();
            break;
          case 'executeScript':
            result = await this.executeScript(params?.script || '');
            break;
          case 'exportDocument':
            result = await this.exportDocument(params?.format || 'png');
            break;
          case 'setLayerProperties':
            result = await this.setLayerProperties(params?.target, params?.properties || {});
            break;
          case 'getMemoryStats':
            result = this.getMemoryStats();
            break;
          default:
            throw new Error(`Unknown agent command: ${command}`);
        }

        source.postMessage({
          type: 'openshop:agent-response',
          id: id,
          ok: true,
          result: result
        }, origin);
      } catch (err) {
        source.postMessage({
          type: 'openshop:agent-response',
          id: id,
          ok: false,
          error: { message: err.message || String(err) }
        }, origin);
      }
    }

    /**
     * Executes a Photoshop/OpenShop DOM script and returns a Promise.
     * @param {string} script
     * @returns {Promise<any>}
     */
    executeScript(script) {
      return new Promise((resolve, reject) => {
        if (!script || typeof script !== 'string') {
          return reject(new Error('Script must be a non-empty string'));
        }

        if (window.location.origin === 'null') {
          return reject(new Error('Script execution is unavailable from an opaque origin'));
        }

        if (this.executionChannelDesynchronized) {
          return reject(new Error('Script execution channel is desynchronized; reload Open-Shop before retrying'));
        }

        this.executionQueue.push({ script, resolve, reject, timeout: null });
        this.dispatchNextExecution();
      });
    }

    dispatchNextExecution() {
      if (this.activeExecution || this.executionQueue.length === 0) return;

      const execution = this.executionQueue.shift();
      this.activeExecution = execution;
      execution.timeout = setTimeout(() => {
        if (this.activeExecution !== execution) return;

        this.activeExecution = null;
        this.executionChannelDesynchronized = true;
        execution.reject(new Error('Script execution timed out before a trusted completion signal'));

        const error = new Error('Script execution queue cancelled because completion correlation was lost');
        for (const queuedExecution of this.executionQueue.splice(0)) {
          queuedExecution.reject(error);
        }
      }, 3000);

      window.postMessage(execution.script, window.location.origin);
    }

    completeActiveExecution(message) {
      const execution = this.activeExecution;
      if (!execution) return;

      clearTimeout(execution.timeout);
      this.activeExecution = null;
      execution.resolve({ ok: true, message });
      this.dispatchNextExecution();
    }

    /**
     * Retrieves structured info about the active document.
     */
    getActiveDocument() {
      if (typeof window.app === 'undefined' || !window.app.activeDocument) {
        return null;
      }
      const doc = window.app.activeDocument;
      const raw = doc.R || {};

      return {
        name: raw.name || 'Untitled',
        width: raw.s || 0,
        height: raw.T || 0,
        dpi: raw.dw || 72,
        layers: this.getLayers()
      };
    }

    /**
     * Retrieves all layers from the active document.
     */
    getLayers() {
      if (typeof window.app === 'undefined' || !window.app.activeDocument) {
        return [];
      }
      const doc = window.app.activeDocument;
      const layers = doc.layers || [];
      const result = [];

      for (let i = 0; i < layers.length; i++) {
        const l = layers[i];
        const raw = l.R || {};
        result.push({
          index: i,
          name: raw.name || l.name || `Layer ${i}`,
          visible: raw.visible !== undefined ? raw.visible : true,
          opacity: raw.tJ !== undefined ? Math.round(raw.tJ * 100 / 255) : 100,
          blendMode: raw.tZ || 'normal',
          isFolder: Boolean(raw.oP && raw.oP())
        });
      }

      return result;
    }

    /**
     * Programmatically sets properties on a layer.
     */
    async setLayerProperties(target, properties = {}) {
      if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
        throw new TypeError('Layer properties must be an object');
      }

      let script = '';
      let targetSelector;
      if (typeof target === 'number') {
        if (!Number.isInteger(target) || target < 0) {
          throw new TypeError('Layer target index must be a non-negative integer');
        }
        targetSelector = `app.activeDocument.layers[${target}]`;
      } else if (typeof target === 'string' && target.length > 0) {
        targetSelector = `app.activeDocument.layers.getByName(${JSON.stringify(target)})`;
      } else {
        throw new TypeError('Layer target must be a non-negative integer or non-empty string');
      }

      if (properties.opacity !== undefined) {
        if (typeof properties.opacity !== 'number' || !Number.isFinite(properties.opacity)) {
          throw new TypeError('Layer opacity must be a finite number');
        }
        script += `${targetSelector}.opacity = ${Math.max(0, Math.min(100, properties.opacity))};\n`;
      }
      if (properties.visible !== undefined) {
        if (typeof properties.visible !== 'boolean') {
          throw new TypeError('Layer visibility must be a boolean');
        }
        script += `${targetSelector}.visible = ${properties.visible};\n`;
      }
      if (properties.name !== undefined) {
        if (typeof properties.name !== 'string') {
          throw new TypeError('Layer name must be a string');
        }
        script += `${targetSelector}.name = ${JSON.stringify(properties.name)};\n`;
      }

      if (script) {
        await this.executeScript(script);
        return true;
      }
      return false;
    }

    /**
     * Exports the active document to binary ArrayBuffer.
     * @param {'png'|'psd'|'jpg'|'webp'|'svg'} format
     * @returns {Promise<ArrayBuffer>}
     */
    async exportDocument(format = 'png') {
      const fmt = String(format).toLowerCase();
      if (typeof window.app === 'undefined' || !window.app.activeDocument) {
        throw new Error('No active document available to export');
      }

      const doc = window.app.activeDocument;
      if (typeof window.JP !== 'undefined' && typeof window.JP.YL === 'function' && doc.R) {
        try {
          const buffer = window.JP.YL(doc.R, fmt.toUpperCase());
          if (buffer) {
            return buffer;
          }
        } catch (e) {
          // Fallback to script saveToOE
        }
      }

      return this.enqueueExportFallback(fmt);
    }

    enqueueExportFallback(format) {
      const run = () => this.performExportFallback(format);
      const result = this.exportFallbackTail.then(run, run);
      this.exportFallbackTail = result.catch(() => {});
      return result;
    }

    performExportFallback(format) {
      return new Promise((resolve, reject) => {
        const responseWindow = this.responseWindow;
        let settled = false;
        let exportTimeout;
        const onBinaryResponse = (e) => {
          if (!this.isTrustedEngineResponse(e) || !(e.data instanceof ArrayBuffer)) return;
          finish(resolve, e.data);
        };

        const cleanup = () => {
          clearTimeout(exportTimeout);
          responseWindow.removeEventListener('message', onBinaryResponse);
        };
        const finish = (callback, value) => {
          if (settled) return;
          settled = true;
          cleanup();
          callback(value);
        };

        responseWindow.addEventListener('message', onBinaryResponse);
        exportTimeout = setTimeout(() => {
          finish(reject, new Error('Document export timed out before a trusted binary response'));
        }, 10000);

        this.executeScript(`app.activeDocument.saveToOE(${JSON.stringify(format)});`).catch((error) => {
          finish(reject, error);
        });
      });
    }

    /**
     * Opens a binary file or URL in the editor.
     * @param {ArrayBuffer|Blob|string} data
     */
    async openFile(data) {
      if (window.location.origin === 'null') {
        throw new Error('Opening files through the message channel is unavailable from an opaque origin');
      }

      if (data instanceof ArrayBuffer) {
        window.postMessage(data, window.location.origin);
        return true;
      } else if (data instanceof Blob) {
        const buffer = await data.arrayBuffer();
        window.postMessage(buffer, window.location.origin);
        return true;
      } else if (typeof data === 'string') {
        const res = await fetch(data);
        const buffer = await res.arrayBuffer();
        window.postMessage(buffer, window.location.origin);
        return true;
      }
      throw new Error('Unsupported file data type for openFile');
    }

    /**
     * Returns real-time memory stats.
     */
    getMemoryStats() {
      const stats = {
        timestamp: Date.now(),
        heapUsedMB: null,
        heapTotalMB: null,
        heapLimitMB: null,
        activeDocumentPixels: 0,
        activeDocumentMemoryMB: 0
      };

      if (window.performance && window.performance.memory) {
        stats.heapUsedMB = +(window.performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(2);
        stats.heapTotalMB = +(window.performance.memory.totalJSHeapSize / (1024 * 1024)).toFixed(2);
        stats.heapLimitMB = +(window.performance.memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(2);
      }

      if (typeof window.app !== 'undefined' && window.app.activeDocument && window.app.activeDocument.R) {
        const raw = window.app.activeDocument.R;
        const w = raw.s || 0;
        const h = raw.T || 0;
        const layerCount = (window.app.activeDocument.layers || []).length || 1;
        const pixels = w * h;
        stats.activeDocumentPixels = pixels;
        // ~4 bytes per RGBA pixel per layer + canvas cache
        stats.activeDocumentMemoryMB = +((pixels * 4 * (layerCount + 1)) / (1024 * 1024)).toFixed(2);
      }

      return stats;
    }
  }

  // Register on window
  window.OpenShopAgent = new OpenShopAgentAPI();
})();
