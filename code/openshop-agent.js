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
      this.pendingExecutions = new Map();
      this.initListeners();
    }

    initListeners() {
      window.addEventListener('message', (e) => {
        if (!e.data) return;

        // Structured Agent Command Request
        if (typeof e.data === 'object' && e.data.type === 'openshop:agent-command') {
          this.handleAgentCommand(e);
        }

        // Script completion "done" notification
        if (e.data === 'done' || e.data === 'saved') {
          for (const [id, req] of this.pendingExecutions.entries()) {
            req.resolve({ ok: true, message: e.data });
            this.pendingExecutions.delete(id);
          }
        }
      });
    }

    async handleAgentCommand(event) {
      const { id, command, params } = event.data;
      const source = event.source || window;
      const origin = event.origin || '*';

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
        }, origin === 'null' ? '*' : origin);
      } catch (err) {
        source.postMessage({
          type: 'openshop:agent-response',
          id: id,
          ok: false,
          error: { message: err.message || String(err) }
        }, origin === 'null' ? '*' : origin);
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

        const reqId = 'exec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const timeout = setTimeout(() => {
          if (this.pendingExecutions.has(reqId)) {
            this.pendingExecutions.delete(reqId);
            resolve({ ok: true, note: 'Execution dispatched (timeout reached without explicit done signal)' });
          }
        }, 3000);

        this.pendingExecutions.set(reqId, {
          resolve: (val) => {
            clearTimeout(timeout);
            resolve(val);
          },
          reject: (err) => {
            clearTimeout(timeout);
            reject(err);
          }
        });

        window.postMessage(script, '*');
      });
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
      let script = '';
      const targetSelector = typeof target === 'number'
        ? `app.activeDocument.layers[${target}]`
        : `app.activeDocument.layers.getByName("${target}")`;

      if (properties.opacity !== undefined) {
        script += `${targetSelector}.opacity = ${Math.max(0, Math.min(100, properties.opacity))};\n`;
      }
      if (properties.visible !== undefined) {
        script += `${targetSelector}.visible = ${Boolean(properties.visible)};\n`;
      }
      if (properties.name) {
        script += `${targetSelector}.name = "${properties.name.replace(/"/g, '\\"')}";\n`;
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
      return new Promise((resolve, reject) => {
        if (typeof window.app === 'undefined' || !window.app.activeDocument) {
          return reject(new Error('No active document available to export'));
        }

        const doc = window.app.activeDocument;
        if (typeof window.JP !== 'undefined' && typeof window.JP.YL === 'function' && doc.R) {
          try {
            const buffer = window.JP.YL(doc.R, fmt.toUpperCase());
            if (buffer) {
              return resolve(buffer);
            }
          } catch (e) {
            // Fallback to script saveToOE
          }
        }

        // Script fallback via saveToOE
        const onBinaryResponse = (e) => {
          if (e.data instanceof ArrayBuffer) {
            window.removeEventListener('message', onBinaryResponse);
            resolve(e.data);
          }
        };
        window.addEventListener('message', onBinaryResponse);

        this.executeScript(`app.activeDocument.saveToOE("${fmt}");`).catch(reject);
      });
    }

    /**
     * Opens a binary file or URL in the editor.
     * @param {ArrayBuffer|Blob|string} data
     */
    async openFile(data) {
      if (data instanceof ArrayBuffer) {
        window.postMessage(data, '*');
        return true;
      } else if (data instanceof Blob) {
        const buffer = await data.arrayBuffer();
        window.postMessage(buffer, '*');
        return true;
      } else if (typeof data === 'string') {
        const res = await fetch(data);
        const buffer = await res.arrayBuffer();
        window.postMessage(buffer, '*');
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
