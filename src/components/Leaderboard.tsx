"use client";
import { useEffect, useRef, useState } from "react";
import { durations, modeLabel, randomPlayerName, validName, type ScoreEntry } from "@/lib/leaderboard";
import { enqueueScore, savePlayerName, type ScoreSubmission } from "@/lib/score-submission";

type Props = { initialName: string; duration: number; currentScore?: ScoreSubmission; onClose: () => void };
export default function Leaderboard({ initialName, duration, currentScore, onClose }: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const [name, setName] = useState(initialName);
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
    <div className="player-name"><label htmlFor="leaderboard-player-name"><span>プレイヤー名</span></label><input id="leaderboard-player-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /><button type="button" className="random-name" aria-label="名前をランダムに変更" title="名前をランダムに変更" onClick={() => setName((previous) => randomPlayerName(previous))}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M4 7h3c4 0 5 10 10 10h3m-3-3 3 3-3 3M4 17h3c1.7 0 2.8-1.8 3.9-3.8M13.1 10.8C14.2 8.8 15.3 7 17 7h3m-3-3 3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div>
    <button className="primary leaderboard-submit" onClick={submit}>名前を保存</button>
    <p className="leaderboard-note">プレイ終了時に名前とスコアを自動公開します。</p>
    <div className="leaderboard-modes" role="group" aria-label="ランキングのモード">{durations.map((d) => <button key={d} aria-pressed={mode === d} onClick={() => setMode(d)}>{modeLabel[d]}</button>)}</div>
    <div className="leaderboard-list" aria-live="polite">{message ? <p>{message}</p> : <ol>{scores.map((entry, i) => <li key={`${entry.created_at}-${i}`}><span>{i + 1}</span><b>{entry.player_name}</b><strong>{Number(entry.score).toLocaleString()} BP</strong></li>)}</ol>}</div>
  </section></div>;
}
