const COUNTER_ENDPOINT = 'https://quixylon-counter.naks56toq.workers.dev/';
const STORAGE_KEY = 'quixylon-anonymous-visitor-id-v1';
const display = document.querySelector('#visitor-count');

function createVisitorId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(20);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getVisitorId() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && /^[a-zA-Z0-9-]{16,100}$/.test(saved)) {
      return saved;
    }

    const created = createVisitorId();
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return createVisitorId();
  }
}

function showCount(value) {
  if (!display) return;
  const count = Number(value);
  if (!Number.isFinite(count) || count < 0) {
    throw new Error('Invalid visitor count');
  }

  display.textContent = `Посетители: ${new Intl.NumberFormat('ru-RU').format(count)}`;
  display.title = 'Примерное количество уникальных браузеров';
}

async function registerVisitor() {
  if (!display) return;

  try {
    const response = await fetch(COUNTER_ENDPOINT, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ visitorId: getVisitorId() })
    });

    if (!response.ok) {
      throw new Error(`Counter returned HTTP ${response.status}`);
    }

    const payload = await response.json();
    showCount(payload?.visitors);
  } catch (error) {
    console.warn('Unique visitor counter is unavailable:', error);
    display.textContent = 'Посетители: —';
    display.title = 'Счётчик временно недоступен';
  }
}

registerVisitor();
