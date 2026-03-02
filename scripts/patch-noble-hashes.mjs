/**
 * Patches @noble/hashes to add extensionless export aliases.
 * Several OPNet deps (built against v1.x) import without .js extension,
 * while v2.x only exports the .js-suffixed paths.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, '../node_modules/@noble/hashes/package.json');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const exports = pkg.exports;

// Map extensionless → .js for every exported .js subpath
const aliases = {};
for (const [key, value] of Object.entries(exports)) {
    if (key.endsWith('.js')) {
        const noExt = key.slice(0, -3);
        if (!exports[noExt]) {
            aliases[noExt] = value;
        }
    }
}

// Also add sha256/sha512 as aliases for sha2.js (v1.x had separate files)
if (!exports['./sha256'] && !aliases['./sha256']) {
    aliases['./sha256'] = exports['./sha2.js'] ?? './sha2.js';
}
if (!exports['./sha512'] && !aliases['./sha512']) {
    aliases['./sha512'] = exports['./sha2.js'] ?? './sha2.js';
}
if (!exports['./sha3'] && !aliases['./sha3']) {
    aliases['./sha3'] = exports['./sha3.js'] ?? './sha3.js';
}
if (!exports['./hmac'] && !aliases['./hmac']) {
    aliases['./hmac'] = exports['./hmac.js'] ?? './hmac.js';
}

const added = Object.keys(aliases);
if (added.length === 0) {
    console.log('patch-noble-hashes: already patched or no changes needed');
} else {
    pkg.exports = { ...exports, ...aliases };
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log('patch-noble-hashes: added exports:', added.join(', '));
}
