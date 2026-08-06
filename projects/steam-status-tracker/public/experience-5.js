/* =========================================================
   22. Интерактивные карточки
   ========================================================= */
class MotionController {
  constructor() { this.items=[]; this.pointer={x:innerWidth/2,y:innerHeight/2,active:false}; this.measureTimer=null; }
  registerAll() { this.items=$$('[data-motion-panel]').map(element=>({ element,max:Number(element.dataset.motionMax)||1.2,rect:null })); this.measure(); }
  measure() { for (const item of this.items) item.rect=item.element.hidden?null:item.element.getBoundingClientRect(); }
  measureSoon() { clearTimeout(this.measureTimer); this.measureTimer=setTimeout(()=>this.measure(),60); }
  updatePointer(x,y,active=true) {
    this.pointer={x,y,active}; if (REDUCED_MOTION.matches||COARSE_POINTER.matches) return;
    for (const item of this.items) {
      const rect=item.rect; if (!rect||item.element.closest('[hidden]')) continue;
      const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2; const dx=x-cx,dy=y-cy;
      const nx=Math.max(-1,Math.min(1,dx/(rect.width*.65))),ny=Math.max(-1,Math.min(1,dy/(rect.height*.65)));
      const distance=Math.hypot(Math.max(0,Math.abs(dx)-rect.width/2),Math.max(0,Math.abs(dy)-rect.height/2));
      const influence=Math.max(0,1-distance/260); const inside=x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom;
      item.element.style.setProperty('--motion-ry',`${nx*item.max*influence}deg`); item.element.style.setProperty('--motion-rx',`${-ny*item.max*influence}deg`);
      item.element.style.setProperty('--glow-x',`${Math.max(0,Math.min(100,(x-rect.left)/rect.width*100))}%`); item.element.style.setProperty('--glow-y',`${Math.max(0,Math.min(100,(y-rect.top)/rect.height*100))}%`);
      item.element.style.setProperty('--glow-alpha',inside?'.09':'0');
    }
  }
  reset() { for (const item of this.items) { item.element.style.setProperty('--motion-rx','0deg'); item.element.style.setProperty('--motion-ry','0deg'); item.element.style.setProperty('--glow-alpha','0'); } }
}
const motionController=new MotionController();

/* =========================================================
   23. Canvas-фон
   ========================================================= */
