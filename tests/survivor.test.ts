import { describe, it, expect, vi } from "vitest";
import {
  chainPower,
  createWorld,
  stepWorld,
  chooseUpgrade,
  upgrades,
  evolutionPartners,
  evolutionNames,
  evolutionReady,
  evolutionBonus,
  upgradeOverflowBonus,
  survivorReport,
  STEP,
  wave,
  lateWaveFactors,
  RUN_SECONDS,
  ENDLESS_SECONDS,
  SECRET_SECONDS,
  isSecretMode,
  runEndTime,
  type World,
} from "../src/game/survivor";
import { read, write } from "../src/lib/storage";
function simulate(w: World, frames: number) {
  for (let i = 0; i < frames; i++) {
    if (w.phase === "upgrade") w = chooseUpgrade(w, w.choices[0]);
    w = stepWorld(w, { x: Math.cos(i / 120), y: Math.sin(i / 120) });
  }
  return w;
}
describe("survivor fixed-step engine", () => {
  it("rewards chain milestones with predictable propagation power", () => {
    expect([0, 9, 10, 29, 30, 100].map(chainPower)).toEqual([1, 1, 1.25, 1.25, 1.5, 1.5]);
    const w = stepWorld(createWorld(), { x: 0, y: 0, panic: true });
    if (w.combo >= 10) expect(w.effects.some((e) => e.kind === "milestone")).toBe(true);
  });
  it("supports all durations and finishes at the selected time", () => {
    for (const duration of [90, 180, 300]) {
      const w = createWorld(42, duration);
      expect(w.duration).toBe(duration);
      w.time = duration - STEP / 2;
      expect(stepWorld(w, { x: 0, y: 0 }).phase).toBe("won");
    }
    expect(createWorld(42, 120).duration).toBe(90);
  });
  it("enters the five-minute secret mode and finishes at 35 minutes", () => {
    const w = createWorld(42, ENDLESS_SECONDS);
    w.time = ENDLESS_SECONDS - STEP / 2; w.bossWave = 59;
    w.shotTimer = 10; w.spawnTimer = 0; w.serverTimer = 10;
    w.entities = [
      { id: 901, x: 1100, y: 1000, hp: 50, maxHp: 100, kind: "boss", label: "SRE CORE", flash: 0 },
      { id: 902, x: 1100, y: 1100, hp: 10, maxHp: 10, kind: "server", label: "DB", flash: 0 },
      { id: 903, x: 1200, y: 1000, hp: 10, maxHp: 10, kind: "drone", label: "WAF", flash: 0 },
      { id: 904, x: 1300, y: 1000, hp: 10, maxHp: 10, kind: "repair", label: "AUTO FIX", flash: 0 },
    ];
    const next = stepWorld(w, { x: 0, y: 0 });
    expect(next.phase).toBe("playing");
    expect(next.duration).toBe(ENDLESS_SECONDS);
    expect(isSecretMode(next)).toBe(true);
    expect(wave(next)).toBe(61);
    expect(next.entities.find(e => e.id === 901)?.hp).toBe(67.5);
    expect(next.entities.find(e => e.id === 901)?.maxHp).toBe(135);
    expect(next.entities.some(e => e.id === 902)).toBe(true);
    expect(next.entities.some(e => e.kind === "drone" || e.kind === "repair")).toBe(false);
    expect(next.effects.some(e => e.kind === "wave" && e.text === "SECRET MODE")).toBe(true);
    expect(next.entities.filter(e => e.kind === "boss")).toHaveLength(61);
    expect(stepWorld(w, { x: 0, y: 0 })).toEqual(next);
    const final = { ...next, time: runEndTime(next) - STEP / 2, bossWave: 69, entities: [], player: { ...next.player, hp: 100 } };
    expect(runEndTime(final)).toBe(ENDLESS_SECONDS + SECRET_SECONDS);
    const finished = stepWorld(final, { x: 0, y: 0 });
    expect(finished.phase).toBe("won");
    expect(wave(finished)).toBe(70);
  });
  it("doubles both damage and kill BP only in secret mode", () => {
    const scoreAt = (time: number) => {
      const w = createWorld(42, ENDLESS_SECONDS);
      w.time = time; w.bossWave = Math.floor(time / 30);
      w.shotTimer = 10; w.spawnTimer = 10; w.serverTimer = 10;
      w.entities = [{ id: 901, x: 1020, y: 1000, hp: 10, maxHp: 10, kind: "server", label: "DB", flash: 0 }];
      w.shots = [{ id: 902, x: 1020, y: 1000, vx: 0, vy: 0, life: 1, damage: 10, pierce: 0, hit: [] }];
      return stepWorld(w, { x: 0, y: 0 });
    };
    expect(scoreAt(1790).score).toBe(116);
    expect(scoreAt(1810).score).toBe(232);
  });
  it("continues spawning cores above 70 while honoring the secret-mode entity cap", () => {
    const w = createWorld(42, ENDLESS_SECONDS);
    w.time = 1830 - STEP / 2; w.bossWave = 60;
    w.shotTimer = 10; w.spawnTimer = 10; w.serverTimer = 10;
    w.entities = Array.from({ length: 100 }, (_, i) => ({
      id: 10000 + i, x: 100, y: 100, hp: 100, maxHp: 100,
      kind: "boss" as const, label: "SRE CORE", flash: 0,
    }));
    const next = stepWorld(w, { x: 0, y: 0 });
    expect(next.entities).toHaveLength(150);
    expect(next.entities.filter(e => e.id < 10000)).toHaveLength(61);
  });
  it("increases secret core health and speed while keeping enemies and entity counts bounded", () => {
    const sample = (waveNumber: number) => {
      const w = createWorld(42, ENDLESS_SECONDS);
      w.time = (waveNumber - 1) * 30 - STEP / 2; w.bossWave = waveNumber - 2;
      w.entities = []; w.shotTimer = 10; w.spawnTimer = 0; w.serverTimer = 10;
      return stepWorld(w, { x: 0, y: 0 });
    };
    const normal = sample(60), first = sample(61), last = sample(70);
    expect(first.entities.filter(e => e.kind === "boss")).toHaveLength(60);
    expect(last.entities.filter(e => e.kind === "boss")).toHaveLength(69);
    expect(first.entities[0].maxHp).toBeGreaterThan(normal.entities.find(e => e.kind === "boss")!.maxHp * 1.35);
    expect(last.entities[0].maxHp).toBeGreaterThan(first.entities[0].maxHp);
    for (const w of [first, last]) {
      expect(w.entities.every(e => e.kind === "boss")).toBe(true);
      expect(w.entities.length).toBeLessThanOrEqual(150);
    }
    const speedAt = (time: number) => {
      const w = createWorld(42, ENDLESS_SECONDS);
      w.time = time; w.bossWave = Math.floor(time / 30);
      w.shotTimer = 10; w.spawnTimer = 10; w.serverTimer = 10;
      w.entities = [{ id: 901, x: 1400, y: 1000, hp: 100, maxHp: 100, kind: "boss", label: "SRE CORE", flash: 0 }];
      return 1400 - stepWorld(w, { x: 0, y: 0 }).entities[0].x;
    };
    expect(speedAt(1810)).toBeGreaterThan(speedAt(1790) * 1.09);
    expect(speedAt(2080)).toBeGreaterThan(speedAt(1810));
  });
  it("unlocks each evolution exactly once in either order", () => {
    const recipes = [
      ["retry", "timeout", "リトライストーム"],
      ["nplus", "leak", "コネクション枯渇祭り"],
      ["hotfix", "friday", "週末リリース"],
      ["threshold", "flush", "完全に正常"],
      ["select", "where", "全件フルスキャン"],
      ["force", "config", "本番直編集"],
      ["oncall", "rollback", "真夜中の復旧会議"],
      ["spec", "local", "動くから仕様"],
      ["cron", "batch", "二重起動フェスティバル"],
      ["migration", "index", "ロック待ちの行列"],
      ["feature", "canary", "全員カナリア"],
      ["cert", "clock", "期限切れタイムリープ"],
      ["approval", "review", "承認済みということにする"],
      ["autoscale", "quota", "無限スケール上限"],
      ["schema", "contract", "互換性は来世で"],
      ["meeting", "reboot", "再起動の承認会議"],
      ["staging", "drift", "環境差分パラダイス"],
      ["lockfile", "latest", "再現不能ビルド"],
      ["timezone", "midnight", "世界同時バッチ祭り"],
      ["secrets", "clipboard", "秘伝の設定コピペ"],
      ["terraform", "manual", "存在しないインフラ"],
      ["sudo", "token", "永遠の管理者権限"],
      ["backup", "restore", "復元できない安心"],
      ["regex", "encoding", "文字化け大正解"],
      ["queue", "duplicate", "無限二重配送"],
      ["cache", "dns", "世界中に古い情報"],
      ["common", "dependency", "全社共通の爆心地"],
      ["test", "deploy", "本番がテスト環境"],
      ["log", "monitor", "監視なきログの海"],
      ["refactor", "merge", "衝突だらけの大改修"],
      ["env", "yolo", "環境変数ヨシ！"],
      ["race", "memory", "競合する記憶"],
      ["allowall", "temporary", "永遠の暫定許可"],
      ["mfa", "sharedaccount", "みんなで本人確認"],
      ["auditlog", "retention", "消えた監査証跡"],
      ["patchlater", "scanner", "既知のまま定例延期"],
      ["publicbucket", "discovery", "知らない公開資産"],
      ["session", "logout", "永遠にログイン中"],
      ["plaintext", "passwordsheet", "みんなのパスワード帳"],
      ["prepared", "sqlstring", "SQLインジェクション発生！"],
      ["sanitize", "trusthtml", "クロスサイトスクリプティング発生！"],
      ["lottery", "attachment", "至急の当選通知"],
      ["secretlog", "publicchat", "秘密の全体共有"],
      ["shoulder", "privacyfilter", "ショルダーハック発生！"],
      ["weakpin", "pinlabel", "PINは端末の隣"],
      ["phishing", "urlcheck", "そっくりログイン画面"],
      ["openredirect", "trustedlink", "どこでも公式リンク"],
      ["dependencyrisk", "typosquat", "依存先がすり替わった"],
      ["usbunknown", "autorun", "拾得物から自動実行"],
      ["alertstorm", "alertfatigue", "鳴り止まない当番電話"],
      ["runbookold", "tribalknowledge", "誰も知らない復旧手順"],
      ["diskfull", "logrotate", "ログで満杯のディスク"],
      ["failover", "standby", "切替先もお休み中"],
      ["capacity", "trafficspike", "想定外の大盛況"],
      ["quickfix", "todo", "永久に一時対応"],
      ["estimate", "scopecreep", "終わらないスプリント"],
      ["mysterycode", "gitblame", "犯人は自分だった"],
      ["fridaydeploy", "vacation", "誰もいない週末障害"],
      ["disabletest", "greenci", "テスト全件成功！"],
      ["directdb", "nobackup", "復元できない直接修正"],
      ["ignoreerror", "emptycatch", "沈黙するエラー"],
      ["yagni", "futureproof", "いつか使う設計"],
      ["solid", "interface", "抽象化の大渋滞"],
      ["kiss", "clever", "解読不能な簡単実装"],
      ["dry", "copypaste", "共通化されたコピペ"],
    ] as const;
    expect(recipes).toHaveLength(65);
    expect(upgrades).toHaveLength(130);
    for (const [a, b, name] of recipes) {
      expect(evolutionPartners[a]).toBe(b);
      expect(evolutionPartners[b]).toBe(a);
      for (const order of [
        [a, b, a],
        [b, a, a],
      ] as const) {
        let w = createWorld();
        for (const id of order) {
          w.phase = "upgrade";
          w.choices = [id];
          w = chooseUpgrade(w, id);
        }
        expect(w.evolutions.filter((x) => x === name)).toHaveLength(1);
      }
    }
  });
  it("highlights only combinations that will actually evolve", () => {
    let w = createWorld();
    expect(evolutionReady(w, "timeout")).toBe(false);
    w.phase = "upgrade"; w.choices = ["retry"];
    w = chooseUpgrade(w, "retry");
    expect(evolutionReady(w, "timeout")).toBe(true);
    expect(evolutionReady(w, "retry")).toBe(false);
    w.phase = "upgrade"; w.choices = ["timeout"];
    w = chooseUpgrade(w, "timeout");
    expect(w.evolutions).toContain("リトライストーム");
    expect(evolutionReady(w, "retry")).toBe(false);
    expect(evolutionReady(w, "timeout")).toBe(false);
  });
  it("previews only the actual extra evolution bonus without mutating the world", () => {
    const w = createWorld();
    w.build = ["prepared"];
    w.phase = "upgrade"; w.choices = ["sqlstring"];
    const before = structuredClone(w);
    expect(evolutionBonus(w, "sqlstring")).toEqual(["連鎖+20", "貫通+2"]);
    expect(w).toEqual(before);
    w.pierce = 8;
    expect(evolutionBonus(w, "sqlstring")).toEqual(["攻撃+12", "連鎖+20"]);
    w.evolutions = ["SQLインジェクション発生！"];
    expect(evolutionBonus(w, "sqlstring")).toEqual([]);
  });
  it("converts capped upgrade and evolution portions into visible attack growth", () => {
    const w = createWorld();
    w.phase = "upgrade"; w.choices = ["cache"];
    w.multishot = 6;
    expect(upgradeOverflowBonus(w, "cache")).toBe(12);
    const next = chooseUpgrade(w, "cache");
    expect(next.multishot).toBe(6);
    expect(next.damage).toBe(w.damage + 12);
    expect(w.overflowDamage).toBe(0);
    const evolution = createWorld();
    evolution.phase = "upgrade"; evolution.choices = ["sqlstring"];
    evolution.build = ["prepared"]; evolution.pierce = 8;
    expect(upgradeOverflowBonus(evolution, "sqlstring")).toBe(12);
    expect(evolutionBonus(evolution, "sqlstring")).toContain("攻撃+12");
  });
  it("keeps every upgrade useful when all capped stats and HP are full", () => {
    for (const card of upgrades) {
      const w = createWorld();
      Object.assign(w, { phase: "upgrade", choices: [card.id], pierce: 8, multishot: 6,
        speed: 340, chainRange: 400, magnet: 420, fireInterval: 0.12, slow: 0.4 });
      w.player.hp = w.player.maxHp;
      const next = chooseUpgrade(w, card.id);
      expect(next.damage > w.damage || next.chainDamage > w.chainDamage || next.aura > w.aura ||
        next.multiplier > w.multiplier || next.player.maxHp > w.player.maxHp, card.name).toBe(true);
      const partner = evolutionPartners[card.id];
      if (partner) {
        w.build = [partner];
        expect(evolutionBonus(w, card.id), card.name).not.toEqual(["能力は上限に到達"]);
      }
    }
  });
  it("rewards large chain milestones exactly once per crossing", () => {
    for (const milestone of [300, 600, 900, 1000, 1200, 1500, 2000, 3000, 4000, 9000, 10000, 10200, 11000, 20000]) {
      const w = createWorld();
      w.combo = milestone - 1; w.comboUntil = 100;
      w.panicCooldown = 15; w.shotTimer = 10; w.spawnTimer = 10; w.serverTimer = 10;
      w.entities = [{ id: 901, x: 1020, y: 1000, hp: 1, maxHp: 1, kind: "server", label: "DB", flash: 0 }];
      w.shots = [{ id: 902, x: 1020, y: 1000, vx: 0, vy: 0, life: 1, damage: 1, pierce: 0, hit: [] }];
      const next = stepWorld(w, { x: 0, y: 0 });
      expect(next.combo).toBe(milestone);
      expect(next.effects.some(e => e.kind === "milestone" && e.text === `${milestone} CHAIN`)).toBe(true);
      expect(next.overdriveUntil).toBeGreaterThan(next.time);
      expect(next.overdrivePower).toBe(milestone >= 10000 ? 1.65 : milestone >= 3000 ? 1.5 : 1.35);
      expect(next.panicCooldown).toBeCloseTo(15 - STEP - (milestone >= 1000 ? 4 : 2));
      const later = stepWorld(next, { x: 0, y: 0 });
      expect(later.panicCooldown).toBeCloseTo(next.panicCooldown - STEP);
    }
  });
  it("grants ten seconds of overdrive and refreshes the full duration at another milestone", () => {
    const w = createWorld();
    w.combo = 9; w.comboUntil = 100;
    w.shotTimer = 10; w.spawnTimer = 10; w.serverTimer = 10;
    w.entities = [{ id: 901, x: 1020, y: 1000, hp: 1, maxHp: 1, kind: "server", label: "DB", flash: 0 }];
    w.shots = [{ id: 902, x: 1020, y: 1000, vx: 0, vy: 0, life: 1, damage: 1, pierce: 0, hit: [] }];
    const first = stepWorld(w, { x: 0, y: 0 });
    expect(first.combo).toBe(10);
    expect(first.overdriveUntil - first.time).toBeCloseTo(10);
    const active = structuredClone(first);
    active.time += 2; active.combo = 29; active.comboUntil = 100;
    active.entities = [{ id: 903, x: 1020, y: 1000, hp: 1, maxHp: 1, kind: "server", label: "DB", flash: 0 }];
    active.shots = [{ id: 904, x: 1020, y: 1000, vx: 0, vy: 0, life: 1, damage: 1, pierce: 0, hit: [] }];
    const refreshed = stepWorld(active, { x: 0, y: 0 });
    expect(refreshed.combo).toBe(30);
    expect(refreshed.overdriveUntil - refreshed.time).toBeCloseTo(10);
    const paused = { ...refreshed, phase: "upgrade" as const };
    expect(stepWorld(paused, { x: 0, y: 0 })).toBe(paused);
    expect(paused.overdriveUntil - paused.time).toBeCloseTo(10);
  });
  it("gives PANIC a proportional core hit and boosts damage during overdrive", () => {
    const w = createWorld();
    w.shotTimer = 10; w.spawnTimer = 10; w.serverTimer = 10;
    w.entities = [{ id: 900, x: 1020, y: 1000, hp: 10000, maxHp: 10000, kind: "boss", label: "CORE", flash: 0 }];
    const panic = stepWorld(w, { x: 0, y: 0, panic: true });
    expect(panic.entities[0].hp).toBe(9400);
    expect(panic.player.invulnerable).toBe(1.5);
    const boosted = createWorld();
    boosted.shotTimer = 10; boosted.spawnTimer = 10; boosted.serverTimer = 10;
    boosted.overdriveUntil = 5; boosted.overdrivePower = 1.5;
    boosted.entities = [{ id: 900, x: 1020, y: 1000, hp: 1000, maxHp: 1000, kind: "boss", label: "CORE", flash: 0 }];
    boosted.shots = [{ id: 901, x: 1020, y: 1000, vx: 0, vy: 0, life: 1, damage: 100, pierce: 0, hit: [] }];
    expect(stepWorld(boosted, { x: 0, y: 0 }).entities[0].hp).toBe(850);
  });
  it("keeps the 10000-chain cut-in when a cascade exceeds the effect budget", () => {
    const w = createWorld();
    w.combo = 9999; w.comboUntil = 100; w.chainDamage = 10000; w.chainRange = 400;
    w.shotTimer = 10; w.spawnTimer = 10; w.serverTimer = 10;
    w.entities = Array.from({ length: 100 }, (_, i) => ({ id: 1000 + i, x: 1000 + i, y: 1000,
      hp: 1, maxHp: 1, kind: "server" as const, label: "DB", flash: 0 }));
    w.shots = [{ id: 2000, x: 1000, y: 1000, vx: 0, vy: 0, life: 1, damage: 1, pierce: 0, hit: [] }];
    const next = stepWorld(w, { x: 0, y: 0 });
    expect(next.effects.length).toBeLessThanOrEqual(100);
    expect(next.effects.some(e => e.kind === "milestone" && e.text === "10000 CHAIN")).toBe(true);
  });
  it("offers an unfinished evolution partner while keeping three distinct choices", () => {
    let offered = 0;
    for (let seed = 0; seed < 100; seed++) {
      const w = createWorld(seed);
      w.build = ["retry"];
      w.xp = 1000;
      const next = stepWorld(w, { x: 0, y: 0 });
      expect(next.phase).toBe("upgrade");
      expect(next.choices).toHaveLength(3);
      expect(new Set(next.choices).size).toBe(3);
      if (next.choices.includes("timeout")) offered++;
      expect(stepWorld(w, { x: 0, y: 0 }).choices).toEqual(next.choices);
    }
    expect(offered).toBe(100);
    const completed = createWorld(8);
    completed.build = ["retry", "timeout"];
    completed.evolutions = ["リトライストーム"];
    completed.xp = 1000;
    const next = stepWorld(completed, { x: 0, y: 0 });
    expect(next.choices.some((id) => evolutionReady(next, id))).toBe(false);
    expect(new Set(next.choices).size).toBe(3);
  });
  it("offers unacquired upgrades more often while retaining repeats and deterministic choices", () => {
    const owned = upgrades.slice(0, upgrades.length / 2).map(card => card.id);
    const ownedSet = new Set(owned);
    let repeated = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const w = createWorld(seed);
      w.build = owned;
      w.evolutions = [...new Set(Object.values(evolutionNames).filter((name): name is string => !!name))];
      w.xp = 1000;
      const options = stepWorld(w, { x: 0, y: 0 }).choices;
      expect(options).toEqual(stepWorld(w, { x: 0, y: 0 }).choices);
      expect(new Set(options).size).toBe(3);
      repeated += options.filter(id => ownedSet.has(id)).length;
    }
    expect(repeated).toBeGreaterThan(30);
    expect(repeated).toBeLessThan(180);
    const completed = createWorld(7);
    completed.build = upgrades.map(card => card.id);
    completed.evolutions = [...new Set(Object.values(evolutionNames).filter((name): name is string => !!name))];
    completed.xp = 1000;
    expect(new Set(stepWorld(completed, { x: 0, y: 0 }).choices).size).toBe(3);
  });
  it("offers a possible evolution starter in every opening choice", () => {
    for (let seed = 0; seed < 100; seed++) {
      const w = createWorld(seed);
      w.xp = 1000;
      const next = stepWorld(w, { x: 0, y: 0 });
      expect(next.choices.some((id) => !!evolutionPartners[id])).toBe(true);
      expect(new Set(next.choices).size).toBe(3);
    }
  });
  it("offers an evolution partner after choosing any first upgrade", () => {
    for (const upgrade of upgrades) {
      const world = createWorld(42);
      world.phase = "upgrade";
      world.choices = [upgrade.id];
      const selected = chooseUpgrade(world, upgrade.id);
      selected.xp = 1000;
      const next = stepWorld(selected, { x: 0, y: 0 });
      expect(next.choices.some((id) => evolutionReady(next, id)), upgrade.name).toBe(true);
      expect(new Set(next.choices).size).toBe(3);
    }
  });
  it("produces deterministic varied reports even for highly destructive runs", () => {
    const reports = Array.from({ length: 100 }, (_, seed) => {
      const w = createWorld(seed);
      w.destroyed = 120;
      w.maxCombo = 80;
      w.build = ["friday", "retry"];
      return survivorReport(w);
    });
    expect(new Set(reports.map((r) => r.title)).size).toBeGreaterThan(5);
    expect(new Set(reports.map((r) => r.cause)).size).toBeGreaterThan(8);
    expect(new Set(reports.map((r) => r.prevention)).size).toBeGreaterThan(8);
    const w = createWorld(7);
    w.destroyed = 120;
    expect(survivorReport(w)).toEqual(survivorReport(w));
    const before = Array.from({ length: 100 }, (_, seed) => {
      const state = createWorld(seed);
      state.destroyed = 79;
      return survivorReport(state).title;
    });
    const after = Array.from({ length: 100 }, (_, seed) => {
      const state = createWorld(seed);
      state.destroyed = 80;
      return survivorReport(state).title;
    });
    expect(before).not.toContain("本番の破壊神");
    expect(after).toContain("本番の破壊神");
  });
  it("is reproducible and never mutates its input", () => {
    const a = createWorld(123),
      before = structuredClone(a);
    expect(simulate(a, 300)).toEqual(simulate(createWorld(123), 300));
    expect(a).toEqual(before);
    expect(createWorld(124).entities).not.toEqual(a.entities);
  });
  it("moves continuously and normalizes diagonal input", () => {
    const a = createWorld();
    const b = stepWorld(a, { x: 1, y: 1 });
    expect(
      Math.hypot(b.player.x - a.player.x, b.player.y - a.player.y),
    ).toBeCloseTo(a.speed * STEP);
    expect(b.time).toBeCloseTo(STEP);
    expect(a.time).toBe(0);
  });
  it("copies nested step data while retaining moving and detached arc endpoints", () => {
    const a = createWorld(42);
    a.entities = [{ id: 100, x: 1120, y: 1000, hp: 100, maxHp: 100, kind: "drone", label: "WAF", flash: 0 }];
    a.shotTimer = 10; a.spawnTimer = 10; a.serverTimer = 10;
    a.shots = [{ id: 101, x: 800, y: 800, vx: 10, vy: 0, life: 1, damage: 1, pierce: 0, hit: [99] }];
    a.pickups = [{ id: 102, x: 1100, y: 1000, value: 3 }];
    const detached = { x: 1600, y: 1600 };
    a.effects = [a.entities[0], a.entities[0], detached, detached, a.player].map((to, i) => ({
      id: 200 + i, kind: "arc", x: 1000, y: 1000, life: 1, maxLife: 1, text: "", to,
    }));
    const before = structuredClone(a);
    const freeze = (value: object) => {
      Object.freeze(value);
      for (const child of Object.values(value)) if (child && typeof child === "object" && !Object.isFrozen(child)) freeze(child);
    };
    freeze(a);
    const b = stepWorld(a, { x: 1, y: 0 });
    expect(a).toEqual(before);
    expect(b.effects[0].to).toBe(b.entities[0]);
    expect(b.effects[1].to).toBe(b.entities[0]);
    expect(b.effects[2].to).toBe(b.effects[3].to);
    expect(b.effects[2].to).not.toBe(detached);
    expect(b.effects[4].to).toBe(b.player);
    expect(b.entities[0].x).not.toBe(a.entities[0].x);
    expect(b.shots[0].hit).not.toBe(a.shots[0].hit);
    expect(b.pickups[0]).not.toBe(a.pickups[0]);
    expect(b.build).not.toBe(a.build);
    expect(b.evolutions).not.toBe(a.evolutions);
    expect(b.choices).not.toBe(a.choices);
  });
  it("retains strict circular projectile hit boundaries", () => {
    for (const [x, y, hit] of [[24, 0, false], [23.999999, 0, true], [23, 23, false], [0, -24, false], [12, 12, true]] as const) {
      const w = createWorld(42);
      w.shotTimer = 10; w.spawnTimer = 10; w.serverTimer = 10;
      w.entities = [{ id: 100, x: 1000 + x, y: 1000 + y, hp: 1000, maxHp: 1000, kind: "server", label: "DB", flash: 0 }];
      w.shots = [{ id: 101, x: 1000, y: 1000, vx: 0, vy: 0, life: 1, damage: 18, pierce: 1, hit: [] }];
      expect(stepWorld(w, { x: 0, y: 0 }).entities[0].hp).toBe(hit ? 982 : 1000);
    }
  });
  it("clamps movement at world bounds and rejects nonfinite movement", () => {
    const a = createWorld();
    a.player.x = 1972;
    expect(stepWorld(a, { x: 1, y: 0 }).player.x).toBe(1972);
    expect(stepWorld(a, { x: NaN, y: Infinity }).player.x).toBe(1972);
  });
  it("automatically fires without an attack input", () => {
    const a = stepWorld(createWorld(), { x: 0, y: 0 });
    expect(a.shots.length).toBeGreaterThan(0);
    expect(a.entities.length).toBeGreaterThan(7);
  });
  it("creates a bounded chain, scores destruction, and vacuums XP with PANIC", () => {
    const a = stepWorld(createWorld(), { x: 0, y: 0, panic: true });
    expect(a.panicUses).toBe(1);
    expect(a.destroyed).toBeGreaterThanOrEqual(7);
    expect(a.maxCombo).toBeGreaterThanOrEqual(7);
    expect(a.score).toBeGreaterThan(0);
    expect(a.phase).toBe("upgrade");
    expect(a.choices).toHaveLength(3);
    expect(new Set(a.choices).size).toBe(3);
  });
  it("spaces opening upgrades while preserving earned XP", () => {
    let w = stepWorld(createWorld(), { x: 0, y: 0, panic: true });
    expect(w.phase).toBe("upgrade");
    const firstTime = w.time;
    w = chooseUpgrade(w, w.choices[0]);
    w.xp = 1000;
    const banked = w.xp;
    for (let i = 0; i < 210; i++) {
      w = stepWorld(w, { x: 0, y: 0 });
      expect(w.phase).toBe("playing");
    }
    expect(w.xp).toBeGreaterThanOrEqual(banked);
    while (w.phase === "playing" && w.time < firstTime + 9)
      w = stepWorld(w, { x: 0, y: 0 });
    expect(w.phase).toBe("upgrade");
    expect(w.time - firstTime).toBeGreaterThanOrEqual(8);
    expect(w.xp).toBeGreaterThan(0);
  });
  it("keeps banked XP from causing back-to-back upgrades after 30 seconds", () => {
    let w = createWorld();
    w.time = 31;
    w.xp = 1000;
    w.player.hp = w.player.maxHp = 10000;
    w = stepWorld(w, { x: 0, y: 0 });
    expect(w.phase).toBe("upgrade");
    const firstTime = w.time;
    w = chooseUpgrade(w, w.choices[0]);
    for (let i = 0; i < 120; i++) {
      w = stepWorld(w, { x: 0, y: 0 });
      expect(w.phase).toBe("playing");
    }
    while (w.phase === "playing" && w.time < firstTime + 6)
      w = stepWorld(w, { x: 0, y: 0 });
    expect(w.phase).toBe("upgrade");
    expect(w.time - firstTime).toBeGreaterThanOrEqual(5);
    expect(w.xp).toBeGreaterThan(0);
  });
  it("keeps early XP requirements while limiting late-level growth", () => {
    for (const [required, next] of [[5, 8], [68, 87], [400, 440], [480, 500], [500, 500], [1000, 500]]) {
      const w = createWorld(42, 1800);
      w.time = 60;
      w.xp = w.nextXp = required;
      const result = stepWorld(w, { x: 0, y: 0 });
      expect(result.phase).toBe("upgrade");
      expect(result.nextXp).toBe(next);
      expect(result.nextUpgradeAt - result.time).toBe(5);
    }
  });
  it("adds targets and a flanking enemy in later waves while keeping bounds", () => {
    const w = createWorld();
    w.time = 35; w.bossWave = 1; w.spawnTimer = 0; w.serverTimer = 0;
    const beforeServers = w.entities.filter((e) => e.kind === "server").length;
    const next = stepWorld(w, { x: 0, y: 0 });
    expect(next.entities.filter((e) => e.kind === "server").length).toBe(beforeServers + 5);
    expect(next.entities.filter((e) => e.kind === "drone" || e.kind === "repair").length).toBe(2);
    expect(next.entities.length).toBeLessThanOrEqual(100);
  });
  it("adds more nearby targets as waves advance without exceeding the entity cap", () => {
    const early = createWorld(42, 300);
    early.shotTimer = 10; early.serverTimer = 0; early.spawnTimer = 10;
    const earlyCount = stepWorld(early, { x: 0, y: 0 }).entities.filter((e) => e.kind === "server").length;
    const later = createWorld(42, 300);
    later.time = 90; later.bossWave = 3; later.shotTimer = 10; later.serverTimer = 0; later.spawnTimer = 10;
    const next = stepWorld(later, { x: 0, y: 0 });
    expect(next.entities.filter((e) => e.kind === "server").length).toBeGreaterThan(earlyCount);
    expect(next.entities.length).toBeLessThanOrEqual(100);
  });
  it("announces a new wave once, with modestly stronger reinforcements", () => {
    const w = createWorld(42, 90);
    w.time = 30 - STEP / 2;
    w.spawnTimer = 0;
    w.shotTimer = 10;
    const next = stepWorld(w, { x: 0, y: 0 });
    expect(wave(next)).toBe(2);
    expect(next.effects.filter((e) => e.kind === "wave").map((e) => e.text)).toEqual(["WAVE 02"]);
    expect(next.entities.find((e) => e.kind === "boss")?.maxHp).toBe(589);
    const drone = next.entities.find((e) => e.kind === "drone");
    expect(drone?.maxHp).toBe(39);
    const after = stepWorld(next, { x: 0, y: 0 });
    expect(after.effects.filter((e) => e.kind === "wave")).toHaveLength(1);
    const end = createWorld(42, 90);
    end.time = 90 - STEP / 2;
    expect(stepWorld(end, { x: 0, y: 0 }).effects.some((e) => e.kind === "wave")).toBe(false);
  });
  it("activates a temporary faster firing burst at a chain milestone", () => {
    const triggered = stepWorld(createWorld(), { x: 0, y: 0, panic: true });
    expect(triggered.combo).toBeGreaterThanOrEqual(10);
    expect(triggered.overdriveUntil).toBeGreaterThan(triggered.time);
    const active = createWorld();
    active.overdriveUntil = 10;
    const normal = createWorld();
    const fastStep = stepWorld(active, { x: 0, y: 0 });
    const normalStep = stepWorld(normal, { x: 0, y: 0 });
    expect(fastStep.shotTimer).toBeCloseTo(normal.fireInterval * 0.65 - STEP);
    expect(normalStep.shotTimer).toBeCloseTo(normal.fireInterval - STEP);
    const expired = createWorld();
    expired.time = 10;
    expired.overdriveUntil = 10;
    expect(stepWorld(expired, { x: 0, y: 0 }).shotTimer).toBeCloseTo(normal.fireInterval - STEP);
  });
  it("recharges PANIC at chain milestones without going negative", () => {
    const w = stepWorld(createWorld(), { x: 0, y: 0, panic: true });
    expect(w.combo).toBeGreaterThanOrEqual(10);
    expect(w.panicCooldown).toBeLessThanOrEqual(20);
    expect(w.panicCooldown).toBeGreaterThanOrEqual(0);
  });
  it("prevents repeated panic during cooldown", () => {
    let a = stepWorld(createWorld(), { x: 0, y: 0, panic: true });
    a = chooseUpgrade(a, a.choices[0]);
    for (let i = 0; i < 30; i++) {
      if (a.phase === "upgrade") a = chooseUpgrade(a, a.choices[0]);
      a = stepWorld(a, { x: 0, y: 0, panic: true });
    }
    expect(a.panicUses).toBe(1);
    expect(a.panicCooldown).toBeGreaterThan(0);
  });
  it("pauses simulation during upgrade and validates choices", () => {
    const a = stepWorld(createWorld(), { x: 0, y: 0, panic: true });
    expect(stepWorld(a, { x: 1, y: 0 })).toBe(a);
    const missing = upgrades.find((u) => !a.choices.includes(u.id))!;
    expect(() => chooseUpgrade(a, missing.id)).toThrow();
    const b = chooseUpgrade(a, a.choices[0]);
    expect(b.phase).toBe("playing");
    expect(b.build).toHaveLength(1);
    expect(a.build).toHaveLength(0);
  });
  it("applies every upgrade effect", () => {
    for (const u of upgrades) {
      const a = createWorld();
      a.phase = "upgrade";
      a.choices = [u.id];
      const b = chooseUpgrade(a, u.id);
      expect(b.build).toContain(u.id);
      expect(b.choices).toEqual([]);
      expect(b.phase).toBe("playing");
      expect(b.player.hp).toBeLessThanOrEqual(b.player.maxHp);
      const stats = (w: World) => [
        w.damage,
        w.fireInterval,
        w.multishot,
        w.pierce,
        w.speed,
        w.magnet,
        w.chainRange,
        w.chainDamage,
        w.multiplier,
        w.aura,
        w.slow,
        w.player.hp,
        w.player.maxHp,
      ];
      expect(stats(b), `${u.name} must have a gameplay effect`).not.toEqual(
        stats(a),
      );
    }
  });
  it("caps fire rate, shots, movement speed and chain radius", () => {
    let a = createWorld();
    for (let i = 0; i < 30; i++)
      for (const id of ["test", "cache", "env", "retry"] as const) {
        a.phase = "upgrade";
        a.choices = [id];
        a = chooseUpgrade(a, id);
      }
    expect(a.fireInterval).toBeGreaterThanOrEqual(0.12);
    expect(a.multishot).toBeLessThanOrEqual(6);
    expect(a.speed).toBeLessThanOrEqual(340);
    expect(a.chainRange).toBeLessThanOrEqual(400);
  });
  it("attracts and collects nearby logs", () => {
    const a = createWorld();
    a.pickups = [{ id: 999, x: a.player.x + 60, y: a.player.y, value: 2 }];
    let b = a;
    for (let i = 0; i < 10; i++) b = stepWorld(b, { x: 0, y: 0 });
    expect(b.xp).toBe(2);
    expect(b.pickups.some((p) => p.id === 999)).toBe(false);
  });
  it("moves SRE cores a little faster and respects enemy slow effects", () => {
    const w = createWorld();
    w.shotTimer = 10; w.spawnTimer = 10; w.serverTimer = 10;
    w.entities = [{ id: 999, x: 1300, y: 1000, hp: 500, maxHp: 500, kind: "boss", label: "SRE CORE", flash: 0 }];
    const normal = stepWorld(w, { x: 0, y: 0 });
    expect(1300 - normal.entities[0].x).toBeCloseTo(71.5 * STEP);
    w.slow = 0.5;
    const slowed = stepWorld(w, { x: 0, y: 0 });
    expect(1300 - slowed.entities[0].x).toBeCloseTo(35.75 * STEP);
  });
  it("chasing enemies cause contact damage with an immunity window", () => {
    const a = createWorld();
    a.entities = [
      {
        id: 999,
        x: 1000,
        y: 1000,
        hp: 1000,
        maxHp: 1000,
        kind: "drone",
        label: "WAF",
        flash: 0,
      },
    ];
    const b = stepWorld(a, { x: 0, y: 0 });
    expect(b.player.hp).toBe(88);
    expect(stepWorld(b, { x: 0, y: 0 }).player.hp).toBe(88);
  });
  it("repair bots restore damaged services", () => {
    const a = createWorld();
    a.shotTimer = 10;
    a.entities = [
      {
        id: 1,
        x: 1100,
        y: 1000,
        hp: 10,
        maxHp: 30,
        kind: "server",
        label: "DB",
        flash: 0,
      },
      {
        id: 2,
        x: 1101,
        y: 1000,
        hp: 30,
        maxHp: 30,
        kind: "repair",
        label: "FIX",
        flash: 0,
      },
    ];
    expect(stepWorld(a, { x: 0, y: 0 }).entities[0].hp).toBeGreaterThan(10);
  });
  it("limits repeated chain damage to cores while direct attacks remain effective", () => {
    const w = createWorld();
    w.chainDamage = 10000;
    w.shotTimer = 10;
    w.entities = [
      { id: 900, x: 1020, y: 1000, hp: 1, maxHp: 1, kind: "server", label: "WEB", flash: 0 },
      { id: 901, x: 1030, y: 1000, hp: 1, maxHp: 1, kind: "server", label: "API", flash: 0 },
      { id: 902, x: 1040, y: 1000, hp: 500, maxHp: 500, kind: "boss", label: "SRE CORE", flash: 0 },
    ];
    const after = stepWorld(w, { x: 0, y: 0, panic: true });
    const core = after.entities.find((e) => e.id === 902);
    expect(core?.hp).toBe(275); // One 20% chain hit plus 100 and 5% PANIC damage.
    expect(after.destroyed).toBe(2);
    expect(after.score).toBeGreaterThan(0);
    expect(core?.chainGuardUntil).toBeGreaterThan(after.time);
    const later = structuredClone(after);
    later.phase = "playing";
    later.time = core!.chainGuardUntil!;
    later.shotTimer = 10;
    later.entities.push({ id: 904, x: 1100, y: 1000, hp: 1, maxHp: 1, kind: "server", label: "DB", flash: 0 });
    later.shots = [{ id: 905, x: 1100, y: 1000, vx: 0, vy: 0, life: 1, damage: 1, pierce: 0, hit: [] }];
    expect(stepWorld(later, { x: 0, y: 0 }).entities.find((e) => e.id === 902)?.hp).toBe(175);
    const direct = createWorld();
    direct.shotTimer = 10;
    direct.entities = [{ id: 902, x: 1020, y: 1000, hp: 50, maxHp: 500, kind: "boss", label: "SRE CORE", flash: 0, chainGuardUntil: 100 }];
    direct.shots = [{ id: 903, x: 1020, y: 1000, vx: 0, vy: 0, life: 1, damage: 50, pierce: 0, hit: [] }];
    expect(stepWorld(direct, { x: 0, y: 0 }).entities.some((e) => e.id === 902)).toBe(false);
  });
  it("advances waves and spawns the increasing number of bosses once", () => {
    let a = createWorld();
    a.time = 60 - STEP;
    const b = stepWorld(a, { x: 0, y: 0 });
    expect(wave(b)).toBe(3);
    expect(b.bossSpawned).toBe(true);
    expect(b.entities.filter((e) => e.kind === "boss")).toHaveLength(2);
    a = stepWorld(b, { x: 0, y: 0 });
    expect(a.entities.filter((e) => e.kind === "boss")).toHaveLength(2);
  });
  it("scales core and enemy durability in later waves", () => {
    const sample = (waveNumber: number) => {
      const w = createWorld(42, 300);
      w.time = (waveNumber - 1) * 30 - STEP / 2;
      w.bossWave = waveNumber - 2;
      w.shotTimer = 10; w.spawnTimer = 0; w.serverTimer = 10;
      return stepWorld(w, { x: 0, y: 0 });
    };
    const early = sample(2);
    const late = sample(8);
    const earlyCore = early.entities.find((e) => e.kind === "boss")!;
    const lateCore = late.entities.find((e) => e.kind === "boss")!;
    expect(earlyCore.maxHp).toBe(580);
    expect(lateCore.maxHp).toBe(2913);
    const earlyEnemy = early.entities.find((e) => e.kind === "drone")!;
    const lateEnemy = late.entities.find((e) => e.kind === "drone")!;
    expect(lateEnemy.maxHp).toBeGreaterThan(earlyEnemy.maxHp);
  });
  it("spawns one additional core per wave without exceeding the entity cap", () => {
    for (let waveNumber = 2; waveNumber <= 10; waveNumber++) {
      const w = createWorld(42, 300);
      w.time = (waveNumber - 1) * 30 - STEP / 2;
      w.bossWave = waveNumber - 2;
      w.shotTimer = 10; w.spawnTimer = 10; w.serverTimer = 10;
      const next = stepWorld(w, { x: 0, y: 0 });
      const bosses = next.entities.filter((e) => e.kind === "boss");
      expect(bosses).toHaveLength(waveNumber - 1);
      expect(new Set(bosses.map((e) => e.id)).size).toBe(waveNumber - 1);
      expect(next.entities.length).toBeLessThanOrEqual(100);
    }
  });
  it("limits core HP growth in the final endless wave", () => {
    const w = createWorld(42, 1800);
    w.time = 1770 - STEP / 2; w.bossWave = 58;
    w.entities = []; w.shotTimer = 10; w.spawnTimer = 10; w.serverTimer = 10;
    const next = stepWorld(w, { x: 0, y: 0 });
    const cores = next.entities.filter((entity) => entity.kind === "boss");
    expect(wave(next)).toBe(60);
    expect(cores).toHaveLength(59);
    expect(cores[0].maxHp).toBe(16576);
    expect(next.entities.length).toBeLessThanOrEqual(100);
  });
  it("raises late-wave enemy health and speed gently from wave 50", () => {
    expect(lateWaveFactors(49)).toEqual({ hp: 1, speed: 1 });
    for (const [waveNumber, hp] of [[49, 11808], [50, 12208], [51, 12615], [60, 16576]]) {
      const w = createWorld(42, 1800);
      w.time = (waveNumber - 1) * 30 - STEP / 2; w.bossWave = waveNumber - 2;
      w.entities = []; w.shotTimer = 10; w.spawnTimer = 0; w.serverTimer = 10;
      const next = stepWorld(w, { x: 0, y: 0 });
      expect(next.entities.find(e => e.kind === "boss")?.maxHp).toBe(hp);
      const moving = createWorld(42, 1800);
      moving.time = (waveNumber - 1) * 30 + 1; moving.bossWave = waveNumber - 1;
      moving.entities = [{ id: 200, x: 1300, y: 1000, hp: 500, maxHp: 500, kind: "boss", label: "CORE", flash: 0 }];
      moving.shotTimer = 10; moving.spawnTimer = 10; moving.serverTimer = 10;
      const after = stepWorld(moving, { x: 0, y: 0 });
      expect(1300 - after.entities[0].x).toBeCloseTo(71.5 * lateWaveFactors(waveNumber).speed * STEP);
    }
    expect(lateWaveFactors(60).hp).toBeCloseTo(1.165);
    expect(lateWaveFactors(60).speed).toBeCloseTo(1.066);
  });
  it("starts the same gentle scaling at the selected wave of each shorter mode", () => {
    for (const [duration, start, startHp, endHp] of [[90, 2, 589, 1026], [180, 4, 1535, 2192], [300, 6, 2383, 2645]]) {
      expect(lateWaveFactors(start - 1, duration)).toEqual({ hp: 1, speed: 1 });
      expect(lateWaveFactors(start, duration).hp).toBeCloseTo(1.015);
      expect(lateWaveFactors(start, duration).speed).toBeCloseTo(1.006);
      expect(lateWaveFactors(start + 1, duration).hp).toBeCloseTo(1.03);
      expect(lateWaveFactors(start + 1, duration).speed).toBeCloseTo(1.012);
      for (const [number, hp] of [[start, startHp], [start + 1, endHp]]) {
        const w = createWorld(42, duration);
        w.time = (number - 1) * 30 - STEP / 2; w.bossWave = number - 2;
        w.entities = []; w.shotTimer = 10; w.spawnTimer = 10; w.serverTimer = 10;
        expect(stepWorld(w, { x: 0, y: 0 }).entities.find(e => e.kind === "boss")?.maxHp).toBe(hp);
      }
    }
  });
  it("keeps scaling through the final wave of each shorter mode", () => {
    for (const [duration, finalWave, coreHp] of [[90, 3, 1026], [180, 6, 2454], [300, 10, 3470]]) {
      const w = createWorld(42, duration);
      w.time = (finalWave - 1) * 30 - STEP / 2; w.bossWave = finalWave - 2;
      w.entities = []; w.shotTimer = 10; w.spawnTimer = 10; w.serverTimer = 10;
      const next = stepWorld(w, { x: 0, y: 0 });
      expect(wave(next)).toBe(finalWave);
      expect(next.entities.find(e => e.kind === "boss")?.maxHp).toBe(coreHp);
    }
  });
  it("increases repair-bot health every late wave even with integer rounding", () => {
    for (let waveNumber = 49; waveNumber <= 60; waveNumber++) {
      const w = createWorld(12, 1800);
      w.time = (waveNumber - 1) * 30 + 1; w.bossWave = waveNumber - 1;
      w.entities = []; w.shotTimer = 10; w.spawnTimer = 0; w.serverTimer = 10;
      const next = stepWorld(w, { x: 0, y: 0 });
      expect(next.entities.find(e => e.kind === "repair")?.maxHp).toBe(58 + Math.max(0, waveNumber - 49));
    }
  });
  it("applies late-wave speed to every moving enemy type", () => {
    for (const [kind, baseSpeed] of [["boss", 71.5], ["repair", 64], ["drone", 795]] as const) {
      const w = createWorld(42, 1800);
      w.time = 1771; w.bossWave = 59;
      w.entities = [{ id: 200, x: 1300, y: 1000, hp: 500, maxHp: 500, kind, label: "ENEMY", flash: 0 }];
      w.shotTimer = 10; w.spawnTimer = 10; w.serverTimer = 10;
      const next = stepWorld(w, { x: 0, y: 0 });
      expect(1300 - next.entities[0].x, kind).toBeCloseTo(baseSpeed * 1.066 * STEP);
    }
  });
  it("spawns cores across the map safely, including when the player is at the edge", () => {
    const positions = [[1000, 1000], [28, 28], [1972, 28], [28, 1972], [1972, 1972], [1000, 28], [28, 1000]];
    for (const [x, y] of positions) {
      const w = createWorld(42, 300);
      w.player.x = x; w.player.y = y;
      w.time = 270 - STEP / 2; w.bossWave = 8;
      w.entities = []; w.shotTimer = 10; w.spawnTimer = 10; w.serverTimer = 10;
      const next = stepWorld(w, { x: 0, y: 0 });
      const cores = next.entities.filter((e) => e.kind === "boss");
      expect(cores).toHaveLength(9);
      for (const core of cores) {
        expect(Math.hypot(core.x - x, core.y - y)).toBeGreaterThan(275);
        expect(core.x).toBeGreaterThanOrEqual(28); expect(core.x).toBeLessThanOrEqual(1972);
        expect(core.y).toBeGreaterThanOrEqual(28); expect(core.y).toBeLessThanOrEqual(1972);
      }
      for (let i = 0; i < cores.length; i++) for (let j = i + 1; j < cores.length; j++) {
        expect(Math.hypot(cores[i].x - cores[j].x, cores[i].y - cores[j].y)).toBeGreaterThan(85);
      }
      expect(stepWorld(w, { x: 0, y: 0 }).entities).toEqual(next.entities);
    }
  });
  it("varies core spawn locations by seed while remaining reproducible", () => {
    const spawn = (seed: number) => {
      const w = createWorld(seed, 300);
      w.time = 90 - STEP / 2; w.bossWave = 2;
      w.entities = []; w.shotTimer = 10; w.spawnTimer = 10; w.serverTimer = 10;
      return stepWorld(w, { x: 0, y: 0 }).entities.filter((e) => e.kind === "boss").map(({ x, y }) => [x, y]);
    };
    expect(spawn(42)).toEqual(spawn(42));
    expect(spawn(42)).not.toEqual(spawn(43));
    expect(new Set(Array.from({ length: 8 }, (_, seed) => JSON.stringify(spawn(seed)))).size).toBe(8);
  });
  it("wins at 90 seconds and freezes terminal states", () => {
    const a = createWorld();
    a.time = RUN_SECONDS - STEP / 2;
    const b = stepWorld(a, { x: 0, y: 0 });
    expect(b.phase).toBe("won");
    expect(b.time).toBe(90);
    expect(stepWorld(b, { x: 1, y: 1 })).toBe(b);
  });
  it("loses at zero HP, never allowing negative HP", () => {
    const a = createWorld();
    a.player.hp = 1;
    a.entities = [
      {
        id: 999,
        x: 1000,
        y: 1000,
        hp: 1000,
        maxHp: 1000,
        kind: "boss",
        label: "BOSS",
        flash: 0,
      },
    ];
    const b = stepWorld(a, { x: 0, y: 0 });
    expect(b.phase).toBe("lost");
    expect(b.player.hp).toBe(0);
  });
  it("bounds entities, particles, bullets and loot over long runs", () => {
    for (let seed = 0; seed < 8; seed++) {
      const w = simulate(createWorld(seed), 1800);
      expect(w.entities.length).toBeLessThanOrEqual(100);
      expect(w.shots.length).toBeLessThanOrEqual(120);
      expect(w.effects.length).toBeLessThanOrEqual(100);
      expect(w.pickups.length).toBeLessThanOrEqual(160);
      expect(Number.isFinite(w.score)).toBe(true);
      expect(w.entities.every((e) => e.hp >= 0)).toBe(true);
    }
  });
  it("survives unavailable and corrupt storage", () => {
    localStorage.setItem("bad", "{");
    expect(read("bad", 7)).toBe(7);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(read("x", 42)).toBe(42);
    expect(() => write("x", 1)).not.toThrow();
    vi.restoreAllMocks();
  });
});
