/**
 * Open-Shop Photoshop Scripting Compatibility Bridge (ExtendScript DOM)
 * Provides standard Photoshop JavaScript API bindings for browser & headless AI agents.
 */
(function(root) {
  'use strict';

  class PhotoshopLayer {
    constructor(doc, rawLayer, index) {
      this.document = doc;
      this.raw = rawLayer || {};
      this.index = index;
    }

    get name() {
      return this.raw.name || `Layer ${this.index + 1}`;
    }

    set name(val) {
      this.raw.name = String(val);
      if (this.document && this.document.app && this.document.app.K) {
        this.document.app.K({ S: 'renameLayer', id: this.index, name: String(val) });
      }
    }

    get visible() {
      return this.raw.visible !== false;
    }

    set visible(val) {
      this.raw.visible = Boolean(val);
      if (this.document && this.document.app && this.document.app.K) {
        this.document.app.K({ S: 'setLayerVisibility', id: this.index, visible: Boolean(val) });
      }
    }

    get opacity() {
      return typeof this.raw.opacity === 'number' ? this.raw.opacity : 100;
    }

    set opacity(val) {
      const clamped = Math.max(0, Math.min(100, Number(val)));
      this.raw.opacity = clamped;
      if (this.document && this.document.app && this.document.app.K) {
        this.document.app.K({ S: 'setLayerOpacity', id: this.index, opacity: clamped / 100 });
      }
    }

    get blendMode() {
      return this.raw.blendMode || 'normal';
    }

    set blendMode(val) {
      this.raw.blendMode = String(val).toLowerCase();
    }

    get isBackgroundLayer() {
      return this.index === 0 && (this.raw.isBackground || this.name.toLowerCase() === 'background');
    }

    adjustBrightnessContrast(brightness = 0, contrast = 0) {
      if (this.document && this.document.app && this.document.app.K) {
        this.document.app.K({ S: 'adjustBrightnessContrast', id: this.index, brightness, contrast });
      }
      return true;
    }

    adjustHueSaturation(hue = 0, saturation = 0, lightness = 0) {
      if (this.document && this.document.app && this.document.app.K) {
        this.document.app.K({ S: 'adjustHueSaturation', id: this.index, hue, saturation, lightness });
      }
      return true;
    }

    applyGaussianBlur(radius = 2.0) {
      if (this.document && this.document.app && this.document.app.K) {
        this.document.app.K({ S: 'applyGaussianBlur', id: this.index, radius });
      }
      return true;
    }

    duplicate() {
      const cloned = { ...this.raw, name: `${this.name} copy` };
      this.document.layers.push(new PhotoshopLayer(this.document, cloned, this.document.layers.length));
      return this.document.layers[this.document.layers.length - 1];
    }

    remove() {
      const idx = this.document.layers.indexOf(this);
      if (idx !== -1) {
        this.document.layers.splice(idx, 1);
        if (this.document.app && this.document.app.K) {
          this.document.app.K({ S: 'deleteLayer', id: this.index });
        }
      }
    }
  }

  class PhotoshopSelection {
    constructor(doc) {
      this.document = doc;
      this.bounds = [0, 0, 0, 0];
      this.isEmpty = true;
    }

    select(coords) {
      this.bounds = Array.isArray(coords) ? coords : [0, 0, this.document.width, this.document.height];
      this.isEmpty = false;
    }

    selectAll() {
      this.select([0, 0, this.document.width, this.document.height]);
    }

    deselect() {
      this.bounds = [0, 0, 0, 0];
      this.isEmpty = true;
    }
  }

  class PhotoshopDocument {
    constructor(app, rawDoc) {
      this.app = app;
      this.raw = rawDoc || {};
      this.name = this.raw.name || 'Untitled-1';
      this.width = this.raw.width || this.raw.s || 1920;
      this.height = this.raw.height || this.raw.T || 1080;
      this.resolution = this.raw.resolution || 72;
      this.mode = this.raw.mode || 'RGB';
      this.bitsPerChannel = this.raw.bitsPerChannel || 8;
      this.selection = new PhotoshopSelection(this);
      
      const rawLayers = this.raw.layers || (this.raw.Z ? this.raw.Z : [{ name: 'Background', visible: true, opacity: 100 }]);
      this.layers = rawLayers.map((l, i) => new PhotoshopLayer(this, l, i));
      this.artLayers = this.layers;
      this.layerSets = [];
    }

    get activeLayer() {
      return this.layers[this.layers.length - 1] || null;
    }

    set activeLayer(layer) {
      const idx = this.layers.indexOf(layer);
      if (idx !== -1 && this.app && this.app.K) {
        this.app.K({ S: 'selectLayer', id: idx });
      }
    }

    resizeImage(newWidth, newHeight, resolution, resampleMethod = 'bicubic') {
      this.width = Math.round(newWidth);
      this.height = Math.round(newHeight);
      if (resolution) this.resolution = resolution;
      if (this.app && this.app.K) {
        this.app.K({ S: 'resizeImage', width: this.width, height: this.height, resampleMethod });
      }
      return true;
    }

    resizeCanvas(newWidth, newHeight, anchor = 'center') {
      this.width = Math.round(newWidth);
      this.height = Math.round(newHeight);
      if (this.app && this.app.K) {
        this.app.K({ S: 'resizeCanvas', width: this.width, height: this.height, anchor });
      }
      return true;
    }

    exportDocument(format = 'png', options = {}) {
      return {
        format: String(format).toLowerCase(),
        width: this.width,
        height: this.height,
        layersCount: this.layers.length,
        options
      };
    }
  }

  class PhotoshopApp {
    constructor() {
      this.name = 'Open-Shop ExtendScript Bridge';
      this.version = '1.0.0';
      this.documents = [];
    }

    get activeDocument() {
      if (this.documents.length === 0) {
        const currentDoc = (typeof window !== 'undefined' && window.app && typeof window.app.Xh === 'function') ? window.app.Xh() : null;
        if (currentDoc) {
          const doc = new PhotoshopDocument(window.app, currentDoc);
          this.documents.push(doc);
          return doc;
        }
        const defaultDoc = new PhotoshopDocument(typeof window !== 'undefined' ? window.app : null, { name: 'Active Document', width: 1920, height: 1080 });
        this.documents.push(defaultDoc);
        return defaultDoc;
      }
      return this.documents[this.documents.length - 1];
    }

    documentsAdd(width = 1920, height = 1080, resolution = 72, name = 'Untitled', mode = 'RGB') {
      const doc = new PhotoshopDocument(typeof window !== 'undefined' ? window.app : null, { width, height, resolution, name, mode });
      this.documents.push(doc);
      return doc;
    }

    evalScript(scriptString) {
      const scopedEval = new Function('app', 'doc', 'Document', 'Layer', `
        const activeDocument = app.activeDocument;
        ${scriptString}
      `);
      return scopedEval(this, this.activeDocument, PhotoshopDocument, PhotoshopLayer);
    }
  }

  const psCompat = new PhotoshopApp();

  globalThis.PhotoshopApp = PhotoshopApp;
  globalThis.PhotoshopDocument = PhotoshopDocument;
  globalThis.PhotoshopLayer = PhotoshopLayer;
  globalThis.PhotoshopSelection = PhotoshopSelection;
  globalThis.PhotoshopCompat = psCompat;
  globalThis.appCompat = psCompat;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PhotoshopApp, PhotoshopDocument, PhotoshopLayer, PhotoshopSelection, psCompat };
  }
})(typeof window !== 'undefined' ? window : globalThis);
