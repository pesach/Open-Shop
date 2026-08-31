/**
 * Open-Shop Native Container Format (.openshop)
 * High-speed JSON metadata header + binary/base64 tile surface serializer & deserializer.
 */
(function(root) {
  'use strict';

  const MAGIC = 'OPENSHOP';
  const FORMAT_VERSION = 1;

  class OpenShopFormatEngine {
    constructor() {
      this.version = FORMAT_VERSION;
    }

    /**
     * Encode document state into an .openshop container object / JSON string.
     */
    encode(docState) {
      if (!docState) throw new Error('Invalid document state for encoding');

      const manifest = {
        magic: MAGIC,
        version: FORMAT_VERSION,
        createdAt: new Date().toISOString(),
        dimensions: {
          width: docState.width || docState.s || 1920,
          height: docState.height || docState.T || 1080,
          resolution: docState.resolution || 72
        },
        colorSpace: docState.colorSpace || 'sRGB',
        bitDepth: docState.bitDepth || 8,
        layers: []
      };

      const rawLayers = docState.layers || docState.Z || [];
      manifest.layers = rawLayers.map((layer, idx) => ({
        id: layer.id || `layer_${idx}`,
        name: layer.name || `Layer ${idx + 1}`,
        visible: layer.visible !== false,
        opacity: typeof layer.opacity === 'number' ? layer.opacity : 100,
        blendMode: layer.blendMode || 'normal',
        bounds: layer.bounds || [0, 0, manifest.dimensions.width, manifest.dimensions.height],
        rasterBase64: layer.rasterBase64 || null,
        vectorPath: layer.vectorPath || null
      }));

      return JSON.stringify(manifest, null, 2);
    }

    /**
     * Decode an .openshop container string/buffer into an Open-Shop document state.
     */
    decode(data) {
      let content = data;
      if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
        content = data.toString('utf8');
      } else if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
        content = new TextDecoder('utf8').decode(data);
      }

      if (typeof content !== 'string') {
        throw new Error('Unsupported input format for .openshop decode');
      }

      const parsed = JSON.parse(content);
      if (parsed.magic !== MAGIC) {
        throw new Error(`Invalid format magic: expected ${MAGIC}, got ${parsed.magic}`);
      }

      return {
        name: parsed.name || 'Imported Project.openshop',
        width: parsed.dimensions.width,
        height: parsed.dimensions.height,
        resolution: parsed.dimensions.resolution,
        colorSpace: parsed.colorSpace,
        bitDepth: parsed.bitDepth,
        layers: parsed.layers
      };
    }
  }

  const formatEngine = new OpenShopFormatEngine();

  globalThis.OpenShopFormatEngine = OpenShopFormatEngine;
  globalThis.OpenShopFormat = formatEngine;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OpenShopFormatEngine, formatEngine, MAGIC, FORMAT_VERSION };
  }
})(typeof window !== 'undefined' ? window : globalThis);
