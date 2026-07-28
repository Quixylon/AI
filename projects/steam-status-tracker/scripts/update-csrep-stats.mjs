import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const currentFile = fileURLToPath(import.meta.url);
const projectDirectory = path.resolve(path.dirname(currentFile), '..');
const dataDirectory = path.join(projectDirectory, 'public', 'data');
const outputPath = path.join(dataDirectory, 'csrep.json');

const profileUrl = process.env.CSREP_PROFILE_URL?.trim() ||
  'https://csrep.gg/player/76561199524001992';
const steamId = profileUrl.match(/\/player\/(\d{17})/)?.[1] || '76561199524001992';

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return fallback;
    throw error;
  }
}

async function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}

function compactError(error) {
  return String(error?.message || error || 'Неизвестная ошибка')
    .replace(/\s+/g, ' ')
    .slice(0, 280);
}

await mkdir(dataDirectory, { recursive: true });
const previous = await readJson(outputPath, null);
const attemptedAt = new Date().toISOString();
let browser;
let result;

try {
  browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox'
    ]
  });

  const context = await browser.newContext({
    locale: 'en-US',
    timezoneId: 'Europe/Moscow',
    viewport: { width: 1440, height: 1100 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  // Первый переход нужен, чтобы переждать возможную проверку Cloudflare и
  // сохранить cookies в том же браузерном контексте.
  await page.goto('https://csrep.gg/', {
    waitUntil: 'domcontentloaded',
    timeout: 45_000
  });

  await page.waitForFunction(() => {
    const title = document.title || '';
    const text = document.body?.innerText || '';
    return !/Just a moment/i.test(title) &&
      !/Enable JavaScript and cookies/i.test(text) &&
      text.length > 100;
  }, { timeout: 35_000 }).catch(() => false);

  await page.goto(profileUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000
  });

  let ready = await page.waitForFunction(() => {
    const title = document.title || '';
    const text = document.body?.innerText || '';
    if (/Just a moment/i.test(title) || /Enable JavaScript and cookies/i.test(text)) {
      return false;
    }
    return /Stats Based Analysis/i.test(text) || /Trust Rating/i.test(text);
  }, { timeout: 45_000 }).then(() => true).catch(() => false);

  if (!ready) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => null);
    ready = await page.waitForFunction(() => {
      const text = document.body?.innerText || '';
      return /Stats Based Analysis/i.test(text) || /Trust Rating/i.test(text);
    }, { timeout: 30_000 }).then(() => true).catch(() => false);
  }

  if (!ready) {
    const title = await page.title().catch(() => '');
    throw new Error(`CSRep не загрузил блок статистики. Заголовок страницы: ${title || 'неизвестен'}.`);
  }

  const extracted = await page.evaluate(() => {
    const text = document.body?.innerText || '';
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

    const parseNumber = (value) => {
      const match = String(value || '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
      return match ? Number(match[0]) : null;
    };

    const parsePercent = (value) => {
      const match = String(value || '').replace(',', '.').match(/(-?\d+(?:\.\d+)?)\s*%/);
      return match ? Number(match[1]) : null;
    };

    const percentNear = (label, radius = 220) => {
      const index = text.toLowerCase().indexOf(label.toLowerCase());
      if (index < 0) return null;
      const slice = text.slice(Math.max(0, index - radius), index + radius);
      const match = slice.match(/(\d{1,3}(?:[.,]\d+)?)\s*%/);
      return match ? Number(match[1].replace(',', '.')) : null;
    };

    const findPreviousValue = (labels, parser = parseNumber) => {
      for (const label of labels) {
        const index = lines.findIndex((line) => line.toLowerCase() === label.toLowerCase());
        if (index > 0) return parser(lines[index - 1]);
      }
      return null;
    };

    const findAccountValue = (label) => {
      const index = lines.findIndex((line) => line.toUpperCase() === label.toUpperCase());
      if (index < 0) return null;

      const candidates = [lines[index + 2], lines[index + 1], lines[index - 1]];
      const knownLabels = new Set([
        'ACCOUNT AGE', 'CS2 HOURS', 'INVENTORY VALUE', 'STEAM LEVEL', 'COLLECTIBLES'
      ]);

      for (const candidate of candidates) {
        if (!candidate || knownLabels.has(candidate.toUpperCase())) continue;
        if (/^[+-]\d+(?:[.,]\d+)?%?$/.test(candidate)) continue;
        return candidate;
      }
      return null;
    };

    let trust = null;
    const directTrust = text.match(/(\d{1,3}(?:[.,]\d+)?)\s*%\s*Trust\s*Rating/i);
    if (directTrust) trust = Number(directTrust[1].replace(',', '.'));
    if (trust == null) trust = percentNear('Trust Rating');

    const metrics = {
      kd: findPreviousValue(['K/D Ratio']),
      adr: findPreviousValue(['ADR']),
      hltvRating: findPreviousValue(['HLTV Rating 2.0']),
      reactionMs: findPreviousValue(['Reaction Time']),
      timeToDamageMs: findPreviousValue(['Time to Damage']),
      crosshairPlacementDeg: findPreviousValue(['Crosshair Placement']),
      preaimDeg: findPreviousValue(['Preaim']),
      aimAccuracy: findPreviousValue(['Aim Accuracy'], parsePercent),
      headAccuracy: findPreviousValue(['Head Accuracy'], parsePercent),
      wallbangKillPercent: findPreviousValue(['Wallbang Kill %'], parsePercent),
      smokeKillPercent: findPreviousValue(['Smoke Kill %'], parsePercent),
      kast: findPreviousValue(['KAST'], parsePercent)
    };

    const gamesMatch = text.match(/(?:based on|from|analyzed?)\s+(\d[\d, ]*)\s+(?:games|matches)/i) ||
      text.match(/(\d[\d, ]*)\s+(?:games|matches)\s+(?:analyzed|analysed)/i);

    return {
      pageTitle: document.title || null,
      trustRating: trust,
      anomaliesDetected: percentNear('Anomalies Detected'),
      statsBasedAnalysis: percentNear('Stats Based Analysis'),
      gamesAnalyzed: gamesMatch ? Number(gamesMatch[1].replace(/[, ]/g, '')) : null,
      metrics,
      account: {
        age: findAccountValue('ACCOUNT AGE'),
        cs2Hours: findAccountValue('CS2 HOURS'),
        inventoryValue: findAccountValue('INVENTORY VALUE'),
        steamLevel: findAccountValue('STEAM LEVEL'),
        collectibles: findAccountValue('COLLECTIBLES')
      }
    };
  });

  const usefulValues = [
    extracted.trustRating,
    extracted.anomaliesDetected,
    extracted.statsBasedAnalysis,
    extracted.gamesAnalyzed,
    ...Object.values(extracted.metrics),
    ...Object.values(extracted.account)
  ];

  if (!usefulValues.some((value) => value !== null && value !== undefined && value !== '')) {
    throw new Error('Страница CSRep открылась, но распознаваемые показатели не найдены.');
  }

  result = {
    configured: true,
    available: true,
    fresh: true,
    source: 'CSRep.gg',
    profileUrl,
    steamId,
    checkedAt: attemptedAt,
    lastAttemptAt: attemptedAt,
    error: null,
    stats: extracted
  };
} catch (error) {
  const message = compactError(error);
  console.warn(`CSRep scrape failed: ${message}`);

  if (previous?.available && previous?.stats) {
    result = {
      ...previous,
      configured: true,
      fresh: false,
      profileUrl,
      steamId,
      lastAttemptAt: attemptedAt,
      error: message
    };
  } else {
    result = {
      configured: true,
      available: false,
      fresh: false,
      source: 'CSRep.gg',
      profileUrl,
      steamId,
      checkedAt: null,
      lastAttemptAt: attemptedAt,
      error: message,
      stats: null
    };
  }
} finally {
  await browser?.close().catch(() => null);
}

await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
await setOutput('persist', 'true');
console.log(`CSRep result saved for ${steamId}. Available: ${result.available}.`);
