import { createWorld, step, choose, type Input, type SkillId } from "./engine";
export type Replay = { version: 1; seed: number; inputs: string; upgrades: [number, SkillId][] };
export type Recorder = { seed: number; bytes: number[]; upgrades: [number, SkillId][] };
export function recordInput(record: Recorder, input: Input): Input {
  const rawX = Number.isFinite(input.x) ? input.x : 0, rawY = Number.isFinite(input.y) ? input.y : 0;
  const length = Math.max(1, Math.hypot(rawX, rawY));
  const x = Math.round(rawX / length * 127);
  const y = Math.round(rawY / length * 127);
  record.bytes.push(x + 127, y + 127, input.panic ? 1 : 0);
  return { x: x / 127, y: y / 127, panic: !!input.panic };
}
export function finishReplay(record: Recorder): Replay {
  let binary = "";
  for (const byte of record.bytes) binary += String.fromCharCode(byte);
  return { version: 1, seed: record.seed, inputs: btoa(binary), upgrades: record.upgrades.map(([frame, id]) => [frame, id]) };
}
/** Re-simulate only bounded, valid inputs. Never accept a client-supplied score on its own. */
export function verifyReplay(value: unknown, duration: number, score: number): boolean {
  try {
    if (![90, 180, 300].includes(duration) || !Number.isSafeInteger(score) || score < 0 || !value || typeof value !== "object") return false;
    const r = value as Replay;
    if (r.version !== 1 || !Number.isInteger(r.seed) || r.seed < 0 || r.seed > 0xffffffff || typeof r.inputs !== "string" || r.inputs.length > (duration * 30 + 2) * 4 || !/^(?:[A-Za-z0-9+/]{4})*$/.test(r.inputs) || !Array.isArray(r.upgrades) || r.upgrades.length > 500) return false;
    if (r.upgrades.some((u, i) => !Array.isArray(u) || u.length !== 2 || !Number.isInteger(u[0]) || u[0] < 1 || typeof u[1] !== "string" || (i > 0 && u[0] <= r.upgrades[i - 1][0]))) return false;
    const bytes = atob(r.inputs);
    if (!bytes.length || bytes.length % 3) return false;
    let w = createWorld(r.seed, duration), upgrade = 0;
    for (let offset = 0; offset < bytes.length; offset += 3) {
      const frame = offset / 3;
      if (w.phase === "upgrade") {
        const u = r.upgrades[upgrade++];
        if (!u || u[0] !== frame || !w.choices.includes(u[1])) return false;
        w = choose(w, u[1]);
      }
      if (w.phase !== "playing" || (r.upgrades[upgrade] && r.upgrades[upgrade][0] <= frame)) return false;
      const x = bytes.charCodeAt(offset), y = bytes.charCodeAt(offset + 1), panic = bytes.charCodeAt(offset + 2);
      if (x > 254 || y > 254 || panic > 1) return false;
      w = step(w, { x: (x - 127) / 127, y: (y - 127) / 127, panic: panic === 1 });
    }
    return upgrade === r.upgrades.length && (w.phase === "won" || w.phase === "lost") && w.score === score;
  } catch { return false; }
}
