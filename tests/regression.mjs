/**
 * Open-Shop Automated Regression & Platform Test Suite (tests/regression.mjs)
 * Executes asset integrity checks, server REST API checks, Headless Agent
 * operations, Photoshop Scripting DOM, Color Management, Vector Boolean, and Fuzzing.
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { OpenShopNodeAPI, openshop, formatEngine, colorEngine, vectorEngine, psCompat } from '../api/openshop-node.mjs';
import { runFuzzSuite } from '../tools/fuzz-test.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

function startCheckoutServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.mjs'], {
      cwd: rootDir,
      env: { ...process.env, HOST: '127.0.0.1', PORT: '0' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Checkout server did not start in time${stderr ? `: ${stderr.trim()}` : ''}`));
    }, 5000);

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.once('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.stdout.on('data', chunk => {
      const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (!match) return;
      clearTimeout(timeout);
      resolve({
        api: new OpenShopNodeAPI({ serverUrl: `http://127.0.0.1:${match[1]}` }),
        stop: () => child.kill()
      });
    });
    child.once('exit', code => {
      if (code !== null && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Checkout server exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`));
      }
    });
  });
}

async function run() {
  console.log('\n========================================');
  console.log('🚀 Running Open-Shop Platform Test Suite');
  console.log('========================================\n');

  // Test Suite 1: File & Asset Integrity
  console.log('📁 1. Asset & Module Integrity Checks:');
  const requiredFiles = [
    'index.html',
    'manifest.json',
    'sw.js',
    'style/all.css',
    'code/openshop.js',
    'code/dbs.js',
    'code/external/ext.js',
    'code/openshop-logger.js',
    'code/openshop-recovery.js',
    'code/openshop-agent.js',
    'code/openshop-memory.js',
    'code/openshop-batch.js',
    'code/openshop-color.js',
    'code/openshop-vector.js',
    'code/openshop-format.js',
    'code/openshop-ps-compat.js',
    'tools/corpus-gen.mjs',
    'tools/fuzz-test.mjs',
    'api/openshop-node.mjs',
    'bin/openshop-cli.mjs',
    'bin/openshop-mcp.mjs',
    'mcp/openshop-mcp-server.mjs',
    'promo/icon.svg',
    'promo/icon512.png',
    'promo/icon256.png',
    'promo/icon192.png',
    'promo/icon64.png',
    'promo/icon32.png',
    'favicon.png',
    'favicon.ico',
    'promo/logo.svg',
    'demo.psd'
  ];

  for (const f of requiredFiles) {
    const exists = fs.existsSync(path.join(rootDir, f));
    assert(exists, `Required file exists: ${f}`);
  }

  // Test Suite 2: CSS Theme & Style Rules
  console.log('\n🎨 2. Visual Theme & CSS Specifications:');
  const css = fs.readFileSync(path.join(rootDir, 'style/all.css'), 'utf8');
  assert(css.includes('--base: #474747;'), 'CSS contains Studio Base color (#474747)');
  assert(css.includes('--bg-canvas: #252525;'), 'CSS contains Studio Canvas color (#252525)');
  assert(css.includes('border-top-left-radius: 7px'), 'CSS contains Tab rounded corner (7px)');
  assert(css.includes('rgba(255, 255, 255, 0.14)'), 'CSS contains Menubar hover color (rgba 0.14)');
  assert(css.includes('#3a6ea5'), 'CSS contains Context Menu hover blue (#3a6ea5)');

  // Test Suite 3: Local Server & REST API
  console.log('\n🌐 3. Server Endpoints & REST API:');
  let checkoutServer;
  try {
    checkoutServer = await startCheckoutServer();
    const status = await checkoutServer.api.postJSON('/api/status', {});
    assert(status.ok === true, 'Server REST API /api/status responds with ok: true');
    assert(status.name === 'Open-Shop Headless API', 'Server engine identifies as Open-Shop Headless API');
  } catch (err) {
    assert(false, `Server endpoint check failed: ${err.message}`);
  } finally {
    checkoutServer?.stop();
  }

  // Test Suite 4: Headless Node.js Agent API
  console.log('\n🤖 4. Headless Agent Operations:');
  try {
    const inspectRes = await openshop.inspect('demo.psd');
    assert(inspectRes.success === true, 'Headless inspect returned success');
    assert(inspectRes.format === 'PSD', 'Format correctly detected as PSD');
    assert(inspectRes.colorMode === 'RGB', 'Color mode correctly parsed as RGB');
    assert(inspectRes.channels === 3 || inspectRes.channels === 4, `Channels parsed: ${inspectRes.channels}`);
  } catch (err) {
    assert(false, `Inspect API failed: ${err.message}`);
  }

  // Test Suite 5: Color Management Engine
  console.log('\n🌈 5. Color Profiles & Space Transforms:');
  try {
    const rgb = { r: 255, g: 128, b: 0 };
    const lab = colorEngine.rgbToLab(rgb.r, rgb.g, rgb.b);
    const roundtripRGB = colorEngine.labToRGB(lab.L, lab.a, lab.b);
    assert(Math.abs(rgb.r - roundtripRGB.r) <= 2, 'RGB <-> CIELAB roundtrip accuracy within delta tolerance');

    const cmyk = colorEngine.rgbToCMYK(rgb.r, rgb.g, rgb.b);
    assert(cmyk.c === 0 && cmyk.m === 50 && cmyk.y === 100 && cmyk.k === 0, 'RGB to CMYK orange translation is accurate');

    const deltaE = colorEngine.deltaE76(lab, colorEngine.rgbToLab(255, 130, 0));
    assert(deltaE < 2.0, `Delta-E 76 color difference accurately calculated (${deltaE.toFixed(2)})`);
  } catch (err) {
    assert(false, `Color engine failed: ${err.message}`);
  }

  // Test Suite 6: Vector & Path Boolean Engine
  console.log('\n📐 6. Vector & Path Boolean Operations:');
  try {
    const pathA = [[0, 0], [100, 0], [100, 100], [0, 100]];
    const pathB = [[50, 50], [150, 50], [150, 150], [50, 150]];
    
    const unionRes = vectorEngine.combinePaths(pathA, pathB, 'union');
    assert(unionRes.bounds.width === 150 && unionRes.bounds.height === 150, 'Path Union bounds correctly calculated to 150x150');

    const simplified = vectorEngine.simplifyPath([[0, 0], [10, 0.1], [20, -0.1], [100, 0]], 1.0);
    assert(simplified.length === 2, 'Bézier path collinear simplification reduces points from 4 to 2');
  } catch (err) {
    assert(false, `Vector engine failed: ${err.message}`);
  }

  // Test Suite 7: Native .openshop Container Format
  console.log('\n📦 7. Native .openshop Project Format:');
  try {
    const docState = {
      width: 1920,
      height: 1080,
      colorSpace: 'sRGB',
      layers: [
        { name: 'Layer 1', opacity: 80, blendMode: 'multiply' },
        { name: 'Layer 2', opacity: 100, blendMode: 'normal' }
      ]
    };
    const encoded = formatEngine.encode(docState);
    assert(encoded.includes('"magic": "OPENSHOP"'), 'Encoded .openshop contains OPENSHOP magic signature');
    
    const decoded = formatEngine.decode(encoded);
    assert(decoded.width === 1920 && decoded.layers.length === 2, 'Decoded .openshop preserves dimensions and layers');
  } catch (err) {
    assert(false, `Format engine failed: ${err.message}`);
  }

  // Test Suite 8: Photoshop ExtendScript Compatibility Bridge
  console.log('\n📜 8. Photoshop ExtendScript Compatibility:');
  try {
    const scriptResult = openshop.evalPhotoshopScript(`
      doc.resizeImage(1280, 720);
      const layer = doc.activeLayer;
      layer.name = "Hero Banner";
      layer.adjustBrightnessContrast(10, 5);
      return doc.width + "x" + doc.height + " - " + layer.name;
    `);
    assert(scriptResult === '1280x720 - Hero Banner', `ExtendScript execution succeeded: ${scriptResult}`);
  } catch (err) {
    assert(false, `Photoshop ExtendScript bridge failed: ${err.message}`);
  }

  // Test Suite 9: Fuzz & Resilience Testing
  console.log('\n🛡️ 9. Fuzzing & Resilience Validation:');
  try {
    const fuzzRes = await runFuzzSuite();
    assert(fuzzRes.passed === fuzzRes.total, `All ${fuzzRes.passed}/${fuzzRes.total} fuzz & corrupted test permutations passed`);
  } catch (err) {
    assert(false, `Fuzz suite failed: ${err.message}`);
  }

  // Test Suite 10: 100% Air-Gapped Local Typography
  console.log('\n🔤 10. Air-Gapped Typography & Local Fonts:');
  try {
    const fontFiles = [
      'style/fonts/opensans-400.ttf',
      'style/fonts/opensans-400i.ttf',
      'style/fonts/opensans-700.ttf',
      'style/fonts/opensans-700i.ttf'
    ];
    for (const f of fontFiles) {
      assert(fs.existsSync(path.join(rootDir, f)), `Local font asset exists: ${f}`);
    }
    assert(css.includes('@font-face') && css.includes("url('fonts/opensans-400.ttf')"), 'CSS imports local Open Sans @font-face');
    const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert(!indexHtml.includes('fonts.googleapis.com'), 'index.html is 100% air-gapped with 0 external Google Fonts links');
  } catch (err) {
    assert(false, `Local typography check failed: ${err.message}`);
  }

  // Test Suite 11: Model Context Protocol (MCP) Server
  console.log('\n🔌 11. Model Context Protocol (MCP) Server:');
  try {
    const { TOOLS, executeTool } = await import('../mcp/openshop-mcp-server.mjs');
    assert(Array.isArray(TOOLS) && TOOLS.length >= 7, `MCP server registers ${TOOLS.length} tools`);

    const colorToolRes = await executeTool('openshop_color_convert', {
      fromSpace: 'rgb',
      toSpace: 'cmyk',
      values: [255, 128, 0]
    });
    assert(colorToolRes.outputValues.c === 0 && colorToolRes.outputValues.y === 100, 'MCP openshop_color_convert returns accurate CMYK');

    const vectorToolRes = await executeTool('openshop_vector_simplify', {
      points: [[0, 0], [50, 0], [100, 0]]
    });
    assert(vectorToolRes.simplifiedPointsCount === 2, 'MCP openshop_vector_simplify eliminates collinear point');
  } catch (err) {
    assert(false, `MCP server test failed: ${err.message}`);
  }

  // Test Suite 12: Batch Processing Engine
  console.log('\n⚡ 12. Batch Processing CLI & Node Engine:');
  try {
    const batchOut = path.join(rootDir, 'dist/test_batch_dist');
    const batchRes = await openshop.batchProcess({
      inputDir: path.join(rootDir, 'tests/fixtures'),
      outputDir: batchOut,
      targetFormat: 'webp'
    });
    assert(batchRes.totalFiles >= 4, `Batch processor scanned ${batchRes.totalFiles} files`);
    assert(batchRes.processedFiles === batchRes.totalFiles, `All ${batchRes.processedFiles} files processed successfully`);
    assert(fs.existsSync(path.join(batchOut, 'sample.webp')), 'Batch output file exists');
  } catch (err) {
    assert(false, `Batch processing failed: ${err.message}`);
  }

  // Summary Report
  console.log('\n========================================');
  console.log(`📊 Test Summary: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('========================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
