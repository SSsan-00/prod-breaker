// Keep this version immutable so runs started before a deploy still validate.
import * as v1 from "./replay-engine-v1";
import * as v2 from "./replay-engine-v2";

/** Check the entire run rather than trusting a client-provided score. */
export function verifyReplay(value: unknown, duration: number, score: number): boolean {
  if (!value || typeof value !== "object") return false;
  const replay = value as Record<string, unknown>;
  if ((replay.version !== 1 && replay.version !== 2) || !Number.isInteger(replay.seed) || (replay.seed as number) < 0 || (replay.seed as number) > 0xffffffff ||
      typeof replay.inputs !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(replay.inputs) ||
      !Array.isArray(replay.upgrades) || replay.upgrades.length > 1000) return false;
  const maxFrames = (duration === 1800 ? 2100 : duration) * 30 + 2;
  if (replay.inputs.length > Math.ceil(maxFrames * 3 / 3) * 4) return false;
  const inputs = Buffer.from(replay.inputs, "base64");
  if (!inputs.length || inputs.length % 3 || inputs.length / 3 > maxFrames) return false;
  const engine = replay.version === 1 ? v1 : v2;
  let w = engine.createWorld(replay.seed as number, duration), upgradeIndex = 0;
  try {
    for (let i = 0; i < inputs.length / 3; i++) {
      if (w.phase === "upgrade") {
        const choice = replay.upgrades[upgradeIndex++];
        if (!Array.isArray(choice) || choice.length !== 2 || choice[0] !== i || typeof choice[1] !== "string") return false;
        w = engine.chooseUpgrade(w, choice[1] as v1.UpgradeId);
      }
      if (w.phase !== "playing" || inputs[3 * i] > 254 || inputs[3 * i + 1] > 254 || inputs[3 * i + 2] > 1) return false;
      w = engine.stepWorld(w, { x: (inputs[3 * i] - 127) / 127, y: (inputs[3 * i + 1] - 127) / 127, panic: inputs[3 * i + 2] === 1 });
    }
    return upgradeIndex === replay.upgrades.length && (w.phase === "won" || w.phase === "lost") && w.score === score;
  } catch { return false; }
}
