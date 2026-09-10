import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const source = fs.readFileSync(new URL('../public/assets/motion.js', import.meta.url), 'utf8');
function fixture() {
  let time = 0, sequence = 0, largestDot = 0, largestGlow = 0, spriteCount = 0, strokes = 0;
  const queue = new Map();
  const styles = new Map();
  const element = {
    id: 'profileCard',
    classList: { contains: name => name === 'panel', add() {}, toggle() {}, remove() {} },
    style: { setProperty: (name, value) => styles.set(name, value) },
    closest: () => null,
    getBoundingClientRect: () => ({ left: 100, top: 100, right: 500, bottom: 400, width: 400, height: 300 }),
    matches: () => false
  };
  const draw = { drawImage(image,x,y,width,height) { largestGlow=Math.max(largestGlow,width,height); }, save() {}, restore() {}, translate() {}, scale() {}, createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, setTransform() {}, clearRect() {}, beginPath() {}, arc(x,y,radius) { largestDot=Math.max(largestDot,radius); }, fill() {}, moveTo() {}, lineTo() {}, stroke() { strokes++; } };
  const canvas = { getContext: () => draw };
  const reduced = { matches: false }, coarse = { matches: false, addEventListener() {}, removeEventListener() {} };
  const document = { hidden: false, createElement: () => { spriteCount++; return {getContext:()=>draw}; }, querySelectorAll: () => [element] };
  const context = vm.createContext({
    document, REDUCED_MOTION: reduced, COARSE_POINTER: coarse,
    innerWidth: 1440, innerHeight: 900, devicePixelRatio: 3,
    performance: { now: () => time },
    requestAnimationFrame: fn => { const id = ++sequence; queue.set(id, fn); return id; },
    cancelAnimationFrame: id => queue.delete(id),
    byId: () => canvas,
    addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, console
  });
  vm.runInContext(source + '\nthis.motion = motionController; this.background = canvasController; this.hub = interactionHub;', context);
  return {
    context, reduced, coarse, document, styles, queue, canvas,
    get strokes() { return strokes; },
    get largestDot() { return largestDot; },
    get largestGlow() { return largestGlow; },
    get spriteCount() { return spriteCount; },
    advanceTime(ms) { time += ms; },
    step(ms) { time += ms; const callbacks = [...queue.values()]; queue.clear(); callbacks.forEach(fn => fn(time)); },
    read() { return parseFloat(styles.get('--tilt-y') || '0'); }
  };
}
function sample(fps, seconds) {
  const test = fixture();
  test.context.motion.registerAll();
  test.context.motion.updatePointer(490, 390);
  for (let i = 0; i < Math.round(fps * seconds); ++i) test.step(1000 / fps);
  return test;
}
test('motion is time based, bounded, idle aware, and respects device preferences', () => {
const at60 = sample(60, .2), at144 = sample(144, 29 / 144);
assert.ok(Math.abs(at60.read() - at144.read()) < .012, 'time-based tilt must agree at 60 and 144 Hz');
const test = sample(60, 2);
assert.ok(test.read() > 1.5 && test.read() <= 2.05, 'outer card tilt stays subtle');
assert.equal(test.queue.size, 0, 'settled panels must stop requesting frames');
test.context.motion.reset();
for (let i = 0; i < 120; i++) test.step(1000 / 60);
assert.equal(test.read(), 0, 'pointer leave returns the card to neutral');
assert.equal(test.queue.size, 0);
test.coarse.matches = true;
test.context.motion.updatePointer(500, 300);
assert.equal(test.queue.size, 0, 'touch-only devices must not animate tilt');
test.coarse.matches = false;
test.reduced.matches = true;
test.context.motion.updatePointer(500, 300);
assert.equal(test.queue.size, 0, 'reduced motion must suppress tilt');
test.context.background.init();
assert.equal(test.queue.size, 0, 'reduced motion paints a static background');
assert.equal(test.canvas.width, 2880, 'desktop DPR is capped at 2');
test.reduced.matches = false;
test.context.background.resume();
assert.equal(test.queue.size, 1, 'background resumes with exactly one loop');
test.context.background.resume();
assert.equal(test.queue.size, 1, 'repeated resume must not duplicate loops');
test.context.background.stop();
assert.equal(test.queue.size, 0);
test.document.hidden = true;
test.context.background.resume();
test.context.motion.updatePointer(300, 300);
assert.equal(test.queue.size, 0, 'hidden tabs cannot schedule either loop');
test.document.hidden = false;
test.coarse.matches = true;
test.context.background.resize();
assert.equal(test.canvas.width, 2880, 'touch uses the same 2x density as desktop');
assert.ok(test.context.background.particles.length <= 2400, 'the shared dot budget also bounds large touch screens');
});

