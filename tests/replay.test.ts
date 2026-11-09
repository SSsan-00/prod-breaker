import { describe, expect, it } from "vitest";
import { createWorld, step, choose, ready } from "../src/game/engine";
import { finishReplay, recordInput, verifyReplay, type Recorder } from "../src/game/replay";
import { validName, defaultNames, randomPlayerName } from "../src/lib/leaderboard";
export function completedRun(duration = 90) {
  let w = createWorld(42, duration);
  const record: Recorder = { seed: 42, bytes: [], upgrades: [] };
  while (w.phase === "playing" || w.phase === "upgrade") {
    if (w.phase === "upgrade") {
      const id = w.choices.find((id) => ready(w, id)) ?? w.choices[0];
      record.upgrades.push([record.bytes.length / 3, id]);
      w = choose(w, id); continue;
    }
    const target = w.facilities.find((f) => !f.active) ?? { x: 450, y: 580 };
    const dx = target.x - w.player.x, dy = target.y - w.player.y, len = Math.hypot(dx, dy);
    w = step(w, recordInput(record, { x: len > 20 ? dx / len : 0, y: len > 20 ? dy / len : 0, panic: w.enemies.length > 8 && w.time >= w.panicAt }));
    if (record.bytes.length > (duration * 30 + 2) * 3) throw Error("Did not terminate");
  }
  return { w, replay: finishReplay(record) };
}
describe("verified shared scores", () => {
  it.each([90,180,300])("replays complete %i-second runs exactly", (duration) => {
    const {w,replay} = completedRun(duration);
    expect(w.phase).toBe("won");
    expect(replay.upgrades.length).toBeGreaterThan(0);
    expect(verifyReplay(replay,duration,w.score)).toBe(true);
    expect(verifyReplay(replay,duration,w.score+1)).toBe(false);
  });
  it("rejects incomplete, modified, oversized and invalid play records", () => {
    const {w,replay}=completedRun();
    expect(verifyReplay({...replay,inputs:replay.inputs.slice(0,-4)},90,w.score)).toBe(false);
    expect(verifyReplay({...replay,upgrades:[]},90,w.score)).toBe(false);
    expect(verifyReplay({...replay,upgrades:[[1,"made-up"]]},90,w.score)).toBe(false);
    expect(verifyReplay({...replay,inputs:"AAAA".repeat(9002)},90,w.score)).toBe(false);
    expect(verifyReplay({...replay,inputs:"////"},90,w.score)).toBe(false);
    expect(verifyReplay({...replay,version:99},90,w.score)).toBe(false);
    expect(verifyReplay(null,90,w.score)).toBe(false);
    expect(verifyReplay(replay,1800,w.score)).toBe(false);
  });
  it("preserves movement direction and sanitizes nonfinite controls", () => {
    const r:Recorder={seed:1,bytes:[],upgrades:[]};
    const input=recordInput(r,{x:4,y:2});expect(input.x/input.y).toBeCloseTo(2,1);
    expect(recordInput(r,{x:NaN,y:Infinity})).toEqual({x:0,y:0,panic:false});
  });
  it("accepts safe names and every compact random name, rejects control characters", () => {
    for(const name of defaultNames){expect(validName(name)).toBe(true);expect([...name].length).toBeLessThanOrEqual(12);expect(randomPlayerName(name)).not.toBe(name);}
    for(const name of ["", " ","a\nb","a\u200bb","あ".repeat(21)])expect(validName(name)).toBe(false);
    expect(validName("あ".repeat(20))).toBe(true);
  });
});
