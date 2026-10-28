import { describe, it, expect, vi } from "vitest";
import {
  chainPower,
  createWorld,
  stepWorld,
  chooseUpgrade,
  upgrades,
  evolutionPartners,
  evolutionReady,
  survivorReport,
  STEP,
  wave,
  RUN_SECONDS,
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
    ] as const;
    expect(recipes).toHaveLength(32);
    expect(upgrades).toHaveLength(64);
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
    expect(next.entities.find((e) => e.kind === "boss")?.maxHp).toBe(580);
    const drone = next.entities.find((e) => e.kind === "drone");
    expect(drone?.maxHp).toBe(38);
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
    expect(core?.hp).toBe(300); // One chain hit at 20% plus PANIC's direct 100.
    expect(after.destroyed).toBe(2);
    expect(after.score).toBeGreaterThan(0);
    expect(core?.chainGuardUntil).toBeGreaterThan(after.time);
    const later = structuredClone(after);
    later.phase = "playing";
    later.time = core!.chainGuardUntil!;
    later.shotTimer = 10;
    later.entities.push({ id: 904, x: 1100, y: 1000, hp: 1, maxHp: 1, kind: "server", label: "DB", flash: 0 });
    later.shots = [{ id: 905, x: 1100, y: 1000, vx: 0, vy: 0, life: 1, damage: 1, pierce: 0, hit: [] }];
    expect(stepWorld(later, { x: 0, y: 0 }).entities.find((e) => e.id === 902)?.hp).toBe(200);
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
    expect(lateCore.maxHp).toBeGreaterThan((330 + 7 * 250) * 2);
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
  it("spawns each wave of cores within one sector, including at the map edge", () => {
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
        expect(Math.hypot(core.x - x, core.y - y)).toBeGreaterThan(300);
        expect(core.x).toBeGreaterThanOrEqual(28); expect(core.x).toBeLessThanOrEqual(1972);
        expect(core.y).toBeGreaterThanOrEqual(28); expect(core.y).toBeLessThanOrEqual(1972);
      }
      for (const a of cores) for (const b of cores) {
        const ax = a.x - x, ay = a.y - y, bx = b.x - x, by = b.y - y;
        expect((ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by))).toBeGreaterThan(-0.02);
      }
      expect(stepWorld(w, { x: 0, y: 0 }).entities).toEqual(next.entities);
    }
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
