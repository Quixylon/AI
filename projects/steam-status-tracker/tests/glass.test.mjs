import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = fs.readFileSync(new URL('../public/assets/glass.js', import.meta.url), 'utf8');
function fixture(available = true) {
  const classes = new Set(), events = {}, calls = [], copies = [];
  const gl = new Proxy({}, { get: (_, name) => {
    if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
    if (name === 'getUniformLocation') return (_, uniform) => uniform;
    if (/^[A-Z_0-9]+$/.test(name)) return name;
    return (...args) => { calls.push([name, ...args]); return {}; };
  } });
  const visible = { offsetWidth: 328, offsetHeight: 200,
    prepend() {},
    closest: () => null,
    getBoundingClientRect: () => ({ left: 16, top: 20, right: 344, bottom: 220, width: 328, height: 200 }) };
  const offscreen = { ...visible, getBoundingClientRect: () => ({ left: 16, top: 850, right: 344, bottom: 1050, width: 328, height: 200 }) };
  const document = { hidden: false,
    createElement: () => ({ width:0, height:0, setAttribute() {}, remove() {}, getContext: () => ({ drawImage: (...args) => copies.push(args) }) }),
    querySelectorAll: () => [visible, offscreen, { ...visible, offsetWidth: 0 }],
    documentElement: { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } } };
  const canvas = { width: 0, height: 0, getContext: () => available ? gl : null,
    addEventListener: (name, fn) => { events[name] = fn; } };
  const context = vm.createContext({ document, Float32Array,
    getComputedStyle: () => ({ width: '328px', height: '200px', borderTopLeftRadius: '23px', opacity: '1', transform: 'none', scale: 'none' }) });
  vm.runInContext(source + '\nthis.Glass = GlassRenderer; this.inverse = glassInverse;', context);
  return { context, classes, events, calls, copies, document, renderer: new context.Glass(canvas) };
}
function map(matrix, x, y) {
  const w = matrix[2] * x + matrix[5] * y + matrix[8];
  return [(matrix[0] * x + matrix[3] * y + matrix[6]) / w, (matrix[1] * x + matrix[4] * y + matrix[7]) / w];
}
function close(actual, expected) {
  for (let i = 0; i < 2; i++) assert.ok(Math.abs(actual[i] - expected[i]) < .002, `${actual} should map to ${expected}`);
}

test('lens plane follows rounded cards through scroll, entrance scale and perspective tilt', () => {
  const { inverse } = fixture().context;
  close(map(inverse({ left: 16, top: -500 }, 328, 200), 180, -400), [0, 0]);
  close(map(inverse({ left: 16, top: -500 }, 328, 200), 16, -500), [-164, -100]);
  close(map(inverse({ left: 20, top: 30 }, 400, 240, 'none', '.94'), 208, 142.8), [0, 0]);
  // The entrance moves each card backwards in perspective, not its parent.
  const depth=150,denominator=1+depth/1200;
  const depthRect={left:300-200/denominator,top:280+(-120+20)/denominator};
  const depthCss=`matrix3d(1,0,0,0,0,1,0,0,0,0,1,${-1/1200},0,20,${-depth},${denominator})`;
  const depthPlane=inverse(depthRect,400,240,depthCss,'none',false);
  for(const [x,y] of [[0,0],[-200,-120],[200,120]])close(map(depthPlane,x,y),[300+x/denominator,280+(y+20)/denominator]);
  const angle = .02618, c = Math.cos(angle), s = Math.sin(angle), scale = .94;
  // Independently project a CSS rotateY plane under perspective(1200px).
  const project = (x, y) => [350 + scale * c * x / (1 + s * x / 1200), 260 + scale * y / (1 + s * x / 1200)];
  const corners = [[-200, -120], [-200, 120], [200, -120], [200, 120]].map(p => project(...p));
  const rect = { left: Math.min(...corners.map(p => p[0])), top: Math.min(...corners.map(p => p[1])) };
  const css = `matrix3d(${[c, 0, -s, s / 1200, 0, 1, 0, 0, s, 0, c, -c / 1200, 0, 0, 0, 1].join(',')})`;
  const matrix = inverse(rect, 400, 240, css, String(scale));
  for (const point of [[0, 0], [-200, -120], [200, 120], [170, -70]]) close(map(matrix, ...project(...point)), point);
  const forward = inverse(rect, 400, 240, css, String(scale), false);
  for (const point of [[0, 0], [-200, -120], [200, 120], [170, -70]]) close(map(forward, ...point), project(...point));
});

test('one shared lens texture draws visible cards only and survives context loss', () => {
  const t = fixture(), scene = { width: 720, height: 1600 };
  t.renderer.init(); t.renderer.draw(scene, 360, 800); t.renderer.draw(scene, 360, 800);
  assert.equal(t.calls.filter(c => c[0] === 'drawArrays').length, 2, 'offscreen and hidden cards must not render');
  assert.equal(t.copies.length, 2, 'each visible card receives its own clipped texture');
  assert.deepEqual(t.copies[0].slice(1), [0, 0, 656, 400, 0, 0, 656, 400]);
  assert.equal(t.calls.filter(c => c[0] === 'texImage2D').length, 1, 'allocate once per size');
  assert.equal(t.calls.filter(c => c[0] === 'texSubImage2D').length, 1, 'reuse the live source texture');
  assert.ok(t.classes.has('has-refraction'));
  t.document.hidden = true;
  const before = t.calls.length;
  t.renderer.draw(scene, 360, 800);
  assert.equal(t.calls.length, before, 'hidden tabs perform no GPU work');
  let prevented = false;
  t.events.webglcontextlost({ preventDefault() { prevented = true; } });
  assert.ok(prevented);
  assert.equal(t.renderer.ready, false);
  assert.equal(t.classes.has('has-refraction'), false, 'context loss restores readable CSS glass');
  t.document.hidden = false;
  t.renderer.onRestore = () => t.renderer.draw(scene, 360, 800);
  t.events.webglcontextrestored();
  assert.ok(t.classes.has('has-refraction'), 'restoration also repaints when motion is reduced');
  const unavailable = fixture(false);
  unavailable.renderer.init(); unavailable.renderer.draw(scene, 360, 800);
  assert.equal(unavailable.renderer.ready, false);
  assert.equal(unavailable.classes.has('has-refraction'), false);
});
