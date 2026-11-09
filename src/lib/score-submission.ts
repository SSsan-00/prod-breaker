import { load, save } from "./storage";
import { randomPlayerName, validName } from "./leaderboard";
import type { Replay } from "@/game/replay";
export type ScoreSubmission = { duration: number; score: number; runId: string; replay: Replay };
type Pending = ScoreSubmission & { name: string };
let fallbackName = "";
let fallbackQueue: Pending[] = [];
let flushing: Promise<void> | null = null;
export function playerName() {
  const name = load<unknown>("pk-player-name", fallbackName);
  if (validName(name)) return name;
  fallbackName = randomPlayerName();
  save("pk-player-name", fallbackName);
  return fallbackName;
}
export function savePlayerName(name: string) {
  if (!validName(name)) return;
  fallbackName = name;
  save("pk-player-name", name);
}
function queue(): Pending[] {
  const data = load<unknown>("pk-pending-scores", fallbackQueue);
  return Array.isArray(data) ? data.filter((item): item is Pending => !!item && typeof item === "object" && typeof item.runId === "string" && validName(item.name) && !!item.replay) : fallbackQueue;
}
function persist(items: Pending[]) { fallbackQueue = items; save("pk-pending-scores", items); }
export function enqueueScore(score: ScoreSubmission) {
  persist([...queue().filter((item) => item.runId !== score.runId), { ...score, name: playerName() }].slice(-20));
  return flushScores();
}
export function flushScores(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    try {
      while (queue().length) {
        const item = queue()[0];
        const response = await fetch("/api/leaderboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item), signal: AbortSignal.timeout(60000) });
        if (!response.ok && ![400, 409, 413].includes(response.status)) break;
        persist(queue().filter((p) => p.runId !== item.runId || p.name !== item.name));
        window.dispatchEvent(new CustomEvent("pk:score-saved", { detail: { runId: item.runId, ok: response.ok } }));
      }
    } catch { /* Keep queued scores for reconnection or the next visit. */ }
  })().finally(() => { flushing = null; });
  return flushing;
}
