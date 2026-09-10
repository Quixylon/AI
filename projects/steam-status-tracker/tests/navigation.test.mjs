import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/assets/navigation.js',import.meta.url),'utf8');
function fixture() {
  const pending=[],applied=[]; let cancellations=0,releases=0;
  const state={route:{screen:'profile',trackerTab:'overview'}},location={hash:'#profile'};
  const context=vm.createContext({state,location,
    surfaceMotion:{cancel(){cancellations++;},exit:()=>new Promise(resolve=>pending.push(()=>resolve(()=>releases++)))},
    apply:(parsed)=>{state.route={screen:parsed.screen,trackerTab:parsed.trackerTab};applied.push(parsed.canonical);}
  });
  vm.runInContext(source+'\napplyRoute=apply;this.render=renderRoute;',context);
  return {context,pending,applied,location,state,get cancellations(){return cancellations;},get releases(){return releases;}};
}
test('rapid route changes cannot show an obsolete panel after its exit finishes',async()=>{
  const t=fixture();
  t.location.hash='#tracker/steam';const first=t.context.render();
  t.location.hash='#tracker/discord';const second=t.context.render();
  t.pending[1]();await second;
  t.pending[0]();await first;
  assert.deepEqual(t.applied,['#tracker/discord']);
  assert.equal(t.releases,2);
  assert.equal(t.state.route.trackerTab,'discord');
});
test('returning to the current route cancels its pending exit immediately',async()=>{
  const t=fixture();
  t.location.hash='#tracker/steam';const first=t.context.render();
  t.location.hash='#profile';await t.context.render();
  assert.equal(t.cancellations,2);
  assert.deepEqual(t.applied,['#profile']);
  t.pending[0]();await first;
  assert.deepEqual(t.applied,['#profile']);
});

function domFixture() {
  const callbacks=[],nodes=new Map(),document={body:{dataset:{}},activeElement:null};
  function node(id,tab) {
    const value={id,dataset:{tab},classList:{toggle(){}},setAttribute(){},removeAttribute(){},
      getAttribute:()=>`#tracker/${tab}`,focus(){document.activeElement=value;}};
    nodes.set(id,value);return value;
  }
  const tabs=['overview','steam','discord','telegram'].map(tab=>node(`tab-${tab}`,tab));
  for(const id of ['profileName','trackerTitle','trackerOverviewView','steamView','discordView','telegramView'])node(id);
  const context=vm.createContext({document,location:{hash:'#profile'},history:{replaceState(){}},
    state:{route:{screen:'profile',trackerTab:'overview'}},
    dom:{profileScreen:node('profileScreen'),trackerScreen:node('trackerScreen')},
    $$:()=>tabs,byId:id=>nodes.get(id),window:{setTimeout:fn=>callbacks.push(fn)},
    surfaceMotion:{cancel(){},async exit(){}},motionController:{measureSoon(){}},updateRoutePresentation(){},
    refreshManager:{resources:new Map(),get(name){return this.resources.get(name);}}
  });
  vm.runInContext(source,context);
  return {context,document,nodes,tabs,callbacks,flush(){callbacks.splice(0).forEach(fn=>fn());}};
}
test('repeated arrow-key navigation retains focus in the tracker tab strip',async()=>{
  const t=domFixture();
  t.context.state.route={screen:'tracker',trackerTab:'overview'};
  t.tabs[0].focus();
  for(const next of [1,2,3,0]) {
    t.context.handleTabKeydown({key:'ArrowRight',target:t.document.activeElement,preventDefault(){}});
    await t.context.renderRoute();t.flush();
    assert.equal(t.document.activeElement,t.tabs[next]);
    assert.equal(t.context.state.route.trackerTab,t.tabs[next].dataset.tab);
  }
});
test('a delayed route focus cannot target an obsolete page or override user focus',async()=>{
  const t=domFixture();
  t.context.location.hash='#tracker/steam';await t.context.renderRoute();
  t.context.location.hash='#profile';await t.context.renderRoute();
  t.callbacks.shift()();
  assert.equal(t.document.activeElement,null,'obsolete route must not focus its hidden heading');
  t.flush();assert.equal(t.document.activeElement,t.nodes.get('profileName'));
  t.context.location.hash='#tracker/steam';await t.context.renderRoute();
  t.tabs[1].focus();t.flush();
  assert.equal(t.document.activeElement,t.tabs[1],'a new user focus takes precedence');
});
test('Steam remains busy while the game catalogue is still loading',()=>{
  const t=domFixture();
  t.context.refreshManager.resources.set('steamGames',{name:'steamGames',promise:Promise.resolve()});
  assert.equal(t.context.platformBusy('steam'),true);
  assert.equal(t.context.platformBusy('discord'),false);
  t.context.refreshManager.resources.get('steamGames').promise=null;
  assert.equal(t.context.platformBusy('steam'),false);
});
