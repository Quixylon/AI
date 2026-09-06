'use strict';

// All panel transforms have one owner. Pointer events only update a target;
// time-based interpolation keeps motion identical at different refresh rates.
class MotionController {
  constructor() {
    this.items = [];
    this.pointer = { x: 0, y: 0, active: false };
    this.raf = 0;
    this.lastFrame = 0;
    this.dirty = true;
    this.selector = '.panel, .social-link, .status-pill, .tracker-topbar, .platform-card, .detail-card, .stats-card, .history-panel, .data-item, .action-button, .ghost-button, .back-link, .tab-link, .filter-button, .copy-button';
  }
  registerAll() {
    const previous = new Map(this.items.map(item => [item.element, item]));
    this.items = [...document.querySelectorAll(this.selector)].map(element => {
      element.classList.add('tilt-surface');
      return previous.get(element) || { element, x: 0, y: 0, light: 0, rect: null };
    });
    this.measureSoon();
  }
  measure() {
    // Cache layout only when invalidated, never in the pointermove handler.
    for (const item of this.items) {
      item.rect = item.element.closest('[hidden]') ? null : item.element.getBoundingClientRect();
    }
    this.dirty = false;
  }
  measureSoon() { this.dirty = true; this.wake(); }
  updatePointer(x, y, active = true) {
    if (REDUCED_MOTION.matches || COARSE_POINTER.matches) return;
    this.pointer = { x, y, active };
    this.wake();
  }
  wake() {
    if (this.raf || document.hidden || REDUCED_MOTION.matches || COARSE_POINTER.matches) return;
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(time => this.frame(time));
  }
  frame(time) {
    this.raf = 0;
    if (this.dirty) this.measure();
    const dt = Math.min(.05, Math.max(0, (time - this.lastFrame) / 1000));
    this.lastFrame = time;
    const blend = 1 - Math.exp(-11 * dt);
    const { x, y, active } = this.pointer;
    let unsettled = false;
    for (const item of this.items) {
      const r = item.rect;
      if (!r || !r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
      const nx = Math.max(-1, Math.min(1, (x - r.left - r.width / 2) / Math.max(100, r.width / 2)));
      const ny = Math.max(-1, Math.min(1, (y - r.top - r.height / 2) / Math.max(100, r.height / 2)));
      const distance = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
      const influence = active ? Math.max(0, 1 - distance / 480) : 0;
      const max = item.element.classList.contains('panel') ? 1.5 : item.element.matches('.platform-card,.detail-card,.stats-card,.history-panel,.tracker-topbar') ? 1.6 : 2.2;
      const tx = -ny * max * influence, ty = nx * max * influence;
      const light = active && distance === 0 ? 1 : 0;
      item.x += (tx - item.x) * blend;
      item.y += (ty - item.y) * blend;
      item.light += (light - item.light) * blend;
      const moving = Math.abs(tx - item.x) + Math.abs(ty - item.y) + Math.abs(light - item.light) > .006;
      if (!moving) { item.x = tx; item.y = ty; item.light = light; }
      unsettled ||= moving;
      const style = item.element.style;
      style.setProperty('--tilt-x', `${item.x.toFixed(3)}deg`);
      style.setProperty('--tilt-y', `${item.y.toFixed(3)}deg`);
      style.setProperty('--light-x', `${Math.max(0, Math.min(100, (x - r.left) / r.width * 100)).toFixed(1)}%`);
      style.setProperty('--light-y', `${Math.max(0, Math.min(100, (y - r.top) / r.height * 100)).toFixed(1)}%`);
      style.setProperty('--light-opacity', item.light.toFixed(3));
      item.element.classList.toggle('is-tilting', moving);
    }
    if (unsettled) this.raf = requestAnimationFrame(next => this.frame(next));
  }
  reset(immediate = false) {
    this.pointer.active = false;
    if (immediate || REDUCED_MOTION.matches || COARSE_POINTER.matches || document.hidden) {
      cancelAnimationFrame(this.raf); this.raf = 0;
      for (const item of this.items) {
        item.x = item.y = item.light = 0;
        item.element.style.setProperty('--tilt-x', '0deg');
        item.element.style.setProperty('--tilt-y', '0deg');
        item.element.style.setProperty('--light-opacity', '0');
        item.element.classList.remove('is-tilting');
      }
    } else this.wake();
  }
}
const motionController = new MotionController();

class CanvasController {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext('2d');
    this.raf = 0;
    this.running = false;
    this.elapsed = 0;
    this.lastFrame = 0;
    this.lastDraw = 0;
    this.particles = [];
    this.pointer = { x: 0, y: 0, rx: 0, ry: 0, active: false };
  }
  init() { this.resize(); this.resume(); }
  resize() {
    if (!this.ctx) return;
    this.width = Math.max(1, innerWidth);
    this.height = Math.max(1, innerHeight);
    this.mobile = COARSE_POINTER.matches || this.width <= 760;
    const dpr = Math.min(devicePixelRatio || 1, this.mobile ? 1.5 : 2);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(this.mobile ? 24 : 65, Math.round(this.width * this.height / 19000));
    // Stable seeds avoid particles jumping randomly after mobile toolbar resize.
    this.particles = Array.from({ length: count }, (_, i) => ({
      u: ((i * 137.508 + 23) % 997) / 997,
      v: ((i * 213.733 + 89) % 991) / 991,
      radius: .8 + (i % 5) * .23,
      depth: .3 + (i % 7) * .1,
      phase: i * 2.39996
    }));
    this.draw();
  }
  setPointer(x, y, { type = 'mouse' } = {}) {
    if (type === 'touch' || this.mobile || REDUCED_MOTION.matches) return;
    this.pointer.x = x; this.pointer.y = y; this.pointer.active = true;
  }
  setDown() {} // Kept for the existing lifecycle interface; no click storm.
  leave() { this.pointer.active = false; }
  start() {
    if (!this.ctx || this.running || document.hidden || REDUCED_MOTION.matches) return;
    this.running = true; this.lastFrame = performance.now(); this.lastDraw = 0;
    this.raf = requestAnimationFrame(time => this.frame(time));
  }
  frame(time) {
    if (!this.running) return;
    const frameInterval = this.mobile ? 1000 / 30 : 1000 / 60;
    if (time - this.lastDraw >= frameInterval - .75) {
      const dt = Math.min(.1, Math.max(0, (time - this.lastFrame) / 1000));
      this.elapsed += dt; this.lastFrame = time; this.lastDraw = time;
      const blend = 1 - Math.exp(-3 * dt);
      const targetX = this.pointer.active ? this.pointer.x / this.width - .5 : 0;
      const targetY = this.pointer.active ? this.pointer.y / this.height - .5 : 0;
      this.pointer.rx += (targetX - this.pointer.rx) * blend;
      this.pointer.ry += (targetY - this.pointer.ry) * blend;
      this.draw();
    }
    this.raf = requestAnimationFrame(next => this.frame(next));
  }
  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.elapsed;
    ctx.clearRect(0, 0, this.width, this.height);
    const points = [];
    for (const p of this.particles) {
      const x = p.u * this.width + Math.sin(t * .16 + p.phase) * 26 + this.pointer.rx * p.depth * 22;
      const y = p.v * this.height + Math.cos(t * .12 + p.phase) * 23 + this.pointer.ry * p.depth * 18;
      points.push({ x, y });
      const alpha = .4 + (.5 + Math.sin(t * .6 + p.phase) * .5) * .4;
      ctx.fillStyle = `rgba(180,204,238,${alpha})`;
      ctx.beginPath(); ctx.arc(x, y, p.radius, 0, Math.PI * 2); ctx.fill();
      if (!this.mobile && this.pointer.active) {
        const distance = Math.hypot(x - this.pointer.x, y - this.pointer.y);
        if (distance < 160) {
          ctx.strokeStyle = `rgba(151,190,235,${(1 - distance / 160) * .14})`;
          ctx.lineWidth = .65;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(this.pointer.x, this.pointer.y); ctx.stroke();
        }
      }
    }
    // A sparse moving constellation remains visible without a mouse pointer.
    const reach = this.mobile ? 145 : 185;
    for (let i = 0; i < points.length; i++) {
      let connections = 0;
      for (let j = i + 1; j < points.length && connections < 2; j++) {
        const a = points[i], b = points[j];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance >= reach) continue;
        ctx.strokeStyle = `rgba(158,190,230,${(1 - distance / reach) * .28})`;
        ctx.lineWidth = .7;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        connections++;
      }
    }
  }
  drawStatic() { this.stop(); this.pointer.rx = this.pointer.ry = 0; this.pointer.active = false; this.elapsed = 0; this.draw(); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); this.raf = 0; }
  resume() { if (REDUCED_MOTION.matches) this.drawStatic(); else this.start(); }
  destroy() { this.stop(); }
}
const canvasController = new CanvasController(byId('particleCanvas'));

