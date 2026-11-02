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
      const max = item.element.classList.contains('panel') ? 2.05 : item.element.matches('.platform-card,.detail-card,.stats-card,.history-panel,.tracker-topbar') ? 2.15 : 2.5;
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

// Interaction distances are CSS pixels, independent of canvas backing density.
const POINTER_LINKS = Object.freeze({ radius: 180, count: 5, growMs: 200, hysteresis: 12 });
class CanvasController {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext('2d', { alpha: false });
    this.particles = []; this.links = new Map();
    this.pointer = { x: 0, y: 0, active: false };
    this.spot = { x: 0, y: 0, strength: 0 };
    this.clock = 0; this.running = false; this.raf = 0;
    this.lens = typeof GlassRenderer === 'function' ? new GlassRenderer(byId('glassCanvas')) : null;
    if (this.lens) this.lens.onRestore = () => this.draw();
  }
  init() { this.lens?.init(); this.resize(); }
  resize() {
    if (!this.ctx) return;
    this.release();
    this.width = Math.max(1, innerWidth); this.height = Math.max(1, innerHeight);
    const dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(4000000 / (this.width * this.height)));
    this.canvas.width = Math.round(this.width * dpr); this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.spacing = Math.max(36, Math.ceil(Math.sqrt(this.width * this.height / 1600)));
    this.particles = [];
    for (let y = this.spacing / 2; y < this.height; y += this.spacing)
      for (let x = this.spacing / 2; x < this.width; x += this.spacing)
        this.particles.push({ x, y, homeX: x, homeY: y });
    this.draw(); this.resume();
  }
  projectDot(p) {
    if (REDUCED_MOTION.matches) return { x: p.homeX, y: p.homeY };
    return { x: p.homeX + Math.sin(p.homeY * .005 - this.clock * .65) * 9,
      y: p.homeY + Math.sin(p.homeX * .004 + this.clock * .55) * 10 };
  }
  setPointer(x, y) {
    this.pointer.x = x; this.pointer.y = y;
    this.spot = { x, y, strength: 1 };
    if (REDUCED_MOTION.matches) this.draw();
  }
  connectAt(x, y) {
    if (document.hidden) return;
    this.pointer.active = true; this.setPointer(x, y); this.draw(); this.start();
  }
  release() { this.pointer.active = false; this.links.clear(); if(this.canvas?.dataset)this.canvas.dataset.connections='0'; }
  leave() { this.release(); this.spot.strength = 0; if (REDUCED_MOTION.matches) this.draw(); }
  updateLinks(points, now) {
    if (!this.pointer.active) { this.links.clear(); return; }
    const { x, y } = this.pointer;
    const candidates = points.map((p, index) => ({ index, distance: Math.hypot(p.x-x, p.y-y) }))
      .filter(p => p.distance <= POINTER_LINKS.radius)
      .sort((a,b) => (a.distance-(this.links.has(a.index)?POINTER_LINKS.hysteresis:0)) -
        (b.distance-(this.links.has(b.index)?POINTER_LINKS.hysteresis:0)) || a.index-b.index)
      .slice(0, POINTER_LINKS.count);
    const selected = new Set(candidates.map(p => p.index));
    for (const index of this.links.keys()) if (!selected.has(index)) this.links.delete(index);
    for (const { index } of candidates) if (!this.links.has(index)) this.links.set(index, now);
  }
  draw() {
    if (!this.ctx || document.hidden) return;
    const ctx = this.ctx, points = this.particles.map(p => this.projectDot(p));
    ctx.fillStyle = '#101319'; ctx.fillRect(0, 0, this.width, this.height);
    this.updateLinks(points, performance.now());
    if (this.canvas.dataset && this.canvas.dataset.connections !== String(this.links.size))
      this.canvas.dataset.connections = String(this.links.size);
    for (let i = 0; i < points.length; i++) {
      const { x, y } = points[i];
      ctx.fillStyle = this.links.has(i) ? '#d5c39a' : 'rgba(170,184,202,.32)';
      ctx.beginPath(); ctx.arc(x, y, this.links.has(i) ? 1.8 : 1, 0, Math.PI*2); ctx.fill();
    }
    for (const [index, born] of this.links) {
      const p = points[index], { x, y } = this.pointer;
      const t = REDUCED_MOTION.matches ? 1 : Math.min(1, (performance.now()-born)/POINTER_LINKS.growMs);
      const reach = 1-(1-t)**3;
      ctx.strokeStyle = 'rgba(220,205,170,.72)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+(p.x-x)*reach,y+(p.y-y)*reach); ctx.stroke();
    }
    this.lens?.draw(this.canvas, this.width, this.height, this.spot);
  }
  frame(time) {
    if (!this.running) return;
    if (time-this.lastDraw >= 1000/60-.75) {
      this.clock += Math.min(.05, Math.max(0,(time-this.lastDraw)/1000));
      this.lastDraw = time; this.draw();
    }
    this.raf = requestAnimationFrame(next => this.frame(next));
  }
  start() {
    if (!this.ctx || this.running || document.hidden || REDUCED_MOTION.matches) return;
    this.running = true; this.lastDraw = performance.now();
    this.raf = requestAnimationFrame(time => this.frame(time));
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); this.raf = 0; this.release(); }
  drawStatic() { this.stop(); this.spot.strength = 0; this.draw(); }
  resume() { if (REDUCED_MOTION.matches) this.drawStatic(); else this.start(); }
  destroy() { this.stop(); }
}
const canvasController = new CanvasController(byId('particleCanvas'));

