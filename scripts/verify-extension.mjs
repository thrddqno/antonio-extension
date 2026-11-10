import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const distDir = resolve('dist');
const manifestPath = join(distDir, 'manifest.json');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(existsSync(manifestPath), 'dist/manifest.json does not exist. Run npm run build first.');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

assert(manifest.manifest_version === 3, 'manifest_version is not 3.');
assert(manifest.chrome_url_overrides?.newtab === 'index.html', 'chrome_url_overrides.newtab is not index.html.');
assert(Array.isArray(manifest.permissions), 'permissions must be an array.');
assert(!manifest.permissions.includes('tabs'), 'tabs permission should not be requested.');
assert(!manifest.permissions.includes('history'), 'history permission should not be requested.');
assert(!manifest.permissions.includes('webRequest'), 'webRequest permission should not be requested.');
assert(manifest.permissions.includes('favicon'), 'favicon permission is required for minimal-proper favicon retrieval.');
assert(!JSON.stringify(manifest).includes('<all_urls>'), '<all_urls> should not be requested.');
assert(!Array.isArray(manifest.host_permissions) || manifest.host_permissions.length === 0, 'Broad host_permissions should not be requested for favicons.');

for (const size of ['16', '32', '48', '128']) {
  assert(existsSync(join(distDir, manifest.icons[size])), `Missing icon for ${size}.`);
}

const chromiumPath = spawnSync('which', ['chromium'], { encoding: 'utf8' }).stdout.trim();

if (!chromiumPath) {
  console.warn('Chromium executable not found; manifest checks passed but unpacked load was not executed.');
  process.exit(0);
}

const profileDir = mkdtempSync(join(tmpdir(), 'new-tab-extension-'));

try {
  const output = execFileSync(
    chromiumPath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--user-data-dir=${profileDir}`,
      `--disable-extensions-except=${distDir}`,
      `--load-extension=${distDir}`,
      '--dump-dom',
      'chrome://newtab/',
    ],
    { encoding: 'utf8', timeout: 30_000 },
  );

  assert(output.includes('New Tab'), 'Chromium did not render the extension new-tab page.');
} finally {
  rmSync(profileDir, { recursive: true, force: true });
}

console.log('Manifest V3 and unpacked extension load checks passed.');
