// Deterministic automated balance probe. This is not a substitute for human play.
import { createWorld, stepWorld, chooseUpgrade, evolutionReady } from '../src/game/survivor.ts';
const cases = [90, 180, 300];
const runs = [];
for (const duration of cases) for (const strategy of ['first', 'evolution']) for (const seed of [17, 42, 177]) {
  let w = createWorld(seed, duration);
  const seen = new Map(), samples = [];
  let previous = new Map();
  for (let frame = 0; frame < duration * 30 + 500 && !['won', 'lost'].includes(w.phase); frame++) {
    if (w.phase === 'upgrade') {
      const selected = strategy === 'evolution' ? w.choices.find(id => evolutionReady(w, id)) ?? w.choices[0] : w.choices[0];
      w = chooseUpgrade(w, selected);
    }
    const angle = Math.floor(frame / 150) * Math.PI / 2;
    w = stepWorld(w, { x: Math.cos(angle), y: Math.sin(angle), panic: w.panicCooldown <= 0 });
    const current = new Map(w.entities.filter(e => e.kind === 'boss').map(e => [e.id, e]));
    for (const [id, entity] of current) if (!seen.has(id)) seen.set(id, { time: w.time, wave: Math.floor(w.time / 30) + 1, hp: entity.maxHp });
    for (const [id] of previous) if (!current.has(id) && seen.has(id)) {
      const start = seen.get(id);
      samples.push({ ...start, survival: +(w.time - start.time).toFixed(2) });
      seen.delete(id);
    }
    previous = current;
  }
  const wave = n => {
    const durations = samples.filter(s => s.wave === n).map(s => s.survival).sort((a,b) => a-b);
    return durations.length ? { n: durations.length, median: durations[Math.floor(durations.length/2)], min: durations[0], max: durations.at(-1) } : null;
  };
  runs.push({duration, strategy, seed, phase: w.phase, time: +w.time.toFixed(1), level: w.level, evolutions: w.evolutions.length, damage: w.damage, chain: w.chainDamage, shots: w.multishot, fire: +w.fireInterval.toFixed(2), wave2: wave(2), wave3: wave(3), wave5: wave(5), wave8: wave(8), alive: seen.size});
}
console.log(JSON.stringify(runs, null, 2));
