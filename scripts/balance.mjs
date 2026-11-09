import { createWorld, step, choose, ready } from "../src/game/engine.ts";
for (const duration of [90, 180, 300]) {
  const results = [];
  for (const seed of [1, 14, 42, 99, 123]) {
    let w = createWorld(seed, duration),
      frames = 0;
    const started = performance.now();
    while (w.phase === "playing" || w.phase === "upgrade") {
      if (w.phase === "upgrade") {
        w = choose(
          w,
          w.choices.find((id) => ready(w, id)) ??
            w.choices.find((id) =>
              [
                "input",
                "prepared",
                "edr",
                "rules",
                "waf",
                "rate",
                "patch",
                "backup",
              ].includes(id),
            ) ??
            w.choices[0],
        );
        continue;
      }
      const target = w.facilities.find((f) => !f.active) ?? {
        x: 450 + Math.cos(w.time * 0.3) * 140,
        y: 450 + Math.sin(w.time * 0.3) * 140,
      };
      const dx = target.x - w.player.x,
        dy = target.y - w.player.y,
        len = Math.hypot(dx, dy);
      w = step(w, {
        x: len > 20 ? dx / len : 0,
        y: len > 20 ? dy / len : 0,
        panic: w.time >= w.panicAt && w.enemies.length > 8,
      });
      frames++;
      if (frames > duration * 31) throw Error("Run did not end");
    }
    results.push({
      seed,
      time: +w.time.toFixed(1),
      phase: w.phase,
      core: Math.round(w.core),
      hp: Math.round(w.player.hp),
      kills: w.kills,
      level: w.level,
      evolved: w.evolutions.length,
      score: w.score,
      cpuMs: +(performance.now() - started).toFixed(0),
    });
  }
  console.log(duration, JSON.stringify(results));
}
