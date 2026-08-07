(() => {
  'use strict';
  const Q = window.QPolish = window.QPolish || {};
  const coarse = matchMedia('(hover:none),(pointer:coarse)');
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');

  try { if (typeof interactionHub !== 'undefined') interactionHub.destroy(); } catch {}
  try { if (typeof motionController !== 'undefined') motionController.reset(); } catch {}
  try {
    if (typeof canvasController !== 'undefined') {
      canvasController.stop(); canvasController.destroy();
      canvasController.start = canvasController.resume = canvasController.setPointer = canvasController.setDown = () => {};
    }
  } catch {}

  class Background {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas?.getContext('2d', { alpha:true, desynchronized:true });
      this.points = []; this.raf = 0; this.last = performance.now();
      this.pointer = { x:innerWidth/2, y:innerHeight/2, tx:innerWidth/2, ty:innerHeight/2, active:false, down:false };
    }
    init() {
      if (!this.ctx) return;
      this.resize();
      addEventListener('resize', () => this.resize(), { passive:true });
      addEventListener('pointermove', e => { this.pointer.tx=e.clientX; this.pointer.ty=e.clientY; this.pointer.active=true; }, { passive:true });
      addEventListener('pointerdown', e => { if (e.button!==0 && e.pointerType!=='touch') return; this.pointer.tx=e.clientX; this.pointer.ty=e.clientY; this.pointer.active=true; this.pointer.down=true; }, { passive:true });
      addEventListener('pointerup', () => this.pointer.down=false, { passive:true });
      addEventListener('pointercancel', () => this.pointer.down=false, { passive:true });
      this.start();
    }
    resize() {
      this.w=Math.max(1,innerWidth); this.h=Math.max(1,innerHeight); this.dpr=Math.min(devicePixelRatio||1,coarse.matches?1.3:1.7);
      this.canvas.width=Math.round(this.w*this.dpr); this.canvas.height=Math.round(this.h*this.dpr);
      this.canvas.style.width=this.w+'px'; this.canvas.style.height=this.h+'px';
      this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
      const n=coarse.matches?Math.min(56,Math.max(34,Math.round(this.w*this.h/15500))):Math.min(96,Math.max(60,Math.round(this.w*this.h/11500)));
      this.points=Array.from({length:n},(_,i)=>({x:Math.random()*this.w,y:(i+Math.random())/n*(this.h+160)-80,d:.35+Math.random()*.65,s:.8+Math.random()*1.4,a:.25+Math.random()*.45,v:7+Math.random()*14,p:Math.random()*Math.PI*2}));
    }
    frame=(t)=>{
      const dt=Math.min(.05,(t-this.last)/1000); this.last=t; this.pointer.x+=(this.pointer.tx-this.pointer.x)*.1; this.pointer.y+=(this.pointer.ty-this.pointer.y)*.1;
      if(!reduced.matches) for(const p of this.points){p.y-=p.v*dt;p.x+=Math.sin(t*.00016+p.p)*1.7*dt;if(p.y<-45){p.y=this.h+45+Math.random()*60;p.x=Math.random()*this.w;}}
      const pos=this.points.map(p=>{let x=p.x+Math.cos(t*.00022+p.p)*(1+p.d),y=p.y+Math.sin(t*.00018+p.p)*(.5+p.d);if(this.pointer.down&&this.pointer.active){const dx=this.pointer.x-x,dy=this.pointer.y-y,dist=Math.hypot(dx,dy)||1,r=coarse.matches?165:225;if(dist<r){const k=(1-dist/r)*(.025+p.d*.025);x+=dx*k;y+=dy*k;}}return{x,y};});
      const c=this.ctx;c.clearRect(0,0,this.w,this.h);const lim=Math.min(145,Math.max(108,Math.min(this.w,this.h)*.145));
      for(let i=0;i<pos.length;i++)for(let j=i+1;j<pos.length;j++){const d=Math.hypot(pos[i].x-pos[j].x,pos[i].y-pos[j].y);if(d<lim){c.strokeStyle=`rgba(${(i+j)%4?'166,157,255':'103,202,255'},${(1-d/lim)*.16*Math.min(this.points[i].d,this.points[j].d)})`;c.lineWidth=.62;c.beginPath();c.moveTo(pos[i].x,pos[i].y);c.lineTo(pos[j].x,pos[j].y);c.stroke();}}
      if(this.pointer.active){const r=coarse.matches?165:260;pos.map((p,i)=>({p,d:Math.hypot(p.x-this.pointer.x,p.y-this.pointer.y),i})).filter(x=>x.d<r).sort((a,b)=>a.d-b.d).slice(0,this.pointer.down?12:8).forEach(x=>{const g=c.createLinearGradient(this.pointer.x,this.pointer.y,x.p.x,x.p.y);g.addColorStop(0,`rgba(225,222,255,${(1-x.d/r)*(this.pointer.down?.28:.18)})`);g.addColorStop(1,'rgba(145,135,255,.02)');c.strokeStyle=g;c.beginPath();c.moveTo(this.pointer.x,this.pointer.y);c.lineTo(x.p.x,x.p.y);c.stroke();});}
      c.shadowBlur=6;c.shadowColor='rgba(160,145,255,.35)';pos.forEach((p,i)=>{c.fillStyle=`rgba(${i%5?'226,229,255':'124,211,255'},${this.points[i].a})`;c.beginPath();c.arc(p.x,p.y,this.points[i].s,0,Math.PI*2);c.fill();});c.shadowBlur=0;
      this.raf=requestAnimationFrame(this.frame);
    }
    start(){if(!this.raf&&!reduced.matches){this.last=performance.now();this.raf=requestAnimationFrame(this.frame)}}
  }

  class Refraction {
    constructor(source){this.source=source;this.items=new Map();this.last=0;this.raf=0;}
    scan(){document.querySelectorAll('#profileCard,.tracker-topbar,.tracker-tabs,.platform-card,.detail-card,.stats-card,.history-panel').forEach(el=>this.add(el));if(!this.raf)this.raf=requestAnimationFrame(this.loop)}
    add(el){if(this.items.has(el))return;el.classList.add('glass-v4');const cv=document.createElement('canvas');cv.className='refraction-canvas';cv.setAttribute('aria-hidden','true');el.prepend(cv);const ctx=cv.getContext('2d',{alpha:true,desynchronized:true});if(ctx)this.items.set(el,{el,cv,ctx,w:0,h:0});}
    draw(item,t){const r=item.el.getBoundingClientRect();if(r.bottom<-80||r.top>innerHeight+80||r.width<20||r.height<20)return;const d=Math.min(devicePixelRatio||1,coarse.matches?1.1:1.35),w=Math.round(r.width),h=Math.round(r.height);if(item.w!==w||item.h!==h){item.w=w;item.h=h;item.cv.width=Math.max(1,Math.round(w*d));item.cv.height=Math.max(1,Math.round(h*d));item.cv.style.width=w+'px';item.cv.style.height=h+'px';item.ctx.setTransform(d,0,0,d,0,0);}const c=item.ctx,sd=this.source.width/Math.max(innerWidth,1);c.clearRect(0,0,w,h);c.save();c.filter='blur(1.1px) saturate(1.2)';for(let y=0;y<h;y+=18){const dh=Math.min(19,h-y),dx=Math.sin(t*.001+y*.055)*2.2,dy=Math.cos(t*.0008+y*.04)*.7,sx=Math.max(0,(r.left+dx)*sd),sy=Math.max(0,(r.top+y+dy)*sd),sw=Math.min(this.source.width-sx,w*1.018*sd),sh=Math.min(this.source.height-sy,dh*1.018*sd);if(sw>0&&sh>0)c.drawImage(this.source,sx,sy,sw,sh,-w*.009,y,w*1.018,dh+1);}c.restore();}
    loop=(t)=>{this.raf=0;if(t-this.last>40){this.last=t;for(const x of this.items.values())this.draw(x,t)}this.raf=requestAnimationFrame(this.loop)}
  }

  Q.background = new Background(document.getElementById('particleCanvas')); Q.background.init();
  Q.refraction = new Refraction(document.getElementById('particleCanvas')); Q.refraction.scan();
})();