class CanvasController {
  constructor(canvas) {
    this.canvas=canvas; this.ctx=canvas?.getContext('2d'); this.particles=[]; this.rings=[]; this.grid=new Map(); this.raf=0; this.running=false; this.lastFrame=0; this.lastMobileFrame=0;
    this.mobile=COARSE_POINTER.matches||innerWidth<720; this.dpr=1; this.width=innerWidth; this.height=innerHeight;
    this.pointer={targetX:innerWidth/2,targetY:innerHeight/2,renderX:innerWidth/2,renderY:innerHeight/2,active:false,down:false,type:'mouse',lastImpulse:0};
  }
  init() { if (!this.canvas||!this.ctx) return; this.resize(); this.createParticles(); if (REDUCED_MOTION.matches) this.drawStatic(); else this.start(); }
  resize() {
    if (!this.canvas||!this.ctx) return; this.mobile=COARSE_POINTER.matches||innerWidth<720; this.width=Math.max(1,innerWidth); this.height=Math.max(1,innerHeight); this.dpr=Math.min(devicePixelRatio||1,this.mobile?1.5:2);
    this.canvas.width=Math.round(this.width*this.dpr); this.canvas.height=Math.round(this.height*this.dpr); this.canvas.style.width=`${this.width}px`; this.canvas.style.height=`${this.height}px`;
    this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0); this.pointer.targetX=Math.min(this.pointer.targetX,this.width); this.pointer.targetY=Math.min(this.pointer.targetY,this.height);
    if (this.particles.length) { for (const p of this.particles) { p.homeX=Math.min(this.width,Math.max(0,p.homeX/Math.max(1,p.spaceW)*this.width)); p.homeY=Math.min(this.height,Math.max(0,p.homeY/Math.max(1,p.spaceH)*this.height)); p.x=Math.min(this.width,Math.max(0,p.x)); p.y=Math.min(this.height,Math.max(0,p.y)); p.spaceW=this.width;p.spaceH=this.height; } }
  }
  createParticles() {
    const area=this.width*this.height; const cap=this.mobile?CONFIG.interface.mobileParticleMaximum:CONFIG.interface.desktopParticleMaximum; const min=this.mobile?35:70; const count=Math.max(min,Math.min(cap,Math.round(area/(this.mobile?18500:15500))));
    this.particles=Array.from({length:count},(_,index)=>{ const x=Math.random()*this.width,y=Math.random()*this.height,depth=.55+Math.random()*.8; return {x,y,homeX:x,homeY:y,vx:(Math.random()-.5)*.12,vy:(Math.random()-.5)*.12,depth,size:.8+Math.random()*1.45,alpha:.22+Math.random()*.48,phase:Math.random()*Math.PI*2,orbit:12+Math.random()*30,index,spaceW:this.width,spaceH:this.height}; });
  }
  setPointer(x,y,meta={}) {
    this.pointer.targetX=x; this.pointer.targetY=y; this.pointer.active=true; this.pointer.type=meta.type||'mouse';
    if (meta.speed>750&&performance.now()-this.pointer.lastImpulse>55) { this.applyMoveImpulse(x,y,meta.dx||0,meta.dy||0,Math.min(meta.speed/1800,1)); this.pointer.lastImpulse=performance.now(); }
  }
  setDown(value,x,y) { this.pointer.down=value; if (Number.isFinite(x)) this.setPointer(x,y); if (value&&!REDUCED_MOTION.matches) this.addRings(x,y); }
  leave() { this.pointer.active=false; this.pointer.down=false; }
  addRings(x,y) { if (!Number.isFinite(x)||!Number.isFinite(y)) return; for (let i=0;i<3;i++) this.rings.push({x,y,radius:i*9,previousRadius:i*9,speed:135+i*28,alpha:.34-i*.06,width:1.25+i*.35}); if (this.rings.length>12) this.rings.splice(0,this.rings.length-12); }
  applyMoveImpulse(x,y,dx,dy,strength) {
    const radius=150; for (const p of this.particles) { const dist=Math.hypot(p.x-x,p.y-y); if (dist<radius) { const falloff=(1-dist/radius)*strength*.55; p.vx+=dx*.0026*falloff; p.vy+=dy*.0026*falloff; } }
  }
  start() { if (this.running||REDUCED_MOTION.matches||document.hidden) return; this.running=true; this.lastFrame=performance.now(); this.raf=requestAnimationFrame(t=>this.frame(t)); }
  stop() { this.running=false; cancelAnimationFrame(this.raf); this.raf=0; }
  resume() { this.lastFrame=performance.now(); if (REDUCED_MOTION.matches) this.drawStatic(); else this.start(); }
  frame(time) {
    if (!this.running) return; if (this.mobile&&time-this.lastMobileFrame<32) { this.raf=requestAnimationFrame(t=>this.frame(t)); return; } this.lastMobileFrame=time;
    const dt=Math.min(.034,Math.max(.001,(time-this.lastFrame)/1000)); this.lastFrame=time; this.update(dt,time); this.draw(time); this.raf=requestAnimationFrame(t=>this.frame(t));
  }
  update(dt,time) {
    const pointer=this.pointer; pointer.renderX+=(pointer.targetX-pointer.renderX)*.13; pointer.renderY+=(pointer.targetY-pointer.renderY)*.13;
    for (const ring of this.rings) { ring.previousRadius=ring.radius; ring.radius+=ring.speed*dt; ring.alpha-=dt*.22; }
    this.rings=this.rings.filter(r=>r.alpha>.015&&r.radius<Math.max(this.width,this.height)*1.2).slice(-12);
    for (const p of this.particles) {
      const driftX=Math.sin(time*.00023+p.phase)*.013*p.depth,driftY=Math.cos(time*.00019+p.phase)*.013*p.depth;
      p.vx+=(p.homeX-p.x)*.00085+driftX; p.vy+=(p.homeY-p.y)*.00085+driftY;
      if (pointer.active) {
        const dx=p.x-pointer.renderX,dy=p.y-pointer.renderY,dist=Math.max(1,Math.hypot(dx,dy)),radius=pointer.down?230:145;
        if (dist<radius) {
          const force=(1-dist/radius); if (pointer.down) { const angle=p.phase+time*.00035; const tx=pointer.renderX+Math.cos(angle)*p.orbit,ty=pointer.renderY+Math.sin(angle)*p.orbit; p.vx+=(tx-p.x)*.0018*force; p.vy+=(ty-p.y)*.0018*force; }
          else { p.vx+=(dx/dist)*force*.022; p.vy+=(dy/dist)*force*.022; }
        }
      }
      for (const ring of this.rings) { const dx=p.x-ring.x,dy=p.y-ring.y,dist=Math.max(1,Math.hypot(dx,dy)); if (dist>=ring.previousRadius-8&&dist<=ring.radius+8) { const force=ring.alpha*.06; p.vx+=(dx/dist)*force; p.vy+=(dy/dist)*force; } }
      p.vx*=.965; p.vy*=.965; p.x+=p.vx*dt*60; p.y+=p.vy*dt*60;
      if (p.x<-40||p.x>this.width+40||p.y<-40||p.y>this.height+40) { p.x=Math.min(this.width,Math.max(0,p.x)); p.y=Math.min(this.height,Math.max(0,p.y)); p.vx*=.3;p.vy*=.3; }
    }
  }
  buildGrid(cellSize=112) { this.grid.clear(); for (let i=0;i<this.particles.length;i++) { const p=this.particles[i],key=`${Math.floor(p.x/cellSize)},${Math.floor(p.y/cellSize)}`; if (!this.grid.has(key)) this.grid.set(key,[]); this.grid.get(key).push(i); } return cellSize; }
  draw(time=0) {
    const ctx=this.ctx;if(!ctx)return;ctx.clearRect(0,0,this.width,this.height); const cell=this.buildGrid(this.mobile?105:120),maxDist=this.mobile?105:124;
    ctx.lineWidth=.65;
    for (let i=0;i<this.particles.length;i++) {
      const p=this.particles[i],cx=Math.floor(p.x/cell),cy=Math.floor(p.y/cell);
      for(let gx=cx-1;gx<=cx+1;gx++)for(let gy=cy-1;gy<=cy+1;gy++){const bucket=this.grid.get(`${gx},${gy}`)||[];for(const j of bucket){if(j<=i)continue;const q=this.particles[j],d=Math.hypot(p.x-q.x,p.y-q.y);if(d<maxDist){const a=(1-d/maxDist)*.16;ctx.strokeStyle=`rgba(${i%3===0?'103,207,255':'176,164,255'},${a})`;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}}}
    }
    if (this.pointer.active&&!this.mobile) {
      const nearest=[]; const limit=this.pointer.down?15:10;
      for(const p of this.particles){const d=Math.hypot(p.x-this.pointer.renderX,p.y-this.pointer.renderY);if(d>260)continue;let inserted=false;for(let i=0;i<nearest.length;i++){if(d<nearest[i].d){nearest.splice(i,0,{p,d});inserted=true;break;}}if(!inserted)nearest.push({p,d});if(nearest.length>limit)nearest.pop();}
      for(const item of nearest){const gradient=ctx.createLinearGradient(this.pointer.renderX,this.pointer.renderY,item.p.x,item.p.y);gradient.addColorStop(0,`rgba(215,220,255,${this.pointer.down?.28:.18})`);gradient.addColorStop(1,'rgba(176,164,255,.025)');ctx.strokeStyle=gradient;ctx.lineWidth=this.pointer.down?1:.7;ctx.beginPath();ctx.moveTo(this.pointer.renderX,this.pointer.renderY);ctx.lineTo(item.p.x,item.p.y);ctx.stroke();}
      const glow=ctx.createRadialGradient(this.pointer.renderX,this.pointer.renderY,0,this.pointer.renderX,this.pointer.renderY,100);glow.addColorStop(0,'rgba(176,164,255,.11)');glow.addColorStop(1,'rgba(176,164,255,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(this.pointer.renderX,this.pointer.renderY,100,0,Math.PI*2);ctx.fill();
    }
    for(const ring of this.rings){ctx.strokeStyle=`rgba(145,180,255,${ring.alpha})`;ctx.lineWidth=ring.width;ctx.beginPath();ctx.arc(ring.x,ring.y,ring.radius,0,Math.PI*2);ctx.stroke();}
    ctx.shadowBlur=8;ctx.shadowColor='rgba(176,164,255,.42)';
    for(const p of this.particles){ctx.fillStyle=`rgba(${p.index%4===0?'103,207,255':'220,217,255'},${p.alpha})`;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}
    ctx.shadowBlur=0;
  }
  drawStatic(){this.draw(0);}
  destroy(){this.stop();this.rings=[];}
}
const canvasController=new CanvasController(byId('particleCanvas'));

