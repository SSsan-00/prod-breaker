"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, MotionConfig } from "motion/react";
import {
  cascade,
  edges,
  finished,
  hand,
  report,
  topology,
  uptime,
  validTarget,
  type Card,
  type Log,
  type NodeId,
  type Server,
} from "@/game/engine";
import { read, write } from "@/lib/storage";
import { sound, startMusic } from "@/effects/audio";
import ParticleCanvas from "@/effects/ParticleCanvas";
type Phase = "title" | "pick" | "countdown" | "cascade" | "round" | "result";
type Settings = { mute: boolean; volume: number; reduced: boolean };
export default function Game() {
  const [phase, setPhase] = useState<Phase>("title"),
    [nodes, setNodes] = useState(topology),
    [round, setRound] = useState(1),
    [seed, setSeed] = useState(1),
    [selected, setSelected] = useState<Card | null>(null),
    [target, setTarget] = useState<NodeId | null>(null),
    [acquired, setAcquired] = useState<Card[]>([]),
    [total, setTotal] = useState(0),
    [combo, setCombo] = useState(0),
    [maxCombo, setMaxCombo] = useState(0),
    [logs, setLogs] = useState<Log[]>([]),
    [cursor, setCursor] = useState(0),
    [panic, setPanic] = useState(false),
    [fast, setFast] = useState(false),
    [count, setCount] = useState(3),
    [modal, setModal] = useState<"settings" | "help" | null>(null),
    [settings, setSettings] = useState<Settings>({
      mute: true,
      volume: 0.5,
      reduced: false,
    }),
    [high, setHigh] = useState(0),
    [burst, setBurst] = useState<{ x: number; y: number; id: number } | null>(
      null,
    ),
    [elapsed, setElapsed] = useState(0);
  const startTime = useRef(0),
    base = useRef<Server[]>([]),
    run = useRef<ReturnType<typeof cascade> | null>(null),
    panicLock = useRef(false),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const id = setTimeout(() => {
      setSettings(
        read("pb-settings", {
          mute: true,
          volume: 0.5,
          reduced:
            typeof matchMedia === "function" &&
            matchMedia("(prefers-reduced-motion: reduce)").matches,
        }),
      );
      setHigh(read("pb-high", 0));
    }, 0);
    return () => clearTimeout(id);
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (phase === "title" || phase === "result" || settings.mute) return;
    return startMusic(settings.volume);
  }, [phase, settings.mute, settings.volume]);
  const playSound = (kind: Parameters<typeof sound>[0]) => {
    if (!settings.mute) sound(kind, settings.volume);
  };
  function start() {
    timers.current.forEach(clearTimeout);
    startTime.current = performance.now();
    setSeed(Math.floor(Math.random() * 1000000));
    setNodes(topology());
    setRound(1);
    setTotal(0);
    setCombo(0);
    setMaxCombo(0);
    setAcquired([]);
    setSelected(null);
    setTarget(null);
    setLogs([]);
    setCursor(0);
    setPanic(false);
    setFast(false);
    run.current = null;
    setPhase("pick");
    playSound("deploy");
  }
  function deploy() {
    if (!selected || !target || phase !== "pick") return;
    base.current = nodes.map((n) => ({ ...n }));
    run.current = cascade({
      nodes,
      card: selected,
      target,
      acquired,
      seed,
      round,
    });
    setLogs(run.current.logs);
    setCursor(0);
    setCombo(0);
    setPanic(false);
    panicLock.current = false;
    setCount(3);
    setPhase("countdown");
    playSound("deploy");
    for (let i = 1; i <= 3; i++)
      timers.current.push(
        setTimeout(() => {
          setCount(3 - i);
          if (i === 3) setPhase("cascade");
        }, i * 330),
      );
  }
  useEffect(() => {
    if (phase !== "cascade") return;
    const timer = setTimeout(
      () => {
        if (cursor >= logs.length) {
          const result = run.current;
          if (result) {
            setNodes(result.nodes);
            setTotal((t) => t + result.score);
            setMaxCombo((c) => Math.max(c, result.combo));
            setAcquired((a) => (selected ? [...a, selected] : a));
          }
          setPhase("round");
          return;
        }
        const e = logs[cursor];
        setNodes((ns) =>
          ns.map((n) =>
            n.id === e.targetNodeId ? { ...n, hp: e.hp, status: e.status } : n,
          ),
        );
        setCombo(e.combo);
        const n = topology().find((n) => n.id === e.targetNodeId)!;
        setBurst({
          x: n.position[0],
          y: n.position[1],
          id: cursor + round * 200,
        });
        if (!settings.mute)
          sound(e.hp === 0 ? "destroy" : "hit", settings.volume);
        setCursor((c) => c + 1);
      },
      fast ? 65 : settings.reduced ? 180 : logs[cursor]?.hp === 0 ? 650 : 480,
    );
    return () => clearTimeout(timer);
  }, [phase, cursor, logs, fast, settings, selected, round]);
  function doPanic() {
    if (phase !== "cascade" || panicLock.current || !selected || !target)
      return;
    panicLock.current = true;
    setPanic(true);
    playSound("panic");
    const result = cascade({
      nodes: base.current,
      card: selected,
      target,
      acquired,
      seed,
      round,
      panicAt: Math.max(0, cursor),
    });
    run.current = result;
    setLogs(result.logs);
  }
  function next() {
    if (finished(round)) {
      const seconds = Math.round(
        (performance.now() - startTime.current) / 1000,
      );
      setElapsed(seconds);
      const best = Math.max(high, total);
      setHigh(best);
      write("pb-high", best);
      setPhase("result");
    } else {
      setNodes((ns) =>
        ns.map((n) => ({
          ...n,
          hp: Math.max(45, n.hp),
          status: n.hp < 45 ? "warning" : n.status,
        })),
      );
      setRound((r) => r + 1);
      setSelected(null);
      setTarget(null);
      setCombo(0);
      setPanic(false);
      setFast(false);
      setPhase("pick");
    }
  }
  function updateSettings(patch: Partial<Settings>) {
    const value = { ...settings, ...patch };
    setSettings(value);
    write("pb-settings", value);
  }
  const destroyed = nodes.filter((n) => n.hp === 0).length,
    incident = report(total, destroyed),
    currentHand = hand(seed, round),
    last = logs[cursor - 1];
  async function exportImage(share = false) {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#090e12";
    ctx.fillRect(0, 0, 1080, 1080);
    ctx.fillStyle = "#d5fa4e";
    ctx.font = "bold 90px monospace";
    ctx.fillText("PROD BREAKER", 70, 160);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 110px monospace";
    ctx.fillText(`${total.toLocaleString()} BP`, 70, 330);
    ctx.font = "34px sans-serif";
    [
      incident.title,
      `MAX COMBO ${maxCombo} / DESTROYED ${destroyed}/7`,
      `UPTIME ${uptime(nodes)}%`,
      incident.summary,
      `原因：${incident.cause}`,
      "再発防止策：金曜日を廃止する。",
      "架空のジョークゲーム / BUILD THE BUG.",
    ].forEach((line, i) => ctx.fillText(line, 70, 440 + i * 75));
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve),
    );
    if (!blob) return;
    const file = new File([blob], "prod-breaker.png", { type: "image/png" });
    if (share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "PROD BREAKER" });
      } catch {}
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  return (
    <MotionConfig reducedMotion={settings.reduced ? "always" : "user"}>
      <main className={settings.reduced ? "app reduced" : "app"}>
        <header className="site-header">
          <Link href="/" className="brand">
            P<span>▰</span>B <small>PROD BREAKER</small>
          </Link>
          <div className="header-right">
            <span className="sandbox">● SIMULATION ONLY</span>
            <button
              aria-label="ミュート切替"
              onClick={() => updateSettings({ mute: !settings.mute })}
            >
              {settings.mute ? "SOUND OFF" : "SOUND ON"}
            </button>
            <button onClick={() => setModal("settings")} aria-label="設定">
              ⚙
            </button>
          </div>
        </header>
        {phase === "title" ? (
          <section className="title-screen">
            <div className="eyebrow">INCIDENT SIMULATOR / V.1.0</div>
            <h1>
              PROD
              <br />
              <span>
                BREAKER<span className="logo-dot">_</span>
              </span>
            </h1>
            <p className="tagline">BUILD THE BUG. BREAK THE PROD.</p>
            <p className="intro">
              そのデプロイが、すべての始まり。
              <br />
              カードを仕込み、架空の本番を連鎖爆破せよ。
            </p>
            <button className="primary start" onClick={start}>
              GAME START <span>↗</span>
            </button>
            <button className="text-button" onClick={() => setModal("help")}>
              HOW TO PLAY <span>→</span>
            </button>
            <div className="title-meta">
              <span>03 ROUNDS</span>
              <span>07 SERVICES</span>
              <span>∞ BAD IDEAS</span>
            </div>
            <div className="rack" aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="rack-column">
                  {Array.from({ length: 7 }, (_, j) => (
                    <div key={j}>
                      <b /> ▰ ▰ <i />
                    </div>
                  ))}
                </div>
              ))}
              <div className="rack-label">
                PRODUCTION / DO NOT TOUCH
                <br />
                <strong>ALL SYSTEMS OPERATIONAL</strong>
              </div>
            </div>
            <div className="floating-alert">
              ⚠ &nbsp; DEPLOY ON FRIDAY?
              <br />
              <small>What could possibly go wrong.</small>
            </div>
            <p className="high-score">
              PERSONAL BEST <b>{high.toLocaleString()} BP</b>
            </p>
          </section>
        ) : phase === "result" ? (
          <section className="result">
            <div className="eyebrow">INCIDENT CLOSED / ROUND 03</div>
            <h1 className="result-title">
              PRODUCTION
              <br />
              <span>{uptime(nodes) <= 15 ? "DESTROYED" : "SURVIVED"}</span>
            </h1>
            <div className="result-score">
              {total.toLocaleString()}
              <small> BP</small>
            </div>
            <div className="stats">
              <div>
                MAX COMBO<b>{maxCombo}</b>
              </div>
              <div>
                DESTROYED<b>{destroyed}/7</b>
              </div>
              <div>
                UPTIME<b>{uptime(nodes)}%</b>
              </div>
            </div>
            <article className="report">
              <div className="eyebrow">POSTMORTEM # {seed}</div>
              <h2>{incident.title}</h2>
              <p>障害概要：{incident.summary}</p>
              <p>発生原因：{incident.cause}</p>
              <p>
                影響範囲：
                {nodes
                  .filter((n) => n.hp < 100)
                  .map((n) => n.id)
                  .join(" / ")}
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
            <p className="muted">
              PLAY TIME {elapsed}s · BEST {high.toLocaleString()} BP
            </p>
          </section>
        ) : (
          <section className="game">
            <div className="game-heading">
              <div>
                <div className="eyebrow">LIVE INCIDENT / TOKYO REGION</div>
                <h1>本番へ、ようこそ。</h1>
              </div>
              <span className="live">
                ●{" "}
                {phase === "cascade"
                  ? "INCIDENT IN PROGRESS"
                  : "AWAITING DEPLOY"}
              </span>
            </div>
            <div className="hud">
              <div>
                ROUND
                <b>
                  0{round}
                  <small> / 03</small>
                </b>
              </div>
              <div>
                TOTAL BP
                <b>
                  {(
                    total +
                    (phase === "cascade"
                      ? logs.slice(0, cursor).reduce((s, e) => s + e.score, 0)
                      : 0)
                  ).toLocaleString()}
                </b>
              </div>
              <div>
                COMBO
                <b className="lime">
                  {combo}
                  <small> CHAIN</small>
                </b>
              </div>
              <div>
                本番稼働率
                <b className={uptime(nodes) < 40 ? "danger" : ""}>
                  {uptime(nodes)}
                  <small>%</small>
                </b>
                <div className="uptime">
                  <i style={{ width: `${uptime(nodes)}%` }} />
                </div>
              </div>
            </div>
            <div
              className={
                "board " +
                (phase === "cascade" && !settings.reduced && combo >= 10
                  ? "shaking"
                  : "")
              }
            >
              <div className="board-label">
                SERVICE TOPOLOGY <span>● {destroyed} OFFLINE</span>
              </div>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="connections"
                aria-hidden="true"
              >
                {edges.map((e) => {
                  const a = nodes.find((n) => n.id === e.from)!,
                    b = nodes.find((n) => n.id === e.to)!;
                  return (
                    <line
                      key={e.from + e.to}
                      x1={a.position[0]}
                      y1={a.position[1]}
                      x2={b.position[0]}
                      y2={b.position[1]}
                      className={
                        phase === "cascade" &&
                        last?.sourceNodeId === e.from &&
                        last?.targetNodeId === e.to
                          ? "electric"
                          : ""
                      }
                    />
                  );
                })}
              </svg>
              {nodes.map((n) => (
                <button
                  key={n.id}
                  aria-label={`${n.id} ノード HP ${n.hp}`}
                  aria-pressed={target === n.id}
                  disabled={
                    phase !== "pick" ||
                    (!!selected && !validTarget(selected, n))
                  }
                  onClick={() => setTarget(n.id)}
                  className={`server ${n.status} ${target === n.id ? "targeted" : ""} ${last?.targetNodeId === n.id && phase === "cascade" ? "hit" : ""}`}
                  style={{
                    left: `${n.position[0]}%`,
                    top: `${n.position[1]}%`,
                  }}
                >
                  <span className="server-icon">
                    <i />
                    <i />
                    <i />
                  </span>
                  <strong>{n.id}</strong>
                  <span className="node-hp">
                    {n.hp === 0 ? "OFFLINE" : `${n.hp} / 100`}
                  </span>
                  <span className="hp-track">
                    <i style={{ width: n.hp + "%" }} />
                  </span>
                </button>
              ))}
              <ParticleCanvas burst={burst} reduced={settings.reduced} />
              {phase === "cascade" && last && (
                <div
                  key={`${round}-${cursor}`}
                  className="score-pop"
                  style={{
                    left: `${nodes.find((n) => n.id === last.targetNodeId)!.position[0]}%`,
                    top: `${nodes.find((n) => n.id === last.targetNodeId)!.position[1]}%`,
                  }}
                >
                  +{last.score}
                  <small>{last.hp === 0 ? "DESTROYED" : "FAULT"}</small>
                </div>
              )}
              {phase === "cascade" && last?.hp === 0 && !settings.reduced && (
                <div
                  key={`wave-${round}-${cursor}`}
                  className="shockwave"
                  style={{
                    left: `${nodes.find((n) => n.id === last.targetNodeId)!.position[0]}%`,
                    top: `${nodes.find((n) => n.id === last.targetNodeId)!.position[1]}%`,
                  }}
                />
              )}
              {phase === "cascade" && [5, 10, 20, 50].includes(combo) && (
                <div className="combo-banner" key={combo}>
                  {combo} CHAIN
                  <span>
                    {combo >= 20
                      ? "ABSOLUTE CHAOS"
                      : combo >= 10
                        ? "CASCADE FAILURE"
                        : "IT WORKS ON MY MACHINE"}
                  </span>
                </div>
              )}
              {phase === "countdown" && (
                <div className="countdown">
                  DEPLOYING<span>{count || "GO"}</span>
                </div>
              )}
              <div className="board-bottom">
                <span>
                  {phase === "pick"
                    ? "↖ カードと対象ノードを選択"
                    : last
                      ? `> ${last.targetNodeId}: ${last.hp === 0 ? "SERVICE DOWN" : "FAULT DETECTED"} +${last.score} BP`
                      : "> Preparing deployment..."}
                </span>
                <span>SEED {seed}</span>
              </div>
            </div>
            {phase === "pick" ? (
              <>
                <div className="section-label">
                  <span>01 / SELECT YOUR BAD IDEA</span>
                  <span>永続効果は次ラウンドへ持ち越し</span>
                </div>
                <div className="cards">
                  {currentHand.map((c, i) => (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.18 }}
                      className={`card ${selected?.id === c.id ? "selected" : ""}`}
                      key={c.id}
                      aria-pressed={selected?.id === c.id}
                      onClick={() => {
                        setSelected(c);
                        setTarget(null);
                      }}
                    >
                      <div className="card-top">
                        <span className={c.type}>{c.type}</span>
                        <small>
                          0{i + 1} / {c.rarity}
                        </small>
                      </div>
                      <div className="card-art">
                        {c.type === "BUG"
                          ? "⌁"
                          : c.type === "CHAIN"
                            ? "⌘"
                            : "↯"}
                      </div>
                      <h2>{c.name}</h2>
                      <p>{c.description}</p>
                      <div className="card-footer">
                        <span>DMG {c.baseDamage}</span>
                        <span>
                          {c.effects.spread
                            ? `伝播 +${Math.round(c.effects.spread * 100)}%`
                            : c.effects.multiplier
                              ? `BP +${Math.round(c.effects.multiplier * 100)}%`
                              : "DIRECT DAMAGE"}
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>
                <div className="deploy-bar">
                  <div>
                    <span className="eyebrow">DEPLOYMENT PLAN</span>
                    <p>
                      {selected
                        ? `${selected.name} → ${target || "対象ノードを選択"}`
                        : "まずは、バグをひとつ。"}
                    </p>
                  </div>
                  <button
                    className="primary"
                    disabled={!selected || !target}
                    onClick={deploy}
                  >
                    DEPLOY <span>↗</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="cascade-controls">
                <div>
                  <span className="eyebrow">
                    {phase === "round"
                      ? "DEPLOYMENT COMPLETE"
                      : "NO ROLLBACK. ONLY FORWARD."}
                  </span>
                  {phase === "round" && uptime(nodes) <= 15 && (
                    <div className="final-stamp">PRODUCTION DESTROYED</div>
                  )}
                  <h2>
                    {phase === "round"
                      ? `${combo} CHAIN · ${destroyed} SERVICES DOWN`
                      : phase === "countdown"
                        ? "本番反映中…"
                        : combo >= 10
                          ? "大丈夫、想定の範囲外です。"
                          : "正常に異常が発生しています。"}
                  </h2>
                </div>
                {phase === "round" ? (
                  <button className="primary" onClick={next}>
                    {round === 3 ? "障害報告書を見る" : "次のラウンドへ"} →
                  </button>
                ) : (
                  <>
                    <button
                      className="panic"
                      disabled={panic || phase !== "cascade"}
                      onClick={doPanic}
                    >
                      {panic ? "PANIC USED" : "PANIC / 緊急マージ"}
                      <small>全ノードに負荷追加 · 1回限り</small>
                    </button>
                    <button
                      onClick={() => setFast((f) => !f)}
                      disabled={phase !== "cascade"}
                    >
                      {fast ? "通常速度" : "高速化 ⏩"}
                    </button>
                  </>
                )}
              </div>
            )}
            {acquired.length > 0 && (
              <div className="inventory">
                ACTIVE EFFECTS{" "}
                {acquired.map((c, i) => (
                  <span key={i}>{c.name}</span>
                ))}
              </div>
            )}
          </section>
        )}
        <footer>
          <span>PROD BREAKER © 2026</span>
          <span>すべて架空の環境です。実際の本番は大切に。</span>
          <span>BUILD THE BUG. BREAK THE PROD.</span>
        </footer>
        {modal && (
          <div className="modal-backdrop" onClick={() => setModal(null)}>
            <section
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label={modal === "settings" ? "設定" : "遊び方"}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="close"
                onClick={() => setModal(null)}
                aria-label="閉じる"
              >
                ×
              </button>
              <div className="eyebrow">OPERATOR MANUAL</div>
              <h2>{modal === "settings" ? "SETTINGS" : "HOW TO BREAK PROD"}</h2>
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
              ) : (
                <>
                  <p>01　3枚からカードを1枚選ぶ。</p>
                  <p>02　対応するノードを選び、DEPLOY。</p>
                  <p>03　連鎖中にPANICで緊急マージ！</p>
                  <p>04　3ラウンドで最大BPを狙おう。</p>
                  <p className="muted">
                    BUGは直接攻撃、CHAINは伝播強化、BOOSTはBP倍率。カード効果は持ち越します。各ラウンド間にHP45まで自動復旧します。適用できないノードは選択できません。
                  </p>
                </>
              )}
              <button className="primary" onClick={() => setModal(null)}>
                了解、ヨシ！
              </button>
            </section>
          </div>
        )}
      </main>
    </MotionConfig>
  );
}
