"use client";
import { useEffect, useRef, useState } from "react";
import { defaultNames, durations, modeLabel, validName, type ScoreEntry } from "@/lib/leaderboard";
import { read, write } from "@/lib/storage";

type Props = { duration: number; score?: number; runId: string; submitted: boolean; onSubmitted: () => void; onClose: () => void };
export default function Leaderboard({ duration, score, runId, submitted, onSubmitted, onClose }: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const [name, setName] = useState("");
  const [mode, setMode] = useState(duration);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [message, setMessage] = useState("読み込み中…");
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? []);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, [onClose]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const saved = read("pb-player-name", "");
      const initial = validName(saved) ? saved : defaultNames[Math.floor(Math.random() * defaultNames.length)];
      setName(initial);
      write("pb-player-name", initial);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/leaderboard?duration=${mode}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data: { scores: ScoreEntry[] }) => { setScores(data.scores); setMessage(data.scores.length ? "" : "まだスコアはありません。"); })
      .catch(() => { if (!controller.signal.aborted) { setScores([]); setMessage("スコアボードを読み込めませんでした。時間をおいて再試行してください。"); } });
    return () => controller.abort();
  }, [mode, revision]);
  async function submit() {
    const cleaned = name.trim();
    if (!validName(cleaned)) { setMessage("名前は1〜20文字で入力してください。"); return; }
    setName(cleaned); write("pb-player-name", cleaned);
    if (score === undefined) { setMessage("名前を保存しました。"); return; }
    setPending(true);
    try {
      const response = await fetch("/api/leaderboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: cleaned, duration, score, runId }) });
      if (!response.ok) throw new Error();
      onSubmitted(); setMode(duration); setRevision((n) => n + 1);
    } catch { setMessage("登録できませんでした。時間をおいて再試行してください。"); }
    finally { setPending(false); }
  }
  return <div className="modal-backdrop leaderboard-backdrop"><section ref={dialogRef} className="modal leaderboard" role="dialog" aria-modal="true" aria-label="スコアボード">
    <button className="close" aria-label="閉じる" onClick={onClose}>×</button>
    <div className="eyebrow">PRODUCTION INCIDENTS / GLOBAL</div><h2>SCOREBOARD</h2>
    <label className="player-name"><span>プレイヤー名</span><input autoFocus aria-label="プレイヤー名" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></label>
    <button className="primary leaderboard-submit" disabled={pending || submitted} onClick={submit}>{submitted ? "登録済み ✓" : score === undefined ? "名前を保存" : `今回の ${score.toLocaleString()} BP を登録`}</button>
    <p className="leaderboard-note">名前とスコアは全員に公開されます。</p>
    <div className="leaderboard-modes" role="group" aria-label="ランキングのモード">{durations.map((d) => <button key={d} aria-pressed={mode === d} onClick={() => setMode(d)}>{modeLabel[d]}</button>)}</div>
    <div className="leaderboard-list" aria-live="polite">{message ? <p>{message}</p> : <ol>{scores.map((entry, i) => <li key={`${entry.created_at}-${i}`}><span>{i + 1}</span><b>{entry.player_name}</b><strong>{Number(entry.score).toLocaleString()} BP</strong></li>)}</ol>}</div>
  </section></div>;
}
