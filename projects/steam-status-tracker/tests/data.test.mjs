import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const file = name => readFileSync(new URL(`../public/assets/${name}.js`, import.meta.url), 'utf8');
function context() {
  const values = new Map();
  const c = vm.createContext({
    console, URL, URLSearchParams, AbortController, AbortSignal, DOMException,
    setTimeout, clearTimeout, setInterval, clearInterval, structuredClone,
    window: { location: { href:'https://quixylon.github.io/AI/' }, matchMedia:()=>({matches:false}), setTimeout, setInterval },
    document: { querySelector:()=>null, querySelectorAll:()=>[], getElementById:()=>null },
    setResourceBusy(){}, clearResourceError(){}, updateOverallState(){}, updateStaleStates(){}, updateTechnicalJson(){}, showResourceError(){}, showToast(){},
    renderProfile(){}, renderOverview(){}, renderSteam(){}, renderDiscord(){}, renderTelegram(){}, renderVisitors(){}, renderSteamHistory(){}, renderDiscordHistory(){}, renderTelegramHistory(){},
    text:(id,value)=>values.set(id,value)
  });
  vm.runInContext(file('config')+'\n'+file('data')+'\n'+file('history'), c);
  return { c, values, run:code=>vm.runInContext(code,c) };
}
test('missing dates and URLs stay missing; unsafe schemes are rejected',()=>{
  const {run}=context();
  assert.equal(run('validDate(null)'),null);
  assert.equal(run("validDate('')"),null);
  assert.equal(run('validDate(false)'),null);
  assert.equal(run('normalizeExternalUrl(undefined)'),null);
  assert.equal(run("normalizeExternalUrl('javascript:alert(1)')"),null);
  assert.equal(run("normalizeExternalUrl('https://t.me/quixylon')"),'https://t.me/quixylon');
  assert.equal(run('formatDuration(null)'), 'Нет данных');
});
test('unconfigured or malformed responses cannot crash the profile',()=>{
  const {run}=context();
  assert.equal(run('normalizeSteamStatus({configured:false, player:null}).player.status'),'unknown');
  assert.equal(run('normalizeSteamStatus(null).checkedAt'),null);
  assert.equal(run('normalizeDiscordStatus({user:null,activity:null}).user.status'),'unknown');
  assert.equal(run('normalizeProfile({}).avatarUrl'),null);
});
test('history keeps recent entries and rejects invalid end dates',()=>{
  const {c,run}=context();
  const base=Date.now()-1300*60000;
  c.rows=Array.from({length:1200},(_,i)=>({id:String(i),type:'presence',status:i%2?'online':'offline',startedAt:new Date(base+i*60000).toISOString(),endedAt:new Date(base+(i+1)*60000).toISOString()}));
  assert.equal(run("normalizeHistory('steam', rows)[0].id"),'1199');
  assert.equal(run("normalizeHistory('steam', rows).at(-1).id"),'200');
  c.rows=[{id:'bad',status:'online',startedAt:new Date(base).toISOString(),endedAt:'bad-date'}];
  assert.equal(run("normalizeHistory('steam', rows).length"),0);
});
test('interleaved game and presence records merge independently',()=>{
  const {c,run}=context(); const start=Date.now()-10000;
  c.rows=['presence','game','presence','game'].map((type,i)=>({id:String(i),type,status:'in-game',personaState:'online',gameName:'Game',gameId:'1',startedAt:new Date(start+(i>1?5000:0)).toISOString(),endedAt:new Date(start+(i>1?10000:5000)).toISOString()}));
  assert.equal(run("normalizeHistory('steam', rows).length"),2);
  assert.equal(run("normalizeHistory('steam', rows)[0].durationSeconds"),10);
});
test('today launch counter excludes previous days',()=>{
  const {c,run,values}=context();
  const today=new Date();today.setHours(0,0,0,0);
  c.rows=[{type:'game',gameName:'Today',startedAt:new Date(today.getTime()+1000).toISOString(),endedAt:new Date(today.getTime()+2000).toISOString()},{type:'game',gameName:'Yesterday',startedAt:new Date(today.getTime()-10000).toISOString(),endedAt:new Date(today.getTime()-5000).toISOString()}];
  run('state.steam.history=rows; renderSteamStats()');
  assert.equal(values.get('steamStatLaunches'),1);
});
test('superseded request cannot overwrite data or clear the current request',async()=>{
  const {c,run}=context(); let finishOld,finishNew; const applied=[];
  c.fetcher=()=>new Promise(resolve=>{if(!finishOld)finishOld=resolve;else finishNew=resolve;});
  c.apply=value=>applied.push(value);
  run("const manager=new RefreshManager(); manager.register('sample',fetcher,value=>value,apply); this.oldRequest=manager.refresh('sample'); this.newRequest=manager.refresh('sample',{force:true});");
  finishOld('stale'); await c.oldRequest;
  assert.equal(run("manager.get('sample').promise !== null"),true);
  finishNew('fresh'); await c.newRequest;
  assert.deepEqual(applied,['fresh']);
  assert.equal(run("manager.get('sample').promise"),null);
});
