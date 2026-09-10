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

test('route expansion begins at the originating button rectangle',()=>{
  const t=fixture();
  const from={left:25,top:480,width:320,height:72},to={left:180,top:20,width:960,height:1200};
  const g=t.context.routeMorphGeometry(from,to);
  assert.equal(to.left+to.width/2+g.x,from.left+from.width/2);
  assert.equal(to.top+to.height/2+g.y,from.top+from.height/2);
  assert.equal(to.width*g.sx,from.width);
  assert.equal(to.height*g.sy,from.height);
});
