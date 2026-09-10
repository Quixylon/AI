import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/assets/interface-audio.js',import.meta.url),'utf8');
test('UI cues wait for activation, obey mute and cap overlapping voices',()=>{
  let now=1000,created=0;const tones=[];
  const parameter={setValueAtTime(){},exponentialRampToValueAtTime(){}};
  class AudioContext {
    constructor(){created++;this.state='running';this.currentTime=0;this.destination={};}
    createGain(){return {gain:parameter,connect(){},disconnect(){}};}
    createOscillator(){const tone={frequency:parameter,connect(){},disconnect(){},start(){},stop(){}};tones.push(tone);return tone;}
  }
  const context=vm.createContext({window:{AudioContext},document:{hidden:false},performance:{now:()=>now}});
  vm.runInContext(source+'\nthis.audio=interfaceAudio;',context);const audio=context.audio;
  audio.play('hover');assert.equal(created,0,'hover cannot create an autoplay context');
  audio.unlock();audio.play('click');assert.equal(tones.length,1);
  audio.enabled=false;now+=100;audio.play('click');assert.equal(tones.length,1);
  audio.enabled=true;
  for(let i=0;i<10;i++){now+=100;audio.play('hover');}
  assert.equal(audio.voices,4);assert.equal(created,1);
  tones[0].onended();assert.equal(audio.voices,3);
  now+=100;audio.play('click');assert.equal(audio.voices,4);
});
