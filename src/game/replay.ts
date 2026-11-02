import type { Input, UpgradeId } from "./survivor";

export type Replay = { version: 1; seed: number; inputs: string; upgrades: [number, UpgradeId][] };
export type Recorder = { seed: number; inputs: number[]; upgrades: [number, UpgradeId][] };

export function recordInput(recorder: Recorder, input: Input): Input {
  const quantize = (n: number) => Math.round(Math.max(-1, Math.min(1, Number.isFinite(n) ? n : 0)) * 127);
  const x = quantize(input.x), y = quantize(input.y);
  recorder.inputs.push(x + 127, y + 127, input.panic ? 1 : 0);
  return { x: x / 127, y: y / 127, panic: !!input.panic };
}

export function finishReplay(recorder: Recorder): Replay {
  let bytes = "";
  for (let i = 0; i < recorder.inputs.length; i += 8192)
    bytes += String.fromCharCode(...recorder.inputs.slice(i, i + 8192));
  return { version: 1, seed: recorder.seed, inputs: btoa(bytes), upgrades: recorder.upgrades };
}
