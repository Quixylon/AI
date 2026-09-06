import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const currentFile = fileURLToPath(import.meta.url);
const projectDirectory = path.resolve(path.dirname(currentFile), '..');
const publicDirectory = path.join(projectDirectory, 'public');
const repositoryDirectory = path.resolve(projectDirectory, '..', '..');

const errors = [];
const warnings = [];

function relativeToProject(filePath) {
  return path.relative(projectDirectory, filePath).split(path.sep).join('/');
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else files.push(fullPath);
  }

  return files;
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    errors.push(`${relativeToProject(filePath)}: invalid JSON (${error.message})`);
    return null;
  }
}

function stripUrlSuffix(value) {
  return value.split('#', 1)[0].split('?', 1)[0];
}

function decodeReference(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isExternalReference(value) {
  const normalized = value.trim();
  const decoded = decodeReference(normalized);
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(normalized)
    || decoded.startsWith('#');
}

async function validateLocalReference(sourceFile, rawReference) {
  const trimmedReference = rawReference.trim();
  if (!trimmedReference || isExternalReference(trimmedReference)) return;

  const reference = stripUrlSuffix(trimmedReference);
  if (!reference || isExternalReference(reference)) return;

  const resolved = path.resolve(path.dirname(sourceFile), reference);
  const candidate = reference.endsWith('/') ? path.join(resolved, 'index.html') : resolved;

  if (!candidate.startsWith(publicDirectory + path.sep) && candidate !== publicDirectory) {
    errors.push(`${relativeToProject(sourceFile)}: reference escapes public directory: ${rawReference}`);
    return;
  }

  if (!await exists(candidate)) {
    errors.push(`${relativeToProject(sourceFile)}: missing local resource: ${rawReference}`);
  }
}

async function validateHtml(filePath) {
  const html = await readFile(filePath, 'utf8');
  const ids = new Set();
  for (const [, id] of html.matchAll(/\bid=["']([^"']+)["']/g)) {
    if (ids.has(id)) errors.push(`${relativeToProject(filePath)}: duplicate id ${id}`);
    ids.add(id);
  }
  const attributePattern = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;

  for (const match of html.matchAll(attributePattern)) {
    await validateLocalReference(filePath, match[1]);
  }

  if (/<img\b[^>]*\bsrc=["']{2}/i.test(html)) {
    errors.push(`${relativeToProject(filePath)}: empty image src causes a request for the HTML document`);
  }
}

async function validateCss(filePath) {
  const css = await readFile(filePath, 'utf8');

  // Capture quoted URLs as a whole. The previous expression stopped at quotes
  // inside data:image SVGs and then mistook nested url(%23filter) fragments for
  // local files such as "%23noise".
  const urlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi;

  for (const match of css.matchAll(urlPattern)) {
    const reference = match[1] ?? match[2] ?? match[3] ?? '';
    await validateLocalReference(filePath, reference);
  }
}

function validateSyntax(filePath) {
  const result = spawnSync(process.execPath, ['--check', filePath], {
    cwd: repositoryDirectory,
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    errors.push(`${relativeToProject(filePath)}: JavaScript syntax error\n${output}`);
  }
}

function validateHttpsUrl(value, label) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') errors.push(`${label}: URL must use HTTPS`);
  } catch {
    errors.push(`${label}: invalid URL`);
  }
}

function validateBio(bio) {
  if (!bio || typeof bio !== 'object') return;
  if (!Array.isArray(bio.links) || bio.links.length === 0) {
    errors.push('public/data/bio.json: links must be a non-empty array');
    return;
  }

  const kinds = new Set();
  for (const [index, link] of bio.links.entries()) {
    const label = `public/data/bio.json links[${index}]`;
    if (!link?.label || !link?.kind || !link?.url) {
      errors.push(`${label}: label, kind and url are required`);
      continue;
    }

    if (kinds.has(link.kind)) errors.push(`${label}: duplicate kind "${link.kind}"`);
    kinds.add(link.kind);
    validateHttpsUrl(link.url, label);
  }

  if (!kinds.has('discord')) errors.push('public/data/bio.json: Discord link is missing');
}

function validateStatus(status) {
  if (!status || typeof status !== 'object') return;
  if (typeof status.configured !== 'boolean') {
    errors.push('public/data/status.json: configured must be boolean');
    return;
  }

  if (!status.configured) return;
  if (!status.player || typeof status.player !== 'object') {
    errors.push('public/data/status.json: configured status requires player data');
    return;
  }

  if (!status.checkedAt || !Number.isFinite(Date.parse(status.checkedAt))) errors.push('status.json: invalid checkedAt');
  if (!/^\d{17}$/.test(status.player.steamId || '')) errors.push('status.json: invalid Steam ID');
  validateHttpsUrl(status.player.profileUrl, 'public/data/status.json profileUrl');
  validateHttpsUrl(status.player.avatar, 'public/data/status.json avatar');
}

function validateHistory(history) {
  if (!Array.isArray(history)) {
    errors.push('public/data/history.json: root value must be an array');
    return;
  }

  let previousStart = Number.NEGATIVE_INFINITY;
  let activeEntries = 0;

  history.forEach((entry, index) => {
    const label = `public/data/history.json entry[${index}]`;
    const startedAt = new Date(entry?.startedAt).getTime();
    if (!Number.isFinite(startedAt)) {
      errors.push(`${label}: invalid startedAt`);
      return;
    }

    if (startedAt < previousStart) errors.push(`${label}: history is not chronological`);
    previousStart = startedAt;

    if (entry.endedAt == null) {
      activeEntries += 1;
      if (index !== history.length - 1) errors.push(`${label}: only the last entry may be active`);
    } else {
      const endedAt = new Date(entry.endedAt).getTime();
      if (!Number.isFinite(endedAt) || endedAt < startedAt) {
        errors.push(`${label}: invalid endedAt`);
      }
    }
  });

  if (activeEntries > 1) errors.push('public/data/history.json: multiple active entries');
}

const requiredFiles = [
  'public/.nojekyll', 'public/index.html', 'public/assets/site.css',
  ...['config', 'data', 'profile', 'platforms', 'history', 'navigation', 'motion', 'icons', 'ui', 'app', 'cat-audio'].map(name => `public/assets/${name}.js`),
  'public/assets/favicon.svg', 'public/data/bio.json', 'public/data/status.json',
  'public/data/history.json', 'public/tracker/index.html', 'public/profile-v2/index.html'
];

const forbiddenPaths = [
  'paused-site', 'public/experience-1.js', 'public/app.js', 'public/styles.css',
  'public/backup-exact-card.js', 'public/liquid-glass-integration.js',
  'public/visual-refresh.js', 'public/experience-shell-1.html'
];

for (const relativePath of requiredFiles) {
  if (!await exists(path.join(projectDirectory, relativePath))) {
    errors.push(`${relativePath}: required file is missing`);
  }
}

for (const relativePath of forbiddenPaths) {
  if (await exists(path.join(projectDirectory, relativePath))) {
    errors.push(`${relativePath}: obsolete or temporary artifact must be removed`);
  }
}

// Older shared profile URLs still use this compatibility redirect. Keep the
// route, but reject accidentally reviving a second independent profile app.
const legacyProfileRedirect = path.join(publicDirectory, 'profile-v2/index.html');
if (await exists(legacyProfileRedirect)) {
  const redirect = await readFile(legacyProfileRedirect, 'utf8');
  if (!redirect.includes("new URL('../', window.location.href)")
      || !redirect.includes('window.location.replace(target.href)')
      || /<script\b[^>]*\bsrc\s*=/i.test(redirect)) {
    errors.push('public/profile-v2/index.html: legacy route must remain a redirect to the main profile');
  }
}

const publicFiles = await walk(publicDirectory);
for (const filePath of publicFiles) {
  if (filePath.endsWith('.html')) await validateHtml(filePath);
  if (filePath.endsWith('.css')) await validateCss(filePath);
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) validateSyntax(filePath);
}

const scriptFiles = (await walk(path.join(projectDirectory, 'scripts')))
  .filter((filePath) => filePath.endsWith('.js') || filePath.endsWith('.mjs'));
for (const filePath of scriptFiles) validateSyntax(filePath);

const bio = await readJson(path.join(publicDirectory, 'data', 'bio.json'));
const status = await readJson(path.join(publicDirectory, 'data', 'status.json'));
const history = await readJson(path.join(publicDirectory, 'data', 'history.json'));
validateBio(bio);
validateStatus(status);
validateHistory(history);
if (status?.configured && Array.isArray(history)) {
  const active = history.at(-1);
  if (!active || active.endedAt || active.status !== status.player?.status || active.gameId !== status.player?.gameId) {
    errors.push('history.json: active entry does not match the current Steam status');
  }
}

if (warnings.length) {
  console.warn(`Warnings (${warnings.length}):`);
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error(`Validation failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validation passed: ${publicFiles.length} public files and ${scriptFiles.length} project scripts checked.`);
