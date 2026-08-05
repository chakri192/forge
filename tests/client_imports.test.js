import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const jsRoot = path.join(here, '../src/public/js');

/**
 * The client is plain ES modules with no build step, so nothing checks that an
 * import actually exists until a browser refuses the whole module graph — and
 * then the entire app fails to boot on a blank page. Every server test can pass
 * while the site is dead.
 *
 * This walks the real import graph and resolves every named import against what
 * the target file exports.
 */

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

/** Named imports from relative paths — the only kind that can dangle here. */
function namedImports(source) {
  const found = [];
  const re = /import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g;
  for (const match of source.matchAll(re)) {
    const names = match[1]
      .split(',')
      .map((n) => n.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean);
    found.push({ names, from: match[2] });
  }
  return found;
}

function exportedNames(source) {
  const names = new Set();
  for (const m of source.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  for (const m of source.matchAll(/export\s+(?:const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  // `export { a, b as c }` — the outward-facing name is what matters.
  for (const m of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const asMatch = trimmed.split(/\s+as\s+/);
      names.add((asMatch[1] || asMatch[0]).trim());
    }
  }
  return names;
}

describe('Client module graph', () => {
  const files = walk(jsRoot);

  it('has files to check', () => {
    assert.ok(files.length > 20, `expected a real client tree, found ${files.length} files`);
  });

  it('resolves every named import to a real export', () => {
    const broken = [];

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const { names, from } of namedImports(source)) {
        const target = path.resolve(path.dirname(file), from);
        if (!fs.existsSync(target)) {
          broken.push(`${path.relative(jsRoot, file)} imports a missing file: ${from}`);
          continue;
        }
        const targetExports = exportedNames(fs.readFileSync(target, 'utf8'));
        for (const name of names) {
          if (!targetExports.has(name)) {
            broken.push(
              `${path.relative(jsRoot, file)} imports { ${name} } from ${from}, which does not export it`
            );
          }
        }
      }
    }

    assert.deepEqual(broken, [], `dangling imports would stop the app booting:\n  ${broken.join('\n  ')}`);
  });
});
