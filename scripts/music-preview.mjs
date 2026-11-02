// Render the actual Web Audio music graph without a sound device.
// node scripts/music-preview.mjs [output.wav] [wave] [duration]
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { chromium } from '@playwright/test';
import { escalationStep } from '../src/game/survivor.ts';
const file = process.argv[2] ?? '/tmp/prod-breaker-music.wav';
const wave = Number(process.argv[3] ?? 1), duration = Number(process.argv[4] ?? 1800);
const js = ts.transpileModule(readFileSync('src/effects/audio.ts','utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;$/gm,'').replace(/^export /gm,'');
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage();
 await page.addScriptTag({content:`(()=>{${escalationStep.toString()};${js};window.startMusic=startMusic;})()`});
 const result=await page.evaluate(async({wave,duration})=>{
  const seconds=64, sampleRate=22050;
  const offline=new OfflineAudioContext(1, seconds*sampleRate, sampleRate);
  let clock=0;const timers=[];
  window.AudioContext=class {
   get currentTime(){return clock} state='running'; destination=offline.destination;
   resume(){return Promise.resolve()}
   createGain(){return offline.createGain()}
   createOscillator(){return offline.createOscillator()}
   createDynamicsCompressor(){return offline.createDynamicsCompressor()}
   createBiquadFilter(){return offline.createBiquadFilter()}
   createDelay(n){return offline.createDelay(n)}
  };
  window.setInterval=(cb)=>{timers.push(cb);return timers.length};
  const stop=window.startMusic(1,()=>wave,()=>duration,()=>({combo:clock>=20&&clock<32?1000:0,overdrive:clock>=20&&clock<30}));
  for(clock=.1;clock<seconds-.2;clock+=.1) for(const timer of timers) timer();
  const buffer=await offline.startRendering(), data=buffer.getChannelData(0);
  const pcm=new Int16Array(data.length);let peak=0,clipped=0,sum=0;const sections=[];
  for(let i=0;i<data.length;i++){const value=data[i];if(!Number.isFinite(value))throw Error('Non-finite audio');peak=Math.max(peak,Math.abs(value));if(Math.abs(value)>=1)clipped++;sum+=value*value;pcm[i]=Math.max(-32768,Math.min(32767,Math.round(value*32767)));}
  for(let s=0;s<seconds;s+=8){let sum=0;for(let i=s*sampleRate;i<(s+8)*sampleRate;i++)sum+=data[i]*data[i];sections.push(Math.sqrt(sum/(8*sampleRate)));}
  stop();
  let bytes='';const raw=new Uint8Array(pcm.buffer);for(let i=0;i<raw.length;i+=8192)bytes+=String.fromCharCode(...raw.subarray(i,i+8192));
  return {sampleRate,seconds,peak,clipped,rms:Math.sqrt(sum/data.length),sections,base64:btoa(bytes)};
 },{wave,duration});
 const pcm=Buffer.from(result.base64,'base64'),header=Buffer.alloc(44);
 header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(result.sampleRate,24);header.writeUInt32LE(result.sampleRate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
 writeFileSync(file,Buffer.concat([header,pcm]));delete result.base64;console.log(JSON.stringify({file,wave,duration,...result}));
 if(result.clipped||result.rms<.005)throw Error('Invalid or clipped music render');
}finally{await browser.close()}
