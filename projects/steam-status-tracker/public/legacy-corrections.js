'use strict';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)');

class CalmLegacyBackground {
  constructor() {
    this.canvas = null;
    this.context = null;
    this.points = [];
    this.width = 1;
    this.height = 1;
    this.ratio = 1;
    this.frame = 0;
    this.pointer = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      targetX: window.innerWidth / 2,
      targetY: window.innerHeight / 2,
      active: false
    };
  }

  init() {
    if (document.getElementById('legacy-calm-background')) return;

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'legacy-calm-background';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.context = this.canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!this.context) return;

    const original = document.getElementById('particleCanvas');
    if (original?.parentNode) original.parentNode.insertBefore(this.canvas, original);
    else document.body.prepend(this.canvas);

    this.resize();
    window.addEventListener('resize', () => this.resize(), { passive: true });
    window.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      this.pointer.targetX = event.clientX;
      this.pointer.targetY = event.clientY;
      this.pointer.active = true;
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => {
      this.pointer.active = false;
    }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop();
      else this.start();
    });
    reduceMotion.addEventListener?.('change', () => {
      this.stop();
      this.resize();
      this.start();
    });

    this.start();
  }

  resize() {
    if (!this.canvas || !this.context) return;
    this.width = Math.max(1, window.innerWidth);
    this.height = Math.max(1, window.innerHeight);
    this.ratio = Math.min(window.devicePixelRatio || 1, coarsePointer.matches ? 1.25 : 1.7);
    this.canvas.width = Math.round(this.width * this.ratio);
    this.canvas.height = Math.round(this.height * this.ratio);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.context.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);

    const areaCount = Math.round((this.width * this.height) / (coarsePointer.matches ? 18_000 : 13_500));
    const count = coarsePointer.matches
      ? Math.min(48, Math.max(28, areaCount))
      : Math.min(86, Math.max(48, areaCount));
    const aspect = Math.max(0.55, this.width / this.height);
    const columns = Math.max(6, Math.ceil(Math.sqrt(count * aspect)));
    const rows = Math.ceil(count / columns);
    const cellWidth = this.width / columns;
    const cellHeight = this.height / rows;

    this.points = Array.from({ length: count }, (_, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const depth = 0.35 + Math.random() * 0.65;
      return {
        x: (column + 0.5) * cellWidth + (Math.random() - 0.5) * cellWidth * 0.46,
        y: (row + 0.5) * cellHeight + (Math.random() - 0.5) * cellHeight * 0.46,
        depth,
        size: 0.75 + depth * 1.35,
        alpha: 0.25 + depth * 0.48,
        phase: Math.random() * Math.PI * 2
      };
    });

    this.draw(performance.now());
  }

  start() {
    if (!this.context || document.hidden) return;
    if (reduceMotion.matches) {
      this.draw(performance.now());
      return;
    }
    if (this.frame) return;
    this.frame = requestAnimationFrame((time) => this.loop(time));
  }

  stop() {
    if (!this.frame) return;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  loop(time) {
    this.frame = 0;
    this.draw(time);
    if (!document.hidden && !reduceMotion.matches) {
      this.frame = requestAnimationFrame((nextTime) => this.loop(nextTime));
    }
  }

  pointPosition(point, time) {
    const motion = reduceMotion.matches ? 0 : 1;
    let x = point.x + Math.cos(time * 0.00023 + point.phase) * (1.2 + point.depth * 1.5) * motion;
    let y = point.y + Math.sin(time * 0.00019 + point.phase) * (1 + point.depth * 1.3) * motion;

    if (this.pointer.active && !coarsePointer.matches && !reduceMotion.matches) {
      const dx = x - this.pointer.x;
      const dy = y - this.pointer.y;
      const distance = Math.hypot(dx, dy) || 1;
      const radius = 150;
      if (distance < radius) {
        const offset = (1 - distance / radius) * 7 * point.depth;
        x += (dx / distance) * offset;
        y += (dy / distance) * offset;
      }
    }

    return { x, y };
  }

  draw(time) {
    const context = this.context;
    if (!context) return;

    this.pointer.x += (this.pointer.targetX - this.pointer.x) * 0.08;
    this.pointer.y += (this.pointer.targetY - this.pointer.y) * 0.08;
    context.clearRect(0, 0, this.width, this.height);

    const positions = this.points.map((point) => this.pointPosition(point, time));
    const threshold = Math.min(142, Math.max(108, Math.min(this.width, this.height) * 0.145));

    context.lineWidth = 0.65;
    for (let firstIndex = 0; firstIndex < positions.length; firstIndex += 1) {
      const first = positions[firstIndex];
      for (let secondIndex = firstIndex + 1; secondIndex < positions.length; secondIndex += 1) {
        const second = positions[secondIndex];
        const distance = Math.hypot(first.x - second.x, first.y - second.y);
        if (distance >= threshold) continue;
        const depth = Math.min(this.points[firstIndex].depth, this.points[secondIndex].depth);
        const alpha = (1 - distance / threshold) * 0.19 * depth;
        context.strokeStyle = `rgba(166, 157, 255, ${alpha})`;
        context.beginPath();
        context.moveTo(first.x, first.y);
        context.lineTo(second.x, second.y);
        context.stroke();
      }
    }

    for (let index = 0; index < positions.length; index += 1) {
      const point = this.points[index];
      const position = positions[index];
      const pulse = reduceMotion.matches ? 1 : 1 + Math.sin(time * 0.0012 + point.phase) * 0.06;
      context.beginPath();
      context.fillStyle = `rgba(225, 229, 255, ${point.alpha})`;
      context.shadowColor = `rgba(157, 147, 255, ${point.alpha * 0.42})`;
      context.shadowBlur = 3 + point.depth * 4;
      context.arc(position.x, position.y, point.size * pulse, 0, Math.PI * 2);
      context.fill();
    }
    context.shadowBlur = 0;
  }
}

