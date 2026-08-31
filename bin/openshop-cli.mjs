#!/usr/bin/env node
/**
 * Open-Shop Headless Agent CLI (bin/openshop-cli.mjs)
 * Usage:
 *   node bin/openshop-cli.mjs inspect <file>
 *   node bin/openshop-cli.mjs convert <input> <output>
 *   node bin/openshop-cli.mjs script <scriptString>
 *   node bin/openshop-cli.mjs corpus
 *   node bin/openshop-cli.mjs fuzz
 *   node bin/openshop-cli.mjs status
 */
import fs from 'fs';
import { openshop } from '../api/openshop-node.mjs';
import { generateCorpus } from '../tools/corpus-gen.mjs';
import { runFuzzSuite } from '../tools/fuzz-test.mjs';

const [,, cmd, ...args] = process.argv;

async function main() {
  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(`
Open-Shop Headless Agent CLI
============================
Commands:
  inspect <filePath>               Inspect PSD / .openshop / image metadata and dimensions
  convert <inputFile> <outputFile> Convert image format headlessly
  batch <inDir> <outDir> [format]  Batch process and convert an entire folder
  script <scriptCodeOrFile>        Execute Photoshop ExtendScript code on headless DOM
  corpus                           Generate deterministic multi-format test corpus
  fuzz                             Run parser & decoder fuzz / resilience test suite
  status                           Check local Open-Shop engine server status
    `);
    process.exit(0);
  }

  try {
    switch (cmd) {
      case 'inspect': {
        const filePath = args[0];
        if (!filePath) throw new Error('Specify file path to inspect');
        const info = await openshop.inspect(filePath);
        console.log(JSON.stringify(info, null, 2));
        break;
      }

      case 'convert': {
        const [input, output] = args;
        if (!input || !output) throw new Error('Usage: convert <inputFile> <outputFile>');
        console.log(`Converting "${input}" -> "${output}"...`);
        const res = await openshop.convert(input, output);
        console.log('Conversion successful:', res);
        break;
      }

      case 'script': {
        let script = args.join(' ');
        if (!script) throw new Error('Specify ExtendScript code or script file path');
        if (fs.existsSync(script)) {
          script = fs.readFileSync(script, 'utf8');
        }
        const result = openshop.evalPhotoshopScript(script);
        console.log('Script execution result:', result);
        break;
      }

      case 'corpus': {
        generateCorpus();
        break;
      }

      case 'fuzz': {
        const fuzzRes = await runFuzzSuite();
        if (fuzzRes.passed !== fuzzRes.total) process.exit(1);
        break;
      }

      case 'batch': {
        const inputDir = args[0] || 'tests/fixtures';
        const outputDir = args[1] || 'dist/batch_output';
        const targetFormat = args[2] || 'webp';
        console.log(`Batch processing directory "${inputDir}" -> "${outputDir}" (Format: ${targetFormat})...`);
        const batchRes = await openshop.batchProcess({ inputDir, outputDir, targetFormat });
        console.log(`Batch finished: ${batchRes.processedFiles}/${batchRes.totalFiles} files processed.`);
        console.log(JSON.stringify(batchRes, null, 2));
        break;
      }

      case 'status': {
        const res = await openshop.postJSON('/api/status', {});
        console.log('Open-Shop Engine Status:', res);
        break;
      }

      default:
        console.error(`Unknown command: ${cmd}`);
        process.exit(1);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
