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
  const document = { hidden: false, addEventListener() {}, removeEventListener() {}, createElement: () => { spriteCount++; return {getContext:()=>draw}; }, querySelectorAll: () => [element] };
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
const mouse = (x=300,y=300) => ({button:0,buttons:1,pointerId:1,pointerType:'mouse',clientX:x,clientY:y,target:{closest:()=>null}});

test('press grows no more than five direct lines; holding, dragging and release follow pointer lifetime',()=>{
 const t=fixture(), g=t.context.background, h=t.context.hub; g.init();
 t.step(16); assert.equal(g.links.size,0);
 h.onMove(mouse()); t.step(16); assert.equal(g.links.size,0,'hover never connects');
 h.onDown(mouse()); t.step(220); assert.equal(g.links.size,5);
 for(const index of g.links.keys()) {
   const p=g.projectDot(g.particles[index]); assert.ok(Math.hypot(p.x-300,p.y-300)<=180);
 }
 for(let i=0;i<180;i++) t.step(16);
 assert.equal(g.links.size,5,'hold does not expire at 1.6s');
 h.onMove(mouse(620,420));t.step(16);
 assert.equal(g.pointer.x,620); assert.equal(g.pointer.y,420);
 for(const index of g.links.keys()) {
   const p=g.projectDot(g.particles[index]); assert.ok(Math.hypot(p.x-620,p.y-420)<=180);
 }
 h.onUp(mouse()); t.step(16); assert.equal(g.links.size,0);
 assert.equal(g.pointer.active,false);
 h.onDown(mouse(-1000,-1000)); t.step(16); assert.equal(g.links.size,0,'no distant connections');
});

test('drawing starts at cursor and grows to the selected point, never between two dots',()=>{
 const t=fixture(),g=t.context.background,segments=[]; let start;
 g.ctx.moveTo=(x,y)=>{start=[x,y]};g.ctx.lineTo=(x,y)=>segments.push({start,end:[x,y]});
 g.init();g.connectAt(310,310);segments.length=0;t.step(100);
 assert.equal(segments.length,5);
 for(const line of segments)assert.deepEqual(line.start,[310,310]);
 const initial=segments.map(s=>Math.hypot(s.end[0]-310,s.end[1]-310));
 segments.length=0;t.step(120);
 assert.ok(segments.some((s,i)=>Math.hypot(s.end[0]-310,s.end[1]-310)>initial[i]));
});

test('nearest selection has hysteresis without exceeding the hard radius or connection cap',()=>{
 const t=fixture(),g=t.context.background;g.init();g.connectAt(300,300);t.step(220);
 const first=[...g.links.keys()];g.setPointer(300.1,300.1);t.step(16);
 assert.deepEqual([...g.links.keys()],first,'subpixel movement must not flicker endpoints');
 for(let x=0;x<1000;x+=17){g.setPointer(x,300);t.step(16);assert.ok(g.links.size<=5);}
});

test('cancel, lost capture, blur, hidden tab, scroll and missing mouse button clear the gesture',()=>{
 for(const cancel of [h=>h.onUp(mouse()),h=>h.onLeave(),h=>h.onOut({relatedTarget:null}),h=>h.onScroll(),h=>h.onMove({...mouse(),buttons:0}),
 h=>{h.onVisibility();}]) {
  const t=fixture(),g=t.context.background,h=t.context.hub;g.init();h.onDown(mouse());t.step(220);
  if(cancel.toString().includes('onVisibility'))t.document.hidden=true;
  cancel(h); assert.equal(g.links.size,0); assert.equal(h.pointerId,null);
 }
 const t=fixture(),h=t.context.hub;h.init();
 assert.ok(h.bindings.some(([name,fn])=>name==='pointercancel'&&fn===h.onUp));
 assert.ok(h.bindings.some(([name,fn])=>name==='lostpointercapture'&&fn===h.onUp));
});

test('controls, text, secondary pointers and right click do not start a background gesture',()=>{
 const t=fixture(),h=t.context.hub,g=t.context.background;g.init();
 for(const event of [{...mouse(),button:2},{...mouse(),isPrimary:false},{...mouse(),target:{closest:()=>({})}}]) {
 h.onDown(event); assert.equal(g.pointer.active,false);
 }
 h.onDown(mouse()); h.onUp({...mouse(),pointerId:2}); assert.equal(g.pointer.active,true);
 h.onUp(mouse()); assert.equal(g.pointer.active,false);
 const touch={...mouse(),pointerType:'touch',target:{closest:()=>null,setPointerCapture(){throw Error('touch must retain native scrolling')}}};
 h.onDown(touch); assert.equal(g.pointer.active,true); h.onUp(touch);
});

test('rapid repeats keep one scene loop; reduced motion supports static connections; hidden tabs stop',()=>{
 const t=fixture(),g=t.context.background,h=t.context.hub;g.init();
 for(let i=0;i<100;i++){h.onDown(mouse());t.step(16);h.onUp(mouse());}
 assert.equal(t.queue.size,1); assert.equal(g.links.size,0);
 g.stop();assert.equal(t.queue.size,0);
 t.reduced.matches=true;g.resume();assert.equal(t.queue.size,0);
 h.onDown(mouse());assert.equal(g.links.size,5);assert.equal(t.queue.size,0);
 h.onUp(mouse());assert.equal(g.links.size,0);
 t.document.hidden=true; t.reduced.matches=false;g.start();assert.equal(t.queue.size,0);
});

test('canvas resize handles HiDPI within budget and clears old point indices',()=>{
 const t=fixture(),g=t.context.background;g.init();g.connectAt(300,300);
 assert.ok(t.canvas.width>1440 && t.canvas.width<=2880); assert.ok(t.canvas.width*t.canvas.height<=4005000);assert.ok(g.particles.length<=1600);
 t.context.innerWidth=390;t.context.innerHeight=844;g.resize();
 assert.equal(t.canvas.width,780);assert.equal(g.links.size,0);
 assert.equal(g.width,390); assert.equal(t.queue.size,1);
});