test('dot grid is regular, reacts locally to mouse and touch, then returns home while ambient light continues', () => {
  const t = fixture(), grid = t.context.background;
  grid.init();
  for (let i = 0; i < 240; i++) t.step(1000 / 60);
  const dots = grid.particles;
  assert.ok(dots.length > 100);
  assert.equal(dots[1].homeX - dots[0].homeX, grid.spacing);
  assert.equal(dots[1].homeY, dots[0].homeY);
  const near = dots.find(p => p.homeX > 300 && p.homeY > 300);
  const far = dots.at(-1);
  grid.setPointer(near.homeX - 20, near.homeY, { type: 'mouse' });
  for (let i = 0; i < 120; i++) t.step(1000 / 60);
  assert.ok(near.x > near.homeX + 1 && near.x < near.homeX + grid.spacing*.25, 'local response stays inside its cell');
  assert.ok(near.light > .5);
  assert.equal(far.x, far.homeX);
  grid.leave();
  for (let i = 0; i < 120; i++) t.step(1000 / 60);
  assert.ok(dots.every(p => p.x === p.homeX && p.y === p.homeY && p.light === 0));
  assert.equal(t.queue.size, 1, 'one scene loop keeps ambient light and floating lenses in sync');
  t.coarse.matches = true;
  grid.resize();
  grid.setPointer(40, 40, { type: 'touch' });
  for (let i = 0; i < 120; i++) t.step(1000 / 60);
  assert.ok(grid.particles.some(p => p.light > .5));
  t.reduced.matches = true;
  grid.resume();
  assert.ok(grid.particles.every(p => p.x === p.homeX && p.y === p.homeY && p.light === 0));
  assert.equal(t.queue.size, 0);
});

test('click waves are bounded, displace grid dots, and fully settle; reduced motion clears them', () => {
  const t = fixture(), grid = t.context.background;
  grid.init();
  assert.equal(grid.ripples.length, 1, 'opening sends one wave through the grid');
  for (let i = 0; i < 240; i++) t.step(1000 / 60);
  for (let i = 0; i < 10; i++) grid.pulse(320 + i, 260);
  assert.equal(grid.ripples.length, 3, 'rapid clicks cannot create unlimited work');
  for (let i = 0; i < 30; i++) t.step(1000 / 60);
  assert.ok(grid.particles.some(p => Math.hypot(p.x - p.homeX, p.y - p.homeY) > 3));
  assert.ok(grid.particles.every(p => Math.hypot(p.x - p.homeX, p.y - p.homeY) <= 48));
  for (let i = 0; i < 240; i++) t.step(1000 / 60);
  assert.equal(grid.ripples.length, 0);
  assert.equal(t.queue.size, 1, 'settled interactions retain only the ambient scene loop');
  assert.ok(grid.particles.every(p => p.x === p.homeX && p.y === p.homeY));
  grid.pulse(300, 200);
  t.reduced.matches = true;
  grid.resume();
  assert.equal(grid.ripples.length, 0);
  assert.equal(t.queue.size, 0);
});