const calmBackground = new CalmLegacyBackground();
calmBackground.init();

let avatarRequest = null;
function getAvatarUrl() {
  if (avatarRequest) return avatarRequest;
  avatarRequest = Promise.all([
    fetch(`./data/status.json?v=${Date.now()}`, { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).catch(() => null),
    fetch(`./data/bio.json?v=${Date.now()}`, { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).catch(() => null)
  ]).then(([status, bio]) => status?.player?.avatar || bio?.avatarUrl || null);
  return avatarRequest;
}

function exposeAvatar() {
  const image = document.getElementById('profileAvatar');
  const placeholder = document.getElementById('profileAvatarPlaceholder');
  if (!image) return;

  const show = () => {
    image.hidden = false;
    image.removeAttribute('hidden');
    image.style.display = 'block';
    image.style.visibility = 'visible';
    image.style.opacity = '1';
    if (placeholder) placeholder.hidden = true;
  };

  if (image.currentSrc || image.src) {
    if (image.complete && image.naturalWidth > 0) show();
    else image.addEventListener('load', show, { once: true });
  }

  getAvatarUrl().then((url) => {
    if (!url) return;
    if (image.src !== url) image.src = url;
    image.addEventListener('load', show, { once: true });
    if (image.complete && image.naturalWidth > 0) show();
  });
}

function setText(id, text) {
  const element = document.getElementById(id);
  if (element && element.textContent !== text) element.textContent = text;
  return element;
}

function markProgressIntegration(prefix) {
  const isDiscord = prefix === 'discord';
  const title = isDiscord ? 'Discord' : 'Telegram';
  const badge = document.getElementById(`${prefix}OverviewBadge`);
  if (badge) {
    badge.textContent = 'В процессе';
    badge.dataset.state = 'progress';
  }

  setText(`${prefix}OverviewStatus`, 'В процессе');
  const overviewActivity = setText(`${prefix}OverviewActivity`, `Отслеживание ${title} ещё разрабатывается.`);
  overviewActivity?.classList.add('progress-note');

  const updated = setText(`${prefix}OverviewUpdated`, 'Интеграция готовится');
  updated?.classList.add('progress-note');

  const detailStatus = setText(`${prefix}DetailMainStatus`, 'В процессе');
  detailStatus?.classList.add('progress-note');

  const detailNoteId = isDiscord ? 'discordCustomStatus' : 'telegramLastSeenText';
  const detailNote = setText(detailNoteId, `Интеграция ${title} ещё разрабатывается.`);
  detailNote?.classList.add('progress-note');

  const orb = document.getElementById(`${prefix}DetailStatusOrb`);
  if (orb) orb.dataset.state = 'progress';

  setText(isDiscord ? 'discordStatusValue' : 'telegramStatusValue', 'В процессе');
  setText(`${prefix}DetailUpdated`, 'После подключения интеграции');

  if (isDiscord) {
    setText('discordSideStatus', 'В процессе');
    setText('discordSideActivity', 'Интеграция готовится');
  } else {
    setText('telegramStatCategory', 'В процессе');
  }

  const tab = document.querySelector(`.tab-link[data-tab="${prefix}"]`);
  if (tab) tab.dataset.progressLabel = 'В процессе';
}

function restoreWordIndexes() {
  document.querySelectorAll('#profileDescription .description-word').forEach((word, index) => {
    word.style.setProperty('--word-index', String(index));
    word.style.setProperty('--word-flow-delay', `${index * -180}ms`);
  });
}

let correctionFrame = 0;
function applyCorrections() {
  if (correctionFrame) return;
  correctionFrame = requestAnimationFrame(() => {
    correctionFrame = 0;
    exposeAvatar();
    restoreWordIndexes();
    markProgressIntegration('discord');
    markProgressIntegration('telegram');
  });
}

const correctionObserver = new MutationObserver(applyCorrections);
correctionObserver.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['hidden', 'src', 'data-state']
});

applyCorrections();
window.addEventListener('hashchange', applyCorrections);
window.addEventListener('pageshow', applyCorrections);
