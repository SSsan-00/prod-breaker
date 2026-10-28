"use client";
import { useEffect, useRef, useState } from "react";
import { motion, MotionConfig } from "motion/react";
import {
  createWorld,
  stepWorld,
  chooseUpgrade,
  upgrades,
  evolutionPartners,
  evolutionNames,
  evolutionReady,
  evolutionBonus,
  wave,
  survivorReport,
  STEP,
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
  const [duration, setDuration] = useState(180);
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
    frameRef = useRef(0),
    pauseHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    pauseTouch = useRef<{ x: number; y: number } | null>(null),
    suppressPauseClick = useRef(false);
  const [snapshot, setSnapshot] = useState<World>(initialWorld),
    [screen, setScreen] = useState<Screen>("title"),
    [modal, setModal] = useState<Modal>(null),
    [settings, setSettings] = useState<Settings>({
      mute: true,
      volume: 0.5,
      reduced: false,
    }),
    [high, setHigh] = useState(0),
    [evolutionNotice, setEvolutionNotice] = useState(""),
    [evolutionBonusNotice, setEvolutionBonusNotice] = useState<string[]>([]);
  useEffect(() => {
    if (!evolutionNotice) return;
    const timer = setTimeout(() => setEvolutionNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [evolutionNotice]);
  useEffect(() => () => {
    if (pauseHoldTimer.current) clearTimeout(pauseHoldTimer.current);
  }, []);
  function cancelPauseHold() {
    if (pauseHoldTimer.current) clearTimeout(pauseHoldTimer.current);
    pauseHoldTimer.current = null;
    pauseTouch.current = null;
  }
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
      setHigh(read("pb-survivor-high-180", 0));
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
      // Mobile browsers can emit blur during ordinary touch and focus changes.
      // Clear movement, but only pause automatically when the page is hidden.
      clearInput();
      cancelPauseHold();
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
    let oldCombo = 0;
    let oldDestroyed = world.current.destroyed;
    let oldBossWave = world.current.bossWave;
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
      if (w.bossWave > oldBossWave && !settingsRef.current.mute)
        sound("deploy", settingsRef.current.volume);
      oldBossWave = w.bossWave;
      const milestone = [100, 30, 10].find(
        (value) => w.combo >= value && oldCombo < value,
      );
      if (milestone && !settingsRef.current.mute)
        sound(
          "milestone",
          settingsRef.current.volume,
        );
      oldCombo = w.combo;
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
          write(`pb-survivor-high-${w.duration}`, value);
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
    world.current = createWorld(seed, duration);
    setSnapshot(world.current);
    setEvolutionNotice("");
    setEvolutionBonusNotice([]);
    setModal(null);
    setScreen("run");
    if (!settings.mute) sound("deploy", settings.volume);
  }
  function select(id: UpgradeId) {
    if (world.current.phase !== "upgrade") return;
    const previous = world.current.evolutions.length;
    const bonus = evolutionBonus(world.current, id);
    world.current = chooseUpgrade(world.current, id);
    if (world.current.evolutions.length > previous) {
      setEvolutionBonusNotice(bonus);
      setEvolutionNotice(world.current.evolutions.at(-1)!);
    }
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
    remaining = Math.ceil(w.duration - w.time),
    minutes = Math.floor(remaining / 60),
    seconds = String(remaining % 60).padStart(2, "0");
  return (
    <MotionConfig reducedMotion={settings.reduced ? "always" : "user"}>
      <main
        className={`app survivor ${settings.reduced ? "reduced" : ""}`}
        onContextMenu={(event) => {
          const target = event.target as HTMLElement;
          if (
            (screen === "run" || target.closest(".site-header")) &&
            !target.closest("input, textarea")
          )
            event.preventDefault();
        }}
      >
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
            disabled={screen === "run"}
          >
            P<span>▰</span>B{" "}
            <small>
              PROD BREAKER <em>SURVIVOR</em>
            </small>
          </button>
          <div className="header-right">
            <span className="sandbox">● SIMULATION ONLY</span>
            <button
              className="header-sound"
              aria-label="ミュート切替"
              onClick={() => updateSettings({ mute: !settings.mute })}
            >
              {settings.mute ? "SOUND OFF" : "SOUND ON"}
            </button>
            {screen === "run" && (
              <button
                className="header-pause"
                aria-label="一時停止"
                onPointerDown={(event) => {
                  cancelPauseHold();
                  suppressPauseClick.current = event.pointerType === "touch";
                  if (event.pointerType !== "touch") return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  pauseTouch.current = { x: event.clientX, y: event.clientY };
                  pauseHoldTimer.current = setTimeout(() => {
                    pauseHoldTimer.current = null;
                    pauseTouch.current = null;
                    clearInput();
                    setModal("pause");
                  }, 600);
                }}
                onPointerMove={(event) => {
                  const start = pauseTouch.current;
                  if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 14)
                    cancelPauseHold();
                }}
                onPointerUp={cancelPauseHold}
                onPointerCancel={cancelPauseHold}
                onLostPointerCapture={cancelPauseHold}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") suppressPauseClick.current = false;
                }}
                onClick={() => {
                  if (suppressPauseClick.current) {
                    suppressPauseClick.current = false;
                    return;
                  }
                  suppressPauseClick.current = false;
                  clearInput();
                  setModal("pause");
                }}
              >
                Ⅱ<span className="hold-hint">長押し</span>
              </button>
            )}
            <button
              className="header-settings"
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
              SURVIVOR RUN / AUTO ATTACK / ENDLESS BAD IDEAS
            </div>
            <h1>
              PROD
              <br />
              <span>
                BREAKER<span className="logo-dot">_</span>
              </span>
            </h1>
            <div className="edition">
              SURVIVOR EDITION <span>↗ V2.19.2</span>
            </div>
            <p className="tagline">BUILD THE BUG. BREAK THE PROD.</p>
            <p className="intro">
              逃げろ。育てろ。本番を連鎖爆破しろ。
              <br />
              暴走バグとなって、復旧部隊の猛攻を生き延びよう。
            </p>
            <div
              className="duration-options"
              role="group"
              aria-label="プレイ時間"
            >
              {[
                { seconds: 90, label: "QUICK", time: "90秒" },
                { seconds: 180, label: "STANDARD", time: "3分" },
                { seconds: 300, label: "CHAOS", time: "5分" },
              ].map((option) => (
                <button
                  key={option.seconds}
                  aria-pressed={duration === option.seconds}
                  onClick={() => {
                    setDuration(option.seconds);
                    setHigh(
                      read(
                        `pb-survivor-high-${option.seconds}`,
                        option.seconds === 90 ? read("pb-survivor-high", 0) : 0,
                      ),
                    );
                  }}
                >
                  <b>{option.label}</b>
                  <span>{option.time}</span>
                </button>
              ))}
            </div>
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
            <div
              className="hero-art"
              role="img"
              aria-label="ゲームの主人公、暴走バグ"
            >
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="pixel-bug" />
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
                  {String(wave(w)).padStart(2, "0")}
                  <small> / {String(w.duration / 30).padStart(2, "0")}</small>
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
                  {w.time >= 30
                    ? "⚠ SRE CORE ONLINE"
                    : w.time >= 15
                      ? "⚠ REPAIR BOTS DEPLOYED"
                      : "● FAULT SPREADING"}
                </span>
              </div>
              {w.time < 5 && w.phase === "playing" && (
                <div className="move-hint">
                  WASD / 矢印キー / ドラッグで移動
                  <span>攻撃は自動。青い障害ログを拾って強化。</span>
                </div>
              )}
              {w.combo >= 5 && (
                <div
                  className={`chain-badge ${w.combo >= 100 ? "legendary" : w.combo >= 30 ? "massive" : w.combo >= 10 ? "major" : ""}`}
                >
                  <b key={w.combo}>{w.combo}</b> CHAIN
                  {w.combo >= 10 && <em>連鎖ダメージ ×{w.combo >= 30 ? "1.5" : "1.25"}</em>}
                  <div className="chain-timer" aria-label="連鎖の残り時間"><i style={{ width: `${Math.max(0, Math.min(100, (w.comboUntil - w.time) / 2.8 * 100))}%` }} /></div>
                  <span>
                    {w.combo >= 100
                      ? "PRODUCTION OBLITERATED"
                      : w.combo >= 30
                        ? "ABSOLUTE CHAOS"
                        : w.combo >= 10
                          ? "CASCADE FAILURE"
                          : "LOOKS GOOD TO ME"}
                  </span>
                </div>
              )}
              {w.effects.filter((effect) => effect.kind === "wave").slice(-1).map((effect) => (
                <div className="chain-cutin wave-cutin" key={effect.id} role="status" data-testid="wave-cutin">
                  <small>INCOMING INCIDENT</small><strong>{effect.text}</strong><span>復旧部隊、増援到着。</span>
                </div>
              ))}
              {!w.effects.some((effect) => effect.kind === "wave") && w.effects.filter((effect) => effect.kind === "milestone").slice(-1).map((effect) => (
                <div className="chain-cutin" key={effect.id} aria-hidden="true">
                  <small>CHAIN REACTION</small><strong>{effect.text}</strong><span>本番、炎上中。</span>
                </div>
              ))}
              {w.time < w.overdriveUntil && (
                <div className="overdrive-badge" role="status">
                  <b>OVERDRIVE</b><span>攻撃速度アップ / {Math.ceil(w.overdriveUntil - w.time)}s</span>
                </div>
              )}
              {evolutionNotice && (
                <div className="evolution-notice" role="status">
                  <small>EVOLUTION UNLOCKED</small>
                  <strong>{evolutionNotice}</strong>
                  <span className="evolution-bonus-notice">{evolutionBonusNotice.join(" / ")}</span>
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
                <small>周囲を爆破＋ログ全回収 / 10・30・100連鎖で短縮</small>
              </button>
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
                  <div className="upgrade-cards">
                    {w.choices.map((id) => {
                      const u = upgrades.find((u) => u.id === id)!;
                      const ready = evolutionReady(w, id);
                      const evolved = !!evolutionNames[id] && w.evolutions.includes(evolutionNames[id]!);
                      return (
                        <motion.button
                          autoFocus={id === w.choices[0]}
                          whileTap={{ scale: 0.97 }}
                          key={id}
                          className={`upgrade-card${ready ? " evolution-ready" : ""}`}
                          onClick={() => select(id)}
                        >
                          <div className="card-top">
                            <span className={u.type}>{u.type}</span>
                            <small>{ready ? "✦ 選ぶと進化！" : evolved ? "進化済み" : "STACKABLE"}</small>
                          </div>
                          <div className="card-art">{u.icon}</div>
                          <h3>{u.name}</h3>
                          <p>{u.description}</p>
                          {ready ? (
                            <small className="evolution-hint evolution-bonus">進化: {evolutionBonus(w, id).join(" / ")}</small>
                          ) : evolutionPartners[id] && (
                            <small className="evolution-hint">
                              ✦{" "}
                              {
                                upgrades.find(
                                  (card) => card.id === evolutionPartners[id],
                                )?.name
                              }{" "}
                              {ready ? " を取得済み → 選ぶと進化！" : evolved ? " との進化は発動済み" : " と組み合わせで進化"}
                            </small>
                          )}
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
              {w.phase === "won" ? `${w.duration} SECONDS.` : "BUG TERMINATED."}
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
            <p className="muted">SURVIVOR BEST {high.toLocaleString()} BP</p>
          </section>
        )}
        <footer>
          <span>PROD BREAKER / SURVIVOR V2.19.2</span>
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
                  <p>05　復旧部隊を避け、選んだ時間を生き延びよう。</p>
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