test('phones keep desktop wave strength and 60 Hz scene updates; static mode freezes the clock', () => {
  const desktop = fixture(), phone = fixture();
  phone.coarse.matches = true;
  for (const t of [desktop, phone]) {
    t.context.background.init();
    for (let i = 0; i < 240; i++) t.step(1000 / 60);
    t.context.background.pulse(320, 260);
    for (let i = 0; i < 24; i++) t.step(1000 / 60);
  }
  assert.equal(phone.context.background.clock, desktop.context.background.clock);
  assert.equal(phone.context.background.lastDraw, desktop.context.background.lastDraw);
  const before = phone.context.background.lastDraw;
  phone.step(1000 / 60);
  assert.ok(phone.context.background.lastDraw > before, 'touch frames must not be throttled to 30 Hz');
  phone.reduced.matches = true;
  phone.context.background.resume();
  const clock = phone.context.background.clock;
  phone.step(1000);
  assert.equal(phone.context.background.clock, clock);
  assert.equal(phone.queue.size, 0);
});

test('cursor movement creates a light trail without emitting click rings',()=>{
  const t=fixture(),grid=t.context.background;
  grid.init();
  for(let i=0;i<160;i++)t.step(1000/60);
  grid.setPointer(200,300);
  for(let i=0;i<40;i++) {t.step(1000/30);grid.setPointer(200+i*9,300+Math.sin(i*.2)*35);}
  assert.equal(grid.ripples.length,0,'movement must not emit concentric click waves');
  assert.ok(grid.wake.length>0 && grid.wake.length<=16);
  assert.ok(grid.particles.some(p=>Math.hypot(p.x-p.homeX,p.y-p.homeY)>1));
  assert.ok(grid.particles.every(p=>Math.hypot(p.x-p.homeX,p.y-p.homeY)<=grid.spacing*.25+.00001));
  grid.leave();for(let i=0;i<240;i++)t.step(1000/60);
  assert.equal(grid.wake.length,0);
  assert.ok(grid.particles.every(p=>p.x===p.homeX && p.y===p.homeY));
});

test('wake strength is independent of pointer polling rate and resets on leave',()=>{
  const slow=fixture(),fast=fixture();
  for(const [t,interval] of [[slow,24],[fast,4]]) {
    const grid=t.context.background;grid.setPointer(200,300);
    for(let elapsed=interval;elapsed<=240;elapsed+=interval) {
      t.advanceTime(interval);grid.setPointer(200+elapsed*.5,300);
    }
    assert.equal(grid.wake.length,10);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(fast.context.background.wake)),JSON.parse(JSON.stringify(slow.context.background.wake)));
  const grid=fast.context.background,count=grid.wake.length;
  grid.leave();fast.advanceTime(100);grid.setPointer(1200,700);
  assert.equal(grid.wake.length,count,'re-entering elsewhere must not draw a connecting streak');
  fast.reduced.matches=true;grid.drawStatic();
  assert.equal(grid.wakeAnchor,null);
});

test('rapid overlapping gestures preserve dot separation and never inflate halos',()=>{
  const t=fixture(),grid=t.context.background;
  t.context.innerWidth=720;t.context.innerHeight=480;grid.init();
  const homes=new Map(grid.particles.map(p=>[`${p.homeX},${p.homeY}`,p]));
  for(let frame=0;frame<100;frame++) {
    const angle=frame*.8;
    grid.setPointer(360+Math.cos(angle)*100,240+Math.sin(angle)*90);
    if(frame%12===0)grid.pulse(360,240);
    t.step(1000/60);
    for(const p of grid.particles) {
      assert.ok(Math.hypot(p.x-p.homeX,p.y-p.homeY)<=grid.spacing*.25+1e-6);
      for(const key of [`${p.homeX+grid.spacing},${p.homeY}`,`${p.homeX},${p.homeY+grid.spacing}`]) {
        const neighbour=homes.get(key);
        if(neighbour) {
          const a=grid.projectDot(p),b=grid.projectDot(neighbour);
          assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=grid.spacing*.60,'rendered neighbours must stay separated after both ambient and pointer deformation');
        }
      }
    }
  }
  assert.ok(t.largestDot<=1.31,'bright dot cores never inflate into circles');
  assert.ok(t.largestGlow>0 && t.largestGlow<=10,'soft glow has a fixed small footprint');
  assert.equal(t.spriteCount,1,'all frames reuse one glow texture');
  const p=grid.particles[20];grid.clock=0;const first=grid.projectDot(p);grid.clock=3;const later=grid.projectDot(p);
  assert.ok(Math.hypot(later.x-first.x,later.y-first.y)>5,'the field remains visibly alive without pointer movement');
  t.reduced.matches=true;grid.drawStatic();
  assert.equal(grid.projectDot(p).x,p.homeX);assert.equal(grid.projectDot(p).y,p.homeY);
});

