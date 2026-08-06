'use strict';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)');

class CalmBackground {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.points = [];
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.raf = 0;
    this.pointer = { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2, active: false };
  }

  init() {
    if (document.getElementById('legacy-calm-background')) return;
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'legacy-calm-background';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!this.ctx) return;

    const original = document.getElementById('particleCanvas');
    (original?.parentNode || document.body).insertBefore(this.canvas, original || document.body.firstChild);
    this.resize();

    addEventListener('resize', () => this.resize(), { passive: true });
    addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      this.pointer.tx = event.clientX;
      this.pointer.ty = event.clientY;
      this.pointer.active = true;
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => { this.pointer.active = false; }, { passive: true });
    document.addEventListener('visibilitychange', () => document.hidden ? this.stop() : this.start());
    reduceMotion.addEventListener?.('change', () => { this.stop(); this.resize(); this.start(); });
    this.start();
  }

  resize() {
    if (!this.ctx) return;
    this.width = Math.max(1, innerWidth);
    this.height = Math.max(1, innerHeight);
    this.dpr = Math.min(devicePixelRatio || 1, coarsePointer.matches ? 1.25 : 1.7);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const estimated = Math.round((this.width * this.height) / (coarsePointer.matches ? 18000 : 13500));
    const count = coarsePointer.matches ? Math.min(48, Math.max(28, estimated)) : Math.min(86, Math.max(48, estimated));
    const columns = Math.max(6, Math.ceil(Math.sqrt(count * Math.max(.55, this.width / this.height))));
    const rows = Math.ceil(count / columns);
    const cellWidth = this.width / columns;
    const cellHeight = this.height / rows;

    this.points = Array.from({ length: count }, (_, index) => {
      const depth = .35 + Math.random() * .65;
      return {
        x: (index % columns + .5) * cellWidth + (Math.random() - .5) * cellWidth * .46,
        y: (Math.floor(index / columns) + .5) * cellHeight + (Math.random() - .5) * cellHeight * .46,
        depth,
        size: .75 + depth * 1.35,
        alpha: .25 + depth * .48,
        phase: Math.random() * Math.PI * 2
      };
    });
    this.draw(performance.now());
  }

  position(point, time) {
    const moving = reduceMotion.matches ? 0 : 1;
    let x = point.x + Math.cos(time * .00023 + point.phase) * (1.2 + point.depth * 1.5) * moving;
    let y = point.y + Math.sin(time * .00019 + point.phase) * (1 + point.depth * 1.3) * moving;

    if (this.pointer.active && !coarsePointer.matches && moving) {
      const dx = x - this.pointer.x;
      const dy = y - this.pointer.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance < 150) {
        const offset = (1 - distance / 150) * 7 * point.depth;
        x += dx / distance * offset;
        y += dy / distance * offset;
      }
    }
    return { x, y };
  }

  draw(time) {
    if (!this.ctx) return;
    this.pointer.x += (this.pointer.tx - this.pointer.x) * .08;
    this.pointer.y += (this.pointer.ty - this.pointer.y) * .08;
    this.ctx.clearRect(0, 0, this.width, this.height);
    const positions = this.points.map((point) => this.position(point, time));
    const threshold = Math.min(142, Math.max(108, Math.min(this.width, this.height) * .145));

    this.ctx.lineWidth = .65;
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = i + 1; j < positions.length; j += 1) {
        const distance = Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y);
        if (distance >= threshold) continue;
        const alpha = (1 - distance / threshold) * .19 * Math.min(this.points[i].depth, this.points[j].depth);
        this.ctx.strokeStyle = `rgba(166,157,255,${alpha})`;
        this.ctx.beginPath();
        this.ctx.moveTo(positions[i].x, positions[i].y);
        this.ctx.lineTo(positions[j].x, positions[j].y);
        this.ctx.stroke();
      }
    }

    positions.forEach((position, index) => {
      const point = this.points[index];
      const pulse = reduceMotion.matches ? 1 : 1 + Math.sin(time * .0012 + point.phase) * .06;
      this.ctx.fillStyle = `rgba(225,229,255,${point.alpha})`;
      this.ctx.shadowColor = `rgba(157,147,255,${point.alpha * .42})`;
      this.ctx.shadowBlur = 3 + point.depth * 4;
      this.ctx.beginPath();
      this.ctx.arc(position.x, position.y, point.size * pulse, 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.shadowBlur = 0;
  }

  loop(time) {
    this.raf = 0;
    this.draw(time);
    if (!document.hidden && !reduceMotion.matches) this.raf = requestAnimationFrame((next) => this.loop(next));
  }

  start() {
    if (!this.ctx || document.hidden || this.raf) return;
    if (reduceMotion.matches) this.draw(performance.now());
    else this.raf = requestAnimationFrame((time) => this.loop(time));
  }

  stop() {
    if (!this.raf) return;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}

new CalmBackground().init();

let avatarRequest;
function requestAvatar() {
  if (avatarRequest) return avatarRequest;
  const read = (path) => fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : null)
    .catch(() => null);
  avatarRequest = Promise.all([read('./data/status.json'), read('./data/bio.json')])
    .then(([status, bio]) => status?.player?.avatar || bio?.avatarUrl || null);
  return avatarRequest;
}

function exposeAvatar() {
  const image = document.getElementById('profileAvatar');
  const placeholder = document.getElementById('profileAvatarPlaceholder');
  if (!image) return;

  const show = () => {
    image.hidden = false;
    image.removeAttribute('hidden');
    image.style.cssText += ';display:block;visibility:visible;opacity:1';
    if (placeholder) placeholder.hidden = true;
  };

  if (image.complete && image.naturalWidth > 0) show();
  else image.addEventListener('load', show, { once: true });

  requestAvatar().then((url) => {
    if (!url) return;
    if (image.src !== url) image.src = url;
    if (image.complete && image.naturalWidth > 0) show();
    else image.addEventListener('load', show, { once: true });
  });
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element && element.textContent !== value) element.textContent = value;
  return element;
}

