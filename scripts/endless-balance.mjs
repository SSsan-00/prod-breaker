// Fixed-input endurance probe; invulnerability is intentional and does not measure survival difficulty.
import {createWorld,stepWorld,chooseUpgrade,evolutionReady} from '../src/game/survivor.ts';
for (const seed of [17,42]) {
 let w=createWorld(seed,1800); w.player.invulnerable=2200;
 let sample=300;
 for(let frame=0;frame<64000 && w.phase!=='won';frame++){
  if(w.phase==='upgrade') w=chooseUpgrade(w,w.choices.find(id=>evolutionReady(w,id))??w.choices[0]);
  const angle=Math.floor(frame/150)*Math.PI/2;
  w=stepWorld(w,{x:Math.cos(angle),y:Math.sin(angle),panic:w.panicCooldown<=0});
  if(w.time>=sample || w.phase==='won'){
   const bosses=w.entities.filter(e=>e.kind==='boss');
   console.log(JSON.stringify({seed,time:Math.round(w.time),level:w.level,damage:Math.round(w.damage),cores:bosses.length,otherEnemies:w.entities.filter(e=>e.kind==='drone'||e.kind==='repair').length,maxCoreHp:Math.max(0,...bosses.map(e=>e.maxHp)),chain:w.maxCombo,phase:w.phase}));
   sample+=300;
  }
 }
}
