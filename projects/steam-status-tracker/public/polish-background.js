(() => {
  'use strict';
  const Q = window.QPolish = window.QPolish || {};
  const coarse = matchMedia('(hover:none),(pointer:coarse)');

  try { if (typeof interactionHub !== 'undefined') interactionHub.destroy(); } catch {}
  try { if (typeof motionController !== 'undefined') motionController.reset(); } catch {}
  try {
    if (typeof canvasController !== 'undefined') {
      canvasController.stop();
      canvasController.destroy();
      canvasController.start = canvasController.resume = canvasController.setPointer = canvasController.setDown = () => {};
    }
  } catch {}

  class Refraction {
    constructor(source){this.source=source;this.items=new Map();this.last=0;this.raf=0;}
    scan(){document.querySelectorAll('#profileCard,.tracker-topbar,.tracker-tabs,.platform-card,.detail-card,.stats-card,.history-panel').forEach(el=>this.add(el));if(!this.raf)this.raf=requestAnimationFrame(this.loop)}
    add(el){if(this.items.has(el))return;el.classList.add('glass-v4');const cv=document.createElement('canvas');cv.className='refraction-canvas';cv.setAttribute('aria-hidden','true');el.prepend(cv);const ctx=cv.getContext('2d',{alpha:true,desynchronized:true});if(ctx)this.items.set(el,{el,cv,ctx,w:0,h:0});}
    draw(item,t){const r=item.el.getBoundingClientRect();if(r.bottom<-80||r.top>innerHeight+80||r.width<20||r.height<20)return;const d=Math.min(devicePixelRatio||1,coarse.matches?1.1:1.35),w=Math.round(r.width),h=Math.round(r.height);if(item.w!==w||item.h!==h){item.w=w;item.h=h;item.cv.width=Math.max(1,Math.round(w*d));item.cv.height=Math.max(1,Math.round(h*d));item.cv.style.width=w+'px';item.cv.style.height=h+'px';item.ctx.setTransform(d,0,0,d,0,0);}const c=item.ctx,sd=this.source.width/Math.max(innerWidth,1);c.clearRect(0,0,w,h);c.save();c.filter='blur(1.1px) saturate(1.2)';for(let y=0;y<h;y+=18){const dh=Math.min(19,h-y),dx=Math.sin(t*.001+y*.055)*2.2,dy=Math.cos(t*.0008+y*.04)*.7,sx=Math.max(0,(r.left+dx)*sd),sy=Math.max(0,(r.top+y+dy)*sd),sw=Math.min(this.source.width-sx,w*1.018*sd),sh=Math.min(this.source.height-sy,dh*1.018*sd);if(sw>0&&sh>0)c.drawImage(this.source,sx,sy,sw,sh,-w*.009,y,w*1.018,dh+1);}c.restore();}
    loop=(t)=>{this.raf=0;if(t-this.last>40){this.last=t;for(const x of this.items.values())this.draw(x,t)}this.raf=requestAnimationFrame(this.loop)}
  }

  const source = document.getElementById('particleCanvas');
  Q.refraction = new Refraction(source);
  Q.refraction.scan();
})();