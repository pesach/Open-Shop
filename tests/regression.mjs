/**
 * Open-Shop Automated Regression & Platform Test Suite (tests/regression.mjs)
 * Executes asset integrity checks, server REST API checks, and Headless Agent
 * inspection checks against this checkout.
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { OpenShopNodeAPI, openshop } from '../api/openshop-node.mjs';

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
    'api/openshop-node.mjs',
    'bin/openshop-cli.mjs',
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