class InteractionHub {
  constructor() { this.bound = false; this.resizeTimer = 0; }
  onMove = event => {
    if (event.pointerType === 'touch') return;
    canvasController.setPointer(event.clientX, event.clientY, { type: event.pointerType });
    motionController.updatePointer(event.clientX, event.clientY);
  };
  onLeave = () => { canvasController.leave(); motionController.reset(); };
  onOut = event => { if (!event.relatedTarget) this.onLeave(); };
  onResize = () => {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => { canvasController.resize(); motionController.measureSoon(); }, 100);
  };
  onScroll = () => motionController.measureSoon();
  onCapabilities = () => { motionController.reset(true); canvasController.resize(); motionController.measureSoon(); };
  init() {
    if (this.bound) return;
    this.bound = true;
    addEventListener('pointermove', this.onMove, { passive: true });
    addEventListener('pointerout', this.onOut, { passive: true });
    addEventListener('blur', this.onLeave);
    addEventListener('resize', this.onResize, { passive: true });
    // Capture nested history scrolls as well as document scrolling.
    addEventListener('scroll', this.onScroll, { passive: true, capture: true });
    COARSE_POINTER.addEventListener?.('change', this.onCapabilities);
  }
  destroy() {
    this.bound = false;
    clearTimeout(this.resizeTimer);
    removeEventListener('pointermove', this.onMove);
    removeEventListener('pointerout', this.onOut);
    removeEventListener('blur', this.onLeave);
    removeEventListener('resize', this.onResize);
    removeEventListener('scroll', this.onScroll, true);
    COARSE_POINTER.removeEventListener?.('change', this.onCapabilities);
    motionController.reset(true);
  }
}
const interactionHub = new InteractionHub();
