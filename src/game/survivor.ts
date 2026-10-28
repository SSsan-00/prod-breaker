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
  kind: "explosion" | "arc" | "hit" | "panic" | "heal" | "milestone";
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
  | "env"
  | "nplus"
  | "select"
  | "flush"
  | "timeout"
  | "force"
  | "hotfix"
  | "spec"
  | "threshold"
  | "dependency"
  | "rollback"
  | "deploy"
  | "yolo"
  | "dns"
  | "merge"
  | "race"
  | "memory"
  | "config"
  | "oncall"
  | "cron"
  | "batch"
  | "migration"
  | "index"
  | "feature"
  | "canary"
  | "cert"
  | "clock"
  | "approval"
  | "review"
  | "autoscale"
  | "quota"
  | "schema"
  | "contract"
  | "meeting"
  | "reboot"
  | "staging"
  | "drift"
  | "lockfile" | "latest" | "timezone" | "midnight"
  | "secrets" | "clipboard" | "terraform" | "manual";
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
  {
    id: "nplus",
    name: "N+1クエリ",
    type: "BUG",
    icon: "⌁",
    description: "同時発射 +1、ダメージ +4。1件取るだけなのに。",
  },
  {
    id: "select",
    name: "SELECT *",
    type: "BUG",
    icon: "✳",
    description: "連鎖範囲 +25。必要なカラムは後で考える。",
  },
  {
    id: "flush",
    name: "キャッシュ全消し",
    type: "CHAIN",
    icon: "◉",
    description: "周囲への持続ダメージ +12。困ったら消す。",
  },
  {
    id: "timeout",
    name: "タイムアウト延長",
    type: "CHAIN",
    icon: "◷",
    description: "弾の貫通 +1、連鎖ダメージ +5。待てば終わる。",
  },
  {
    id: "force",
    name: "force push",
    type: "BUG",
    icon: "➜",
    description: "弾ダメージ +18。履歴は綺麗になった。",
  },
  {
    id: "hotfix",
    name: "深夜のホットフィックス",
    type: "BOOST",
    icon: "☾",
    description: "攻撃間隔 -12%、HPを15回復。朝までに直そう。",
  },
  {
    id: "spec",
    name: "仕様です",
    type: "BOOST",
    icon: "✓",
    description: "最大HP +30、HPを30回復。期待された挙動です。",
  },
  {
    id: "threshold",
    name: "監視閾値の引き上げ",
    type: "CHAIN",
    icon: "⊘",
    description: "敵の速度 -10%。アラートが減りました。",
  },
  {
    id: "dependency",
    name: "依存ライブラリ全更新",
    type: "BOOST",
    icon: "⇧",
    description: "攻撃と連鎖が強化。マイナーなので安全。",
  },
  {
    id: "rollback",
    name: "ロールバック失敗",
    type: "BUG",
    icon: "↶",
    description: "弾の貫通 +1、攻撃速度アップ。戻れません。",
  },
  {
    id: "deploy",
    name: "手動デプロイ",
    type: "BOOST",
    icon: "⌘",
    description: "BP倍率 +25%、ダメージ +5。手順書は古い。",
  },
  {
    id: "yolo",
    name: "ヨシ！",
    type: "BOOST",
    icon: "✓",
    description: "HP回復、攻撃速度アップ。見てないけどヨシ。",
  },
  {
    id: "dns",
    name: "DNSキャッシュ",
    type: "CHAIN",
    icon: "◇",
    description: "ログ回収範囲 +50、連鎖範囲 +20。浸透待ち。",
  },
  {
    id: "merge",
    name: "コンフリクト解消",
    type: "BUG",
    icon: "⊕",
    description: "弾ダメージ +10、同時発射 +1。両方残した。",
  },
  {
    id: "race",
    name: "競合状態",
    type: "CHAIN",
    icon: "⟳",
    description: "攻撃速度と連鎖ダメージ上昇。再現率は低い。",
  },
  {
    id: "memory",
    name: "メモリリーク",
    type: "BUG",
    icon: "∞",
    description: "持続ダメージ +8、最大HP +10。増える一方。",
  },
  {
    id: "config",
    name: "設定ファイル直編集",
    type: "BOOST",
    icon: "{}",
    description: "移動速度 +10%、ダメージ +8。再起動は後で。",
  },
  {
    id: "oncall",
    name: "オンコール当番",
    type: "BOOST",
    icon: "☎",
    description: "HP回復、ログ回収範囲 +40。眠れない夜に。",
  },
  {
    id: "cron",
    name: "cron多重起動",
    type: "CHAIN",
    icon: "⏱",
    description: "連鎖ダメージ +9。前回のジョブがまだ生きている。",
  },
  {
    id: "batch",
    name: "バッチの手動再実行",
    type: "BUG",
    icon: "▶",
    description:
      "持続ダメージ +10、弾ダメージ +5。二重起動ではない、再実行です。",
  },
  {
    id: "migration",
    name: "無停止マイグレーション",
    type: "BUG",
    icon: "⇆",
    description: "貫通 +1、ダメージ +8。ロックは想定外。",
  },
  {
    id: "index",
    name: "インデックス貼り忘れ",
    type: "CHAIN",
    icon: "▤",
    description: "連鎖範囲 +25、ダメージ +5。本番データは多かった。",
  },
  {
    id: "feature",
    name: "フラグ全部ON",
    type: "BOOST",
    icon: "⚑",
    description: "同時発射 +1、BP倍率 +15%。全機能を有効化。",
  },
  {
    id: "canary",
    name: "カナリア全量配信",
    type: "BOOST",
    icon: "↗",
    description: "攻撃速度 +10%、移動速度 +8%。全員がカナリア。",
  },
  {
    id: "cert",
    name: "証明書の期限切れ",
    type: "BUG",
    icon: "◈",
    description: "連鎖ダメージ +10、持続ダメージ +6。去年も見た。",
  },
  {
    id: "clock",
    name: "時刻同期ずれ",
    type: "CHAIN",
    icon: "◷",
    description: "敵の移動速度 -8%、連鎖範囲 +20。時刻だけ別世界。",
  },
  {
    id: "approval",
    name: "承認待ちのまま緊急リリース",
    type: "BOOST",
    icon: "✓",
    description: "最大HP +20、HP回復 +20。承認は事後で。",
  },
  {
    id: "review",
    name: "レビューコメント全解決",
    type: "BUG",
    icon: "✎",
    description: "弾ダメージ +12、BP倍率 +10%。指摘は消えた。",
  },
  {
    id: "autoscale",
    name: "オートスケール暴走",
    type: "CHAIN",
    icon: "⇧",
    description: "同時発射 +1、連鎖範囲 +15。増えれば解決。",
  },
  {
    id: "quota",
    name: "クォータ上限到達",
    type: "BOOST",
    icon: "▥",
    description: "持続ダメージ +8、HP回復 +15。上限とは聞いてない。",
  },
  {
    id: "schema",
    name: "スキーマ変更直当て",
    type: "BUG",
    icon: "▦",
    description: "貫通 +1、連鎖ダメージ +7。互換性は未来の課題。",
  },
  {
    id: "contract",
    name: "API仕様の暗黙変更",
    type: "CHAIN",
    icon: "≋",
    description: "攻撃速度 +8%、ダメージ +6。レスポンスが少しだけ違う。",
  },
  {
    id: "meeting",
    name: "障害対応会議",
    type: "BOOST",
    icon: "☎",
    description: "最大HP +15、HP回復 +25。まず会議室を探す。",
  },
  {
    id: "reboot",
    name: "とりあえず再起動",
    type: "BUG",
    icon: "⟳",
    description: "持続ダメージ +8、攻撃速度 +8%。根本原因は元気です。",
  },
  {
    id: "staging",
    name: "検証環境だけ最新",
    type: "BOOST",
    icon: "⌂",
    description: "移動速度 +10%、BP倍率 +15%。本番も同じはず。",
  },
  {
    id: "drift",
    name: "構成管理のドリフト",
    type: "CHAIN",
    icon: "⇄",
    description: "連鎖範囲 +30、ログ回収 +30。いつの間にか差分が。",
  },
  { id: "lockfile", name: "ロックファイルの置き忘れ", type: "BUG", icon: "⌑", description: "攻撃力 +10、連鎖ダメージ +8。昨日と同じ依存関係とは限らない。" },
  { id: "latest", name: "最新版なら安心", type: "BOOST", icon: "↑", description: "攻撃速度 +10%、BP倍率 +10%。破壊的変更は明日読む。" },
  { id: "timezone", name: "時差を無視した日付", type: "CHAIN", icon: "◷", description: "連鎖範囲 +25、敵速度 -8%。今日はもう昨日。" },
  { id: "midnight", name: "午前零時の定期実行", type: "BUG", icon: "☾", description: "持続ダメージ +8、連鎖ダメージ +8。全リージョンで同時開催。" },
  { id: "secrets", name: "秘密の置き場所", type: "BOOST", icon: "▣", description: "最大HP +20、HP回復 +20。誰でも見つけられる安心設計。" },
  { id: "clipboard", name: "コピペで設定完了", type: "CHAIN", icon: "▤", description: "連鎖範囲 +25、攻撃力 +8。コメントも一緒に引き継ぐ。" },
  { id: "terraform", name: "手元だけの構成変更", type: "BUG", icon: "◇", description: "貫通 +1、攻撃力 +8。差分はなかったことに。" },
  { id: "manual", name: "職人の手作業", type: "BOOST", icon: "✦", description: "移動速度 +8%、BP倍率 +20%。手順は記憶の中。" },
];
export const evolutionPartners: Partial<Record<UpgradeId, UpgradeId>> = {
  retry: "timeout",
  timeout: "retry",
  nplus: "leak",
  leak: "nplus",
  hotfix: "friday",
  friday: "hotfix",
  threshold: "flush",
  flush: "threshold",
  select: "where",
  where: "select",
  force: "config",
  config: "force",
  oncall: "rollback",
  rollback: "oncall",
  spec: "local",
  local: "spec",
  cron: "batch",
  batch: "cron",
  migration: "index",
  index: "migration",
  feature: "canary",
  canary: "feature",
  cert: "clock",
  clock: "cert",
  approval: "review",
  review: "approval",
  autoscale: "quota",
  quota: "autoscale",
  schema: "contract",
  contract: "schema",
  meeting: "reboot",
  reboot: "meeting",
  staging: "drift",
  drift: "staging",
  lockfile: "latest", latest: "lockfile",
  timezone: "midnight", midnight: "timezone",
  secrets: "clipboard", clipboard: "secrets",
  terraform: "manual", manual: "terraform",
};

