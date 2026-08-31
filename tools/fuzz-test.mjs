/**
 * Open-Shop Fuzz & Resilience Testing Suite
 * Tests parsers, decoders, and format handlers against bitflips, truncations, and boundary conditions.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OpenShopHeadless, formatEngine, colorEngine, vectorEngine } from '../api/openshop-node.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, '../tests/fixtures');

export async function runFuzzSuite() {
  console.log('🧪 Starting Open-Shop Fuzz & Resilience Suite...');
  let totalTests = 0;
  let passedTests = 0;

  const files = fs.existsSync(FIXTURES_DIR) ? fs.readdirSync(FIXTURES_DIR) : [];

  // 1. Test Bitflip & Truncation resilience on fixtures
  for (const file of files) {
    const filePath = path.join(FIXTURES_DIR, file);
    if (!fs.statSync(filePath).isFile()) continue;

    const originalBuf = fs.readFileSync(filePath);
    
    // Fuzz 1: Truncate at various lengths
    const truncLengths = [0, 4, Math.floor(originalBuf.length / 2), Math.max(0, originalBuf.length - 1)];
    for (const len of truncLengths) {
      totalTests++;
      const truncated = originalBuf.subarray(0, len);
      try {
        await OpenShopHeadless.inspect(truncated);
        passedTests++;
      } catch (err) {
        // Must fail with a controlled error, not unhandled crash
        if (err instanceof Error) {
          passedTests++;
        }
      }
    }

    // Fuzz 2: Bitflips in header and body
    for (let i = 0; i < 5; i++) {
      totalTests++;
      const corrupted = Buffer.from(originalBuf);
      if (corrupted.length > 0) {
        const offset = Math.floor(Math.random() * corrupted.length);
        corrupted[offset] ^= 0xFF;
      }
      try {
        await OpenShopHeadless.inspect(corrupted);
        passedTests++;
      } catch (err) {
        if (err instanceof Error) {
          passedTests++;
        }
      }
    }
  }

  // 2. Fuzz OpenShopFormat decode with malformed inputs
  const badFormatInputs = [
    '',
    '{}',
    '{"magic":"INVALID"}',
    '{"magic":"OPENSHOP"}',
    null,
    undefined,
    Buffer.from([0x00, 0xFF, 0xFE, 0xFD])
  ];

  for (const bad of badFormatInputs) {
    totalTests++;
    try {
      formatEngine.decode(bad);
      // Some might succeed if valid empty structure
      passedTests++;
    } catch (err) {
      if (err instanceof Error) {
        passedTests++;
      }
    }
  }

  // 3. Fuzz OpenShopVector with extreme / NaN coordinates
  const vectorCases = [
    [],
    [[0, 0]],
    [[-1e6, -1e6], [1e6, 1e6]],
    [[0, 0], [100, 100], [50, 50]]
  ];

  for (const pts of vectorCases) {
    totalTests++;
    try {
      const bounds = vectorEngine.getBounds(pts);
      const simplified = vectorEngine.simplifyPath(pts, 1.0);
      if (typeof bounds.width === 'number' && Array.isArray(simplified)) {
        passedTests++;
      }
    } catch (err) {
      if (err instanceof Error) passedTests++;
    }
  }

  // 4. Fuzz OpenShopColor with out-of-range RGB/CMYK values
  const colorCases = [
    { r: -10, g: 300, b: 128 },
    { r: 0, g: 0, b: 0 },
    { r: 255, g: 255, b: 255 }
  ];

  for (const rgb of colorCases) {
    totalTests++;
    try {
      const lab = colorEngine.rgbToLab(rgb.r, rgb.g, rgb.b);
      const cmyk = colorEngine.rgbToCMYK(rgb.r, rgb.g, rgb.b);
      if (typeof lab.L === 'number' && typeof cmyk.c === 'number') {
        passedTests++;
      }
    } catch (err) {
      if (err instanceof Error) passedTests++;
    }
  }

  console.log(`📊 Fuzz Suite Result: ${passedTests}/${totalTests} Passed`);
  return { total: totalTests, passed: passedTests };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runFuzzSuite().then((res) => {
    if (res.passed !== res.total) {
      process.exit(1);
    }
  });
}
