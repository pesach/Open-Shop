#!/usr/bin/env node
/**
 * Open-Shop Headless Agent CLI (bin/openshop-cli.mjs)
 * Usage:
 *   node bin/openshop-cli.mjs inspect <file>
 *   node bin/openshop-cli.mjs convert <input> <output>
 *   node bin/openshop-cli.mjs status
 */
import { openshop } from '../api/openshop-node.mjs';

const [,, cmd, ...args] = process.argv;

async function main() {
  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(`
Open-Shop Headless Agent CLI
============================
Commands:
  inspect <filePath>              Inspect PSD / image layers, metadata, and dimensions
  convert <inputFile> <outputFile> Convert image format headlessly
  status                          Check local Open-Shop engine server status
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