class InteractionHub {
  constructor(){this.last={x:innerWidth/2,y:innerHeight/2,time:performance.now()};this.bound=false;this.resizeTimer=null;}
  init(){if(this.bound)return;this.bound=true;window.addEventListener('pointermove',this.onMove,{passive:true});window.addEventListener('pointerdown',this.onDown,{passive:true});window.addEventListener('pointerup',this.onUp,{passive:true});window.addEventListener('pointercancel',this.onUp,{passive:true});window.addEventListener('blur',this.onLeave);window.addEventListener('resize',this.onResize,{passive:true});window.addEventListener('scroll',this.onScroll,{passive:true});}
  onMove=event=>{const now=performance.now(),dt=Math.max(1,now-this.last.time),dx=event.clientX-this.last.x,dy=event.clientY-this.last.y,speed=Math.hypot(dx,dy)/dt*1000;this.last={x:event.clientX,y:event.clientY,time:now};canvasController.setPointer(event.clientX,event.clientY,{dx,dy,speed,type:event.pointerType});motionController.updatePointer(event.clientX,event.clientY,true);};
  onDown=event=>{if(event.button!==0)return;canvasController.setDown(true,event.clientX,event.clientY);};
  onUp=event=>{canvasController.setDown(false,event.clientX,event.clientY);};
  onLeave=()=>{canvasController.leave();motionController.reset();};
  onResize=()=>{clearTimeout(this.resizeTimer);this.resizeTimer=setTimeout(()=>{canvasController.resize();motionController.measure();},100);};
  onScroll=()=>motionController.measureSoon();
  destroy(){if(!this.bound)return;this.bound=false;window.removeEventListener('pointermove',this.onMove);window.removeEventListener('pointerdown',this.onDown);window.removeEventListener('pointerup',this.onUp);window.removeEventListener('pointercancel',this.onUp);window.removeEventListener('blur',this.onLeave);window.removeEventListener('resize',this.onResize);window.removeEventListener('scroll',this.onScroll);}
}
const interactionHub=new InteractionHub();

