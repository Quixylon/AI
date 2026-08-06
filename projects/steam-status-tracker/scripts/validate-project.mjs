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

function isExternalReference(value) {
  return /^(?:[a-z]+:|\/\/|#)/i.test(value);
}

async function validateLocalReference(sourceFile, rawReference) {
  const reference = stripUrlSuffix(rawReference.trim());
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
  'public/.nojekyll',
  'public/index.html',
  'public/app.js',
  'public/styles.css',
  'public/brand-icons.js',
  'public/brand-icons.css',
  'public/data/bio.json',
  'public/data/status.json',
  'public/data/history.json',
  'public/tracker/index.html',
  'public/tracker/tracker.js',
  'public/tracker/tracker-scroll-reset.js'
];

const forbiddenPaths = [
  'paused-site',
  'public/data/deployment.json',
  'public/profile-v2',
  'public/profile-refresh.js',
  'public/tracker/tracker-status-labels.js',
  'scripts/build-profile-v2.mjs'
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

const duplicateIconLayers = await readFile(path.join(publicDirectory, 'app.js'), 'utf8');
if (/const\s+iconMarkup\s*=/.test(duplicateIconLayers)) {
  warnings.push('public/app.js still contains fallback icon markup; brand-icons.js is the canonical presentation layer.');
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
