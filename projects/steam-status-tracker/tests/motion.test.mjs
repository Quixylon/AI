import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const source = fs.readFileSync(new URL('../public/assets/motion.js', import.meta.url), 'utf8');
function fixture() {
  let time = 0, sequence = 0;
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
  const draw = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, setTransform() {}, clearRect() {}, beginPath() {}, arc() {}, fill() {}, moveTo() {}, lineTo() {}, stroke() {} };
  const canvas = { getContext: () => draw };
  const reduced = { matches: false }, coarse = { matches: false, addEventListener() {}, removeEventListener() {} };
  const document = { hidden: false, querySelectorAll: () => [element] };
  const context = vm.createContext({
    document, REDUCED_MOTION: reduced, COARSE_POINTER: coarse,
    innerWidth: 1440, innerHeight: 900, devicePixelRatio: 3,
    performance: { now: () => time },
    requestAnimationFrame: fn => { const id = ++sequence; queue.set(id, fn); return id; },
    cancelAnimationFrame: id => queue.delete(id),
    byId: () => canvas,
    addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, console
  });
  vm.runInContext(source + '\nthis.motion = motionController; this.background = canvasController;', context);
  return {
    context, reduced, coarse, document, styles, queue, canvas,
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
assert.ok(test.read() > 1 && test.read() <= 1.5, 'outer card tilt stays subtle');
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
assert.equal(test.canvas.width, 2160, 'touch DPR is capped at 1.5');
assert.ok(test.context.background.particles.length <= 900, 'touch dot count is bounded');
});

test('dot grid is regular, reacts locally to mouse and touch, then returns home and sleeps', () => {
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
  assert.ok(near.x > near.homeX + 10);
  assert.ok(near.light > .5);
  assert.equal(far.x, far.homeX);
  grid.leave();
  for (let i = 0; i < 120; i++) t.step(1000 / 60);
  assert.ok(dots.every(p => p.x === p.homeX && p.y === p.homeY && p.light === 0));
  assert.equal(t.queue.size, 0);
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
  assert.equal(t.queue.size, 0);
  assert.ok(grid.particles.every(p => p.x === p.homeX && p.y === p.homeY));
  grid.pulse(300, 200);
  t.reduced.matches = true;
  grid.resume();
  assert.equal(grid.ripples.length, 0);
  assert.equal(t.queue.size, 0);
});
