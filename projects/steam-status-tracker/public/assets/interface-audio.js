'use strict';

// Tiny synthesized cues; one context, no audio downloads and no autoplay workaround.
const interfaceAudio = {
  context:null, enabled:true, voices:0, lastHover:0, lastClick:0,
  selector:'a[href],button:not(:disabled),summary',
  getContext(create=false) {
    if(!this.context && create) {
      const Context=window.AudioContext || window.webkitAudioContext;
      if(Context) this.context=new Context();
    }
    return this.context;
  },
  unlock() {
    if(!this.enabled) return;
    try {const ctx=this.getContext(true); if(ctx?.state==='suspended') ctx.resume().catch(()=>{});} catch {}
  },
  sync() {
    const button=byId('soundToggle');if(!button) return;
    button.setAttribute('aria-pressed',String(this.enabled));
    button.setAttribute('aria-label',this.enabled?'Выключить звуки интерфейса':'Включить звуки интерфейса');
    button.title=this.enabled?'Звуки включены':'Звуки выключены';
  },
  play(kind) {
    const ctx=this.context;
    if(!this.enabled || !ctx || ctx.state!=='running' || document.hidden || this.voices>=4) return;
    const hover=kind==='hover',now=performance.now();
    if(now-(hover?this.lastHover:this.lastClick)<(hover?95:45)) return;
    if(hover)this.lastHover=now;else this.lastClick=now;
    const start=ctx.currentTime,duration=hover ? .045 : .085;
    const tone=ctx.createOscillator(),gain=ctx.createGain();
    tone.type='sine';
    tone.frequency.setValueAtTime(hover?880:620,start);
    tone.frequency.exponentialRampToValueAtTime(hover?1046:360,start+duration);
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.exponentialRampToValueAtTime(hover ? .012 : .032,start+.006);
    gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    tone.connect(gain);gain.connect(ctx.destination);this.voices++;
    tone.onended=()=>{tone.disconnect();gain.disconnect();this.voices--;};
    tone.start(start);tone.stop(start+duration+.01);
  },
  init() {
    try {this.enabled=localStorage.getItem('qulon-interface-sound')!=='off';} catch {}
    this.sync();
    document.addEventListener('pointerdown',()=>this.unlock(),{passive:true});
    document.addEventListener('keydown',event=>{if(!event.repeat)this.unlock();},{passive:true});
    document.addEventListener('pointerover',event=>{
      if(event.pointerType==='touch')return;
      const control=event.target.closest(this.selector);
      if(control && !control.contains(event.relatedTarget))this.play('hover');
    },{passive:true});
    document.addEventListener('click',event=>{
      const control=event.target.closest(this.selector);
      if(!control)return;
      if(control.id==='soundToggle') {
        this.enabled=!this.enabled;
        try {localStorage.setItem('qulon-interface-sound',this.enabled?'on':'off');}catch{}
        this.sync();if(this.enabled){this.unlock();this.play('click');}return;
      }
      if(control.id!=='catButton')this.play('click');
    });
  }
};