export type World = {
  seed: number;
  duration: number;
  evolutions: string[];
  bossWave: number;
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
  overdriveUntil: number;
  destroyed: number;
  kills: number;
  level: number;
  xp: number;
  nextXp: number;
  nextUpgradeAt: number;
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
  const life = kind === "milestone" ? 1.2 : kind === "panic" ? 0.9 : kind === "explosion" ? 0.65 : 0.35;
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
export function createWorld(seed = 42, duration = RUN_SECONDS): World {
  const w: World = {
    seed,
    duration: [90, 180, 300].includes(duration) ? duration : 90,
    evolutions: [],
    bossWave: 0,
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
    overdriveUntil: 0,
    destroyed: 0,
    kills: 0,
    level: 1,
    xp: 0,
    nextXp: 5,
    nextUpgradeAt: 0,
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
/** Chain momentum rewards sustained destruction without adding another pause. */
export function chainPower(combo: number) {
  return combo >= 30 ? 1.5 : combo >= 10 ? 1.25 : 1;
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
    const bonus = Math.round(
      (target.kind === "server" ? 100 : target.kind === "boss" ? 1500 : 75) *
        w.multiplier *
        (1 + Math.min(w.combo, 50) * 0.06),
    );
    w.score = Math.min(Number.MAX_SAFE_INTEGER, w.score + bonus);
    if ([10, 30, 100].includes(w.combo)) {
      // Milestones recharge PANIC once per crossing, including during a cascade.
      w.panicCooldown = Math.max(0, w.panicCooldown - 2);
      // A short automatic burst rewards a chain without interrupting movement.
      w.overdriveUntil = Math.min(w.time + 10, Math.max(w.overdriveUntil, w.time) + (w.combo === 10 ? 5 : 3));
      fx(w, target, "milestone", w.combo === 100 ? "SYSTEM MELTDOWN" : w.combo === 30 ? "OVERLOAD x1.5" : "OVERLOAD x1.25");
    }
    if (target.kind === "server") w.destroyed++;
    else w.kills++;
    fx(
      w,
      target,
      "explosion",
      `+${bonus}${w.combo >= 5 ? ` / ${w.combo} CHAIN` : ""}`,
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
          damage: w.chainDamage * chainPower(w.combo) * (target.kind === "boss" ? 2 : 1),
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
    case "nplus":
    case "merge":
      w.multishot = Math.min(6, w.multishot + 1);
      w.damage += upgrade === "merge" ? 10 : 4;
      break;
    case "select":
      w.chainRange = Math.min(400, w.chainRange + 25);
      break;
    case "flush":
    case "memory":
      w.aura += upgrade === "flush" ? 12 : 8;
      if (upgrade === "memory") w.player.maxHp += 10;
      break;
    case "timeout":
    case "rollback":
      w.pierce = Math.min(8, w.pierce + 1);
      w.chainDamage += 5;
      if (upgrade === "rollback")
        w.fireInterval = Math.max(0.12, w.fireInterval * 0.9);
      break;
    case "force":
      w.damage += 18;
      break;
    case "hotfix":
    case "yolo":
      w.fireInterval = Math.max(0.12, w.fireInterval * 0.88);
      w.player.hp = Math.min(w.player.maxHp, w.player.hp + 15);
      break;
    case "spec":
      w.player.maxHp += 30;
      w.player.hp = Math.min(w.player.maxHp, w.player.hp + 30);
      break;
    case "threshold":
      w.slow = Math.max(0.4, w.slow * 0.9);
      break;
    case "dependency":
      w.damage += 10;
      w.chainDamage += 10;
      break;
    case "deploy":
      w.multiplier += 0.25;
      w.damage += 5;
      break;
    case "dns":
      w.magnet = Math.min(420, w.magnet + 50);
      w.chainRange = Math.min(400, w.chainRange + 20);
      break;
    case "race":
      w.fireInterval = Math.max(0.12, w.fireInterval * 0.9);
      w.chainDamage += 8;
      break;
    case "config":
      w.speed = Math.min(340, w.speed * 1.1);
      w.damage += 8;
      break;
    case "oncall":
      w.player.hp = Math.min(w.player.maxHp, w.player.hp + 25);
      w.magnet = Math.min(420, w.magnet + 40);
      break;
    case "cron":
      w.chainDamage += 9;
      break;
    case "batch":
      w.aura += 10;
      w.damage += 5;
      break;
    case "migration":
      w.pierce = Math.min(8, w.pierce + 1);
      w.damage += 8;
      break;
    case "index":
      w.chainRange = Math.min(400, w.chainRange + 25);
      w.damage += 5;
      break;
    case "feature":
      w.multishot = Math.min(6, w.multishot + 1);
      w.multiplier += 0.15;
      break;
    case "canary":
      w.fireInterval = Math.max(0.12, w.fireInterval * 0.9);
      w.speed = Math.min(340, w.speed * 1.08);
      break;
    case "cert":
      w.chainDamage += 10;
      w.aura += 6;
      break;
    case "clock":
      w.slow = Math.max(0.4, w.slow * 0.92);
      w.chainRange = Math.min(400, w.chainRange + 20);
      break;
    case "approval":
      w.player.maxHp += 20;
      w.player.hp = Math.min(w.player.maxHp, w.player.hp + 20);
      break;
    case "review":
      w.damage += 12;
      w.multiplier += 0.1;
      break;
    case "autoscale":
      w.multishot = Math.min(6, w.multishot + 1);
      w.chainRange = Math.min(400, w.chainRange + 15);
      break;
    case "quota":
      w.aura += 8;
      w.player.hp = Math.min(w.player.maxHp, w.player.hp + 15);
      break;
    case "schema":
      w.pierce = Math.min(8, w.pierce + 1);
      w.chainDamage += 7;
      break;
    case "contract":
      w.fireInterval = Math.max(0.12, w.fireInterval * 0.92);
      w.damage += 6;
      break;
    case "meeting":
      w.player.maxHp += 15;
      w.player.hp = Math.min(w.player.maxHp, w.player.hp + 25);
      break;
    case "reboot":
      w.aura += 8;
      w.fireInterval = Math.max(0.12, w.fireInterval * 0.92);
      break;
    case "staging":
      w.speed = Math.min(340, w.speed * 1.1);
      w.multiplier += 0.15;
      break;
    case "drift":
      w.chainRange = Math.min(400, w.chainRange + 30);
      w.magnet = Math.min(420, w.magnet + 30);
      break;
    case "lockfile":
      w.damage += 10; w.chainDamage += 8; break;
    case "latest":
      w.fireInterval = Math.max(0.12, w.fireInterval * 0.9); w.multiplier += 0.1; break;
    case "timezone":
      w.chainRange = Math.min(400, w.chainRange + 25); w.slow = Math.max(0.4, w.slow * 0.92); break;
    case "midnight":
      w.aura += 8; w.chainDamage += 8; break;
    case "secrets":
      w.player.maxHp += 20; w.player.hp = Math.min(w.player.maxHp, w.player.hp + 20); break;
    case "clipboard":
      w.chainRange = Math.min(400, w.chainRange + 25); w.damage += 8; break;
    case "terraform":
      w.pierce = Math.min(8, w.pierce + 1); w.damage += 8; break;
    case "manual":
      w.speed = Math.min(340, w.speed * 1.08); w.multiplier += 0.2; break;
    case "env":
      w.speed = Math.min(340, w.speed * 1.15);
      break;
  }
  const recipes: { name: string; pair: UpgradeId[]; apply: () => void }[] = [
    {
      name: "リトライストーム",
      pair: ["retry", "timeout"],
      apply: () => {
        w.chainRange = Math.min(400, w.chainRange + 80);
        w.chainDamage += 25;
      },
    },
    {
      name: "コネクション枯渇祭り",
      pair: ["nplus", "leak"],
      apply: () => {
        w.multishot = Math.min(6, w.multishot + 2);
        w.aura += 20;
      },
    },
    {
      name: "週末リリース",
      pair: ["hotfix", "friday"],
      apply: () => {
        w.multiplier += 0.8;
        w.fireInterval = Math.max(0.12, w.fireInterval * 0.7);
      },
    },
    {
      name: "完全に正常",
      pair: ["threshold", "flush"],
      apply: () => {
        w.aura += 25;
        w.slow = Math.max(0.4, w.slow * 0.75);
      },
    },
    {
      name: "全件フルスキャン",
      pair: ["select", "where"],
      apply: () => {
        w.pierce = Math.min(8, w.pierce + 2);
        w.chainRange = Math.min(400, w.chainRange + 70);
      },
    },
    {
      name: "本番直編集",
      pair: ["force", "config"],
      apply: () => {
        w.damage += 35;
        w.speed = Math.min(340, w.speed * 1.2);
      },
    },
    {
      name: "真夜中の復旧会議",
      pair: ["oncall", "rollback"],
      apply: () => {
        w.player.maxHp += 40;
        w.player.hp = w.player.maxHp;
        w.chainDamage += 20;
      },
    },
    {
      name: "動くから仕様",
      pair: ["spec", "local"],
      apply: () => {
        w.player.maxHp += 50;
        w.player.hp = w.player.maxHp;
        w.aura += 12;
      },
    },

    {
      name: "二重起動フェスティバル",
      pair: ["cron", "batch"],
      apply: () => {
        w.aura += 20;
        w.chainDamage += 20;
      },
    },
    {
      name: "ロック待ちの行列",
      pair: ["migration", "index"],
      apply: () => {
        w.pierce = Math.min(8, w.pierce + 2);
        w.chainRange = Math.min(400, w.chainRange + 60);
      },
    },
    {
      name: "全員カナリア",
      pair: ["feature", "canary"],
      apply: () => {
        w.multishot = Math.min(6, w.multishot + 1);
        w.fireInterval = Math.max(0.12, w.fireInterval * 0.75);
      },
    },
    {
      name: "期限切れタイムリープ",
      pair: ["cert", "clock"],
      apply: () => {
        w.aura += 20;
        w.slow = Math.max(0.4, w.slow * 0.8);
      },
    },
    {
      name: "承認済みということにする",
      pair: ["approval", "review"],
      apply: () => {
        w.player.maxHp += 40;
        w.player.hp = w.player.maxHp;
        w.damage += 15;
      },
    },
    {
      name: "無限スケール上限",
      pair: ["autoscale", "quota"],
      apply: () => {
        w.multishot = Math.min(6, w.multishot + 1);
        w.aura += 18;
      },
    },
    {
      name: "互換性は来世で",
      pair: ["schema", "contract"],
      apply: () => {
        w.pierce = Math.min(8, w.pierce + 2);
        w.damage += 22;
      },
    },
    {
      name: "再起動の承認会議",
      pair: ["meeting", "reboot"],
      apply: () => {
        w.player.maxHp += 30;
        w.player.hp = w.player.maxHp;
        w.aura += 16;
      },
    },
    {
      name: "環境差分パラダイス",
      pair: ["staging", "drift"],
      apply: () => {
        w.chainRange = Math.min(400, w.chainRange + 65);
        w.multiplier += 0.5;
      },
    },
    { name: "再現不能ビルド", pair: ["lockfile", "latest"], apply: () => { w.damage += 25; w.fireInterval = Math.max(0.12, w.fireInterval * 0.8); } },
    { name: "世界同時バッチ祭り", pair: ["timezone", "midnight"], apply: () => { w.chainRange = Math.min(400, w.chainRange + 60); w.aura += 18; } },
    { name: "秘伝の設定コピペ", pair: ["secrets", "clipboard"], apply: () => { w.player.maxHp += 30; w.player.hp = w.player.maxHp; w.chainDamage += 20; } },
    { name: "存在しないインフラ", pair: ["terraform", "manual"], apply: () => { w.pierce = Math.min(8, w.pierce + 2); w.multiplier += 0.5; } },
  ];
  for (const recipe of recipes)
    if (
      !w.evolutions.includes(recipe.name) &&
      recipe.pair.every((id) => w.build.includes(id))
    ) {
      recipe.apply();
      w.evolutions.push(recipe.name);
      fx(w, w.player, "heal", `EVOLUTION: ${recipe.name}`);
    }
  w.choices = [];
  w.phase = "playing";
  return w;
}
export function wave(w: World) {
  return Math.min(w.duration / 30, Math.floor(w.time / 30) + 1);
}
/** One 1/30 second step. Input and state are never mutated. */
export function stepWorld(state: World, input: Input): World {
  if (state.phase !== "playing") return state;
  const w = structuredClone(state),
    dt = STEP;
  w.time = Math.min(w.duration, w.time + dt);
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
    w.shotTimer += w.fireInterval * (w.time < w.overdriveUntil ? 0.65 : 1);
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
  if (
    w.time >= 30 &&
    Math.floor(w.time / 30) > w.bossWave &&
    w.time < w.duration
  ) {
    w.bossWave = Math.floor(w.time / 30);
    w.bossSpawned = true;
    w.entities.push({
      id: id(w),
      x: clamp(w.player.x + 350, 40, 1960),
      y: w.player.y,
      hp: 250 + w.bossWave * 200,
      maxHp: 250 + w.bossWave * 200,
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
  else if (w.time >= w.duration) w.phase = "won";
  else if (w.xp >= w.nextXp && w.time >= w.nextUpgradeAt) {
    w.xp -= w.nextXp;
    w.level++;
    // Retain earned XP while giving the player uninterrupted time between choices.
    w.nextUpgradeAt = w.time + (w.time < 30 ? 12 : 8);
    w.nextXp = Math.round(w.nextXp * 1.25 + 2);
    w.choices = choices(w);
    w.phase = "upgrade";
    fx(w, w.player, "heal", "LEVEL UP");
  }
  return w;
}
/** A report depends only on the final run, and never changes on re-render. */
export function survivorReport(w: World) {
  const causes = [
    "善意のパフォーマンス改善",
    "レビューで「あとで直す」と書いた一行",
    "手順書には載っていない手動操作",
    "本番だけ微妙に違う環境変数",
    "再起動すれば直るという強い信念",
    "深夜の小さな設定変更",
    "互換性があるはずだった依存ライブラリ更新",
    "キャッシュはいつか消えるという楽観",
    "通知が多すぎたので止めた監視",
    "昨日は正常に終わったバッチの再実行",
    "本番データでは試していない検索条件",
    "コメントアウトされた最後の安全装置",
    "「影響範囲は限定的」という見積もり",
    "本番への善意の一括変更",
    "期限切れを誰も見ていなかった証明書",
    "仕様書にない仕様への完全対応",
    "最新版なら大丈夫という根拠のない確信",
    "タイムゾーンを考慮しなかった午前零時",
    "作業者の記憶にしか存在しない設定",
    "コピペ元に残っていた検証用の値",
    "存在しないはずのインフラの手動変更",
    "誰も読まなかった破壊的変更の告知",
    "一時的な対応として永住した設定",
    "戻せると思っていた片道のマイグレーション",
    "再現条件が会議室に置き忘れられた不具合",
    "全員が別の人が確認したと思っていた設定",
  ];
  const preventions = [
    "金曜日を廃止する。",
    "リリース前にカレンダーを確認する。",
    "「ヨシ！」の前に一度だけ中身を見る。",
    "本番環境に気軽に入れないよう入口を迷路にする。",
    "再起動ボタンに「本当に？」と三回聞かせる。",
    "手順書の最終更新日も監視する。",
    "レビューの「LGTM」に句読点を必須にする。",
    "休日のデプロイには温かい飲み物を添える。",
    "アラートを消す前に一度だけ読む。",
    "「ローカルでは動く」を証拠として採用しない。",
    "設定変更の前に深呼吸と差分確認を行う。",
    "復旧BOTにも有給を付与する。",
    "バッチの開始前に前回のバッチへ生存確認を行う。",
    "全件更新の前に全員を集合させる。",
    "「念のため」の再実行を念のため確認する。",
    "承認ボタンの位置をデプロイボタンから離す。",
    "期限切れの通知を期限切れにしない。",
    "影響範囲の欄を「たぶん」以外で埋める。",
    "原因調査中のまま祝勝会を始めない。",
    "バックアップの復元方法もバックアップする。",
    "「一時対応」に賞味期限を設定する。",
    "タイムゾーンを会議の参加者として招待する。",
    "コピペ元にもレビューを受けてもらう。",
    "手作業の前に未来の自分へ手紙を書く。",
    "最新版の説明を更新ボタンより大きく表示する。",
    "変更履歴の空欄に事情聴取を行う。",
    "本番と検証環境を定期的に自己紹介させる。",
    "「誰がやったか」より先に「何が起きたか」を書く。",
    "ロックファイルにもチームの一員として席を用意する。",
    "無限リトライの前に有限のお茶休憩を入れる。",
  ];
  const titles =
    w.destroyed >= 80
      ? [
          "本番の破壊神",
          "稼働率ゼロの錬金術師",
          "連鎖障害の演出家",
          "全件更新の覇者",
          "SLA解体職人",
          "データセンターの伝説",
          "稼働率の天敵", "本番炎上マエストロ", "SLOの最終面接官", "障害予算の使い手", "全サービス同時多発の匠",
        ]
      : w.destroyed >= 25
        ? [
            "伝説のデグレ職人",
            "キャッシュを消す者",
            "影響範囲は全サービス",
            "秘密の障害職人",
            "手順書の冒険者", "差分を生む者", "デプロイの風雲児", "深夜アラートの名付け親",
          ]
        : [
            "原因は調査中",
            "本番は見ていない",
            "ヨシ！の達人",
            "ログの海の漂流者",
            "再起動見習い", "小さな変更の大冒険", "設定値の旅人", "影響調査の新人",
          ];
  if (w.maxCombo >= 20) titles.push("無限リトライの使者", "連鎖反応の支配者");
  if (w.maxCombo >= 100) titles.push("終わらない障害対応", "アラートの大洪水");
  if (w.build.includes("friday")) titles.push("金曜の魔術師", "週末を奪う者");
  if (w.build.includes("local"))
    titles.push("動作保証はローカル", "私の環境代表");
  if (w.panicUses >= 3) titles.push("緊急マージの達人", "再起動ボタンの守護者");
  if (w.evolutions.length >= 1)
    titles.push("進化したレガシーコード", "複雑性の錬金術師");
  if (w.build.includes("timezone")) titles.push("時差の支配者", "昨日と明日の境界線");
  if (w.build.includes("lockfile")) titles.push("依存関係の漂流者", "再現不能の建築家");
  if (w.build.includes("manual")) titles.push("手順書なき職人", "記憶だけが真実");
  if (w.phase === "won")
    titles.push("90秒を超えた何か", "本番を生き延びたバグ");
  const mix = (salt: number) => {
    let hash =
      (w.seed ^
        Math.imul(w.destroyed + 1, 0x9e3779b1) ^
        Math.imul(w.maxCombo + 1, 0x85ebca6b) ^
        salt) >>>
      0;
    hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d) >>> 0;
    return (hash ^ (hash >>> 15)) >>> 0;
  };
  const buildCause = w.build.length
    ? upgrades.find((u) => u.id === w.build[mix(31) % w.build.length])?.name
    : undefined;
  return {
    title: titles[mix(1) % titles.length],
    cause:
      buildCause && mix(2) % 2 === 0
        ? `${buildCause} と ${causes[mix(3) % causes.length]}`
        : causes[mix(3) % causes.length],
    prevention: preventions[mix(4) % preventions.length],
  };
}
