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
      const light = active ? Math.max(0, 1 - distance / 85) : 0;
      item.x += (tx - item.x) * blend;
      item.y += (ty - item.y) * blend;
      item.light += (light - item.light) * blend;
      const moving = Math.abs(tx - item.x) + Math.abs(ty - item.y) + Math.abs(light - item.light) > .006;
      if (!moving) { item.x = tx; item.y = ty; item.light = light; }
      unsettled ||= moving;
      const style = item.element.style;
      style.setProperty('--tilt-x', `${item.x.toFixed(3)}deg`);
      style.setProperty('--tilt-y', `${item.y.toFixed(3)}deg`);
      style.setProperty('--light-x', `${(x - r.left).toFixed(1)}px`);
      style.setProperty('--light-y', `${(y - r.top).toFixed(1)}px`);
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
    this.ctx = canvas?.getContext('2d', { alpha: false });
    this.raf = 0;
    this.running = false;
    this.lastFrame = 0;
    this.lastDraw = 0;
    this.particles = [];
    this.ripples = [];
    this.spot = { x: 0, y: 0, strength: 0 };
    this.pointer = { x: 0, y: 0, active: false };
    this.clock = 0;
    this.lens = typeof GlassRenderer === 'function' ? new GlassRenderer(byId('glassCanvas')) : null;
    if (this.lens) this.lens.onRestore = () => this.draw();
  }
  init() { this.lens?.init(); this.resize(); this.pulse(this.width * .5, this.height * .45, .65); this.resume(); }
  resize() {
    if (!this.ctx) return;
    this.width = Math.max(1, innerWidth);
    this.height = Math.max(1, innerHeight);
    this.mobile = COARSE_POINTER.matches || this.width <= 760;
    // Same quality on phones and desktop; only exceptionally large viewports
    // share a pixel budget, rather than downgrading every touch screen.
    const dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(6000000 / (this.width * this.height)));
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Every dot has a fixed home in a regular lattice, including after resize.
    const budget = 2400;
    let gap = this.mobile ? 30 : 32;
    while (Math.ceil(this.width / gap) * Math.ceil(this.height / gap) > budget) gap++;
    this.spacing = gap;
    this.particles = [];
    for (let y = gap / 2; y < this.height; y += gap) {
      for (let x = gap / 2; x < this.width; x += gap) {
        this.particles.push({ homeX: x, homeY: y, x, y, light: 0 });
      }
    }
    this.draw();
    this.resume();
  }
  setPointer(x, y) {
    if (REDUCED_MOTION.matches) return;
    if (!this.pointer.active && this.spot.strength < .01) { this.spot.x = x; this.spot.y = y; }
    this.pointer = { x, y, active: true };
    this.start();
  }
  pulse(x, y, strength = 1) {
    if (REDUCED_MOTION.matches || document.hidden) return;
    this.ripples.push({ x, y, age: 0, strength });
    this.ripples = this.ripples.slice(-3);
    this.start();
  }
  leave() { this.pointer.active = false; if (REDUCED_MOTION.matches) this.draw(); else this.start(); }
  start() {
    if (!this.ctx || this.running || document.hidden || REDUCED_MOTION.matches) return;
    this.running = true;
    this.lastFrame = performance.now();
    this.lastDraw = 0;
    this.raf = requestAnimationFrame(time => this.frame(time));
  }
  frame(time) {
    if (!this.running) return;
    const interval = 1000 / 60;
    if (time - this.lastDraw < interval - .75) {
      this.raf = requestAnimationFrame(next => this.frame(next));
      return;
    }
    const dt = Math.min(.1, Math.max(0, (time - this.lastFrame) / 1000));
    this.lastFrame = this.lastDraw = time;
    this.clock += dt;
    const blend = 1 - Math.exp(-10 * dt);
    const reach = 220;
    const glowTarget = this.pointer.active ? 1 : 0;
    this.spot.x += (this.pointer.x - this.spot.x) * blend;
    this.spot.y += (this.pointer.y - this.spot.y) * blend;
    this.spot.strength += (glowTarget - this.spot.strength) * blend;
    if (Math.abs(glowTarget - this.spot.strength) < .002) this.spot.strength = glowTarget;
    for (const ripple of this.ripples) ripple.age += dt;
    this.ripples = this.ripples.filter(ripple => ripple.age < 2.4);
    for (const p of this.particles) {
      const dx = p.homeX - this.pointer.x, dy = p.homeY - this.pointer.y;
      const distance = Math.hypot(dx, dy);
      const proximity = this.pointer.active ? Math.max(0, 1 - distance / reach) : 0;
      const influence = proximity * proximity * (3 - 2 * proximity);
      const offset = 24 * influence;
      let x = p.homeX + dx / Math.max(1, distance) * offset;
      let y = p.homeY + dy / Math.max(1, distance) * offset;
      let light = influence;
      for (const ripple of this.ripples) {
        const rx = p.homeX - ripple.x, ry = p.homeY - ripple.y;
        const radius = Math.hypot(rx, ry);
        const crest = Math.exp(-(((radius - ripple.age * 360) / 40) ** 2)) * (1 - ripple.age / 2.4) * ripple.strength;
        const shift = crest * 16;
        x += rx / Math.max(1, radius) * shift;
        y += ry / Math.max(1, radius) * shift;
        light = Math.min(1.3, light + crest);
      }
      p.x += (x - p.x) * blend;
      p.y += (y - p.y) * blend;
      p.light += (light - p.light) * blend;
      const moving = Math.abs(x - p.x) + Math.abs(y - p.y) + Math.abs(light - p.light) > .008;
      if (!moving) { p.x = x; p.y = y; p.light = light; }
    }
    this.draw();
    // Ambient light and refraction follow the floating surfaces even at rest.
    // Visibility and reduced-motion handlers stop this single scene loop.
    this.raf = requestAnimationFrame(next => this.frame(next));
  }
  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#080e19';
    ctx.fillRect(0, 0, this.width, this.height);
    const t = this.clock;
    const extent = Math.max(this.width, this.height);
    const pools = [
      [.18 + Math.sin(t * .09) * .10, .23 + Math.cos(t * .08) * .13, .64, '44,104,150', .30],
      [.80 + Math.cos(t * .07) * .12, .68 + Math.sin(t * .10) * .14, .57, '101,79,157', .26],
      [.48 + Math.sin(t * .06) * .17, .87 + Math.cos(t * .09) * .09, .44, '37,128,133', .18]
    ];
    for (const [x, y, size, color, alpha] of pools) {
      const glow = ctx.createRadialGradient(x * this.width, y * this.height, 0, x * this.width, y * this.height, extent * size);
      glow.addColorStop(0, `rgba(${color},${alpha})`);
      glow.addColorStop(.5, `rgba(${color},${alpha * .42})`);
      glow.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = glow; ctx.fillRect(0, 0, this.width, this.height);
    }
    if (this.spot.strength > .005) {
      const radius = 330;
      const glow = ctx.createRadialGradient(this.spot.x, this.spot.y, 0, this.spot.x, this.spot.y, radius);
      glow.addColorStop(0, `rgba(83,168,229,${this.spot.strength * .16})`);
      glow.addColorStop(.45, `rgba(86,118,216,${this.spot.strength * .07})`);
      glow.addColorStop(1, 'rgba(86,118,216,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    for (const p of this.particles) {
      // Brightness rolls through a fixed lattice; it never becomes scattered lines.
      const tide = .5 + .5 * Math.sin(p.homeX * .006 + p.homeY * .004 - t * .55);
      const crest = Math.pow(tide, 6);
      const light = p.light + crest * .38;
      const motion = REDUCED_MOTION.matches ? 0 : 1;
      const x = p.x + Math.sin(p.homeY * .009 + t * .44) * 8 * motion;
      const y = p.y + Math.sin(p.homeX * .007 - t * .56) * 10 * motion;
      const depth = .78 + .22 * Math.cos(p.homeY / this.height * Math.PI);
      if (light > .10) {
        ctx.fillStyle = `rgba(139,193,245,${light * .085})`;
        ctx.beginPath(); ctx.arc(x, y, 3 + light * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = `rgba(${Math.round(151 + tide * 26)},${Math.round(186 + tide * 22)},228,${Math.min(.95, .38 + light * .55) * depth})`;
      ctx.beginPath(); ctx.arc(x, y, 1.10 + light * .85, 0, Math.PI * 2); ctx.fill();
    }
    this.lens?.draw(this.canvas, this.width, this.height);
  }
  drawStatic() {
    this.stop(); this.pointer.active = false; this.ripples = []; this.spot.strength = 0;
    for (const p of this.particles) { p.x = p.homeX; p.y = p.homeY; p.light = 0; }
    this.draw();
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); this.raf = 0; }
  resume() { if (REDUCED_MOTION.matches) this.drawStatic(); else this.start(); }
  destroy() { this.stop(); }
}
const canvasController = new CanvasController(byId('particleCanvas'));

