"use client";
import { useEffect, useRef, useState } from "react";
import { durations, modeLabel, validName, type ScoreEntry } from "@/lib/leaderboard";
import { enqueueScore, playerName, savePlayerName } from "@/lib/score-submission";

type Props = { duration: number; currentScore?: { runId: string; duration: number; score: number }; onClose: () => void };
export default function Leaderboard({ duration, currentScore, onClose }: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const [name, setName] = useState("");
  const [mode, setMode] = useState(duration);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [message, setMessage] = useState("読み込み中…");
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
      setName(playerName());
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
  }, [mode]);
  function submit() {
    const cleaned = name.trim();
    if (!validName(cleaned)) { setMessage("名前は1〜20文字で入力してください。"); return; }
    setName(cleaned); savePlayerName(cleaned);
    if (currentScore) enqueueScore(currentScore);
    setMessage(currentScore ? "名前を保存しました。今回のスコアにも反映します。" : "名前を保存しました。次回からこの名前で登録されます。");
  }
  return <div className="modal-backdrop leaderboard-backdrop"><section ref={dialogRef} className="modal leaderboard" role="dialog" aria-modal="true" aria-label="スコアボード">
    <button autoFocus className="close" aria-label="閉じる" onClick={onClose}>×</button>
    <div className="eyebrow">PRODUCTION INCIDENTS / GLOBAL</div><h2>SCOREBOARD</h2>
    <label className="player-name"><span>プレイヤー名</span><input aria-label="プレイヤー名" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></label>
    <button className="primary leaderboard-submit" onClick={submit}>名前を保存</button>
    <p className="leaderboard-note">スコアはプレイ終了時に名前とともに自動公開されます。</p>
    <div className="leaderboard-modes" role="group" aria-label="ランキングのモード">{durations.map((d) => <button key={d} aria-pressed={mode === d} onClick={() => setMode(d)}>{modeLabel[d]}</button>)}</div>
    <div className="leaderboard-list" aria-live="polite">{message ? <p>{message}</p> : <ol>{scores.map((entry, i) => <li key={`${entry.created_at}-${i}`}><span>{i + 1}</span><b>{entry.player_name}</b><strong>{Number(entry.score).toLocaleString()} BP</strong></li>)}</ol>}</div>
  </section></div>;
}
