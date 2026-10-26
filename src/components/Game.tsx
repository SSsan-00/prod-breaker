"use client";
import { useEffect, useRef, useState } from "react";
import { motion, MotionConfig } from "motion/react";
import {
  createWorld,
  stepWorld,
  chooseUpgrade,
  upgrades,
  wave,
  survivorReport,
  STEP,
  RUN_SECONDS,
  type World,
  type Vec,
  type UpgradeId,
} from "@/game/survivor";
import Arena, { type Stick } from "./Arena";
import { read, write } from "@/lib/storage";
import { sound, startMusic } from "@/effects/audio";
type Settings = { mute: boolean; volume: number; reduced: boolean };
type Screen = "title" | "run" | "result";
type Modal = "settings" | "help" | "pause" | null;
export default function Game() {
  const [initialWorld] = useState(() => createWorld());
  const world = useRef<World>(initialWorld),
    input = useRef<Vec>({ x: 0, y: 0 }),
    stick = useRef<Stick>({
      active: false,
      origin: { x: 0, y: 0 },
      current: { x: 0, y: 0 },
    }),
    keys = useRef(new Set<string>()),
    panicPending = useRef(false),
    frameRef = useRef(0);
  const [snapshot, setSnapshot] = useState<World>(initialWorld),
    [screen, setScreen] = useState<Screen>("title"),
    [modal, setModal] = useState<Modal>(null),
    [settings, setSettings] = useState<Settings>({
      mute: true,
      volume: 0.5,
      reduced: false,
    }),
    [high, setHigh] = useState(0),
    [notice, setNotice] = useState("");
  const settingsRef = useRef(settings);
  const screenRef = useRef(screen);
  const modalRef = useRef(modal);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);
  useEffect(() => {
    modalRef.current = modal;
  }, [modal]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSettings(
        read("pb-settings", {
          mute: true,
          volume: 0.5,
          reduced:
            typeof matchMedia === "function" &&
            matchMedia("(prefers-reduced-motion: reduce)").matches,
        }),
      );
      setHigh(read("pb-survivor-high", 0));
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!modal && snapshot.phase !== "upgrade") return;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
        ),
      );
      const first = elements[0],
        last = elements[elements.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [modal, snapshot.phase]);
  function clearInput() {
    keys.current.clear();
    input.current = { x: 0, y: 0 };
    stick.current.active = false;
    panicPending.current = false;
  }
  useEffect(() => {
    function down(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (modalRef.current && key === "escape") {
        e.preventDefault();
        clearInput();
        setModal(null);
        return;
      }
      if (screenRef.current !== "run" || modalRef.current) return;
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          " ",
          "escape",
        ].includes(key)
      )
        e.preventDefault();
      if (key === "escape") {
        clearInput();
        setModal((m) => (m ? null : "pause"));
        return;
      }
      if (modalRef.current) return;
      if (key === " " && !e.repeat) panicPending.current = true;
      keys.current.add(key);
    }
    function up(e: KeyboardEvent) {
      keys.current.delete(e.key.toLowerCase());
    }
    function hide() {
      clearInput();
      if (document.hidden && screenRef.current === "run")
        setModal((m) => m || "pause");
    }
    function blur() {
      clearInput();
      if (screenRef.current === "run") setModal((m) => m || "pause");
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", blur);
    };
  }, []);
  useEffect(() => {
    if (screen !== "run" || modal) return;
    let last = 0,
      accumulator = 0,
      lastUi = 0,
      lastSound = 0;
    let oldDestroyed = world.current.destroyed;
    const frame = (now: number) => {
      if (document.hidden) {
        last = 0;
        frameRef.current = requestAnimationFrame(frame);
        return;
      }
      if (last) accumulator += Math.min(0.2, (now - last) / 1000);
      last = now;
      let changed = false;
      while (accumulator >= STEP) {
        accumulator -= STEP;
        if (world.current.phase !== "playing") {
          accumulator = 0;
          break;
        }
        const k = keys.current;
        const keyboard = {
          x:
            Number(k.has("d") || k.has("arrowright")) -
            Number(k.has("a") || k.has("arrowleft")),
          y:
            Number(k.has("s") || k.has("arrowdown")) -
            Number(k.has("w") || k.has("arrowup")),
        };
        const movement = keyboard.x || keyboard.y ? keyboard : input.current;
        world.current = stepWorld(world.current, {
          ...movement,
          panic: panicPending.current,
        });
        panicPending.current = false;
        changed = true;
      }
      const w = world.current;
      if (w.destroyed > oldDestroyed && now - lastSound > 140) {
        oldDestroyed = w.destroyed;
        lastSound = now;
        if (!settingsRef.current.mute)
          sound("destroy", settingsRef.current.volume);
      }
      if (changed && (now - lastUi > 90 || w.phase !== "playing")) {
        lastUi = now;
        setSnapshot(w);
      }
      if (w.phase === "won" || w.phase === "lost") {
        setSnapshot(w);
        setHigh((previous) => {
          const value = Math.max(previous, w.score);
          write("pb-survivor-high", value);
          return value;
        });
        setScreen("result");
        return;
      }
      frameRef.current = requestAnimationFrame(frame);
    };
    frameRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameRef.current);
  }, [screen, modal]);
  useEffect(() => {
    if (
      screen !== "run" ||
      modal ||
      snapshot.phase !== "playing" ||
      settings.mute
    )
      return;
    return startMusic(settings.volume);
  }, [screen, modal, snapshot.phase, settings.mute, settings.volume]);
  function updateSettings(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    write("pb-settings", next);
  }
  function start() {
    clearInput();
    const param = new URLSearchParams(location.search).get("seed");
    const seed =
      param !== null && Number.isFinite(Number(param))
        ? Number(param) >>> 0
        : Math.floor(Math.random() * 0xffffffff);
    world.current = createWorld(seed);
    setSnapshot(world.current);
    setNotice("");
    setModal(null);
    setScreen("run");
    if (!settings.mute) sound("deploy", settings.volume);
  }
  function select(id: UpgradeId) {
    if (world.current.phase !== "upgrade") return;
    world.current = chooseUpgrade(world.current, id);
    clearInput();
    setSnapshot(world.current);
    if (!settings.mute) sound("deploy", settings.volume);
  }
  function panic() {
    if (
      screen !== "run" ||
      modal ||
      world.current.phase !== "playing" ||
      world.current.panicCooldown > 0 ||
      panicPending.current
    )
      return;
    panicPending.current = true;
    if (!settings.mute) sound("panic", settings.volume);
  }
  const w = snapshot,
    incident = survivorReport(w),
    remaining = Math.ceil(RUN_SECONDS - w.time),
    minutes = Math.floor(remaining / 60),
    seconds = String(remaining % 60).padStart(2, "0");
  async function exportImage(share = false) {
    try {
      const c = document.createElement("canvas");
      c.width = 1080;
      c.height = 1080;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.fillStyle = "#0a1013";
      ctx.fillRect(0, 0, 1080, 1080);
      ctx.fillStyle = "#d4fa53";
      ctx.font = "bold 80px monospace";
      ctx.fillText("PROD BREAKER", 65, 140);
      ctx.font = "26px monospace";
      ctx.fillText("SURVIVOR / BUILD THE BUG.", 65, 195);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 110px monospace";
      ctx.fillText(`${w.score.toLocaleString()} BP`, 65, 360);
      ctx.font = "34px sans-serif";
      [
        incident.title,
        `${w.time.toFixed(1)}秒 / LV ${w.level} / ${w.destroyed}サーバー破壊`,
        `MAX CHAIN ${w.maxCombo} / WAVE ${wave(w)}`,
        `原因：${incident.cause}`,
        "再発防止策：金曜日を廃止する。",
        "架空のジョーク障害報告書です。",
      ].forEach((s, i) => ctx.fillText(s, 65, 475 + i * 75));
      const blob = await new Promise<Blob | null>((resolve) =>
        c.toBlob(resolve),
      );
      if (!blob) throw new Error("blob");
      const file = new File([blob], "prod-breaker-survivor.png", {
        type: "image/png",
      });
      if (share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "PROD BREAKER" });
        return;
      }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      setNotice("リザルト画像を保存しました。");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setNotice("画像を保存できませんでした。別のブラウザでお試しください。");
    }
  }
  return (
    <MotionConfig reducedMotion={settings.reduced ? "always" : "user"}>
      <main className={`app survivor ${settings.reduced ? "reduced" : ""}`}>
        <header className="site-header">
          <button
            className="brand"
            onClick={() => {
              if (screen === "run") {
                clearInput();
                setModal("pause");
              } else setScreen("title");
            }}
            aria-label="PROD BREAKER ホーム"
          >
            P<span>▰</span>B{" "}
            <small>
              PROD BREAKER <em>SURVIVOR</em>
            </small>
          </button>
          <div className="header-right">
            <span className="sandbox">● SIMULATION ONLY</span>
            <button
              aria-label="ミュート切替"
              onClick={() => updateSettings({ mute: !settings.mute })}
            >
              {settings.mute ? "SOUND OFF" : "SOUND ON"}
            </button>
            {screen === "run" && (
              <button
                aria-label="一時停止"
                onClick={() => {
                  clearInput();
                  setModal("pause");
                }}
              >
                Ⅱ
              </button>
            )}
            <button
              aria-label="設定"
              onClick={() => {
                clearInput();
                setModal("settings");
              }}
            >
              ⚙
            </button>
          </div>
        </header>
        {screen === "title" ? (
          <section className="title-screen">
            <div className="eyebrow">
              90 SECOND RUN / AUTO ATTACK / ENDLESS BAD IDEAS
            </div>
            <h1>
              PROD
              <br />
              <span>
                BREAKER<span className="logo-dot">_</span>
              </span>
            </h1>
            <div className="edition">
              SURVIVOR EDITION <span>↗ V2.0</span>
            </div>
            <p className="tagline">BUILD THE BUG. BREAK THE PROD.</p>
            <p className="intro">
              逃げろ。育てろ。本番を連鎖爆破しろ。
              <br />
              暴走バグとなって、復旧部隊の猛攻を90秒生き延びよう。
            </p>
            <button className="primary start" onClick={start}>
              GAME START <span>↗</span>
            </button>
            <button className="text-button" onClick={() => setModal("help")}>
              HOW TO PLAY <span>→</span>
            </button>
            <div className="title-meta">
              <span>MOVE TO SURVIVE</span>
              <span>AUTO FIRE</span>
              <span>LEVEL UP & BREAK</span>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="pixel-bug">
                <i />
                <i />
                <b>••</b>
                <span />
              </div>
              <div className="hero-server s1">
                API<span>▰ ▰ ▰</span>
              </div>
              <div className="hero-server s2">
                DB<span>▰ ▰ ▰</span>
              </div>
              <div className="hero-server s3">
                WEB<span>▰ ▰ ▰</span>
              </div>
              <div className="hero-beam b1" />
              <div className="hero-beam b2" />
              <div className="hero-caption">
                FAULT PROPAGATION ACTIVE
                <br />
                <strong>THE BUG IS YOU.</strong>
              </div>
            </div>
            <p className="high-score">
              SURVIVOR BEST <b>{high.toLocaleString()} BP</b>
            </p>
          </section>
        ) : screen === "run" ? (
          <section className="game">
            <div className="game-heading">
              <div>
                <div className="eyebrow">LIVE INCIDENT / YOU ARE THE BUG</div>
                <h1>本番で、生き延びろ。</h1>
              </div>
              <span className="live">● AUTO ATTACK ONLINE</span>
            </div>
            <div className="hud">
              <div>
                WAVE
                <b>
                  0{wave(w)}
                  <small> / 03</small>
                </b>
              </div>
              <div>
                TOTAL BP<b data-testid="score">{w.score.toLocaleString()}</b>
              </div>
              <div>
                CHAIN
                <b className="lime">
                  {w.combo}
                  <small> MAX {w.maxCombo}</small>
                </b>
              </div>
              <div>
                TIME LEFT
                <b data-testid="timer">
                  {minutes}:{seconds}
                </b>
              </div>
            </div>
            <div className="vitals">
              <div className="health">
                <span>
                  BUG INTEGRITY{" "}
                  <b data-testid="health">
                    {w.player.hp} / {w.player.maxHp}
                  </b>
                </span>
                <div>
                  <i
                    style={{
                      width: `${(w.player.hp / w.player.maxHp) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div className="xp">
                <span>
                  LV <b data-testid="level">{w.level}</b>
                  <small>
                    障害ログ {w.xp} / {w.nextXp}
                  </small>
                </span>
                <div>
                  <i
                    style={{
                      width: `${Math.min(100, (w.xp / w.nextXp) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <div
              className="arena-shell"
              data-testid="arena"
              data-phase={w.phase}
              data-time={w.time.toFixed(2)}
              data-player-x={w.player.x.toFixed(1)}
              data-player-y={w.player.y.toFixed(1)}
            >
              <Arena
                world={world}
                input={input}
                stick={stick}
                reduced={settings.reduced}
                onBlur={() => keys.current.clear()}
              />
              <div className="arena-topline">
                <span>
                  PROD / TOKYO{" "}
                  {w.time >= 60
                    ? "⚠ SRE CORE ONLINE"
                    : w.time >= 30
                      ? "⚠ REPAIR BOTS DEPLOYED"
                      : "● FAULT SPREADING"}
                </span>
                <span>SEED {w.seed}</span>
              </div>
              {w.time < 5 && w.phase === "playing" && (
                <div className="move-hint">
                  WASD / 矢印キー / ドラッグで移動
                  <span>攻撃は自動。青い障害ログを拾って強化。</span>
                </div>
              )}
              {w.combo >= 5 && (
                <div
                  className={`chain-badge ${w.combo >= 20 ? "massive" : ""}`}
                >
                  <b>{w.combo}</b> CHAIN
                  <span>
                    {w.combo >= 20
                      ? "ABSOLUTE CHAOS"
                      : w.combo >= 10
                        ? "CASCADE FAILURE"
                        : "LOOKS GOOD TO ME"}
                  </span>
                </div>
              )}
              <div className="arena-bottomline">
                <span>▰ {w.destroyed} SERVERS DOWN</span>
                <span>✕ {w.kills} BOTS STOPPED</span>
              </div>
            </div>
            <div className="run-controls">
              <div>
                <span className="eyebrow">
                  {w.panicCooldown > 0
                    ? "MERGE PIPELINE COOLING DOWN"
                    : "WHEN IN DOUBT, MERGE IT."}
                </span>
                <p>移動だけに集中。攻撃はバグに任せよう。</p>
              </div>
              <button
                className="panic"
                disabled={
                  w.panicCooldown > 0 || w.phase !== "playing" || !!modal
                }
                onClick={panic}
              >
                {w.panicCooldown > 0
                  ? `PANIC / ${Math.ceil(w.panicCooldown)}s`
                  : "PANIC / 緊急マージ"}
                <small>周囲を爆破＋ログ全回収 / SPACE</small>
              </button>
            </div>
            <div className="inventory">
              <span>ACTIVE BUILD</span>
              {w.build.length ? (
                w.build.map((id, i) => (
                  <span className="build-chip" key={i}>
                    {upgrades.find((u) => u.id === id)!.name}
                  </span>
                ))
              ) : (
                <span>まだ素のバグです。青いログを回収しよう。</span>
              )}
            </div>
            {w.phase === "upgrade" && !modal && (
              <div className="modal-backdrop level-backdrop">
                <section
                  className="level-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-label="レベルアップ"
                >
                  <div className="eyebrow">DEPLOY ANOTHER BAD IDEA</div>
                  <h2>
                    LEVEL {w.level}
                    <span>もっと、壊せる。</span>
                  </h2>
                  <p className="muted">
                    強化を1つ選択。選択中はゲームが止まります。
                  </p>
                  <div className="upgrade-cards">
                    {w.choices.map((id) => {
                      const u = upgrades.find((u) => u.id === id)!;
                      return (
                        <motion.button
                          autoFocus={id === w.choices[0]}
                          whileTap={{ scale: 0.97 }}
                          key={id}
                          className="upgrade-card"
                          onClick={() => select(id)}
                        >
                          <div className="card-top">
                            <span className={u.type}>{u.type}</span>
                            <small>STACKABLE</small>
                          </div>
                          <div className="card-art">{u.icon}</div>
                          <h3>{u.name}</h3>
                          <p>{u.description}</p>
                          <span className="choose-label">
                            INSTALL UPGRADE ↗
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}
          </section>
        ) : (
          <section className="result">
            <div className="eyebrow">INCIDENT CLOSED / SURVIVOR RUN</div>
            <h1 className="result-title">
              {w.phase === "won" ? "90 SECONDS." : "BUG TERMINATED."}
              <br />
              <span>
                {w.phase === "won" ? "PROD IN RUINS." : "DEPLOY AGAIN."}
              </span>
            </h1>
            <div className="result-score">
              {w.score.toLocaleString()}
              <small> BP</small>
            </div>
            <div className="stats">
              <div>
                SURVIVED<b>{w.time.toFixed(1)}s</b>
              </div>
              <div>
                MAX CHAIN<b>{w.maxCombo}</b>
              </div>
              <div>
                SERVERS DOWN<b>{w.destroyed}</b>
              </div>
            </div>
            <article className="report">
              <div className="eyebrow">POSTMORTEM / SEED {w.seed}</div>
              <h2>{incident.title}</h2>
              <p>
                障害概要：暴走バグが{w.destroyed}台の架空サーバーを破壊。復旧BOT{" "}
                {w.kills}体停止。
              </p>
              <p>発生原因：{incident.cause}</p>
              <p>
                影響範囲：WAVE {wave(w)} / LEVEL {w.level} / PANIC {w.panicUses}
                回
              </p>
              <p>再発防止策：{incident.prevention}</p>
              <small>
                架空のジョーク障害報告書です。実在の環境とは無関係です。
              </small>
            </article>
            <button className="primary" onClick={start}>
              もう一度プレイ ↻
            </button>
            <div className="result-actions">
              <button onClick={() => void exportImage()}>画像保存 ↓</button>
              <button onClick={() => void exportImage(true)}>共有 ↗</button>
            </div>
            <p className="muted">SURVIVOR BEST {high.toLocaleString()} BP</p>
            <p role="status" className="muted">
              {notice}
            </p>
          </section>
        )}
        <footer>
          <span>PROD BREAKER / SURVIVOR V2.0</span>
          <span>すべて架空の環境です。実際の本番は大切に。</span>
          <span>BUILD THE BUG. BREAK THE PROD.</span>
        </footer>
        {modal && (
          <div className="modal-backdrop">
            <section
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label={
                modal === "settings"
                  ? "設定"
                  : modal === "help"
                    ? "遊び方"
                    : "一時停止"
              }
            >
              <button
                autoFocus
                className="close"
                aria-label="閉じる"
                onClick={() => setModal(null)}
              >
                ×
              </button>
              <div className="eyebrow">OPERATOR MANUAL</div>
              <h2>
                {modal === "settings"
                  ? "SETTINGS"
                  : modal === "help"
                    ? "HOW TO SURVIVE"
                    : "INCIDENT PAUSED"}
              </h2>
              {modal === "settings" ? (
                <>
                  <label>
                    <span>ミュート</span>
                    <input
                      type="checkbox"
                      checked={settings.mute}
                      onChange={(e) =>
                        updateSettings({ mute: e.target.checked })
                      }
                    />
                  </label>
                  <label>
                    <span>音量</span>
                    <input
                      aria-label="音量"
                      type="range"
                      min="0"
                      max="1"
                      step=".05"
                      value={settings.volume}
                      onChange={(e) =>
                        updateSettings({ volume: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    <span>演出を軽減（点滅・揺れ・粒子OFF）</span>
                    <input
                      type="checkbox"
                      checked={settings.reduced}
                      onChange={(e) =>
                        updateSettings({ reduced: e.target.checked })
                      }
                    />
                  </label>
                </>
              ) : modal === "help" ? (
                <>
                  <p>01　WASD・矢印キー、スマホはドラッグで移動。</p>
                  <p>02　近くのサーバーや敵を自動で攻撃。</p>
                  <p>03　青い障害ログを拾って3択で強化。</p>
                  <p>04　PANIC（スペース）で周囲を爆破＆ログ回収。</p>
                  <p>05　復旧部隊を避け、90秒・3ウェーブを生き延びよう。</p>
                  <p className="muted">
                    レベルアップ・一時停止・非表示タブではゲーム時間が止まります。連鎖範囲を育てるとサーバーが次々に爆発します。
                  </p>
                </>
              ) : (
                <>
                  <p className="muted">本番も、たまには休憩。</p>
                  <button
                    className="text-button"
                    onClick={() => setModal("settings")}
                  >
                    設定を開く →
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      clearInput();
                      setModal(null);
                      setScreen("title");
                    }}
                  >
                    タイトルへ戻る →
                  </button>
                </>
              )}
              <button className="primary" onClick={() => setModal(null)}>
                {screen === "run" ? "ゲームに戻る →" : "了解、ヨシ！"}
              </button>
            </section>
          </div>
        )}
      </main>
    </MotionConfig>
  );
}