class InteractionHub {
  constructor() { this.bound = false; this.resizeTimer = 0; }
  onMove = event => {
    canvasController.setPointer(event.clientX, event.clientY, { type: event.pointerType });
    if (event.pointerType !== 'touch') motionController.updatePointer(event.clientX, event.clientY);
  };
  onDown = event => {
    if (event.button !== 0) return;
    if (event.pointerType === 'touch') canvasController.setPointer(event.clientX, event.clientY);
    canvasController.pulse(event.clientX, event.clientY);
  };
  onUp = event => { if (event.pointerType === 'touch') canvasController.leave(); };
  onLeave = () => { canvasController.leave(); motionController.reset(); };
  onOut = event => { if (!event.relatedTarget) this.onLeave(); };
  onResize = () => {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => { canvasController.resize(); motionController.measureSoon(); }, 100);
  };
  onScroll = () => { motionController.measureSoon(); if (REDUCED_MOTION.matches) canvasController.draw(); };
  onCapabilities = () => { motionController.reset(true); canvasController.resize(); motionController.measureSoon(); };
  init() {
    if (this.bound) return;
    this.bound = true;
    addEventListener('pointermove', this.onMove, { passive: true });
    addEventListener('pointerdown', this.onDown, { passive: true });
    addEventListener('pointerup', this.onUp, { passive: true });
    addEventListener('pointercancel', this.onUp, { passive: true });
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
    removeEventListener('pointerdown', this.onDown);
    removeEventListener('pointerup', this.onUp);
    removeEventListener('pointercancel', this.onUp);
    removeEventListener('pointerout', this.onOut);
    removeEventListener('blur', this.onLeave);
    removeEventListener('resize', this.onResize);
    removeEventListener('scroll', this.onScroll, true);
    COARSE_POINTER.removeEventListener?.('change', this.onCapabilities);
    motionController.reset(true);
  }
}
const interactionHub = new InteractionHub();
