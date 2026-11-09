"use client";
import { useEffect, useRef, useState } from "react";
import { durations, modeLabel, randomPlayerName, validName, type ScoreEntry } from "@/lib/leaderboard";
import { enqueueScore, playerName, savePlayerName, type ScoreSubmission } from "@/lib/score-submission";
export default function Leaderboard({ duration, currentScore, onClose, onName }: { duration: number; currentScore?: ScoreSubmission; onClose: () => void; onName: (name: string) => void }) {
  const ref = useRef<HTMLElement>(null);
  const [name, setName] = useState(playerName);
  const [mode, setMode] = useState(duration);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [status, setStatus] = useState("読み込み中…");
  const [notice, setNotice] = useState("");
  const [revision, refresh] = useState(0);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const saved = () => refresh((r) => r + 1);
    window.addEventListener("pk:score-saved", saved);
    return () => { window.removeEventListener("pk:score-saved", saved); if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/leaderboard?duration=${mode}`, { cache: "no-store", signal: controller.signal })
      .then(async (r) => { if (!r.ok) throw Error(); return r.json() as Promise<{ scores: ScoreEntry[] }>; })
      .then((data) => { setScores(data.scores); setStatus(data.scores.length ? "" : "最初の防衛記録を残そう。"); })
      .catch(() => { if (!controller.signal.aborted) { setScores([]); setStatus("スコアを読み込めませんでした。"); } });
    return () => controller.abort();
  }, [mode, revision]);
  function saveName() {
    const cleaned = name.trim();
    if (!validName(cleaned)) { setNotice("名前は1〜20文字で入力してください。"); return; }
    setName(cleaned); savePlayerName(cleaned); onName(cleaned);
    setNotice(currentScore ? "名前を保存しました。今回の記録にも反映します。" : "名前を保存しました。");
    if (currentScore) void enqueueScore(currentScore);
  }
  return <div className="backdrop"><section className="dialog leaderboard" ref={ref} role="dialog" aria-modal="true" aria-label="スコアボード" onKeyDown={(e) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    if (e.key !== "Tab") return;
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input") ?? []);
    if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items.at(-1)?.focus(); }
    else if (!e.shiftKey && document.activeElement === items.at(-1)) { e.preventDefault(); items[0]?.focus(); }
  }}>
    <div className="dialog-top"><span className="eyebrow">GLOBAL DEFENSE RECORDS</span><button className="icon-button" aria-label="閉じる" onClick={onClose}>×</button></div>
    <div className="board-heading"><h2>SCOREBOARD<span>本番を守った、その記録。</span></h2><span className="board-emblem" aria-hidden="true"><svg viewBox="0 0 40 44" fill="none"><path d="m20 2 16 6v14c0 9-16 19-16 19S4 31 4 22V8Z" stroke="currentColor"/><path d="m12 21 6 6 11-13" stroke="currentColor" strokeWidth="2"/></svg></span></div>
    <div className="name-editor"><label htmlFor="keeper-name">プレイヤー名</label><div className="name-field"><input id="keeper-name" value={name} maxLength={40} autoComplete="nickname" spellCheck={false} onChange={(e) => setName(e.target.value)} /><button className="random-name" aria-label="名前をランダムに変更" onClick={() => setName(randomPlayerName(name))}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h3c4 0 5 10 10 10h3m-3-3 3 3-3 3M4 17h3c1.7 0 2.8-1.8 3.9-3.8M13.1 10.8C14.2 8.8 15.3 7 17 7h3m-3-3 3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div></div>
    <div className="name-actions"><button className="secondary" onClick={saveName}>名前を保存</button><p>プレイ終了時に<br/>名前とスコアを自動公開します。</p></div>
    <p className="name-notice" role="status">{notice}</p>
    <div className="ranking-modes" role="group" aria-label="ランキングのモード">{durations.map((d) => <button key={d} aria-pressed={mode === d} onClick={() => { setMode(d); setScores([]); setStatus("読み込み中…"); }}>{modeLabel[d]}<small>{d === 90 ? "90秒" : `${d / 60}分`}</small></button>)}</div>
    <div className="ranking-caption"><span>RANK / DEFENDER</span><span>DEFENSE BP</span></div>
    <div className="ranking-list" aria-live="polite">{status ? <div className="ranking-empty"><span aria-hidden="true">◇</span><p>{status}</p>{status.startsWith("スコア") && <button className="secondary" onClick={() => { setStatus("読み込み中…"); refresh((r) => r + 1); }}>再読み込み</button>}</div> : <ol>{scores.map((entry, i) => <li key={`${entry.created_at}-${i}`}><span className="rank">{String(i + 1).padStart(2, "0")}</span><b>{entry.player_name}</b><strong>{Number(entry.score).toLocaleString()}<small> BP</small></strong></li>)}</ol>}</div>
    <div className="ranking-footer"><i/>KEEP PRODUCTION ALIVE.<span>TOP 30</span></div>
  </section></div>;
}
