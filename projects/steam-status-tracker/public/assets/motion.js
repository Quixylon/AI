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
    this.links = [];
    this.networkPulse = null;
    this.motes = [];
    this.sparks = [];
    this.sparkSeed = 0;
    this.spot = { x: 0, y: 0, strength: 0 };
    this.pointer = { x: 0, y: 0, active: false };
    this.clock = 0;
    this.wake = [];
    this.wakeAnchor = null;
    this.dotGlow = null;
    this.lens = typeof GlassRenderer === 'function' ? new GlassRenderer(byId('glassCanvas')) : null;
    if (this.lens) this.lens.onRestore = () => this.draw();
  }
  init() { this.dotGlow ||= this.createDotGlow(); this.lens?.init(); this.resize(); this.pulse(this.width * .5, this.height * .45, .65); this.resume(); }
  createDotGlow() {
    const sprite=document.createElement('canvas');sprite.width=sprite.height=32;
    const ctx=sprite.getContext('2d');if(!ctx)return null;
    const glow=ctx.createRadialGradient(16,16,0,16,16,16);
    glow.addColorStop(0,'rgba(157,221,255,.85)');
    glow.addColorStop(.22,'rgba(115,199,251,.42)');
    glow.addColorStop(.55,'rgba(102,174,241,.10)');
    glow.addColorStop(1,'rgba(102,174,241,0)');
    ctx.fillStyle=glow;ctx.fillRect(0,0,32,32);return sprite;
  }
  // One broad deformation field for both lattice layers. Its gradients stay
  // small even when its amplitude is visible, so rows flow without folding.
  projectDot(p,parallaxX=0,parallaxY=0) {
    if(REDUCED_MOTION.matches)return {x:p.x,y:p.y};
    const t=this.clock,hx=p.homeX,hy=p.homeY;
    return {
      x:p.x+Math.sin(hy*.005-t*.42)*8+Math.sin((hx+hy)*.003+t*.27)*4+parallaxX,
      y:p.y+Math.sin(hx*.004+t*.36)*10+Math.cos((hy-hx)*.003-t*.23)*4+parallaxY
    };
  }
  resetEnergy() {
    this.links=[];this.networkPulse=null;this.sparks=[];
    const count=Math.min(46,Math.max(14,Math.round(this.width*this.height/28000)));
    this.motes=Array.from({length:count},(_,id)=>({
      id,x:((id*.61803398875+.17)%1)*this.width,y:((id*.41421356237+.23)%1)*this.height,
      vx:Math.cos(id*2.4)*15,vy:Math.sin(id*1.7)*12,phase:id*2.399963
    }));
  }
  connectAt(x,y) {
    if(REDUCED_MOTION.matches || document.hidden || !this.particles.length)return;
    const radius=Math.min(105,this.spacing*3);
    const px=(this.spot.x/this.width-.5)*this.spot.strength*10;
    const py=(this.spot.y/this.height-.5)*this.spot.strength*7;
    const nearest=this.particles.map((p,index)=>{
      const point=this.projectDot(p,px,py);
      return {index,...point,distance:Math.hypot(point.x-x,point.y-y)};
    }).filter(p=>p.distance<=radius).sort((a,b)=>a.distance-b.distance).slice(0,9);
    // A click selects actual visible neighbours, never a prebuilt global graph.
    const seen=new Set();this.links=[];
    for(const a of nearest) {
      const neighbours=nearest.filter(b=>b!==a).map(b=>({b,distance:Math.hypot(a.x-b.x,a.y-b.y)}))
        .filter(pair=>pair.distance<=this.spacing*1.75).sort((a,b)=>a.distance-b.distance).slice(0,2);
      for(const {b} of neighbours) {
        const key=[a.index,b.index].sort((a,b)=>a-b).join(',');
        if(seen.has(key))continue;seen.add(key);
        const [from,to]=a.distance<=b.distance?[a,b]:[b,a];
        this.links.push({from:from.index,to:to.index,delay:from.distance/radius*.1});
      }
    }
    this.networkPulse={x,y,age:0,life:1.6};this.start();
  }
  emitSparks(x,y,dx=0,dy=0,count=1,burst=false) {
    if(REDUCED_MOTION.matches || document.hidden)return;
    for(let i=0;i<count;i++) {
      const seed=(++this.sparkSeed*.61803398875)%1,angle=seed*Math.PI*2;
      const speed=burst?48+seed*48:20+seed*16;
      this.sparks.push({x,y,vx:dx*26+Math.cos(angle)*speed,vy:dy*26+Math.sin(angle)*speed,
        age:0,life:.75+seed*.5,phase:seed});
    }
    this.sparks=this.sparks.slice(-36);
  }
  stepEnergy(dt) {
    if(this.networkPulse) {
      this.networkPulse.age+=dt;
      if(this.networkPulse.age>=this.networkPulse.life) {this.networkPulse=null;this.links=[];}
    }
    const blend=1-Math.exp(-3*dt);
    for(const p of this.motes) {
      const dx=p.x-this.spot.x,dy=p.y-this.spot.y,distance=Math.hypot(dx,dy);
      const influence=this.spot.strength*Math.max(0,1-distance/180);
      const targetX=Math.cos(p.phase+this.clock*.38)*17+8-dy/Math.max(40,distance)*influence*38;
      const targetY=Math.sin(p.phase*.7+this.clock*.31)*14-6+dx/Math.max(40,distance)*influence*38;
      p.vx+=(targetX-p.vx)*blend;p.vy+=(targetY-p.vy)*blend;
      p.x+=p.vx*dt;p.y+=p.vy*dt;
      if(p.x < -12)p.x=this.width+12;else if(p.x>this.width+12)p.x=-12;
      if(p.y < -12)p.y=this.height+12;else if(p.y>this.height+12)p.y=-12;
    }
    const damping=Math.exp(-1.8*dt),travel=(1-damping)/1.8;
    for(const p of this.sparks) {
      p.age+=dt;p.x+=p.vx*travel;p.y+=p.vy*travel;p.vx*=damping;p.vy*=damping;
    }
    this.sparks=this.sparks.filter(p=>p.age<p.life);
  }
  drawNetwork(points) {
    const ctx=this.ctx;
    for(const point of points)point.energy=0;
    if(!this.networkPulse || REDUCED_MOTION.matches)return;
    for(const link of this.links) {
      const a=points[link.from],b=points[link.to],age=this.networkPulse.age-link.delay;
      if(!a || !b || age<=0)continue;
      const opening=Math.min(1,age/.12);
      const fade=Math.max(0,1-Math.max(0,age-.4)/1.1)**2;
      const envelope=opening*fade;
      const reach=1-(1-opening)**3;
      ctx.lineWidth=.9;
      ctx.strokeStyle=`rgba(133,214,239,${envelope*.55})`;
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(a.x+(b.x-a.x)*reach,a.y+(b.y-a.y)*reach);ctx.stroke();
      const progress=Math.min(1,age/.55),strength=Math.sin(progress*Math.PI)*envelope*.65;
      const x=a.x+(b.x-a.x)*progress,y=a.y+(b.y-a.y)*progress;
      if(this.dotGlow) {ctx.globalAlpha=strength;ctx.drawImage(this.dotGlow,x-5,y-5,10,10);ctx.globalAlpha=1;}
      ctx.fillStyle=`rgba(176,235,250,${strength})`;
      ctx.beginPath();ctx.arc(x,y,1.05,0,Math.PI*2);ctx.fill();
      a.energy=Math.max(a.energy,(1-progress)*envelope*.30);
      b.energy=Math.max(b.energy,progress*envelope*.30);
    }
  }
  drawEnergy() {
    const ctx=this.ctx;
    const paint=(p,alpha,radius)=>{
      if(this.dotGlow) {ctx.globalAlpha=alpha*.65;ctx.drawImage(this.dotGlow,p.x-5,p.y-5,10,10);ctx.globalAlpha=1;}
      ctx.fillStyle=`rgba(192,234,251,${alpha})`;
      ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fill();
    };
    for(const p of this.motes) {
      const shimmer=.5+.5*Math.sin(this.clock*1.1+p.phase);
      paint(p,.30+shimmer*.45,.8+shimmer*.45);
    }
    for(const p of this.sparks) {
      const life=p.age/p.life,fade=Math.min(1,life*14)*(1-life)**1.5;
      paint(p,fade*.85,.85+p.phase*.4);
    }
  }
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
    this.resetEnergy();
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
        this.emitSparks(x,y,dx/distance,dy/distance,2);
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
    this.emitSparks(x,y,0,0,8,true);
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
    this.stepEnergy(dt);
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
    const flowX=Math.max(-20,Math.min(20,this.pointer.x-this.spot.x))*.22;
    const flowY=Math.max(-20,Math.min(20,this.pointer.y-this.spot.y))*.22;
    const maxOffset=this.spacing*.25;
    // Exact damped-spring step: no frame-dependent Euler integration.
    const damping=12, frequency=16, decay=Math.exp(-damping*dt);
    const cosine=Math.cos(frequency*dt), sine=Math.sin(frequency*dt);
    for (const p of this.particles) {
      const dx = p.homeX - this.pointer.x, dy = p.homeY - this.pointer.y;
      const distance = Math.hypot(dx, dy);
      const proximity = this.pointer.active ? Math.max(0, 1 - distance / reach) : 0;
      const influence = proximity * proximity * (3 - 2 * proximity);
      const offset = 14 * influence;
      let x = p.homeX + dx / (distance+45) * offset + flowX*influence;
      let y = p.homeY + dy / (distance+45) * offset + flowY*influence;
      let light = influence*.82;
      for (const ripple of this.ripples) {
        const rx = p.homeX - ripple.x, ry = p.homeY - ripple.y;
        const radius = Math.hypot(rx, ry);
        const crest = Math.exp(-(((radius - ripple.age * 360) / 40) ** 2)) * (1 - ripple.age / 2.4) * ripple.strength;
        const shift = crest * 7;
        x += rx / Math.max(1, radius) * shift;
        y += ry / Math.max(1, radius) * shift;
        light = Math.max(light,crest*.85);
      }
      let wakeLight=0;
      for(const sample of this.wake) {
        const wx=p.homeX-sample.x,wy=p.homeY-sample.y;
        const along=wx*sample.dx+wy*sample.dy,across=wx*sample.dy-wy*sample.dx;
        const falloff=Math.exp(-(along*along/6400+across*across/1600));
        const life=(1-sample.age/1.6)**2;
        // Light may trail the pointer, but samples never accumulate forces or
        // brightness. Repeated passes cannot bunch dots into luminous clouds.
        wakeLight=Math.max(wakeLight,falloff*life*sample.power*.78);
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
    ctx.fillStyle = '#0b1725';
    ctx.fillRect(0, 0, this.width, this.height);
    const t = this.clock;
    const extent = Math.max(this.width, this.height);
    const parallaxX=(this.spot.x/this.width-.5)*this.spot.strength*10;
    const parallaxY=(this.spot.y/this.height-.5)*this.spot.strength*7;
    // Wide, slowly breathing fields give the lens a richer scene to refract.
    const pools = [
      [.20+Math.sin(t*.15)*.16,.22+Math.cos(t*.12)*.15,.68,.72,'42,125,180',.46],
      [.80+Math.cos(t*.11)*.15,.62+Math.sin(t*.14)*.18,.62,.84,'100,91,169',.36],
      [.44+Math.sin(t*.10)*.22,.87+Math.cos(t*.13)*.13,.54,.62,'39,153,149',.32],
      [.36+Math.sin(t*.18)*.18,.42+Math.sin(t*.15)*.18,.56,.19,'74,173,194',.15]
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
      const radius = 300;
      const glow = ctx.createRadialGradient(this.spot.x, this.spot.y, 0, this.spot.x, this.spot.y, radius);
      glow.addColorStop(0, `rgba(84,181,235,${this.spot.strength * .14})`);
      glow.addColorStop(.45, `rgba(86,154,213,${this.spot.strength * .055})`);
      glow.addColorStop(1, 'rgba(86,154,213,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    const projected=this.particles.map(p=>this.projectDot(p,parallaxX,parallaxY));
    this.drawNetwork(projected);
    for (let index=0;index<this.particles.length;index++) {
      const p=this.particles[index],u=p.homeX/this.width,v=p.homeY/this.height;
      const ribbon=Math.exp(-(((v-.31-Math.sin(u*4-t*.26)*.13-Math.sin(t*.18)*.08)/.12)**2));
      const echo=Math.exp(-(((v-.77-Math.sin(u*4.8+t*.21)*.12)/.10)**2));
      const glint=Math.pow(.5+.5*Math.sin(p.homeX*.014+p.homeY*.009-t*.72),12);
      const light=Math.min(1,p.light+ribbon*.30+echo*.22+glint*.18+projected[index].energy);
      const {x,y}=projected[index];
      // Reuse a feathered light texture instead of painting hard halo discs.
      if(this.dotGlow && light>.16) {
        ctx.globalAlpha=.08+light*.28;
        ctx.drawImage(this.dotGlow,x-5,y-5,10,10);
        ctx.globalAlpha=1;
      }
      ctx.fillStyle=`rgba(${Math.round(151+echo*37)},${Math.round(191+ribbon*37)},241,${.30+light*.43})`;
      ctx.beginPath();ctx.arc(x,y,.90+light*.40,0,Math.PI*2);ctx.fill();
      // The fine grid flows through the same field; it cannot drift into a
      // separate swarm when the larger dots bend or the pointer changes course.
      if(index%2===0) {
        const half=this.spacing*.5;
        const fine=this.projectDot({homeX:p.homeX+half,homeY:p.homeY+half,x:p.x+half,y:p.y+half},parallaxX,parallaxY);
        ctx.fillStyle=`rgba(160,202,221,${.14+ribbon*.10+glint*.07})`;
        ctx.beginPath();ctx.arc(fine.x,fine.y,.60,0,Math.PI*2);ctx.fill();
      }
    }
    this.drawEnergy();
    this.lens?.draw(this.canvas, this.width, this.height, this.spot);
  }
  drawStatic() {
    this.stop(); this.pointer.active = false; this.ripples = []; this.spot.strength = 0;
    this.wake=[]; this.wakeAnchor=null; this.sparks=[];this.links=[];this.networkPulse=null;
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
    canvasController.connectAt(event.clientX, event.clientY);
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
