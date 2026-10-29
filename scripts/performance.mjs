// Node 24+: compare a committed simulation with the current code, without network access.
// Usage: node scripts/performance.mjs --baseline d80f6ce
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import * as current from '../src/game/survivor.ts';

const ref = process.argv[process.argv.indexOf('--baseline') + 1];
if (!process.argv.includes('--baseline') || !ref) throw new Error('Provide --baseline <commit>');
const directory = mkdtempSync(join(tmpdir(), 'prod-breaker-perf-'));
try {
  const file = join(directory, 'survivor.ts');
  writeFileSync(file, execFileSync('git', ['show', `${ref}:src/game/survivor.ts`]));
  const baseline = await import(pathToFileURL(file).href);
  let compared = 0;
  for (const [seed, duration, extended] of [[13, 90, false], [42, 180, false], [177, 300, false], [42, 1800, true]]) {
    let before = baseline.createWorld(seed, duration);
    // Keep this synthetic endurance trace alive to exercise all 60 ENDLESS waves.
    if (extended) before.player.invulnerable = duration + 1;
    let after = structuredClone(before);
    for (let frame = 0; frame <= duration * 30 + 1; frame++) {
      if (before.phase === 'upgrade') {
        const choice = before.choices.find(id => baseline.evolutionReady(before, id)) ?? before.choices[0];
        before = baseline.chooseUpgrade(before, choice);
        after = current.chooseUpgrade(after, choice);
      }
      const angle = Math.floor(frame / 150) * Math.PI / 2;
      const input = { x: Math.cos(angle), y: Math.sin(angle), panic: before.panicCooldown <= 0 };
      before = baseline.stepWorld(before, input);
      after = current.stepWorld(after, input);
      assert.deepStrictEqual(after, before, `Mismatch: seed=${seed} duration=${duration} frame=${frame}`);
      compared++;
      if (before.phase === 'won' || before.phase === 'lost') break;
    }
    console.log(`Exact replay: seed=${seed} duration=${duration} time=${before.time.toFixed(1)} phase=${before.phase}`);
  }
  console.log(`${compared} complete states matched, including score, RNG, entities, projectiles and effects.`);

  const opening = baseline.createWorld(42, 1800);
  const crowded = baseline.createWorld(42, 1800);
  Object.assign(crowded, { time: 700, bossWave: 23, spawnTimer: 10, serverTimer: 10, shotTimer: 10 });
  crowded.entities = Array.from({ length: 100 }, (_, i) => ({ id: 100+i, x: 600+(i%10)*80, y: 600+Math.floor(i/10)*80, hp: 20000, maxHp: 20000, kind: i%8===0?'boss':i%7===0?'repair':i%3===0?'drone':'server', label: 'SERVER', flash: 0 }));
  crowded.shots = Array.from({ length: 120 }, (_, i) => ({ id: 300+i, x: 800+(i%12)*80, y: 700+Math.floor(i/12)*80, vx: 200, vy: 200, life: 1, damage: 18, pierce: 1, hit: [] }));
  crowded.pickups = Array.from({ length: 160 }, (_, i) => ({ id: 500+i, x: 700+(i%16)*35, y: 700+Math.floor(i/16)*35, value: 3 }));
  crowded.effects = Array.from({ length: 100 }, (_, i) => ({ id: 700+i, x: 800, y: 800, kind: i%2?'arc':'explosion', text: '', life: .3, maxLife: .65, to: crowded.entities[i] }));
  const input = { x: 1, y: 0 };
  for (const [name, state] of [['opening', opening], ['crowded', crowded]]) {
    assert.deepStrictEqual(current.stepWorld(state, input), baseline.stepWorld(state, input));
    const run = (fn, count) => { const start = performance.now(); for (let i=0; i<count; i++) fn(state, input); return (performance.now()-start)/count; };
    run(baseline.stepWorld, 500); run(current.stepWorld, 500);
    const samples = [[], []];
    for (let sample=0; sample<7; sample++) {
      const order = sample%2 ? [1, 0] : [0, 1];
      for (const index of order) samples[index].push(run(index ? current.stepWorld : baseline.stepWorld, 1000));
    }
    const [oldMs, newMs] = samples.map(s => s.sort((a,b) => a-b)[3]);
    console.log(JSON.stringify({ workload: name, baselineMs: +oldMs.toFixed(4), currentMs: +newMs.toFixed(4), reductionPercent: +((1-newMs/oldMs)*100).toFixed(1) }));
  }
} finally { rmSync(directory, { recursive: true, force: true }); }