test('only a press creates connections, using the closest visible dots at that location',()=>{
  const t=fixture(),grid=t.context.background;
  t.context.innerWidth=720;t.context.innerHeight=480;grid.init();
  assert.equal(grid.links.length,0,'opening must not create a global network');
  grid.setPointer(200,200);t.step(100);
  assert.equal(grid.links.length,0,'hover must not create connections');
  assert.equal(t.strokes,0,'there must be no stray background line segments before pressing');
  const before=grid.motes.map(p=>({x:p.x,y:p.y}));grid.stepEnergy(.25);
  assert.ok(grid.motes.some((p,i)=>Math.hypot(p.x-before[i].x,p.y-before[i].y)>2));
  const press=(x,y,pointerType='mouse')=>{
    t.context.hub.onDown({button:0,clientX:x,clientY:y,pointerType});
    const px=(grid.spot.x/grid.width-.5)*grid.spot.strength*10;
    const py=(grid.spot.y/grid.height-.5)*grid.spot.strength*7;
    const expected=new Set(grid.particles.map((p,index)=>{
      const point=grid.projectDot(p,px,py);return {index,distance:Math.hypot(point.x-x,point.y-y)};
    }).filter(p=>p.distance<=Math.min(105,grid.spacing*3)).sort((a,b)=>a.distance-b.distance).slice(0,9).map(p=>p.index));
    assert.ok(grid.links.length>0 && grid.links.length<=18);
    const seen=new Set();
    for(const edge of grid.links) {
      assert.ok(expected.has(edge.from) && expected.has(edge.to),'every endpoint must belong to the nearest visible dots');
      const key=[edge.from,edge.to].sort((a,b)=>a-b).join(',');assert.ok(!seen.has(key));seen.add(key);
    }
  };
  press(320,240);t.step(150);assert.ok(t.strokes>0,'the local connections must be drawn');
  press(650,400);grid.setPointer(100,100);
  assert.equal(grid.networkPulse.x,650);assert.equal(grid.networkPulse.y,400,'the cluster stays at the press, not the moving pointer');
  grid.stepEnergy(2);assert.equal(grid.links.length,0);assert.equal(grid.networkPulse,null);
  press(100,100);t.context.innerWidth=360;t.context.innerHeight=780;grid.resize();
  assert.equal(grid.links.length,0,'resize must remove stale endpoint indices');
  press(180,380,'touch');
  t.reduced.matches=true;grid.resume();assert.equal(grid.links.length,0);
  const frozen=JSON.stringify(grid.motes);t.step(1000);assert.equal(JSON.stringify(grid.motes),frozen);
});
test('spark bursts are bounded, integrate consistently at different frame rates, and expire',()=>{
  const slow=fixture(),fast=fixture();
  for(const [t,fps] of [[slow,60],[fast,144]]) {
    const grid=t.context.background;grid.emitSparks(100,100,1,0,8,true);
    for(let i=0;i<fps/2;i++)grid.stepEnergy(1/fps);
  }
  for(let i=0;i<8;i++) {
    const a=slow.context.background.sparks[i],b=fast.context.background.sparks[i];
    assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-9,'spark motion must not depend on refresh rate');
  }
  const grid=slow.context.background;
  for(let i=0;i<40;i++)grid.emitSparks(100+i,120,0,1,8,true);
  assert.equal(grid.sparks.length,36);
  for(let i=0;i<100;i++)grid.stepEnergy(1/60);
  assert.equal(grid.sparks.length,0);
  slow.document.hidden=true;grid.emitSparks(10,10);assert.equal(grid.sparks.length,0);
  slow.document.hidden=false;slow.reduced.matches=true;grid.emitSparks(10,10);assert.equal(grid.sparks.length,0);
});
