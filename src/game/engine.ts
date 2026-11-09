/** Fixed-step, seeded defense simulation. No browser or network side effects. */
export const STEP = 1 / 30;
export const SIZE = 900;
export type Point = { x: number; y: number };
export type EnemyKind =
  | "brute"
  | "phish"
  | "inject"
  | "ransom"
  | "ddos"
  | "zero";
export type Enemy = Point & {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  speed: number;
  hitAt: number;
  attackAt: number;
  target: number;
};
export type Facility = Point & {
  name: string;
  label: string;
  progress: number;
  hp: number;
  active: boolean;
  timer: number;
  rescues: number;
};
export type Effect = Point & {
  id: number;
  kind: "hit" | "blast" | "beam" | "ring" | "heal";
  end?: Point;
  life: number;
  max: number;
  color: string;
  text?: string;
};
export type Input = Point & { panic?: boolean };
export const skills = [
  {
    id: "input",
    name: "入力を信用しない",
    flavor: "善意の文字列にも、検問を。",
    effect: "攻撃 +7 / 貫通 +1",
    icon: "⌘",
    type: "ENDPOINT",
  },
  {
    id: "prepared",
    name: "プリペアドステートメント",
    flavor: "SQLを、つなぐな。",
    effect: "攻撃 +6 / 攻撃間隔 −10%",
    icon: "⟨/⟩",
    type: "ENDPOINT",
  },
  {
    id: "mfa",
    name: "MFAは自分で承認",
    flavor: "押していいのは、覚えのある通知だけ。",
    effect: "最大HP +20 / HP回復 +30",
    icon: "◈",
    type: "IDENTITY",
  },
  {
    id: "least",
    name: "その権限、必要ですか？",
    flavor: "全員adminの時代を終わらせる。",
    effect: "敵速度 −10% / 連鎖 +5",
    icon: "⊘",
    type: "IDENTITY",
  },
  {
    id: "waf",
    name: "WAF、仕事の時間です",
    flavor: "例外ルールは、いったん忘れよう。",
    effect: "発射数 +1 / 攻撃 +3",
    icon: "▥",
    type: "NETWORK",
  },
  {
    id: "rate",
    name: "429でお引き取りください",
    flavor: "お客様、少々アクセスが多すぎます。",
    effect: "攻撃間隔 −15% / 攻撃 +3",
    icon: "429",
    type: "NETWORK",
  },
  {
    id: "edr",
    name: "EDRが見ています",
    flavor: "そのプロセス、さっきから怪しい。",
    effect: "連鎖範囲 +30 / 連鎖 +8",
    icon: "◎",
    type: "ENDPOINT",
  },
  {
    id: "isolate",
    name: "その端末、ちょっと別室へ",
    flavor: "LANケーブルを抜く勇気。",
    effect: "連鎖範囲 +35 / 敵速度 −5%",
    icon: "⊞",
    type: "NETWORK",
  },
  {
    id: "backup",
    name: "オフラインバックアップ",
    flavor: "同じサーバー内は、予備とは呼ばない。",
    effect: "CORE回復 +25 / 最大HP +10",
    icon: "▰",
    type: "RECOVERY",
  },
  {
    id: "drill",
    name: "戻せることを確認しました",
    flavor: "バックアップは、戻せて初めてバックアップ。",
    effect: "CORE回復 +20 / 攻撃 +8",
    icon: "↺",
    type: "RECOVERY",
  },
  {
    id: "patch",
    name: "再起動して更新を完了",
    flavor: "いつかやる。その「いつか」が今。",
    effect: "施設火力 +35% / 攻撃 +5",
    icon: "✚",
    type: "RECOVERY",
  },
  {
    id: "asset",
    name: "そのサーバー、聞いてない",
    flavor: "野良サーバーにも管理番号を。",
    effect: "救援速度 +50% / 回収範囲 +30",
    icon: "⌖",
    type: "RECOVERY",
  },
  {
    id: "logs",
    name: "ログは捨てずに集約",
    flavor: "「ディスクが一杯」で消す前に。",
    effect: "回収範囲 +40 / BP倍率 +15%",
    icon: "≋",
    type: "DETECTION",
  },
  {
    id: "rules",
    name: "点と点が、つながった",
    flavor: "偶然にしては、ログインが多い。",
    effect: "連鎖 +10 / BP倍率 +10%",
    icon: "⋈",
    type: "DETECTION",
  },
  {
    id: "training",
    name: "その添付、開く前に",
    flavor: "社長はギフトカードを急がない。",
    effect: "移動速度 +12% / 攻撃 +4",
    icon: "✉",
    type: "IDENTITY",
  },
  {
    id: "report",
    name: "怒らないので報告して",
    flavor: "早く言ってくれて、ありがとう。",
    effect: "緊急遮断の待機時間 −15% / HP回復 +15",
    icon: "⚑",
    type: "DETECTION",
  },
] as const;
export type SkillId = (typeof skills)[number]["id"];
export const recipes: {
  pair: [SkillId, SkillId];
  name: string;
  bonus: string;
}[] = [
  {
    pair: ["input", "prepared"],
    name: "文字列連結、お断り。",
    bonus: "攻撃 +18 / 貫通 +2",
  },
  {
    pair: ["mfa", "least"],
    name: "認証の、その先へ。",
    bonus: "攻撃 +15 / 敵速度 −15%",
  },
  {
    pair: ["waf", "rate"],
    name: "429 TOO MANY THREATS",
    bonus: "発射数 +2 / 攻撃 +10",
  },
  {
    pair: ["edr", "isolate"],
    name: "封じ込め、完了。",
    bonus: "連鎖 +20 / 連鎖範囲 +60",
  },
  {
    pair: ["backup", "drill"],
    name: "復旧手順、実証済み。",
    bonus: "CORE全回復 / 自動修復を追加",
  },
  {
    pair: ["patch", "asset"],
    name: "管理対象、全台更新。",
    bonus: "施設火力 +80% / 全施設を修復",
  },
  {
    pair: ["logs", "rules"],
    name: "見逃しませんでした。",
    bonus: "連鎖 +15 / BP倍率 +50%",
  },
  {
    pair: ["training", "report"],
    name: "報告してくれて、助かった。",
    bonus: "最大HP +30 / 緊急遮断を即チャージ",
  },
];
export type World = {
  seed: number;
  rng: number;
  serial: number;
  time: number;
  duration: number;
  wave: number;
  phase: "playing" | "upgrade" | "won" | "lost";
  player: Point & { hp: number; maxHp: number; invuln: number };
  core: number;
  shield: number;
  facilities: Facility[];
  enemies: Enemy[];
  logs: (Point & { id: number; value: number })[];
  effects: Effect[];
  score: number;
  kills: number;
  combo: number;
  maxCombo: number;
  comboUntil: number;
  level: number;
  xp: number;
  nextXp: number;
  upgradeReadyAt: number;
  damage: number;
  interval: number;
  shootAt: number;
  multishot: number;
  pierce: number;
  chain: number;
  range: number;
  slow: number;
  speed: number;
  magnet: number;
  rescueSpeed: number;
  turret: number;
  multiplier: number;
  panicAt: number;
  panicDelay: number;
  panicUses: number;
  overdriveUntil: number;
  overdriveAt: number;
  regen: boolean;
  build: SkillId[];
  evolutions: string[];
  choices: SkillId[];
  spawnAt: number;
  notice: string;
  noticeUntil: number;
};
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const center = { x: 450, y: 450 };
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
function rand(w: World) {
  w.rng = (Math.imul(w.rng, 1664525) + 1013904223) >>> 0;
  return w.rng / 4294967296;
}
function effect(
  w: World,
  kind: Effect["kind"],
  p: Point,
  color: string,
  end?: Point,
  text?: string,
) {
  const life = kind === "beam" ? 0.2 : kind === "ring" ? 0.65 : 0.45;
  if (w.effects.length < 100)
    w.effects.push({
      ...p,
      id: ++w.serial,
      kind,
      color,
      end: end ? { ...end } : undefined,
      text,
      life,
      max: life,
    });
}
function notice(w: World, text: string) {
  w.notice = text;
  w.noticeUntil = w.time + 2.4;
}
export function createWorld(seed: number, duration = 180): World {
  return {
    seed: seed >>> 0,
    rng: seed >>> 0,
    serial: 0,
    time: 0,
    duration: [90, 180, 300].includes(duration) ? duration : 180,
    wave: 1,
    phase: "playing",
    player: { x: 450, y: 555, hp: 100, maxHp: 100, invuln: 0 },
    core: 100,
    shield: 30,
    facilities: [
      { x: 240, y: 300, name: "AUTH", label: "認証基盤" },
      { x: 660, y: 300, name: "WAF", label: "通信防壁" },
      { x: 240, y: 640, name: "DB", label: "データ保護" },
      { x: 660, y: 640, name: "SOC", label: "脅威監視" },
    ].map((p) => ({
      ...p,
      progress: 0,
      hp: 100,
      active: false,
      timer: 0,
      rescues: 0,
    })),
    enemies: [],
    logs: [],
    effects: [],
    score: 0,
    kills: 0,
    combo: 0,
    maxCombo: 0,
    comboUntil: 0,
    level: 1,
    xp: 0,
    nextXp: 6,
    upgradeReadyAt: 8,
    damage: 19,
    interval: 0.48,
    shootAt: 0,
    multishot: 1,
    pierce: 1,
    chain: 8,
    range: 115,
    slow: 1,
    speed: 175,
    magnet: 105,
    rescueSpeed: 1,
    turret: 1,
    multiplier: 1,
    panicAt: 0,
    panicDelay: 24,
    panicUses: 0,
    overdriveUntil: 0,
    overdriveAt: 20,
    regen: false,
    build: [],
    evolutions: [],
    choices: [],
    spawnAt: 0,
    notice: "SHIFT START / 本番を守り抜け。",
    noticeUntil: 3,
  };
}
export function ready(w: World, id: SkillId) {
  return recipes.find(
    (r) =>
      r.pair.includes(id) &&
      r.pair.some((p) => p !== id && w.build.includes(p)) &&
      !w.evolutions.includes(r.name),
  );
}
function offer(w: World) {
  const pool = [...skills];
  const result: SkillId[] = [];
  for (let n = 0; n < 3; n++) {
    const weights = pool.map((s) => (w.build.includes(s.id) ? 1 : 4));
    let ticket = rand(w) * weights.reduce((a, b) => a + b, 0),
      i = 0;
    while (i < pool.length - 1 && (ticket -= weights[i]) >= 0) i++;
    result.push(pool.splice(i, 1)[0].id);
  }
  const matches = skills.filter((s) => ready(w, s.id));
  if (matches.length && !result.some((id) => ready(w, id)))
    result[2] = matches[Math.floor(rand(w) * matches.length)].id;
  return result;
}
export function choose(state: World, id: SkillId): World {
  if (state.phase !== "upgrade" || !state.choices.includes(id))
    throw new Error("Invalid upgrade");
  const w = structuredClone(state);
  w.build.push(id);
  switch (id) {
    case "input":
      w.damage += 7;
      w.pierce++;
      break;
    case "prepared":
      w.damage += 6;
      w.interval *= 0.9;
      break;
    case "mfa":
      w.player.maxHp += 20;
      w.player.hp = Math.min(w.player.maxHp, w.player.hp + 30);
      break;
    case "least":
      w.slow *= 0.9;
      w.chain += 5;
      break;
    case "waf":
      w.multishot++;
      w.damage += 3;
      break;
    case "rate":
      w.interval *= 0.85;
      w.damage += 3;
      break;
    case "edr":
      w.range += 30;
      w.chain += 8;
      break;
    case "isolate":
      w.range += 35;
      w.slow *= 0.95;
      break;
    case "backup":
      w.core = Math.min(100, w.core + 25);
      w.player.maxHp += 10;
      w.player.hp += 10;
      break;
    case "drill":
      w.core = Math.min(100, w.core + 20);
      w.damage += 8;
      break;
    case "patch":
      w.turret += 0.35;
      w.damage += 5;
      break;
    case "asset":
      w.rescueSpeed += 0.5;
      w.magnet += 30;
      break;
    case "logs":
      w.magnet += 40;
      w.multiplier += 0.15;
      break;
    case "rules":
      w.chain += 10;
      w.multiplier += 0.1;
      break;
    case "training":
      w.speed *= 1.12;
      w.damage += 4;
      break;
    case "report":
      w.panicDelay *= 0.85;
      w.panicAt = Math.min(w.panicAt, w.time + w.panicDelay);
      w.player.hp = Math.min(w.player.maxHp, w.player.hp + 15);
      break;
  }
  const evolution = ready(state, id);
  if (evolution) {
    w.evolutions.push(evolution.name);
    notice(w, "EVOLUTION / " + evolution.name);
    switch (evolution.pair[0]) {
      case "input":
        w.damage += 18;
        w.pierce += 2;
        break;
      case "mfa":
        w.damage += 15;
        w.slow *= 0.85;
        break;
      case "waf":
        w.multishot += 2;
        w.damage += 10;
        break;
      case "edr":
        w.chain += 20;
        w.range += 60;
        break;
      case "backup":
        w.core = 100;
        w.regen = true;
        break;
      case "patch":
        w.turret += 0.8;
        w.facilities.forEach((f) => {
          f.hp = 100;
        });
        break;
      case "logs":
        w.chain += 15;
        w.multiplier += 0.5;
        break;
      case "training":
        w.player.maxHp += 30;
        w.player.hp = w.player.maxHp;
        w.panicAt = w.time;
        break;
    }
    effect(w, "ring", w.player, "#d6f887");
  } else notice(w, "INSTALLED / " + skills.find((s) => s.id === id)!.name);
  // Convert excess fire rate/projectile growth into damage to bound processing.
  if (w.interval < 0.12) {
    w.damage += (0.12 - w.interval) * 140;
    w.interval = 0.12;
  }
  if (w.multishot > 8) {
    w.damage += (w.multishot - 8) * 8;
    w.multishot = 8;
  }
  if (w.pierce > 8) {
    w.damage += (w.pierce - 8) * 6;
    w.pierce = 8;
  }
  w.range = Math.min(330, w.range);
  w.magnet = Math.min(400, w.magnet);
  w.speed = Math.min(300, w.speed);
  w.slow = Math.max(0.4, w.slow);
  w.choices = [];
  w.phase = "playing";
  return w;
}
const colors: Record<EnemyKind, string> = {
  brute: "#f4a66c",
  phish: "#e2b4fc",
  inject: "#ff718c",
  ransom: "#b7a1ff",
  ddos: "#f6d365",
  zero: "#ff556e",
};
function spawn(w: World, kind?: EnemyKind) {
  if (w.enemies.length >= 150) return;
  const angle = rand(w) * Math.PI * 2;
  const r = 410;
  const roll = rand(w);
  kind ??=
    roll < 0.22
      ? "phish"
      : roll < 0.37 && w.wave >= 2
        ? "inject"
        : roll < 0.47 && w.wave >= 3
          ? "ransom"
          : roll < 0.65
            ? "ddos"
            : "brute";
  const stats = {
    brute: [26, 39],
    phish: [18, 58],
    inject: [35, 66],
    ransom: [65, 30],
    ddos: [12, 48],
    zero: [440, 22],
  }[kind];
  const hp = stats[0] * (1 + (w.wave - 1) * 0.25);
  w.enemies.push({
    id: ++w.serial,
    x: 450 + Math.cos(angle) * r,
    y: 450 + Math.sin(angle) * r,
    kind,
    hp,
    maxHp: hp,
    speed: stats[1] * (1 + (w.wave - 1) * 0.045),
    hitAt: 0,
    attackAt: 0,
    target: Math.floor(rand(w) * 4),
  });
}
function damage(w: World, enemy: Enemy, amount: number, chain = true) {
  if (enemy.hp <= 0) return;
  const actual = Math.min(enemy.hp, amount);
  enemy.hp -= actual;
  enemy.hitAt = w.time;
  w.score += Math.round(
    actual * (1 + Math.min(2, w.combo * 0.015)) * w.multiplier,
  );
  effect(w, "hit", enemy, colors[enemy.kind]);
  if (enemy.hp > 0) return;
  w.kills++;
  w.combo++;
  w.maxCombo = Math.max(w.maxCombo, w.combo);
  w.comboUntil = w.time + 3.5;
  w.panicAt = Math.max(w.time, w.panicAt - 0.08);
  if (w.logs.length < 200)
    w.logs.push({
      x: enemy.x,
      y: enemy.y,
      id: ++w.serial,
      value: enemy.kind === "zero" ? 10 : enemy.kind === "ransom" ? 3 : 1,
    });
  effect(w, "blast", enemy, colors[enemy.kind]);
  if (chain) {
    // One generation per kill: bounded, readable chains rather than recursive explosions.
    const next = w.enemies
      .filter((e) => e.hp > 0 && dist(e, enemy) < w.range)
      .sort((a, b) => dist(a, enemy) - dist(b, enemy))
      .slice(0, 5);
    for (const e of next) {
      effect(w, "beam", enemy, "#9ef1dd", e);
      damage(w, e, w.chain, false);
    }
  }
  if (w.combo >= w.overdriveAt && w.time >= w.overdriveUntil) {
    w.overdriveUntil = w.time + 8;
    w.overdriveAt = w.combo + 30;
    notice(w, "ZERO TRUST / 全拠点、一斉迎撃。");
    effect(w, "ring", center, "#b5f77b");
  }
}
function fire(w: World, origin: Point, power: number, count: number) {
  const targets = w.enemies
    .filter((e) => e.hp > 0 && dist(origin, e) < 360)
    .sort((a, b) => dist(origin, a) - dist(origin, b));
  for (const enemy of targets.slice(0, count)) {
    effect(w, "beam", origin, "#a3f0d8", enemy);
    damage(w, enemy, power);
    if (w.pierce > 1) {
      const dx = enemy.x - origin.x,
        dy = enemy.y - origin.y,
        len = Math.hypot(dx, dy) || 1;
      const pierced = targets
        .filter(
          (e) =>
            e !== enemy &&
            ((e.x - origin.x) * dx + (e.y - origin.y) * dy) / len > len &&
            Math.abs((e.x - origin.x) * dy - (e.y - origin.y) * dx) / len < 22,
        )
        .slice(0, w.pierce - 1);
      for (const e of pierced) {
        effect(w, "beam", enemy, "#69bfe8", e);
        damage(w, e, power * 0.65);
      }
    }
  }
}
export function step(state: World, input: Input): World {
  if (state.phase !== "playing") return state;
  const w = structuredClone(state);
  w.time += STEP;
  w.effects = w.effects.filter((f) => (f.life -= STEP) > 0);
  const nextWave = Math.floor(w.time / 30) + 1;
  if (nextWave > w.wave && w.time < w.duration) {
    w.wave = nextWave;
    notice(w, `WAVE ${String(w.wave).padStart(2, "0")} / 増援を確認。`);
    spawn(w, "zero");
    for (let i = 0; i < 5 + w.wave * 2; i++) spawn(w, "ddos");
    effect(w, "ring", center, "#f2cc8f");
  }
  if (w.time >= w.duration) {
    w.phase = "won";
    notice(w, "SHIFT COMPLETE");
    return w;
  }
  const x = Number.isFinite(input.x) ? input.x : 0,
    y = Number.isFinite(input.y) ? input.y : 0,
    length = Math.max(1, Math.hypot(x, y));
  w.player.x = clamp(w.player.x + (x / length) * w.speed * STEP, 36, SIZE - 36);
  w.player.y = clamp(w.player.y + (y / length) * w.speed * STEP, 36, SIZE - 36);
  if (input.panic && w.time >= w.panicAt) {
    w.panicAt = w.time + w.panicDelay;
    w.panicUses++;
    w.shield = Math.min(45, w.shield + 12);
    effect(w, "ring", center, "#d6f887");
    notice(w, "EMERGENCY / 緊急遮断、実行。");
    for (const enemy of w.enemies)
      if (dist(enemy, center) < 330 || dist(enemy, w.player) < 240)
        damage(w, enemy, w.damage * 3.5 + w.chain);
    for (const log of w.logs) {
      w.xp += log.value;
    }
    w.logs = [];
  }
  const active = w.facilities.filter((f) => f.active).length;
  if (w.shield < 30 + active * 4)
    w.shield = Math.min(
      30 + active * 4,
      w.shield + STEP * (0.4 + active * 0.18),
    );
  if (w.regen) w.core = Math.min(100, w.core + STEP * 1.2);
  if (w.time >= w.spawnAt) {
    const count = 2 + Math.floor(w.wave * 0.7);
    for (let i = 0; i < count; i++) spawn(w);
    w.spawnAt = w.time + Math.max(0.6, 1.7 - w.wave * 0.12);
  }
  const od = w.time < w.overdriveUntil;
  if (w.time >= w.shootAt) {
    fire(w, w.player, w.damage * (od ? 1.6 : 1), w.multishot);
    w.shootAt = w.time + w.interval * (od ? 0.55 : 1);
  }
  for (const f of w.facilities) {
    if (!f.active && dist(w.player, f) < 78) {
      f.progress += (STEP * w.rescueSpeed) / 2.7;
      if (f.progress >= 1) {
        f.active = true;
        f.hp = 100;
        f.rescues++;
        f.progress = 1;
        w.xp += 4;
        w.core = Math.min(100, w.core + 6);
        w.score += 400;
        notice(w, `ONLINE / ${f.name} 防衛網に接続。`);
        effect(w, "heal", f, "#b5f77b");
      }
    }
    if (f.active && w.time >= f.timer) {
      fire(w, f, (12 + w.damage * 0.5) * w.turret, od ? 3 : 1);
      f.timer = w.time + (od ? 0.35 : 0.85);
    }
  }
  for (const enemy of w.enemies) {
    if (enemy.hp <= 0) continue;
    const facility = w.facilities[enemy.target];
    const target =
      enemy.kind === "ransom" && facility.active
        ? facility
        : enemy.kind === "phish" || enemy.kind === "inject"
          ? w.player
          : center;
    const d = dist(enemy, target);
    if (d > 30) {
      enemy.x += ((target.x - enemy.x) / d) * enemy.speed * w.slow * STEP;
      enemy.y += ((target.y - enemy.y) / d) * enemy.speed * w.slow * STEP;
    }
    if (d < 40 && w.time >= enemy.attackAt) {
      enemy.attackAt = w.time + 1.1;
      const hit =
        enemy.kind === "zero"
          ? 11
          : enemy.kind === "ransom"
            ? 7
            : enemy.kind === "ddos"
              ? 2
              : 4;
      if (target === w.player) {
        if (w.time >= w.player.invuln) {
          w.player.hp = Math.max(0, w.player.hp - hit);
          w.player.invuln = w.time + 0.5;
          effect(w, "ring", w.player, "#ff718c");
        }
      } else if (target === center) {
        const absorbed = Math.min(w.shield, hit);
        w.shield -= absorbed;
        w.core = Math.max(0, w.core - (hit - absorbed));
        effect(w, "hit", center, "#ff718c");
      } else {
        facility.hp = Math.max(0, facility.hp - hit);
        if (!facility.hp) {
          facility.active = false;
          facility.progress = 0;
          notice(w, `OFFLINE / ${facility.name} を救援せよ。`);
        }
      }
    }
  }
  w.enemies = w.enemies.filter((e) => e.hp > 0);
  w.logs = w.logs.filter((log) => {
    const d = dist(log, w.player);
    if (d < 24) {
      w.xp += log.value;
      return false;
    }
    if (d < w.magnet) {
      const step = Math.min(d, STEP * 460);
      log.x += ((w.player.x - log.x) / (d || 1)) * step;
      log.y += ((w.player.y - log.y) / (d || 1)) * step;
    }
    return true;
  });
  if (w.time > w.comboUntil) w.combo = 0;
  if (w.player.hp <= 0 || w.core <= 0) {
    w.phase = "lost";
    return w;
  }
  if (w.xp >= w.nextXp && w.time >= w.upgradeReadyAt) {
    w.upgradeReadyAt = w.time + 8;
    w.xp -= w.nextXp;
    w.level++;
    w.nextXp = Math.min(100, 6 + w.level * 3);
    w.phase = "upgrade";
    w.choices = offer(w);
  }
  return w;
}
export function report(w: World) {
  const titles = [
    "無停止の守護者",
    "誰にも気づかれなかった英雄",
    "ログを読む者",
    "定時退社の防衛線",
  ];
  return {
    title: titles[(w.seed + w.evolutions.length) % titles.length],
    cause: [
      "社長を名乗る至急メール",
      "誰も知らない公開サーバー",
      "金曜17:59の怪しい通信",
      "「社内だから安全」という信頼",
    ][w.seed % 4],
    prevention: [
      "予算は、何も起きないために使いました。",
      "添付を開く前に、ひと呼吸。",
      "例外ルールにも、退職日を。",
      "バックアップは、戻すところまで。",
    ][(w.seed + w.kills) % 4],
    comment:
      w.phase === "won"
        ? "「何も起きてないなら、予算減らせるね」"
        : "「次回は、予算を検討します」",
  };
}
