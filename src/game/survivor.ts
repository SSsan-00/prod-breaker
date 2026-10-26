/** Pure, fixed-step simulation. No browser, clock, rendering or network access. */
export const STEP = 1 / 30;
export const RUN_SECONDS = 90;
export type Vec = { x: number; y: number };
export type Entity = Vec & {
  id: number;
  hp: number;
  maxHp: number;
  kind: "server" | "drone" | "repair" | "boss";
  label: string;
  flash: number;
};
export type Shot = Vec & {
  id: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  pierce: number;
  hit: number[];
};
export type Pickup = Vec & { id: number; value: number };
export type Fx = Vec & {
  id: number;
  kind: "explosion" | "arc" | "hit" | "panic" | "heal";
  life: number;
  maxLife: number;
  text: string;
  to?: Vec;
};
export type UpgradeId =
  | "where"
  | "leak"
  | "cache"
  | "retry"
  | "common"
  | "friday"
  | "test"
  | "log"
  | "local"
  | "monitor"
  | "refactor"
  | "env";
export const upgrades: {
  id: UpgradeId;
  name: string;
  type: "BUG" | "CHAIN" | "BOOST";
  icon: string;
  description: string;
}[] = [
  {
    id: "where",
    name: "WHERE句行方不明",
    type: "BUG",
    icon: "⌁",
    description: "弾が対象を貫通。ダメージ +6。全件更新、ヨシ！",
  },
  {
    id: "leak",
    name: "DB接続リーク",
    type: "BUG",
    icon: "◉",
    description: "周囲へ持続ダメージ。接続は二度と戻らない。",
  },
  {
    id: "cache",
    name: "キャッシュ不整合",
    type: "BUG",
    icon: "❖",
    description: "同時発射数 +1。古いバグも一緒に配信。",
  },
  {
    id: "retry",
    name: "無限リトライ",
    type: "CHAIN",
    icon: "ϟ",
    description: "爆発の連鎖範囲 +35。失敗は隣へ伝わる。",
  },
  {
    id: "common",
    name: "秘伝の共通処理",
    type: "CHAIN",
    icon: "⌘",
    description: "連鎖ダメージ +12。影響範囲は全サービス。",
  },
  {
    id: "friday",
    name: "金曜17:59",
    type: "BOOST",
    icon: "↗",
    description: "BP倍率 +35%。週末への期待が止まらない。",
  },
  {
    id: "test",
    name: "テスト未実施",
    type: "BOOST",
    icon: "⚡",
    description: "攻撃間隔を15%短縮。確認する時間はない。",
  },
  {
    id: "log",
    name: "ログ出しすぎ",
    type: "BOOST",
    icon: "≋",
    description: "ログ回収範囲 +65。レベルアップを加速。",
  },
  {
    id: "local",
    name: "私の環境では動く",
    type: "BOOST",
    icon: "⌂",
    description: "最大HP +25、HPを35回復。本番でも多分動く。",
  },
  {
    id: "monitor",
    name: "監視停止",
    type: "CHAIN",
    icon: "⊘",
    description: "敵の移動速度を12%低下。見なければ平和。",
  },
  {
    id: "refactor",
    name: "謎のリファクタリング",
    type: "BUG",
    icon: "✣",
    description: "弾ダメージ +14。挙動は変えていない、はず。",
  },
  {
    id: "env",
    name: "環境変数整理",
    type: "BOOST",
    icon: "{}",
    description: "移動速度 +15%。逃げ道だけは残しておく。",
  },
];
export type World = {
  seed: number;
  rng: number;
  serial: number;
  time: number;
  phase: "playing" | "upgrade" | "won" | "lost";
  player: Vec & { hp: number; maxHp: number; invulnerable: number };
  entities: Entity[];
  shots: Shot[];
  pickups: Pickup[];
  effects: Fx[];
  score: number;
  combo: number;
  maxCombo: number;
  comboUntil: number;
  destroyed: number;
  kills: number;
  level: number;
  xp: number;
  nextXp: number;
  choices: UpgradeId[];
  build: UpgradeId[];
  damage: number;
  fireInterval: number;
  shotTimer: number;
  multishot: number;
  pierce: number;
  speed: number;
  magnet: number;
  chainRange: number;
  chainDamage: number;
  multiplier: number;
  aura: number;
  auraTimer: number;
  slow: number;
  spawnTimer: number;
  serverTimer: number;
  panicCooldown: number;
  panicUses: number;
  bossSpawned: boolean;
};
export type Input = { x: number; y: number; panic?: boolean };
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
function random(w: World) {
  w.rng = (Math.imul(w.rng, 1664525) + 1013904223) >>> 0;
  return w.rng / 4294967296;
}
function id(w: World) {
  return ++w.serial;
}
function fx(w: World, p: Vec, kind: Fx["kind"], text = "", to?: Vec) {
  const life = kind === "panic" ? 0.9 : kind === "explosion" ? 0.65 : 0.35;
  w.effects.push({ ...p, id: id(w), kind, text, life, maxLife: life, to });
}
function server(w: World, p: Vec) {
  const labels = ["WEB", "API", "AUTH", "DB", "CACHE", "BATCH", "MONITOR"];
  const hp = 30 + Math.floor(w.time / 30) * 18;
  w.entities.push({
    ...p,
    id: id(w),
    hp,
    maxHp: hp,
    kind: "server",
    label: labels[Math.floor(random(w) * labels.length)],
    flash: 0,
  });
}
function spawnServer(w: World) {
  const angle = random(w) * Math.PI * 2,
    radius = 160 + random(w) * 380;
  server(w, {
    x: clamp(w.player.x + Math.cos(angle) * radius, 50, 1950),
    y: clamp(w.player.y + Math.sin(angle) * radius, 50, 1950),
  });
}
export function createWorld(seed = 42): World {
  const w: World = {
    seed,
    rng: seed >>> 0,
    serial: 0,
    time: 0,
    phase: "playing",
    player: { x: 1000, y: 1000, hp: 100, maxHp: 100, invulnerable: 0 },
    entities: [],
    shots: [],
    pickups: [],
    effects: [],
    score: 0,
    combo: 0,
    maxCombo: 0,
    comboUntil: 0,
    destroyed: 0,
    kills: 0,
    level: 1,
    xp: 0,
    nextXp: 5,
    choices: [],
    build: [],
    damage: 18,
    fireInterval: 0.48,
    shotTimer: 0,
    multishot: 1,
    pierce: 0,
    speed: 170,
    magnet: 120,
    chainRange: 160,
    chainDamage: 22,
    multiplier: 1,
    aura: 0,
    auraTimer: 0,
    slow: 1,
    spawnTimer: 2.5,
    serverTimer: 2,
    panicCooldown: 0,
    panicUses: 0,
    bossSpawned: false,
  };
  // A breakable cluster and nearby logs make the first chain and upgrade immediate.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    server(w, {
      x: 1000 + Math.cos(a) * (110 + (i % 2) * 55),
      y: 1000 + Math.sin(a) * (110 + (i % 2) * 55),
    });
  }
  for (let i = 0; i < 19; i++) spawnServer(w);
  return w;
}
function killChain(w: World, first: Entity, damage: number) {
  const queue = [{ target: first.id, damage }];
  const visits = new Map<number, number>();
  let processed = 0;
  while (queue.length && processed++ < 200) {
    const hit = queue.shift()!;
    const target = w.entities.find((e) => e.id === hit.target);
    if (!target || target.hp <= 0 || (visits.get(target.id) || 0) >= 2)
      continue;
    visits.set(target.id, (visits.get(target.id) || 0) + 1);
    const actual = Math.min(target.hp, hit.damage);
    target.hp = Math.max(0, target.hp - hit.damage);
    target.flash = 0.15;
    w.score = Math.min(
      Number.MAX_SAFE_INTEGER,
      w.score + Math.round(actual * w.multiplier),
    );
    if (target.hp > 0) {
      fx(w, target, "hit");
      continue;
    }
    w.combo = w.time <= w.comboUntil ? w.combo + 1 : 1;
    w.comboUntil = w.time + 2.8;
    w.maxCombo = Math.max(w.maxCombo, w.combo);
    w.score += Math.round(
      (target.kind === "server" ? 100 : target.kind === "boss" ? 1500 : 75) *
        w.multiplier *
        (1 + Math.min(w.combo, 50) * 0.06),
    );
    if (target.kind === "server") w.destroyed++;
    else w.kills++;
    fx(
      w,
      target,
      "explosion",
      `+${Math.round(100 * w.multiplier)}${w.combo >= 5 ? ` / ${w.combo} CHAIN` : ""}`,
    );
    w.pickups.push({
      x: target.x,
      y: target.y,
      id: id(w),
      value: target.kind === "boss" ? 15 : target.kind === "server" ? 3 : 2,
    });
    for (const next of w.entities) {
      if (next.hp > 0 && distance(target, next) < w.chainRange) {
        fx(w, target, "arc", "", next);
        queue.push({
          target: next.id,
          damage: w.chainDamage * (target.kind === "boss" ? 2 : 1),
        });
      }
    }
  }
}
function choices(w: World) {
  const pool = [...upgrades];
  const result: UpgradeId[] = [];
  for (let i = 0; i < 3; i++) {
    const at = Math.floor(random(w) * pool.length);
    result.push(pool.splice(at, 1)[0].id);
  }
  return result;
}
export function chooseUpgrade(state: World, upgrade: UpgradeId): World {
  if (state.phase !== "upgrade" || !state.choices.includes(upgrade))
    throw new Error("Invalid upgrade");
  const w = structuredClone(state);
  w.build.push(upgrade);
  switch (upgrade) {
    case "where":
      w.pierce = Math.min(8, w.pierce + 1);
      w.damage += 6;
      break;
    case "leak":
      w.aura += 9;
      break;
    case "cache":
      w.multishot = Math.min(6, w.multishot + 1);
      break;
    case "retry":
      w.chainRange = Math.min(400, w.chainRange + 35);
      break;
    case "common":
      w.chainDamage += 12;
      break;
    case "friday":
      w.multiplier += 0.35;
      break;
    case "test":
      w.fireInterval = Math.max(0.12, w.fireInterval * 0.85);
      break;
    case "log":
      w.magnet = Math.min(420, w.magnet + 65);
      break;
    case "local":
      w.player.maxHp += 25;
      w.player.hp = Math.min(w.player.maxHp, w.player.hp + 35);
      break;
    case "monitor":
      w.slow = Math.max(0.4, w.slow * 0.88);
      break;
    case "refactor":
      w.damage += 14;
      break;
    case "env":
      w.speed = Math.min(340, w.speed * 1.15);
      break;
  }
  w.choices = [];
  w.phase = "playing";
  return w;
}
export function wave(w: World) {
  return Math.min(3, Math.floor(w.time / 30) + 1);
}
/** One 1/30 second step. Input and state are never mutated. */
export function stepWorld(state: World, input: Input): World {
  if (state.phase !== "playing") return state;
  const w = structuredClone(state),
    dt = STEP;
  w.time = Math.min(RUN_SECONDS, w.time + dt);
  w.player.invulnerable = Math.max(0, w.player.invulnerable - dt);
  w.panicCooldown = Math.max(0, w.panicCooldown - dt);
  for (const e of w.entities) e.flash = Math.max(0, e.flash - dt);
  w.effects = w.effects.filter((e) => (e.life -= dt) > 0);
  const ix = Number.isFinite(input.x) ? input.x : 0,
    iy = Number.isFinite(input.y) ? input.y : 0,
    length = Math.max(1, Math.hypot(ix, iy));
  w.player.x = clamp(w.player.x + (ix / length) * w.speed * dt, 28, 1972);
  w.player.y = clamp(w.player.y + (iy / length) * w.speed * dt, 28, 1972);
  if (input.panic && w.panicCooldown <= 0) {
    w.panicCooldown = 22;
    w.panicUses++;
    fx(w, w.player, "panic", "EMERGENCY MERGE");
    for (const e of w.entities.filter(
      (e) => e.hp > 0 && distance(e, w.player) < 420,
    ))
      killChain(w, e, 100);
    for (const p of w.pickups) {
      p.x = w.player.x;
      p.y = w.player.y;
    }
    w.player.invulnerable = Math.max(w.player.invulnerable, 1.5);
  }
  if (w.time > w.comboUntil) w.combo = 0;
  w.shotTimer -= dt;
  if (w.shotTimer <= 0) {
    w.shotTimer += w.fireInterval;
    const live = w.entities
      .filter((e) => e.hp > 0 && distance(e, w.player) < 510)
      .sort((a, b) => {
        const da = distance(a, w.player),
          db = distance(b, w.player);
        return (
          (a.kind !== "server" && da < 160 ? da - 500 : da) -
          (b.kind !== "server" && db < 160 ? db - 500 : db)
        );
      });
    if (live.length) {
      for (let i = 0; i < w.multishot; i++) {
        const t = live[i % live.length],
          angle =
            Math.atan2(t.y - w.player.y, t.x - w.player.x) +
            (i >= live.length ? (i - (w.multishot - 1) / 2) * 0.12 : 0);
        w.shots.push({
          ...w.player,
          id: id(w),
          vx: Math.cos(angle) * 540,
          vy: Math.sin(angle) * 540,
          life: 1.05,
          damage: w.damage,
          pierce: w.pierce,
          hit: [],
        });
      }
    }
  }
  for (const shot of w.shots) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;
    for (const e of w.entities) {
      if (e.hp <= 0 || shot.hit.includes(e.id)) continue;
      if (
        distance(shot, e) <
        (e.kind === "boss" ? 35 : e.kind === "server" ? 24 : 18)
      ) {
        shot.hit.push(e.id);
        killChain(w, e, shot.damage);
        if (shot.pierce-- <= 0) {
          shot.life = 0;
          break;
        }
      }
    }
  }
  w.shots = w.shots.filter((s) => s.life > 0).slice(-120);
  w.auraTimer -= dt;
  if (w.aura > 0 && w.auraTimer <= 0) {
    w.auraTimer = 1;
    for (const e of w.entities.filter(
      (e) => e.hp > 0 && distance(e, w.player) < 125,
    ))
      killChain(w, e, w.aura);
  }
  w.spawnTimer -= dt;
  if (w.spawnTimer <= 0) {
    w.spawnTimer = Math.max(0.4, 1.65 - w.time * 0.012);
    const angle = random(w) * Math.PI * 2;
    const kind = w.time > 15 && random(w) < 0.18 ? "repair" : "drone";
    const hp = kind === "repair" ? 30 : 22 + wave(w) * 7;
    w.entities.push({
      id: id(w),
      x: clamp(w.player.x + Math.cos(angle) * 460, 20, 1980),
      y: clamp(w.player.y + Math.sin(angle) * 460, 20, 1980),
      hp,
      maxHp: hp,
      kind,
      label: kind === "repair" ? "AUTO FIX" : "WAF",
      flash: 0,
    });
  }
  if (w.time >= 60 && !w.bossSpawned) {
    w.bossSpawned = true;
    w.entities.push({
      id: id(w),
      x: clamp(w.player.x + 350, 40, 1960),
      y: w.player.y,
      hp: 650,
      maxHp: 650,
      kind: "boss",
      label: "SRE CORE",
      flash: 0,
    });
    fx(w, w.player, "panic", "SRE CORE ONLINE");
  }
  for (const e of w.entities) {
    if (e.hp <= 0 || e.kind === "server") continue;
    let goal: Vec = w.player;
    if (e.kind === "repair") {
      const damaged = w.entities
        .filter((n) => n.kind === "server" && n.hp > 0 && n.hp < n.maxHp)
        .sort((a, b) => distance(e, a) - distance(e, b))[0];
      if (damaged) {
        goal = damaged;
        if (distance(e, damaged) < 35)
          damaged.hp = Math.min(damaged.maxHp, damaged.hp + dt * 9);
      }
    }
    const d = distance(e, goal),
      speed =
        (e.kind === "boss"
          ? 61
          : e.kind === "repair"
            ? 64
            : 65 + wave(w) * 12) * w.slow;
    if (d > 1) {
      e.x += ((goal.x - e.x) / d) * speed * dt;
      e.y += ((goal.y - e.y) / d) * speed * dt;
    }
    if (
      distance(e, w.player) < (e.kind === "boss" ? 49 : 30) &&
      w.player.invulnerable <= 0
    ) {
      w.player.hp = Math.max(0, w.player.hp - (e.kind === "boss" ? 24 : 12));
      w.player.invulnerable = 0.85;
      fx(w, w.player, "hit", "INTEGRITY LOST");
    }
  }
  // Keep distant entities and logs bounded, and populate the region being explored.
  w.entities = w.entities
    .filter(
      (e) => e.hp > 0 && (e.kind === "boss" || distance(e, w.player) < 850),
    )
    .slice(-100);
  w.serverTimer -= dt;
  if (w.serverTimer <= 0) {
    w.serverTimer = 1.2;
    if (w.entities.filter((e) => e.kind === "server").length < 30)
      for (let i = 0; i < 3; i++) spawnServer(w);
  }
  for (const p of w.pickups) {
    const d = distance(p, w.player);
    if (d < w.magnet && d > 0) {
      const speed = 260 + Math.max(0, w.magnet - d) * 3;
      p.x += ((w.player.x - p.x) / d) * Math.min(d, speed * dt);
      p.y += ((w.player.y - p.y) / d) * Math.min(d, speed * dt);
    }
    if (distance(p, w.player) < 25) {
      w.xp += p.value;
      p.value = 0;
    }
  }
  w.pickups = w.pickups
    .filter((p) => p.value > 0 && distance(p, w.player) < 900)
    .slice(-160);
  w.effects = w.effects.slice(-100);
  if (w.player.hp <= 0) w.phase = "lost";
  else if (w.time >= RUN_SECONDS) w.phase = "won";
  else if (w.xp >= w.nextXp) {
    w.xp -= w.nextXp;
    w.level++;
    w.nextXp = Math.round(w.nextXp * 1.25 + 2);
    w.choices = choices(w);
    w.phase = "upgrade";
    fx(w, w.player, "heal", "LEVEL UP");
  }
  return w;
}
export function survivorReport(w: World) {
  return {
    title:
      w.destroyed >= 80
        ? "本番の破壊神"
        : w.maxCombo >= 20
          ? "伝説のデグレ職人"
          : w.build.includes("friday")
            ? "金曜の魔術師"
            : w.phase === "won"
              ? "動作保証はローカル"
              : "原因は調査中",
    cause: w.build.length
      ? upgrades.find((u) => u.id === w.build[w.build.length - 1])!.name
      : "善意の本番デプロイ",
    prevention: "金曜日を廃止する。復旧BOTには有給を付与する。",
  };
}