/* =========================================================
   24. Мяукающий кот
   ========================================================= */
class CatController {
  constructor(button,hint){this.button=button;this.hint=hint;this.audioContext=null;this.animationTimer=null;this.clicked=false;}
  init(){if(!this.button)return;try{this.clicked=localStorage.getItem('qulon-cat-clicked')==='1';}catch{}if(this.hint)this.hint.hidden=this.clicked;this.button.addEventListener('click',()=>this.meow());}
  async meow(){clearTimeout(this.animationTimer);this.button.classList.remove('is-meowing');void this.button.offsetWidth;this.button.classList.add('is-meowing');this.animationTimer=setTimeout(()=>this.button.classList.remove('is-meowing'),600);if(this.hint)this.hint.hidden=true;try{localStorage.setItem('qulon-cat-clicked','1');}catch{}if(navigator.vibrate)navigator.vibrate(24);try{await this.playSound();}catch{} }
  async playSound(){const AudioContextClass=window.AudioContext||window.webkitAudioContext;if(!AudioContextClass)return;if(!this.audioContext)this.audioContext=new AudioContextClass();if(this.audioContext.state==='suspended')await this.audioContext.resume();const ctx=this.audioContext,now=ctx.currentTime,duration=.54;const gain=ctx.createGain(),filter=ctx.createBiquadFilter(),main=ctx.createOscillator(),overtone=ctx.createOscillator();filter.type='bandpass';filter.frequency.setValueAtTime(1050,now);filter.Q.setValueAtTime(2.2,now);main.type='sine';overtone.type='triangle';main.frequency.setValueAtTime(610,now);main.frequency.exponentialRampToValueAtTime(820,now+.18);main.frequency.exponentialRampToValueAtTime(520,now+duration);overtone.frequency.setValueAtTime(1220,now);overtone.frequency.exponentialRampToValueAtTime(1040,now+duration);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.16,now+.035);gain.gain.exponentialRampToValueAtTime(.055,now+.24);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);main.connect(filter);overtone.connect(filter);filter.connect(gain);gain.connect(ctx.destination);main.start(now);overtone.start(now);main.stop(now+duration);overtone.stop(now+duration);}
}
const catController=new CatController(dom.catButton,dom.catHint);

