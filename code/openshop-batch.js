/**
 * Open-Shop Local Batch Processing & Macro Studio (window.OpenShopBatch)
 * Enables multi-file batch resizing, format conversions, watermarking,
 * color grading, and automated Photoshop JSX macro execution.
 */
(function () {
  'use strict';

  class OpenShopBatchProcessor {
    constructor() {
      this.isProcessing = false;
    }

    /**
     * Process an array of File / Blob objects according to the batch config
     * @param {Array<File|Blob|{name: string, data: ArrayBuffer}>} files
     * @param {Object} options
     * @param {Function} onProgress (current, total, currentFileResult)
     * @returns {Promise<Array<{name: string, blob: Blob, dataUrl: string}>>}
     */
    async processQueue(files, options = {}, onProgress = () => {}) {
      if (this.isProcessing) throw new Error('A batch job is already running');
      this.isProcessing = true;

      const results = [];
      const total = files.length;

      try {
        for (let i = 0; i < total; i++) {
          const file = files[i];
          const fileName = file.name || `image_${i + 1}.png`;
          const baseName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;

          const processed = await this.processSingleFile(file, options, baseName);
          results.push(processed);

          if (typeof onProgress === 'function') {
            onProgress(i + 1, total, processed);
          }
        }
      } finally {
        this.isProcessing = false;
      }

      return results;
    }

    async processSingleFile(file, options, baseName) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            try {
              let targetWidth = img.naturalWidth;
              let targetHeight = img.naturalHeight;

              // 1. Calculate Target Dimensions
              if (options.resize) {
                const { width, height, fit = 'contain' } = options.resize;
                if (fit === 'exact' && width && height) {
                  targetWidth = width;
                  targetHeight = height;
                } else if (width || height) {
                  const aspect = img.naturalWidth / img.naturalHeight;
                  if (width && !height) {
                    targetWidth = width;
                    targetHeight = Math.round(width / aspect);
                  } else if (height && !width) {
                    targetHeight = height;
                    targetWidth = Math.round(height * aspect);
                  } else if (width && height) {
                    if (fit === 'contain') {
                      const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight);
                      targetWidth = Math.round(img.naturalWidth * scale);
                      targetHeight = Math.round(img.naturalHeight * scale);
                    } else if (fit === 'cover') {
                      const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
                      targetWidth = Math.round(img.naturalWidth * scale);
                      targetHeight = Math.round(img.naturalHeight * scale);
                    }
                  }
                }
              }

              // 2. Draw to Canvas
              const canvas = document.createElement('canvas');
              canvas.width = targetWidth;
              canvas.height = targetHeight;
              const ctx = canvas.getContext('2d');

              // Apply Filters / Adjustments
              if (options.adjustments) {
                const filters = [];
                const adj = options.adjustments;
                if (adj.brightness !== undefined) filters.push(`brightness(${adj.brightness}%)`);
                if (adj.contrast !== undefined) filters.push(`contrast(${adj.contrast}%)`);
                if (adj.grayscale) filters.push(`grayscale(100%)`);
                if (adj.sepia) filters.push(`sepia(100%)`);
                if (adj.invert) filters.push(`invert(100%)`);
                if (adj.blur) filters.push(`blur(${adj.blur}px)`);
                if (filters.length > 0) ctx.filter = filters.join(' ');
              }

              ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
              ctx.filter = 'none';

              // 3. Apply Watermark
              if (options.watermark && options.watermark.text) {
                const wm = options.watermark;
                ctx.save();
                ctx.globalAlpha = wm.opacity || 0.65;
                ctx.font = wm.font || 'bold 20px sans-serif';
                ctx.fillStyle = wm.color || '#ffffff';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                const textMetrics = ctx.measureText(wm.text);
                let x = 20, y = targetHeight - 20;

                if (wm.position === 'top-left') { x = 20; y = 30; }
                else if (wm.position === 'top-right') { x = targetWidth - textMetrics.width - 20; y = 30; }
                else if (wm.position === 'center') { x = (targetWidth - textMetrics.width) / 2; y = targetHeight / 2; }
                else if (wm.position === 'bottom-left') { x = 20; y = targetHeight - 20; }
                else { x = targetWidth - textMetrics.width - 20; y = targetHeight - 20; } // bottom-right

                ctx.fillText(wm.text, x, y);
                ctx.restore();
              }

              // 4. Export to Target Format
              const targetFormat = (options.format || 'png').toLowerCase();
              const mimeMap = {
                png: 'image/png',
                jpg: 'image/jpeg',
                jpeg: 'image/jpeg',
                webp: 'image/webp'
              };
              const mimeType = mimeMap[targetFormat] || 'image/png';
              const quality = options.quality !== undefined ? options.quality : 0.92;

              canvas.toBlob((blob) => {
                const outName = `${baseName}.${targetFormat}`;
                const dataUrl = canvas.toDataURL(mimeType, quality);
                resolve({
                  name: outName,
                  blob,
                  dataUrl,
                  width: targetWidth,
                  height: targetHeight,
                  size: blob ? blob.size : 0
                });
              }, mimeType, quality);
            } catch (err) {
              reject(err);
            }
          };
          img.onerror = reject;
          img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file instanceof Blob ? file : new Blob([file.data || file]));
      });
    }
  }

  window.OpenShopBatch = new OpenShopBatchProcessor();
})();
