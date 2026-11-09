"use client";
import { useEffect, useRef, useState } from "react";
import {
  createWorld,
  step,
  choose,
  ready,
  skills,
  recipes,
  report,
  STEP,
  type SkillId,
  type Point,
} from "@/game/engine";
import { load, save } from "@/lib/storage";
import { tone, music } from "@/lib/audio";
import Sentry from "./Sentry";
import Field from "./Field";
import Leaderboard from "./Leaderboard";
import { recordInput, finishReplay, type Recorder } from "@/game/replay";
import { enqueueScore, flushScores, playerName, type ScoreSubmission } from "@/lib/score-submission";
const modes = [
  { seconds: 90, name: "QUICK", time: "90 SEC", desc: "短いシフト" },
  { seconds: 180, name: "STANDARD", time: "3 MIN", desc: "いつもの本番" },
  { seconds: 300, name: "OVERTIME", time: "5 MIN", desc: "残業は計画的に" },
];
type Settings = { mute: boolean; reduced: boolean; volume: number };
export default function Game() {
  const [screen, setScreen] = useState<"home" | "run" | "result">("home"),
    [duration, setDuration] = useState(180),
    [modal, setModal] = useState<"help" | "settings" | "pause" | null>(null);
  const [w, setW] = useState(() => createWorld(1));
  const world = useRef(w),
    input = useRef<Point>({ x: 0, y: 0 }),
    keys = useRef(new Set<string>()),
    panic = useRef(false);
  const [settings, setSettings] = useState<Settings>({
      mute: true,
      reduced: false,
      volume: 0.5,
    }),
    [high, setHigh] = useState(0);
  const [scoreboard, setScoreboard] = useState(false);
  const [name, setName] = useState("");
  const [scoreStatus, setScoreStatus] = useState("登録待ち");
  const recorder = useRef<Recorder>({ seed: 1, bytes: [], upgrades: [] });
  const runId = useRef("");
  const lastScore = useRef<ScoreSubmission | undefined>(undefined);
  const [currentScore, setCurrentScore] = useState<ScoreSubmission>();
  useEffect(() => {
    const frame = requestAnimationFrame(() => { setName(playerName()); void flushScores(); });
    const retry = () => { void flushScores(); };
    const submitted = (event: Event) => {
      const detail = (event as CustomEvent<{ runId: string; ok: boolean }>).detail;
      if (detail.runId === lastScore.current?.runId) setScoreStatus(detail.ok ? "スコア登録済み" : "記録を検証できませんでした");
    };
    window.addEventListener("online", retry);
    window.addEventListener("pk:score-saved", submitted);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("online", retry); window.removeEventListener("pk:score-saved", submitted); };
  }, []);
  const dialogRef = useRef<HTMLElement>(null);
  const dialogOpen = !!modal || (screen === "run" && w.phase === "upgrade");
  useEffect(() => {
    if (!dialogOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [dialogOpen, modal]);
  const settingsRef = useRef(settings);
  const active = useRef(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const stored = load<unknown>("pk-settings", {});
      const raw =
        stored && typeof stored === "object"
          ? (stored as Partial<Settings>)
          : {};
      const next = {
        mute: typeof raw.mute === "boolean" ? raw.mute : true,
        reduced:
          typeof raw.reduced === "boolean"
            ? raw.reduced
            : matchMedia("(prefers-reduced-motion: reduce)").matches,
        volume:
          typeof raw.volume === "number" && Number.isFinite(raw.volume)
            ? Math.max(0, Math.min(1, raw.volume))
            : 0.5,
      };
      setSettings(next);
      setHigh(load("pk-best", 0));
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  const clear = () => {
    input.current = { x: 0, y: 0 };
    keys.current.clear();
    panic.current = false;
  };
  const requestPanic = () => {
    if (!active.current || world.current.phase !== "playing") return;
    panic.current = true;
  };
  useEffect(() => {
    active.current = screen === "run" && !modal && w.phase === "playing";
  }, [screen, modal, w.phase]);
  const musicActive =
    screen === "run" &&
    !modal &&
    (w.phase === "playing" || w.phase === "upgrade");
  useEffect(() => {
    if (!musicActive || settings.mute) return;
    return music(settings.volume, () => world.current.wave);
  }, [musicActive, settings.mute, settings.volume]);
  useEffect(() => {
    if (screen !== "run") return;
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input")) {
        if (e.code !== "Escape") return;
      }
      if (e.code === "Escape") {
        e.preventDefault();
        setModal((m) => (m ? ("pause" === m ? null : m) : "pause"));
        clear();
        return;
      }
      if (!active.current) return;
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "Space",
        ].includes(e.code)
      ) {
        e.preventDefault();
        keys.current.add(e.code);
        if (e.code === "Space" && !e.repeat) panic.current = true;
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const hide = () => {
      if (document.hidden) {
        clear();
        setModal((m) => m ?? "pause");
      }
    };
    const blur = () => {
      clear();
      setModal((m) => m ?? "pause");
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", blur);
      clear();
    };
  }, [screen]);
  useEffect(() => {
    if (screen !== "run" || modal || w.phase !== "playing") return;
    let frame = 0,
      last = 0,
      acc = 0,
      lastUI = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (document.hidden) {
        last = now;
        acc = 0;
        return;
      }
      if (!last) {
        last = now;
        return;
      }
      acc += Math.min(0.15, (now - last) / 1000);
      last = now;
      let changed = false;
      while (acc >= STEP && world.current.phase === "playing") {
        const before = world.current;
        const k = keys.current;
        const keyboard = {
          x:
            Number(k.has("KeyD") || k.has("ArrowRight")) -
            Number(k.has("KeyA") || k.has("ArrowLeft")),
          y:
            Number(k.has("KeyS") || k.has("ArrowDown")) -
            Number(k.has("KeyW") || k.has("ArrowUp")),
        };
        world.current = step(before, recordInput(recorder.current, {
          ...(keyboard.x || keyboard.y ? keyboard : input.current),
          panic: panic.current,
        }));
        panic.current = false;
        acc -= STEP;
        changed = true;
        const next = world.current,
          s = settingsRef.current;
        if (!s.mute) {
          if (next.panicUses > before.panicUses) tone("panic", s.volume);
          else if (next.phase === "upgrade") tone("upgrade", s.volume);
          else if (
            next.facilities.filter((f) => f.active).length >
            before.facilities.filter((f) => f.active).length
          )
            tone("rescue", s.volume);
          else if (
            next.kills > before.kills &&
            Math.floor(next.time * 5) !== Math.floor(before.time * 5)
          )
            tone("hit", s.volume);
        }
      }
      if (changed && (now - lastUI > 90 || world.current.phase !== "playing")) {
        lastUI = now;
        setW(world.current);
      }
      if (world.current.phase === "won" || world.current.phase === "lost") {
        const best = Math.max(load<number>("pk-best", 0), world.current.score);
        save("pk-best", best);
        setHigh(best);
        if (!lastScore.current) {
          lastScore.current = { duration: world.current.duration, score: world.current.score, runId: runId.current, replay: finishReplay(recorder.current) };
          setCurrentScore(lastScore.current);
          setScoreStatus("自動登録中・未接続時は再送");
          void enqueueScore(lastScore.current);
        }
        setScreen("result");
        clear();
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [screen, modal, w.phase]);
  const start = () => {
    clear();
    const param = new URLSearchParams(location.search).get("seed");
    const seed =
      param !== null && Number.isFinite(Number(param))
        ? Number(param) >>> 0
        : crypto.getRandomValues(new Uint32Array(1))[0];
    recorder.current = { seed, bytes: [], upgrades: [] };
    runId.current = crypto.randomUUID();
    lastScore.current = undefined;
    setScoreboard(false);
    world.current = createWorld(seed, duration);
    setW(world.current);
    setModal(null);
    setScreen("run");
    if (!settings.mute) tone("rescue", settings.volume);
  };
  const install = (id: SkillId) => {
    if (world.current.phase !== "upgrade") return;
    recorder.current.upgrades.push([recorder.current.bytes.length / 3, id]);
    world.current = choose(world.current, id);
    setW(world.current);
    clear();
    (document.activeElement as HTMLElement)?.blur();
    if (!settings.mute) tone("upgrade", settings.volume);
  };
  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    save("pk-settings", next);
  };
  const remaining = Math.max(0, Math.ceil(w.duration - w.time));
  const incident = report(w);
  const facilityCount = w.facilities.filter((f) => f.active).length;
  const close = () => {
    setModal(null);
    clear();
  };
  const open = (kind: typeof modal) => {
    clear();
    setModal(kind);
  };
  return (
    <main
      className={`app ${settings.reduced ? "reduced" : ""} ${screen}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <header className="topbar">
        <button
          className="brand"
          aria-label="PROD KEEPER ホーム"
          onClick={(e) => {
            e.preventDefault();
            if (screen === "run") open("pause");
            else {
              setScreen("home");
              setModal(null);
            }
          }}
        >
          <span className="brand-mark">
            P<span>⌁</span>K
          </span>
          <span className="brand-label">
            PROD KEEPER<small>SECURITY OPERATIONS</small>
          </span>
        </button>
        <div className="header-actions">
          <span className="system-status">
            <i /> SYSTEM OPERATIONAL
          </span>
          {screen !== "run" && <button className="score-button" onClick={() => setScoreboard(true)} aria-label="スコアボードを開く"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4Zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 1v5m-5 2h10" stroke="currentColor" strokeWidth="1.5"/></svg><span>SCORE</span></button>}
          <button
            className="icon-button"
            aria-label="ミュート切替"
            onClick={() => update({ mute: !settings.mute })}
          >
            {settings.mute ? "♪̸" : "♪"}
          </button>
          {screen === "run" ? (
            <button
              className="icon-button"
              aria-label="一時停止"
              onClick={() => open("pause")}
            >
              Ⅱ
            </button>
          ) : (
            <button
              className="icon-button"
              aria-label="設定"
              onClick={() => open("settings")}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M9 4h6l1 3 3 1v7l-3 1-1 4H9l-1-4-3-1V8l3-1z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
              </svg>
            </button>
          )}
        </div>
      </header>
      {screen === "home" ? (
        <section className="home-content">
          <div className="hero-copy">
            <div className="eyebrow">
              <span /> DEFENSE SURVIVOR / 01
            </div>
            <h1>
              今日も、
              <br />
              何も<span>起こさせない。</span>
            </h1>
            <p className="hero-description">
              迫る脅威を迎撃し、止まりかけた防衛網を取り戻す。
              <br className="desktop-break" />
              本番を守る、小さなあなたの大きなシフト。
            </p>
            <div className="mode-label">
              <span>SELECT YOUR SHIFT</span>
              <span>01 — 03</span>
            </div>
            <div className="modes">
              {modes.map((m) => (
                <button
                  key={m.seconds}
                  aria-pressed={duration === m.seconds}
                  className={duration === m.seconds ? "selected" : ""}
                  onClick={() => setDuration(m.seconds)}
                >
                  <span>{m.name}</span>
                  <b>{m.time}</b>
                  <small>{m.desc}</small>
                </button>
              ))}
            </div>
            <button className="primary start" onClick={start}>
              <span>
                START DEFENDING<small>防衛を開始する</small>
              </span>
              <span className="button-arrow">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M6 18 18 6M6 6h12v12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </span>
            </button>
            <div className="home-secondary">
              <button onClick={() => open("help")}>
                FIELD MANUAL <span>遊び方 ↗</span>
              </button>
              <a className="sister-link" href="https://prod-breaker.vercel.app/" target="_blank" rel="noopener noreferrer" aria-label="姉妹作 PROD BREAKER を開く（壊す側へ）">
                <span><small>姉妹作 / 壊す側へ</small><b>PROD BREAKER</b></span>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12" stroke="currentColor" strokeWidth="1.5"/></svg>
              </a>
              <div>
                PERSONAL BEST{" "}
                <b>
                  {high.toLocaleString()} <small>BP</small>
                </b>
              </div>
            </div>
          </div>
          <div className="hero-art">
            <div className="art-coordinates">
              SENTINEL / UNIT 001<span>DEPLOYMENT READY</span>
            </div>
            <div className="orbit-grid" />
            <Sentry />
            <div className="art-caption">
              <span className="live-dot" />
              YOUR LITTLE LINE OF DEFENSE
              <small>小さな盾で、大きな本番を。</small>
            </div>
            <div className="art-stats">
              <span>
                ROLE <b>DEFENDER</b>
              </span>
              <span>
                MISSION <b>ZERO DOWNTIME</b>
              </span>
            </div>
          </div>
          <footer className="home-footer">
            <span>PROD UNIVERSE / VOL. 02</span>
            <span>名前とスコアは自動公開されます。</span>
          </footer>
        </section>
      ) : screen === "run" ? (
        <section className="run-content">
          <div className="run-hud">
            <div>
              <small>WAVE</small>
              <b>
                {String(w.wave).padStart(2, "0")}
                <em> / {w.duration / 30}</em>
              </b>
            </div>
            <div>
              <small>TOTAL BP</small>
              <b data-testid="score">{w.score.toLocaleString()}</b>
            </div>
            <div>
              <small>CHAIN</small>
              <b className="accent">
                {w.combo}
                <em> / {w.maxCombo}</em>
              </b>
            </div>
            <div>
              <small>SHIFT LEFT</small>
              <b data-testid="timer">
                {Math.floor(remaining / 60)}:
                {String(remaining % 60).padStart(2, "0")}
              </b>
            </div>
          </div>
          <div className="gauges">
            <div>
              <span>
                PRODUCTION CORE <b>{Math.ceil(w.core)}%</b>
              </span>
              <div className="bar">
                <i style={{ width: `${w.core}%` }} />
              </div>
            </div>
            <div>
              <span>
                SENTINEL{" "}
                <b>
                  {Math.ceil(w.player.hp)} / {w.player.maxHp}
                </b>
              </span>
              <div className="bar blue">
                <i
                  style={{ width: `${(w.player.hp / w.player.maxHp) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <span>
                LEVEL {w.level}{" "}
                <b>
                  LOG {w.xp} / {w.nextXp}
                </b>
              </span>
              <div className="bar gold">
                <i style={{ width: `${(w.xp / w.nextXp) * 100}%` }} />
              </div>
            </div>
          </div>
          <div className="battle-layout">
            <aside className="operations">
              <div className="eyebrow">NETWORK STATUS</div>
              <h2>
                防衛網を、
                <br />
                取り戻せ。
              </h2>
              <p>
                施設の近くに留まって救援。
                <br />
                復旧した施設が迎撃に加わる。
              </p>
              <div className="facility-list">
                {w.facilities.map((f) => (
                  <div key={f.name} className={f.active ? "online" : ""}>
                    <span className="facility-dot" />
                    <span>
                      <b>{f.name}</b>
                      <small>{f.label}</small>
                    </span>
                    <em>
                      {f.active ? "ONLINE" : `${Math.floor(f.progress * 100)}%`}
                    </em>
                  </div>
                ))}
              </div>
              <div className="operation-stats">
                <span>
                  THREATS BLOCKED<b>{w.kills}</b>
                </span>
                <span>
                  EVOLUTIONS<b>{w.evolutions.length} / 8</b>
                </span>
              </div>
              <p className="controls">
                WASD / 矢印キーで移動
                <br />
                SPACE で緊急遮断
                <br />
                攻撃は自動
              </p>
            </aside>
            <div
              className="arena"
              data-testid="arena"
              data-time={w.time.toFixed(2)}
              data-phase={w.phase}
              data-online={facilityCount}
              data-player-x={w.player.x.toFixed(1)}
              data-player-y={w.player.y.toFixed(1)}
            >
              <div className="field-label">
                <span>
                  <i /> LIVE DEFENSE
                </span>
                <span>施設救援 {facilityCount} / 4</span>
              </div>
              <Field world={world} input={input} reduced={settings.reduced} />
              {w.noticeUntil > w.time && (
                <div
                  key={w.noticeUntil}
                  className={`announcement ${w.notice.startsWith("EVOLUTION") ? "evolved" : ""}`}
                  role="status"
                >
                  <small>{w.notice.split(" / ")[0]}</small>
                  <strong>{w.notice.split(" / ")[1]}</strong>
                </div>
              )}
              {w.time < w.overdriveUntil && (
                <div className="overdrive">
                  ZERO TRUST MODE <b>{Math.ceil(w.overdriveUntil - w.time)}s</b>
                </div>
              )}
              <div className="field-bottom">
                <span>DRAG TO MOVE / 自動迎撃</span>
                <span>SHIELD {Math.ceil(w.shield)}</span>
              </div>
            </div>
          </div>
          <div className="action-bar">
            <span>
              <i className="live-dot" />{" "}
              {w.time < w.overdriveUntil
                ? "ALL SYSTEMS FIRING"
                : "AUTONOMOUS DEFENSE ACTIVE"}
              <small>敵を倒してログを集め、対策を強化。</small>
            </span>
            <button
              className="panic"
              disabled={w.time < w.panicAt || w.phase !== "playing" || !!modal}
              onClick={requestPanic}
            >
              <span>
                {w.time < w.panicAt
                  ? `RECHARGING / ${Math.ceil(w.panicAt - w.time)}s`
                  : "緊急遮断"}
                <small>周囲を一斉迎撃 ＋ ログ全回収</small>
              </span>
              <b>⌁</b>
            </button>
          </div>
        </section>
      ) : (
        <section className="result-content">
          <div className="result-art">
            <Sentry small />
            <span>
              {w.phase === "won" ? "MISSION ACCOMPLISHED" : "INCIDENT REVIEW"}
            </span>
          </div>
          <div className="eyebrow">SHIFT REPORT / {w.duration} SECONDS</div>
          <h1>
            {w.phase === "won" ? "今日も、本番は" : "次は、もっと"}
            <br />
            <span>{w.phase === "won" ? "動いている。" : "守りきれる。"}</span>
          </h1>
          <div className="result-score">
            {w.score.toLocaleString()}
            <small>BP</small>
          </div>
          <div className="result-stats">
            <div>
              SURVIVED<b>{w.time.toFixed(1)}s</b>
            </div>
            <div>
              BLOCKED<b>{w.kills}</b>
            </div>
            <div>
              MAX CHAIN<b>{w.maxCombo}</b>
            </div>
            <div>
              CORE<b>{Math.ceil(w.core)}%</b>
            </div>
          </div>
          <div className="incident-report">
            <div>
              <small>YOUR TITLE</small>
              <b>{incident.title}</b>
            </div>
            <p>
              <span>侵入経路</span>
              {incident.cause}
            </p>
            <p>
              <span>再発防止</span>
              {incident.prevention}
            </p>
            <blockquote>{incident.comment}</blockquote>
          </div>
          <button className="result-identity" onClick={() => setScoreboard(true)} aria-label="プレイヤー名を変更・スコアボード"><span>{name}</span><small>{scoreStatus}</small><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z" stroke="currentColor" strokeWidth="1.4"/></svg></button>
          <div className="result-actions">
            <button className="primary" onClick={start}>
              もう一度、守る。
              <span className="button-arrow">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M6 18 18 6M6 6h12v12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </span>
            </button>
            <button className="secondary" onClick={() => setScreen("home")}>
              ホームへ
            </button>
          </div>
          <p className="fiction-note">
            架空のインシデント報告書です。実際の本番は大切に。
          </p>
        </section>
      )}
      {scoreboard && <Leaderboard duration={duration} currentScore={screen === "result" ? currentScore : undefined} onClose={() => setScoreboard(false)} onName={setName} />}
      {(modal || (screen === "run" && w.phase === "upgrade")) && (
        <div className="backdrop">
          <section
            className={`dialog ${!modal ? "upgrade-dialog" : ""}`}
            ref={dialogRef}
            onKeyDown={(e) => {
              if (e.key === "Escape" && modal) {
                e.preventDefault();
                e.stopPropagation();
                close();
              }
              if (e.key !== "Tab") return;
              const buttons = [
                ...(dialogRef.current?.querySelectorAll<HTMLElement>(
                  "button:not(:disabled),input",
                ) ?? []),
              ];
              const first = buttons[0],
                last = buttons.at(-1);
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "help"
                ? "遊び方"
                : modal === "settings"
                  ? "設定"
                  : modal === "pause"
                    ? "一時停止"
                    : "レベルアップ"
            }
          >
            {modal ? (
              <>
                <div className="dialog-top">
                  <span className="eyebrow">
                    {modal === "help"
                      ? "FIELD MANUAL"
                      : modal === "settings"
                        ? "SYSTEM CONFIGURATION"
                        : "INCIDENT PAUSED"}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="閉じる"
                    autoFocus
                    onClick={close}
                  >
                    ×
                  </button>
                </div>
                <h2>
                  {modal === "help"
                    ? "本番を守る、4つのこと。"
                    : modal === "settings"
                      ? "あなたのシフト設定。"
                      : "ひと息、入れよう。"}
                </h2>
                {modal === "help" ? (
                  <div className="manual">
                    <p>
                      <b>01 / 移動して迎撃</b>
                      ドラッグ、WASD、矢印キーで移動。攻撃は自動。COREと自分のHPを守ろう。
                    </p>
                    <p>
                      <b>02 / 防衛網を復旧</b>
                      AUTH・WAF・DB・SOCの近くに約3秒留まると救援完了。復旧施設は自動で迎撃。
                    </p>
                    <p>
                      <b>03 / 対策を組み合わせる</b>
                      緑のログを集めてレベルアップ。対応する2スキルを揃えると進化。選択中は時間が停止。
                    </p>
                    <p>
                      <b>04 / 緊急遮断</b>
                      大群を一斉迎撃し、落ちているログを全回収。連続撃破でZERO
                      TRUST MODEに突入。
                    </p>
                    <button className="primary" onClick={close}>
                      任務を了解した <span>↗</span>
                    </button>
                  </div>
                ) : modal === "settings" ? (
                  <div className="settings-list">
                    <label>
                      サウンド
                      <button
                        className="secondary"
                        aria-pressed={!settings.mute}
                        onClick={() => update({ mute: !settings.mute })}
                      >
                        {settings.mute ? "OFF" : "ON"}
                      </button>
                    </label>
                    <label>
                      音量
                      <input
                        aria-label="音量"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={settings.volume}
                        onChange={(e) =>
                          update({ volume: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label>
                      演出を軽減
                      <button
                        className="secondary"
                        aria-pressed={settings.reduced}
                        onClick={() => update({ reduced: !settings.reduced })}
                      >
                        {settings.reduced ? "ON" : "OFF"}
                      </button>
                    </label>
                  </div>
                ) : (
                  <div className="pause-actions">
                    <button className="primary" onClick={close}>
                      防衛を再開 <span>↗</span>
                    </button>
                    <button
                      className="secondary"
                      onClick={() => setModal("settings")}
                    >
                      サウンド・演出設定
                    </button>
                    <button
                      className="text-button"
                      onClick={() => {
                        setScreen("home");
                        setModal(null);
                      }}
                    >
                      シフトを終了してホームへ
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="eyebrow">INSTALL A BETTER DEFENSE</div>
                <h2>
                  LEVEL {w.level}
                  <small>次の一手で、本番を守る。</small>
                </h2>
                <div className="upgrade-options">
                  {w.choices.map((id) => {
                    const s = skills.find((s) => s.id === id)!,
                      recipe = recipes.find((r) => r.pair.includes(id))!,
                      evolution = ready(w, id),
                      partner = skills.find(
                        (s) => s.id === recipe.pair.find((p) => p !== id),
                      )!,
                      count = w.build.filter((s) => s === id).length;
                    return (
                      <button
                        key={id}
                        className={`skill-card ${evolution ? "ready" : ""}`}
                        onClick={() => install(id)}
                      >
                        <div className="skill-meta">
                          <span>{s.type}</span>
                          <small>
                            {evolution
                              ? "✦ 選ぶと進化！"
                              : count
                                ? `強化 ×${count + 1}`
                                : "NEW"}
                          </small>
                        </div>
                        <div className="skill-icon">{s.icon}</div>
                        <h3>{s.name}</h3>
                        <p>{s.flavor}</p>
                        <b className="skill-effect">{s.effect}</b>
                        <small className="recipe-hint">
                          {evolution
                            ? `${recipe.name} / ${recipe.bonus}`
                            : w.evolutions.includes(recipe.name)
                              ? "この組み合わせは進化済み"
                              : `✦ ${partner.name} と組み合わせで進化`}
                        </small>
                        <span className="install">
                          INSTALL <span>↗</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
