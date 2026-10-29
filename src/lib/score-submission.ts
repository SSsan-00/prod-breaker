import { defaultNames, validName } from "./leaderboard";
import { read, write } from "./storage";

type PendingScore = { name: string; duration: number; score: number; runId: string };
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
export function enqueueScore(score: Omit<PendingScore, "name">) {
  const queue = getQueue();
  if (!queue.some((entry) => entry.runId === score.runId)) {
    queue.push({ ...score, name: playerName() });
    setQueue(queue);
  }
  void flushScores();
}
export async function flushScores() {
  if (flushing) return;
  flushing = true;
  try {
    while (getQueue().length) {
      const entry = getQueue()[0];
      const response = await fetch("/api/leaderboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) });
      if (!response.ok) break;
      setQueue(getQueue().filter((item) => item.runId !== entry.runId));
    }
  } catch { /* Keep pending scores for the next visit or reconnection. */ }
  finally { flushing = false; }
}