class InteractionHub {
  constructor() { this.bound = false; this.resizeTimer = 0; this.pointerId = null; this.captureTarget = null; }
  blocked(target) {
    // Text remains selectable. Only unused page/panel space starts the effect.
    return !!target?.closest?.('a,button,input,textarea,select,summary,label,[role="button"],[role="tab"],[contenteditable],h1,h2,h3,h4,p,span,img');
  }
  onMove = event => {
    if (this.pointerId !== null && event.pointerId !== this.pointerId) return;
    if (event.pointerType === 'mouse' && this.pointerId !== null && !(event.buttons & 1)) this.onLeave();
    if (event.pointerType === 'touch' && this.pointerId === null) return;
    canvasController.setPointer(event.clientX, event.clientY);
    if (event.pointerType !== 'touch') motionController.updatePointer(event.clientX, event.clientY);
  };
  onDown = event => {
    if (event.button !== 0 || event.isPrimary === false || this.pointerId !== null || this.blocked(event.target)) return;
    this.pointerId = event.pointerId;
    // Capture only mouse; native touch panning keeps its default gesture ownership.
    if (event.pointerType === 'mouse' && event.target?.setPointerCapture) {
      try { event.target.setPointerCapture(event.pointerId); this.captureTarget = event.target; } catch {}
    }
    canvasController.connectAt(event.clientX, event.clientY);
  };
  onUp = event => { if (event.pointerId === this.pointerId) this.onLeave(); };
  onLeave = () => {
    const id = this.pointerId, target = this.captureTarget;
    this.pointerId = null; this.captureTarget = null;
    if (target?.hasPointerCapture?.(id)) target.releasePointerCapture(id);
    canvasController.leave(); motionController.reset(true);
  };
  onOut = event => { if (!event.relatedTarget) this.onLeave(); };
  onVisibility = () => { if (document.hidden) this.onLeave(); };
  onResize = () => {
    this.onLeave(); clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => { canvasController.resize(); motionController.measureSoon(); }, 100);
  };
  onScroll = () => { this.onLeave(); motionController.measureSoon(); if (REDUCED_MOTION.matches) canvasController.draw(); };
  onCapabilities = () => { this.onLeave(); canvasController.resize(); };
  init() {
    if (this.bound) return;
    this.bound = true;
    this.bindings = [['pointermove',this.onMove],['pointerdown',this.onDown],['pointerup',this.onUp],
      ['pointercancel',this.onUp],['lostpointercapture',this.onUp],['pointerout',this.onOut],
      ['blur',this.onLeave],['pagehide',this.onLeave],['resize',this.onResize]];
    for (const [name,handler] of this.bindings) addEventListener(name,handler,{ passive:true });
    addEventListener('scroll',this.onScroll,{ passive:true,capture:true });
    document.addEventListener('visibilitychange',this.onVisibility);
    COARSE_POINTER.addEventListener?.('change',this.onCapabilities);
  }
  destroy() {
    this.bound = false; this.onLeave(); clearTimeout(this.resizeTimer);
    for (const [name,handler] of this.bindings || []) removeEventListener(name,handler);
    removeEventListener('scroll',this.onScroll,true);
    document.removeEventListener('visibilitychange',this.onVisibility);
    COARSE_POINTER.removeEventListener?.('change',this.onCapabilities);
  }
}
const interactionHub = new InteractionHub();
