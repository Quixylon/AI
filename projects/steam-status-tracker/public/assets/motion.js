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
    this.wake = [];
    this.wakeAnchor = null;
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
    let gap = 30;
    while (Math.ceil(this.width / gap) * Math.ceil(this.height / gap) > budget) gap++;
    this.spacing = gap;
    this.particles = [];
    for (let y = gap / 2; y < this.height; y += gap) {
      for (let x = gap / 2; x < this.width; x += gap) {
        this.particles.push({ homeX: x, homeY: y, x, y, vx: 0, vy: 0, light: 0 });
      }
    }
    this.draw();
    this.resume();
  }
  setPointer(x, y) {
    if (REDUCED_MOTION.matches) return;
    const now=performance.now(),anchor=this.wakeAnchor;
    if(anchor) {
      const dx=x-anchor.x,dy=y-anchor.y,distance=Math.hypot(dx,dy),elapsed=now-anchor.at;
      if(distance>2 && elapsed>=24) {
        // Accumulate skipped pointer events; use velocity so high polling-rate
        // mice produce the same soft wake as a slower mouse or a finger.
        this.wake.push({x,y,dx:dx/distance,dy:dy/distance,age:0,power:Math.min(1,distance/Math.max(1,elapsed)/.7)});
        this.wake=this.wake.slice(-16);
        this.wakeAnchor={x,y,at:now};
      } else if(distance<=2 && elapsed>80) this.wakeAnchor={x,y,at:now};
    } else this.wakeAnchor={x,y,at:now};
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
  leave() { this.pointer.active = false; this.wakeAnchor = null; if (REDUCED_MOTION.matches) this.draw(); else this.start(); }
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
    for (const sample of this.wake) sample.age+=dt;
    this.wake=this.wake.filter(sample=>sample.age<1.6);
    for (const ripple of this.ripples) ripple.age += dt;
    this.ripples = this.ripples.filter(ripple => ripple.age < 2.4);
    const flowX=Math.max(-20,Math.min(20,this.pointer.x-this.spot.x))*.1;
    const flowY=Math.max(-20,Math.min(20,this.pointer.y-this.spot.y))*.1;
    const maxOffset=this.spacing*.18;
    // Exact damped-spring step: no frame-dependent Euler integration.
    const damping=12, frequency=16, decay=Math.exp(-damping*dt);
    const cosine=Math.cos(frequency*dt), sine=Math.sin(frequency*dt);
    for (const p of this.particles) {
      const dx = p.homeX - this.pointer.x, dy = p.homeY - this.pointer.y;
      const distance = Math.hypot(dx, dy);
      const proximity = this.pointer.active ? Math.max(0, 1 - distance / reach) : 0;
      const influence = proximity * proximity * (3 - 2 * proximity);
      const offset = 7 * influence;
      let x = p.homeX + dx / (distance+45) * offset + flowX*influence;
      let y = p.homeY + dy / (distance+45) * offset + flowY*influence;
      let light = influence*.65;
      for (const ripple of this.ripples) {
        const rx = p.homeX - ripple.x, ry = p.homeY - ripple.y;
        const radius = Math.hypot(rx, ry);
        const crest = Math.exp(-(((radius - ripple.age * 360) / 40) ** 2)) * (1 - ripple.age / 2.4) * ripple.strength;
        const shift = crest * 4.5;
        x += rx / Math.max(1, radius) * shift;
        y += ry / Math.max(1, radius) * shift;
        light = Math.max(light,crest*.7);
      }
      let wakeLight=0;
      for(const sample of this.wake) {
        const wx=p.homeX-sample.x,wy=p.homeY-sample.y;
        const along=wx*sample.dx+wy*sample.dy,across=wx*sample.dy-wy*sample.dx;
        const falloff=Math.exp(-(along*along/6400+across*across/1600));
        const life=(1-sample.age/1.6)**2;
        // Light may trail the pointer, but samples never accumulate forces or
        // brightness. Repeated passes cannot bunch dots into luminous clouds.
        wakeLight=Math.max(wakeLight,falloff*life*sample.power*.5);
      }
      light=Math.max(light,wakeLight);
      const offsetScale=Math.min(1,maxOffset/Math.max(.001,Math.hypot(x-p.homeX,y-p.homeY)));
      x=p.homeX+(x-p.homeX)*offsetScale;y=p.homeY+(y-p.homeY)*offsetScale;
      const ex=p.x-x, ey=p.y-y;
      const vx=p.vx, vy=p.vy;
      p.x=x+decay*(ex*cosine+(vx+damping*ex)/frequency*sine);
      p.y=y+decay*(ey*cosine+(vy+damping*ey)/frequency*sine);
      p.vx=decay*(vx*cosine-(damping*vx+400*ex)/frequency*sine);
      p.vy=decay*(vy*cosine-(damping*vy+400*ey)/frequency*sine);
      // Bound spring overshoot too, including a rapid reversal of the cursor.
      const excursion=Math.hypot(p.x-p.homeX,p.y-p.homeY);
      if(excursion>maxOffset) {
        p.x=p.homeX+(p.x-p.homeX)*maxOffset/excursion;
        p.y=p.homeY+(p.y-p.homeY)*maxOffset/excursion;
        p.vx=p.vy=0;
      }
      p.light += (light - p.light) * blend;
      const moving = Math.abs(x - p.x) + Math.abs(y - p.y) + Math.abs(light - p.light) + (Math.abs(p.vx)+Math.abs(p.vy))*.02 > .008;
      if (!moving) { p.x = x; p.y = y; p.vx=p.vy=0; p.light = light; }
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
    ctx.fillStyle = '#0b0e12';
    ctx.fillRect(0, 0, this.width, this.height);
    const t = this.clock;
    const extent = Math.max(this.width, this.height);
    const parallaxX=(this.spot.x/this.width-.5)*this.spot.strength*10;
    const parallaxY=(this.spot.y/this.height-.5)*this.spot.strength*7;
    // Wide, slowly breathing fields give the lens a richer scene to refract.
    const pools = [
      [.20+Math.sin(t*.085)*.14,.24+Math.cos(t*.07)*.13,.68,.66,'99,115,126',.24],
      [.82+Math.cos(t*.07)*.13,.65+Math.sin(t*.09)*.16,.59,.84,'103,108,116',.17],
      [.42+Math.sin(t*.06)*.21,.88+Math.cos(t*.08)*.11,.50,.50,'69,108,110',.13]
    ];
    for (const [x,y,size,aspect,color,alpha] of pools) {
      const radius=extent*size;
      ctx.save();
      ctx.translate(x*this.width+parallaxX,y*this.height+parallaxY);
      ctx.scale(1,aspect);
      const glow=ctx.createRadialGradient(0,0,0,0,0,radius);
      glow.addColorStop(0,`rgba(${color},${alpha})`);
      glow.addColorStop(.42,`rgba(${color},${alpha*.5})`);
      glow.addColorStop(1,`rgba(${color},0)`);
      ctx.fillStyle=glow;ctx.fillRect(-radius,-radius,radius*2,radius*2);
      ctx.restore();
    }
    if (this.spot.strength > .005) {
      const radius = 270;
      const glow = ctx.createRadialGradient(this.spot.x, this.spot.y, 0, this.spot.x, this.spot.y, radius);
      glow.addColorStop(0, `rgba(172,194,201,${this.spot.strength * .055})`);
      glow.addColorStop(.45, `rgba(152,177,189,${this.spot.strength * .025})`);
      glow.addColorStop(1, 'rgba(152,177,189,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    const motion=REDUCED_MOTION.matches?0:1;
    for (let index=0;index<this.particles.length;index++) {
      const p=this.particles[index],u=p.homeX/this.width,v=p.homeY/this.height;
      const ribbon=Math.exp(-(((v-.31-Math.sin(u*4-t*.15)*.13-Math.sin(t*.11)*.08)/.12)**2));
      const echo=Math.exp(-(((v-.77-Math.sin(u*4.8+t*.12)*.12)/.10)**2));
      const glint=Math.pow(.5+.5*Math.sin(p.homeX*.014+p.homeY*.009-t*.44),18);
      const light=Math.min(1,p.light+ribbon*.21+echo*.13+glint*.10);
      // Broad low-amplitude warping keeps neighbouring cells separated.
      const x=p.x+(Math.sin(p.homeY*.006+t*.25)*2+Math.sin(p.homeX*.004-t*.18)+parallaxX)*motion;
      const y=p.y+(Math.sin(p.homeX*.005-t*.28)*2+Math.cos(p.homeY*.004+t*.16)+parallaxY)*motion;
      if(light>.3) {
        ctx.fillStyle=`rgba(193,209,216,${Math.min(.045,light*.045)})`;
        ctx.beginPath();ctx.arc(x,y,2.4,0,Math.PI*2);ctx.fill();
      }
      ctx.fillStyle=`rgba(186,204,213,${.22+light*.46})`;
      ctx.beginPath();ctx.arc(x,y,.82+light*.30,0,Math.PI*2);ctx.fill();
      // A fine, offset lattice adds detail without random particles or linework.
      if(index%2===0) {
        const fineX=p.homeX+this.spacing*.5+parallaxX*.5*motion;
        const fineY=p.homeY+this.spacing*.5+parallaxY*.5*motion;
        ctx.fillStyle=`rgba(177,190,199,${.10+ribbon*.07+glint*.06})`;
        ctx.beginPath();ctx.arc(fineX,fineY,.55,0,Math.PI*2);ctx.fill();
      }
    }
    this.lens?.draw(this.canvas, this.width, this.height, this.spot);
  }
  drawStatic() {
    this.stop(); this.pointer.active = false; this.ripples = []; this.spot.strength = 0;
    this.wake=[]; this.wakeAnchor=null;
    for (const p of this.particles) { p.x = p.homeX; p.y = p.homeY; p.vx=p.vy=0; p.light = 0; }
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
