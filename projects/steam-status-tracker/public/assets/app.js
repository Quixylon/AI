// Application lifecycle and interaction bindings.
/* =========================================================
   24. Мяукающий кот
   ========================================================= */
class CatController {
  constructor(button,hint){this.button=button;this.hint=hint;this.audioContext=null;this.animationTimer=null;this.clicked=false;}
  init(){if(!this.button)return;try{this.clicked=localStorage.getItem('qulon-cat-clicked')==='1';}catch{}if(this.hint)this.hint.hidden=this.clicked;this.button.addEventListener('click',()=>this.meow());}
  async meow(){clearTimeout(this.animationTimer);this.button.classList.remove('is-meowing');void this.button.offsetWidth;this.button.classList.add('is-meowing');this.animationTimer=setTimeout(()=>this.button.classList.remove('is-meowing'),600);if(this.hint)this.hint.hidden=true;try{localStorage.setItem('qulon-cat-clicked','1');}catch{}if(navigator.vibrate)navigator.vibrate(24);try{await this.playSound();}catch{} }
  async playSound(){ return playProfileMeow(); }
}
const catController=new CatController(dom.catButton,dom.catHint);

/* =========================================================
   25. Счётчик посетителей
   ========================================================= */
function getVisitorId(){try{let value=localStorage.getItem('qulon-visitor-id')||localStorage.getItem('quixylon-anonymous-visitor-id-v1');if(!value){value=crypto.randomUUID?crypto.randomUUID():`visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;localStorage.setItem('qulon-visitor-id',value);}return value;}catch{return null;}}

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
  byId('steamGameSearch')?.addEventListener('input',()=>{ const list=byId('steamPlayedGames'); if(list) list.scrollTop=0; renderSteamGames(); });
  window.addEventListener('hashchange',()=>renderRoute(true)); window.addEventListener('focus',()=>refreshManager.refreshStale()); document.addEventListener('visibilitychange',handleVisibility); window.addEventListener('beforeunload',cleanup,{once:true});
  dom.refreshAllButton?.addEventListener('click',()=>refreshManager.refreshAll({force:true,manual:true}));
  byId('retrySteamButton')?.addEventListener('click',()=>refreshManager.refreshPlatform('steam',{force:true,manual:true}));
  byId('retryDiscordButton')?.addEventListener('click',()=>refreshManager.refreshPlatform('discord',{force:true,manual:true}));
  byId('retryTelegramButton')?.addEventListener('click',()=>refreshManager.refreshPlatform('telegram',{force:true,manual:true}));
  $('.tracker-tabs')?.addEventListener('keydown',handleTabKeydown);
  document.addEventListener('click',event=>{
    const copy=event.target.closest('[data-copy-target]');if(copy){handleCopy(copy);return;}
    const filter=event.target.closest('[data-history-platform][data-history-filter]');
    if(filter){
      const key=filter.dataset.historyPlatform, view=state.historyView[key];
      if(!view) return;
      view.filter=filter.dataset.historyFilter;
      view.visible=CONFIG.history.initialVisibleEntries;
      const target=byId(key==='steamPresence'?'steamPresenceTimeline':key==='discord'?'discordTimeline':'telegramTimeline');
      if(target) target.scrollTop=0;
      if(key==='steamPresence') renderSteamHistory();
      else if(key==='discord') renderDiscordHistory();
      else if(key==='telegram') renderTelegramHistory();
      for(const button of $$(`[data-history-platform="${key}"]`)){
        button.classList.toggle('is-active',button===filter);
        button.setAttribute('aria-pressed',String(button===filter));
      }
      return;
    }
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
  setupPresentation();
  byId('profileName')?.setAttribute('tabindex','-1'); byId('trackerTitle')?.setAttribute('tabindex','-1');
  renderBuiltInIcons(); bindEvents(); motionController.registerAll(); interactionHub.init(); canvasController.init(); catController.init(); startLiveTicker(); renderRoute(false); initializeData();
}
initialize();