/* =========================================================
   25. Счётчик посетителей
   ========================================================= */
function getVisitorId(){try{let value=localStorage.getItem('qulon-visitor-id');if(!value){value=crypto.randomUUID?crypto.randomUUID():`visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;localStorage.setItem('qulon-visitor-id',value);}return value;}catch{return null;}}

/* =========================================================
   26. Жизненный цикл
   ========================================================= */
let liveTicker=0;
function startLiveTicker(){if(liveTicker)return;liveTicker=window.setInterval(()=>{for(const el of $$('[data-live-duration]')){const start=el.dataset.liveDuration,end=el.dataset.liveEnd||null;const seconds=getElapsedSeconds(start,end||Date.now());el.textContent=formatDuration(seconds);}},1000);}
function handleVisibility(){if(document.hidden){canvasController.stop();}else{canvasController.resume();refreshManager.refreshStale();motionController.measureSoon();}}
function cleanup(){refreshManager.destroy();canvasController.destroy();interactionHub.destroy();clearInterval(liveTicker);liveTicker=0;}

/* =========================================================
   27. Инициализация
   ========================================================= */
function renderBuiltInIcons(){for(const holder of $$('[data-icon]')){const name=holder.dataset.icon;if(ICONS[name])holder.innerHTML=ICONS[name];}}
function bindEvents(){
  window.addEventListener('hashchange',()=>renderRoute(true)); window.addEventListener('focus',()=>refreshManager.refreshStale()); document.addEventListener('visibilitychange',handleVisibility); window.addEventListener('beforeunload',cleanup,{once:true});
  dom.refreshAllButton?.addEventListener('click',()=>refreshManager.refreshAll({force:true,manual:true}));
  byId('retrySteamButton')?.addEventListener('click',()=>refreshManager.refreshPlatform('steam',{force:true,manual:true}));
  byId('retryDiscordButton')?.addEventListener('click',()=>refreshManager.refreshPlatform('discord',{force:true,manual:true}));
  byId('retryTelegramButton')?.addEventListener('click',()=>refreshManager.refreshPlatform('telegram',{force:true,manual:true}));
  $('.tracker-tabs')?.addEventListener('keydown',handleTabKeydown);
  document.addEventListener('click',event=>{
    const copy=event.target.closest('[data-copy-target]');if(copy){handleCopy(copy);return;}
    const filter=event.target.closest('[data-history-platform][data-history-filter]');if(filter){const platform=filter.dataset.historyPlatform,value=filter.dataset.historyFilter;state.historyView[platform].filter=value;state.historyView[platform].visible=CONFIG.history.initialVisibleEntries;if(platform==='steam'){state.historyView.steamGames.visible=CONFIG.history.initialVisibleEntries;state.historyView.steamPresence.visible=CONFIG.history.initialVisibleEntries;renderSteamHistory();}else if(platform==='discord')renderDiscordHistory();else renderTelegramHistory();for(const button of $$(`[data-history-platform="${platform}"]`))button.classList.toggle('is-active',button===filter);return;}
    const more=event.target.closest('[data-history-more]');if(more){changeHistoryVisible(more.dataset.historyMore,'more');return;}
    const collapse=event.target.closest('[data-history-collapse]');if(collapse){changeHistoryVisible(collapse.dataset.historyCollapse,'collapse');return;}
  });
  REDUCED_MOTION.addEventListener?.('change',()=>{canvasController.stop();if(REDUCED_MOTION.matches)canvasController.drawStatic();else canvasController.start();motionController.reset();});
}
async function initializeData(){
  renderOverview(); updateOverallState();
  await refreshManager.refreshAll();
  state.initialized=true; refreshManager.startPolling(); updateTechnicalJson();
}
function initialize(){
  byId('profileName')?.setAttribute('tabindex','-1'); byId('trackerTitle')?.setAttribute('tabindex','-1');
  renderBuiltInIcons(); bindEvents(); motionController.registerAll(); interactionHub.init(); canvasController.init(); catController.init(); startLiveTicker(); renderRoute(false); initializeData();
}
initialize();
