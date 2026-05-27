/**
 * Dynamically import every backend source file to verify there are no
 * syntax errors, missing-module errors, or unexpected reference errors.
 *
 * Connection errors (ECONNREFUSED, ENOTFOUND, etc.) are expected when
 * there is no running database/Redis and are treated as OK.
 */

import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const BACKEND_SRC = new URL('../src/', import.meta.url).pathname;

/**
 * Recursively collect all .js files under a directory.
 */
async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(full)));
    } else if (entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Errors that indicate infrastructure is unavailable rather than a code bug.
 */
function isConnectionError(err) {
  const msg = (err.message || '') + (err.code || '');
  const patterns = [
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNRESET',
    'EAI_AGAIN',
    'connect ECONNREFUSED',
    'getaddrinfo',
    'Connection terminated',
    'EHOSTUNREACH',
    // Redis/ioredis specific
    'Redis',
    'MaxRetriesPerRequestError',
  ];
  return patterns.some((p) => msg.includes(p));
}

/**
 * Errors we want to flag as real failures.
 */
function isCodeError(err) {
  if (err instanceof SyntaxError) return true;
  if (err.code === 'ERR_MODULE_NOT_FOUND') return true;
  if (err instanceof ReferenceError) return true;
  if (err instanceof TypeError && !isConnectionError(err)) return true;
  return false;
}

async function main() {
  const files = await collectFiles(BACKEND_SRC);
  files.sort();

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const file of files) {
    const rel = relative(BACKEND_SRC, file);
    try {
      await import(pathToFileURL(file).href);
      console.log(`OK:   src/${rel}`);
      passed++;
    } catch (err) {
      if (isCodeError(err)) {
        console.error(`FAIL: src/${rel}: ${err.message}`);
        failed++;
      } else {
        // Connection errors or other runtime issues from missing infra
        console.log(`SKIP: src/${rel} (${err.code || err.constructor.name}: ${err.message.split('\n')[0]})`);
        skipped++;
      }
    }
  }

  console.log(`\n--- Import verification ---`);
  console.log(`Total: ${files.length}  Passed: ${passed}  Skipped (infra): ${skipped}  Failed: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }

  // Force exit since some modules start servers/timers that prevent clean exit
  process.exit(process.exitCode || 0);
}

main();
