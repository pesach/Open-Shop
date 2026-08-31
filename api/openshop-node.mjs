/**
 * Open-Shop Node.js Headless Agent API (api/openshop-node.mjs)
 * Allows any AI agent or Node.js program to perform graphic operations,
 * PSD inspection, resizing, and conversions programmatically without a browser UI.
 */
import fs from 'fs';
import path from 'path';
import http from 'http';

export class OpenShopNodeAPI {
  constructor(options = {}) {
    this.serverUrl = options.serverUrl || 'http://localhost:8888';
  }

  /**
   * Inspect a graphic file (PSD, PNG, JPG, WebP, SVG)
   * @param {string} filePath
   * @returns {Promise<Object>}
   */
  async inspect(filePath) {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stat = fs.statSync(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase().replace('.', '');
    const buffer = fs.readFileSync(resolvedPath);

    // Basic Header Inspector for PSD & Image files
    let width = null;
    let height = null;
    let colorMode = null;
    let channels = null;

    if (ext === 'psd' && buffer.length >= 26) {
      const signature = buffer.toString('utf8', 0, 4);
      if (signature === '8BPS') {
        channels = buffer.readUInt16BE(12);
        height = buffer.readUInt32BE(14);
        width = buffer.readUInt32BE(18);
        const modeId = buffer.readUInt16BE(24);
        const modes = ['Bitmap', 'Grayscale', 'Indexed', 'RGB', 'CMYK', 'MultiChannel', 'Duotone', 'Lab'];
        colorMode = modes[modeId] || `Mode ${modeId}`;
      }
    } else if (ext === 'png' && buffer.length >= 24) {
      if (buffer.toString('ascii', 1, 4) === 'PNG') {
        width = buffer.readUInt32BE(16);
        height = buffer.readUInt32BE(20);
        colorMode = 'RGBA';
      }
    }

    return {
      success: true,
      file: path.basename(resolvedPath),
      path: resolvedPath,
      format: ext.toUpperCase(),
      sizeBytes: stat.size,
      sizeFormatted: (stat.size / 1024).toFixed(1) + ' KB',
      width,
      height,
      colorMode,
      channels,
      lastModified: stat.mtime
    };
  }

  /**
   * Convert an image to target format via local OpenShop REST API
   * @param {string} inputPath
   * @param {string} outputPath
   * @param {Object} options
   */
  async convert(inputPath, outputPath, options = {}) {
    const resolvedIn = path.resolve(inputPath);
    const resolvedOut = path.resolve(outputPath);

    if (!fs.existsSync(resolvedIn)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    const inExt = path.extname(resolvedIn).toLowerCase().replace('.', '');
    const outExt = path.extname(resolvedOut).toLowerCase().replace('.', '');
    const inBuffer = fs.readFileSync(resolvedIn);

    // Send to local OpenShop server conversion worker
    const payload = {
      action: 'convert',
      filename: path.basename(resolvedIn),
      dataBase64: inBuffer.toString('base64'),
      sourceFormat: inExt,
      targetFormat: outExt,
      quality: options.quality || 0.92
    };

    const response = await this.postJSON('/api/process', payload);
    if (!response.ok) {
      throw new Error(`Conversion failed: ${response.error || 'Unknown error'}`);
    }

    const outBuffer = Buffer.from(response.resultBase64, 'base64');
    fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
    fs.writeFileSync(resolvedOut, outBuffer);

    return {
      success: true,
      input: resolvedIn,
      output: resolvedOut,
      bytes: outBuffer.length
    };
  }

  /**
   * Helper to POST JSON to the Open-Shop server
   */
  postJSON(endpoint, data) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.serverUrl);
      const body = JSON.stringify(data);

      const req = http.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let responseText = '';
        res.on('data', chunk => responseText += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseText);
            resolve(parsed);
          } catch (e) {
            resolve({ ok: false, error: `Invalid server response: ${responseText.slice(0, 100)}` });
          }
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}

export const openshop = new OpenShopNodeAPI();
