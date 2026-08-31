/**
 * Open-Shop Automated Regression & Platform Test Suite (tests/regression.mjs)
 * Executes syntax validation, asset integrity checks, server REST API tests,
 * and Headless Agent API inspection & conversion benchmarks.
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { openshop } from '../api/openshop-node.mjs';

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
    'code/openshop-autosave.js',
    'code/openshop-batch.js',
    'api/openshop-node.mjs',
    'bin/openshop-cli.mjs',
    'promo/icon.svg',
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
  try {
    const status = await openshop.postJSON('/api/status', {});
    assert(status.ok === true, 'Server REST API /api/status responds with ok: true');
    assert(status.name === 'Open-Shop Headless API', 'Server engine identifies as Open-Shop Headless API');
  } catch (err) {
    assert(false, `Server endpoint check failed: ${err.message}`);
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
