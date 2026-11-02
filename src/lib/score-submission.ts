import { defaultNames, validName } from "./leaderboard";
import { read, write } from "./storage";
import type { Replay } from "@/game/replay";

export type ScoreSubmission = { duration: number; score: number; runId: string; replay: Replay };
type PendingScore = ScoreSubmission & { name: string };
const queueKey = "pb-pending-scores";
let fallbackName = "";
let fallbackQueue: PendingScore[] = [];
let flushing = false;

export function playerName(): string {
  const saved = read("pb-player-name", fallbackName);
  if (validName(saved)) return saved;
  fallbackName = defaultNames[Math.floor(Math.random() * defaultNames.length)];
  write("pb-player-name", fallbackName);
  return fallbackName;
}
export function savePlayerName(name: string) {
  fallbackName = name;
  write("pb-player-name", name);
}
function getQueue(): PendingScore[] {
  const saved = read<unknown>(queueKey, fallbackQueue);
  return Array.isArray(saved) ? saved as PendingScore[] : fallbackQueue;
}
function setQueue(queue: PendingScore[]) {
  fallbackQueue = queue;
  write(queueKey, queue);
}
export function enqueueScore(score: ScoreSubmission) {
  const queue = getQueue().filter((entry) => entry.runId !== score.runId);
  queue.push({ ...score, name: playerName() });
  setQueue(queue);
  void flushScores();
}
export async function flushScores() {
  if (flushing) return;
  flushing = true;
  try {
    while (getQueue().length) {
      const entry = getQueue()[0];
      const response = await fetch("/api/leaderboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) });
      // Old unverified submissions cannot be accepted, and must not block newer runs.
      if (!response.ok && response.status !== 400 && response.status !== 413) break;
      setQueue(getQueue().filter((item) => item.runId !== entry.runId || item.name !== entry.name));
    }
  } catch { /* Keep pending scores for the next visit or reconnection. */ }
  finally { flushing = false; }
}
