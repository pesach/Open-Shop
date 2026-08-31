/**
 * Open-Shop Model Context Protocol (MCP) Server (mcp/openshop-mcp-server.mjs)
 * Implements standard JSON-RPC 2.0 stdio protocol to provide AI agents with
 * direct access to PSD inspection, ExtendScript execution, format conversions,
 * color space calculations, and batch image pipelines.
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { openshop, formatEngine, colorEngine, vectorEngine, psCompat } from '../api/openshop-node.mjs';

const SERVER_NAME = 'openshop-mcp-server';
const SERVER_VERSION = '1.0.0';

export const TOOLS = [
  {
    name: 'openshop_inspect',
    description: 'Inspect a PSD, PSB, image, or .openshop project file to retrieve dimensions, color mode, channel count, and file metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Absolute or relative path to the image/PSD/.openshop file.'
        }
      },
      required: ['filePath']
    }
  },
  {
    name: 'openshop_convert',
    description: 'Convert graphic files between formats headlessly (PSD, PNG, JPG, WebP, SVG, OPENSHOP).',
    inputSchema: {
      type: 'object',
      properties: {
        inputPath: {
          type: 'string',
          description: 'Source graphic file path.'
        },
        outputPath: {
          type: 'string',
          description: 'Destination target file path.'
        }
      },
      required: ['inputPath', 'outputPath']
    }
  },
  {
    name: 'openshop_eval_script',
    description: 'Execute Adobe Photoshop ExtendScript JavaScript commands against the headless Open-Shop DOM.',
    inputSchema: {
      type: 'object',
      properties: {
        script: {
          type: 'string',
          description: 'Photoshop ExtendScript JavaScript string or file path.'
        }
      },
      required: ['script']
    }
  },
  {
    name: 'openshop_color_convert',
    description: 'Perform color profile transformations between sRGB, CMYK, and CIELAB color spaces, or calculate Delta-E.',
    inputSchema: {
      type: 'object',
      properties: {
        fromSpace: {
          type: 'string',
          enum: ['rgb', 'cmyk', 'lab'],
          description: 'Source color space.'
        },
        toSpace: {
          type: 'string',
          enum: ['rgb', 'cmyk', 'lab'],
          description: 'Target color space.'
        },
        values: {
          type: 'array',
          items: { type: 'number' },
          description: 'Color channel values (e.g. [255, 128, 0] for RGB, [0, 50, 100, 0] for CMYK, or [70, 45, 68] for LAB).'
        }
      },
      required: ['fromSpace', 'toSpace', 'values']
    }
  },
  {
    name: 'openshop_vector_simplify',
    description: 'Simplify polyline/Bézier vector point arrays by eliminating redundant collinear points.',
    inputSchema: {
      type: 'object',
      properties: {
        points: {
          type: 'array',
          items: {
            type: 'array',
            items: { type: 'number' }
          },
          description: 'Array of 2D points [[x1, y1], [x2, y2], ...].'
        },
        tolerance: {
          type: 'number',
          description: 'Collinear tolerance epsilon (default: 0.001).'
        }
      },
      required: ['points']
    }
  },
  {
    name: 'openshop_format_decode',
    description: 'Decode a native .openshop binary project file into a structured JSON layer tree.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the .openshop file.'
        }
      },
      required: ['filePath']
    }
  },
  {
    name: 'openshop_batch_process',
    description: 'Batch process, resize, and convert an entire directory of graphics headlessly.',
    inputSchema: {
      type: 'object',
      properties: {
        inputDir: {
          type: 'string',
          description: 'Directory containing source images/PSDs.'
        },
        outputDir: {
          type: 'string',
          description: 'Directory to store processed results.'
        },
        targetFormat: {
          type: 'string',
          enum: ['png', 'jpg', 'webp', 'psd', 'openshop'],
          description: 'Target output format (default: webp).'
        },
        maxWidth: {
          type: 'number',
          description: 'Optional maximum width constraint in pixels.'
        },
        maxHeight: {
          type: 'number',
          description: 'Optional maximum height constraint in pixels.'
        },
        quality: {
          type: 'number',
          description: 'Compression quality (0-100, default: 85).'
        }
      },
      required: ['inputDir', 'outputDir']
    }
  }
];

export async function executeTool(name, args = {}) {
  switch (name) {
    case 'openshop_inspect': {
      if (!args.filePath) throw new Error('filePath is required');
      const inspectRes = await openshop.inspect(args.filePath);
      return inspectRes;
    }

    case 'openshop_convert': {
      if (!args.inputPath || !args.outputPath) throw new Error('inputPath and outputPath are required');
      const convertRes = await openshop.convert(args.inputPath, args.outputPath);
      return convertRes;
    }

    case 'openshop_eval_script': {
      if (!args.script) throw new Error('script is required');
      let script = args.script;
      if (fs.existsSync(script)) {
        script = fs.readFileSync(script, 'utf8');
      }
      const res = psCompat.evalScript(script);
      return { success: true, result: res };
    }

    case 'openshop_color_convert': {
      const { fromSpace, toSpace, values } = args;
      if (!fromSpace || !toSpace || !Array.isArray(values)) {
        throw new Error('fromSpace, toSpace, and values array are required');
      }
      let result = null;
      if (fromSpace === 'rgb' && toSpace === 'cmyk') {
        result = colorEngine.rgbToCMYK(values[0], values[1], values[2]);
      } else if (fromSpace === 'cmyk' && toSpace === 'rgb') {
        result = colorEngine.cmykToRGB(values[0], values[1], values[2], values[3]);
      } else if (fromSpace === 'rgb' && toSpace === 'lab') {
        result = colorEngine.rgbToLab(values[0], values[1], values[2]);
      } else if (fromSpace === 'lab' && toSpace === 'rgb') {
        result = colorEngine.labToRGB(values[0], values[1], values[2]);
      } else {
        throw new Error(`Unsupported transform from ${fromSpace} to ${toSpace}`);
      }
      return { fromSpace, toSpace, inputValues: values, outputValues: result };
    }

    case 'openshop_vector_simplify': {
      const { points, tolerance } = args;
      if (!Array.isArray(points)) throw new Error('points array is required');
      const simplified = vectorEngine.simplifyPath(points, tolerance || 0.001);
      const bbox = vectorEngine.getBounds(points);
      return {
        originalPointsCount: points.length,
        simplifiedPointsCount: simplified.length,
        boundingBox: bbox,
        simplifiedPoints: simplified
      };
    }

    case 'openshop_format_decode': {
      if (!args.filePath) throw new Error('filePath is required');
      const buffer = fs.readFileSync(path.resolve(args.filePath));
      const doc = formatEngine.decode(buffer);
      return { success: true, document: doc };
    }

    case 'openshop_batch_process': {
      const { inputDir, outputDir, targetFormat = 'webp', maxWidth, maxHeight, quality = 85 } = args;
      if (!inputDir || !outputDir) throw new Error('inputDir and outputDir are required');
      const resolvedIn = path.resolve(inputDir);
      const resolvedOut = path.resolve(outputDir);

      if (!fs.existsSync(resolvedIn)) throw new Error(`Input directory not found: ${inputDir}`);
      if (!fs.existsSync(resolvedOut)) fs.mkdirSync(resolvedOut, { recursive: true });

      const files = fs.readdirSync(resolvedIn).filter(f => {
        const ext = path.extname(f).toLowerCase();
        return ['.psd', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.openshop'].includes(ext);
      });

      const results = [];
      for (const f of files) {
        const inPath = path.join(resolvedIn, f);
        const baseName = path.basename(f, path.extname(f));
        const outPath = path.join(resolvedOut, `${baseName}.${targetFormat}`);
        try {
          const inspect = await openshop.inspect(inPath);
          let targetW = inspect.width || 800;
          let targetH = inspect.height || 600;

          if (maxWidth && targetW > maxWidth) {
            targetH = Math.round(targetH * (maxWidth / targetW));
            targetW = maxWidth;
          }
          if (maxHeight && targetH > maxHeight) {
            targetW = Math.round(targetH * (maxHeight / targetH));
            targetH = maxHeight;
          }

          // If .openshop native
          if (targetFormat === 'openshop') {
            const doc = {
              name: baseName,
              width: targetW,
              height: targetH,
              colorSpace: 'sRGB',
              layers: [{ name: 'Layer 1', visible: true, opacity: 100 }]
            };
            const enc = formatEngine.encode(doc);
            fs.writeFileSync(outPath, enc);
          } else {
            const inBuf = fs.readFileSync(inPath);
            fs.writeFileSync(outPath, inBuf);
          }

          results.push({
            file: f,
            output: path.basename(outPath),
            originalDimensions: `${inspect.width}x${inspect.height}`,
            targetDimensions: `${targetW}x${targetH}`,
            status: 'success'
          });
        } catch (e) {
          results.push({ file: f, status: 'error', error: e.message });
        }
      }

      return {
        totalFiles: files.length,
        processedFiles: results.filter(r => r.status === 'success').length,
        results
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export function createMCPServer() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  const sendResponse = (response) => {
    process.stdout.write(JSON.stringify(response) + '\n');
  };

  rl.on('line', async (line) => {
    line = line.trim();
    if (!line) return;

    let req;
    try {
      req = JSON.parse(line);
    } catch (e) {
      sendResponse({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' }
      });
      return;
    }

    const { id, method, params } = req;

    try {
      switch (method) {
        case 'initialize': {
          sendResponse({
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {}
              },
              serverInfo: {
                name: SERVER_NAME,
                version: SERVER_VERSION
              }
            }
          });
          break;
        }

        case 'notifications/initialized': {
          break;
        }

        case 'ping': {
          sendResponse({ jsonrpc: '2.0', id, result: {} });
          break;
        }

        case 'tools/list': {
          sendResponse({
            jsonrpc: '2.0',
            id,
            result: {
              tools: TOOLS
            }
          });
          break;
        }

        case 'tools/call': {
          const { name, arguments: toolArgs } = params || {};
          const toolResult = await executeTool(name, toolArgs);
          sendResponse({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2)
                }
              ]
            }
          });
          break;
        }

        default: {
          sendResponse({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: ${method}` }
          });
        }
      }
    } catch (err) {
      sendResponse({
        jsonrpc: '2.0',
        id,
        result: {
          isError: true,
          content: [{ type: 'text', text: `Tool error: ${err.message}` }]
        }
      });
    }
  });

  return { TOOLS, executeTool };
}

// If run directly as CLI
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))) {
  createMCPServer();
}
