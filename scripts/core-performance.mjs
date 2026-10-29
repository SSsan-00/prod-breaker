// Chromium synthetic worst case; compare the committed baseline with this checkout.
// Run with Node 24: node scripts/core-performance.mjs [baseline-ref]
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { chromium } from '@playwright/test';
import { createWorld } from '../src/game/survivor.ts';
const ref = process.argv[2] ?? 'HEAD';
const source = (path, baseline) => baseline ? execFileSync('git', ['show', `${ref}:${path}`], {encoding:'utf8'}) : readFileSync(path,'utf8');
const compile = (s) => ts.transpileModule(s, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/^import .*;$/gm,'').replace(/^export /gm,'');
const browser=await chromium.launch({headless:true});
try {
 for(const n of [100,150,200]) for(const baseline of [true,false]) {
  const page=await browser.newPage({viewport:{width:393,height:700},deviceScaleFactor:2});
  const cdp=await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.setContent('<style>body{margin:0}canvas{width:100vw;height:100vh}</style><canvas></canvas>');
  // Lift only the synthetic fixture's cap to compare candidate population sizes.
  const engine=compile(source('src/game/survivor.ts',baseline)).replace('const entityLimit = secret ? 150 : 100;', 'const entityLimit = 1000;').replace('nearby.length > 100','nearby.length > 1000').replace('.slice(-100);\n    const others','.slice(-1000);\n    const others').replace('const remaining = 100 - bosses.length','const remaining = 1000 - bosses.length').replace('100 - w.entities.length','1000 - w.entities.length');
  const arena=compile(source('src/components/Arena.tsx',baseline)).replace('default function Arena','function Arena');
  await page.addScriptTag({content:`(()=>{${engine};window.stepWorld=stepWorld;})()`});
  await page.addScriptTag({content:`(()=>{const _jsx=()=>null;const useRef=()=>({current:document.querySelector('canvas')});const useEffect=fn=>window.cleanup=fn();${arena};window.startArena=Arena;})()`});
  const w=createWorld(42,1800); Object.assign(w,{time:1850,bossWave:61,spawnTimer:100,serverTimer:100,shotTimer:100}); w.player.invulnerable=100;
  w.entities=Array.from({length:n},(_,i)=>({id:1000+i,x:700+(i%20)*30,y:700+Math.floor(i/20)*30,hp:50000,maxHp:50000,kind:'boss',label:'SRE CORE',flash:0}));
  w.shots=Array.from({length:120},(_,i)=>({id:2000+i,x:700+(i%20)*30,y:700+Math.floor(i/20)*30,vx:0,vy:0,life:2,damage:20,pierce:1,hit:[]}));
  w.effects=Array.from({length:100},(_,i)=>({id:3000+i,x:800+(i%10)*30,y:800+Math.floor(i/10)*30,kind:i%2?'arc':'explosion',text:'',life:.3,maxLife:.65,to:w.entities[i]}));
  const result=await page.evaluate(async(w)=>{
   const drawTimes=[],stepTimes=[];let frames=0,active=true;const original=window.requestAnimationFrame.bind(window);
   window.requestAnimationFrame=(cb)=>original((t)=>{const a=performance.now();cb(t);drawTimes.push(performance.now()-a)});
   const ref={current:w};const stick={current:{active:false,origin:{x:0,y:0},current:{x:0,y:0}}};
   window.startArena({world:ref,input:{current:{x:0,y:0}},stick,reduced:false,onBlur(){}});
   const started=performance.now();let last=0;function tick(t){frames++;if(t-last>=32){const a=performance.now();ref.current=window.stepWorld(w,{x:0,y:0});stepTimes.push(performance.now()-a);last=t;}if(active)original(tick)}original(tick);
   await new Promise(r=>setTimeout(r,2500));active=false;window.cleanup();
   const stats=(a)=>{a.sort((x,y)=>x-y);return {median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)]}};
   return {fps:frames*1000/(performance.now()-started),draw:stats(drawTimes),step:stats(stepTimes)};
  },w);
  console.log(JSON.stringify({entities:n,version:baseline?'baseline':'current',cpuThrottle:4,...result}));await page.close();
 }
}finally{await browser.close()}