function setState(element, value) {
  if (element && element.dataset.state !== value) element.dataset.state = value;
}

function markProgress(prefix) {
  const title = prefix === 'discord' ? 'Discord' : 'Telegram';
  const badge = document.getElementById(`${prefix}OverviewBadge`);
  if (badge) {
    if (badge.textContent !== 'В процессе') badge.textContent = 'В процессе';
    setState(badge, 'progress');
  }

  setText(`${prefix}OverviewStatus`, 'В процессе');
  setText(`${prefix}OverviewActivity`, `Отслеживание ${title} ещё разрабатывается.`)?.classList.add('progress-note');
  setText(`${prefix}OverviewUpdated`, 'Интеграция готовится')?.classList.add('progress-note');
  setText(`${prefix}DetailMainStatus`, 'В процессе')?.classList.add('progress-note');
  setText(prefix === 'discord' ? 'discordCustomStatus' : 'telegramLastSeenText', `Интеграция ${title} ещё разрабатывается.`)?.classList.add('progress-note');
  setState(document.getElementById(`${prefix}DetailStatusOrb`), 'progress');
  setText(prefix === 'discord' ? 'discordStatusValue' : 'telegramStatusValue', 'В процессе');
  setText(`${prefix}DetailUpdated`, 'После подключения интеграции');

  if (prefix === 'discord') {
    setText('discordSideStatus', 'В процессе');
    setText('discordSideActivity', 'Интеграция готовится');
  } else {
    setText('telegramStatCategory', 'В процессе');
  }

  const tab = document.querySelector(`.tab-link[data-tab="${prefix}"]`);
  if (tab && tab.dataset.progressLabel !== 'В процессе') tab.dataset.progressLabel = 'В процессе';
}

function restoreWordIndexes() {
  document.querySelectorAll('#profileDescription .description-word').forEach((word, index) => {
    if (word.style.getPropertyValue('--word-index') !== String(index)) word.style.setProperty('--word-index', String(index));
    const delay = `${index * -180}ms`;
    if (word.style.getPropertyValue('--word-flow-delay') !== delay) word.style.setProperty('--word-flow-delay', delay);
  });
}

let scheduled = 0;
function applyCorrections() {
  if (scheduled) return;
  scheduled = requestAnimationFrame(() => {
    scheduled = 0;
    exposeAvatar();
    restoreWordIndexes();
    markProgress('discord');
    markProgress('telegram');
  });
}

new MutationObserver(applyCorrections).observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['hidden', 'src']
});

applyCorrections();
addEventListener('hashchange', applyCorrections);
addEventListener('pageshow', applyCorrections);
