export type NodeId =
  "WEB" | "API" | "AUTH" | "DB" | "CACHE" | "BATCH" | "MONITOR";
export type Server = {
  id: NodeId;
  label: string;
  maxHp: number;
  hp: number;
  status: "healthy" | "warning" | "critical" | "destroyed";
  position: [number, number];
  tags: string[];
  weight: number;
};
export type Card = {
  id: string;
  name: string;
  type: "BUG" | "CHAIN" | "BOOST";
  description: string;
  targetTags: string[];
  baseDamage: number;
  effects: { spread: number; multiplier: number };
  rarity: "COMMON" | "RARE";
};
export const cards: Card[] = [
  [
    "where",
    "WHERE句行方不明",
    "BUG",
    "全件更新。影響範囲は、全件です。",
    "data",
    70,
    0,
    0,
  ],
  [
    "leak",
    "DB接続リーク",
    "BUG",
    "接続は増える。空きは戻らない。",
    "data",
    62,
    0.08,
    0,
  ],
  [
    "cache",
    "キャッシュ不整合",
    "BUG",
    "昨日の正解を、今日の本番へ。",
    "service",
    58,
    0.1,
    0,
  ],
  [
    "retry",
    "無限リトライ",
    "CHAIN",
    "失敗したら、もっと強く叩こう。",
    "all",
    45,
    0.22,
    0,
  ],
  [
    "common",
    "秘伝の共通処理",
    "CHAIN",
    "一箇所の修正で、全サービスに影響。",
    "all",
    48,
    0.18,
    0,
  ],
  [
    "friday",
    "金曜17:59",
    "BOOST",
    "週末への期待がBPを増幅する。",
    "all",
    54,
    0,
    0.55,
  ],
  [
    "test",
    "テスト未実施",
    "BOOST",
    "動いたのでヨシ！ 倍率を追加。",
    "all",
    52,
    0,
    0.35,
  ],
  [
    "log",
    "ログ出しすぎ",
    "BUG",
    "ディスクは有限。好奇心は無限。",
    "all",
    64,
    0.03,
    0,
  ],
  [
    "local",
    "私の環境では動く",
    "BOOST",
    "本番も、きっと同じ環境です。",
    "all",
    50,
    0,
    0.4,
  ],
  [
    "monitor",
    "監視停止",
    "CHAIN",
    "アラートがない。つまり正常。",
    "ops",
    68,
    0.2,
    0,
  ],
  [
    "refactor",
    "謎のリファクタリング",
    "CHAIN",
    "挙動は変えていない、はず。",
    "all",
    50,
    0.16,
    0,
  ],
  [
    "env",
    "環境変数整理",
    "BUG",
    "不要そうなキーを全部削除。",
    "service",
    66,
    0.04,
    0,
  ],
].map((a) => ({
  id: String(a[0]),
  name: String(a[1]),
  type: a[2] as Card["type"],
  description: String(a[3]),
  targetTags: [String(a[4])],
  baseDamage: Number(a[5]),
  effects: { spread: Number(a[6]), multiplier: Number(a[7]) },
  rarity: a[0] === "friday" ? "RARE" : "COMMON",
}));
export const edges: {
  from: NodeId;
  to: NodeId;
  weight: number;
  faultTypes: string[];
}[] = (
  [
    ["WEB", "API"],
    ["API", "DB"],
    ["DB", "API"],
    ["API", "AUTH"],
    ["AUTH", "WEB"],
    ["DB", "CACHE"],
    ["CACHE", "WEB"],
    ["BATCH", "DB"],
    ["DB", "BATCH"],
    ["API", "MONITOR"],
    ["MONITOR", "API"],
  ] as [NodeId, NodeId][]
).map(([from, to]) => ({ from, to, weight: 0.82, faultTypes: ["fault"] }));
export function topology(): Server[] {
  return (
    ["WEB", "API", "AUTH", "DB", "CACHE", "BATCH", "MONITOR"] as NodeId[]
  ).map((id, i) => ({
    id,
    label: id,
    maxHp: 100,
    hp: 100,
    status: "healthy",
    position: (
      [
        [22, 20],
        [50, 39],
        [78, 20],
        [50, 72],
        [20, 66],
        [80, 66],
        [50, 10],
      ] as [number, number][]
    )[i],
    tags: [
      ["WEB", "API", "AUTH", "CACHE"].includes(id)
        ? "service"
        : ["DB", "BATCH"].includes(id)
          ? "data"
          : "ops",
    ],
    weight: id === "DB" ? 3 : id === "API" ? 2 : 1,
  }));
}
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export function hand(seed: number, round: number) {
  const r = rng(seed + round * 997);
  const options = [...cards]
    .filter((c) => c.id !== "retry")
    .map((c) => ({ c, k: r() }))
    .sort((a, b) => a.k - b.k)
    .slice(0, 2)
    .map((x) => x.c);
  return [...options, cards[3]];
}
export function validTarget(card: Card, node: Server) {
  return (
    node.hp > 0 &&
    (card.targetTags.includes("all") ||
      node.tags.some((t) => card.targetTags.includes(t)))
  );
}
export function uptime(nodes: Server[]) {
  return Math.round(
    (nodes.reduce((s, n) => s + n.hp * n.weight, 0) /
      nodes.reduce((s, n) => s + n.maxHp * n.weight, 0)) *
      100,
  );
}
export type FaultEvent = {
  eventId: string;
  sourceNodeId: NodeId | null;
  targetNodeId: NodeId;
  faultType: string;
  damage: number;
  depth: number;
  parentEventId: string | null;
};
export type Log = FaultEvent & {
  effectiveDamage: number;
  hp: number;
  status: Server["status"];
  score: number;
  combo: number;
};
export type CascadeInput = {
  nodes: Server[];
  card: Card;
  target: NodeId;
  acquired: Card[];
  seed: number;
  round: number;
  panicAt?: number;
  initialEvents?: FaultEvent[];
};
export function cascade(input: CascadeInput) {
  const { card, target, seed, round, acquired } = input;
  const nodes = input.nodes.map((n) => ({
    ...n,
    position: [...n.position] as [number, number],
    tags: [...n.tags],
  }));
  const selected = nodes.find((n) => n.id === target);
  if (!selected || !validTarget(card, selected))
    throw new Error("無効なカード配置");
  const random = rng(seed + round);
  const active = [...acquired, card];
  const spread = Math.min(
    1.15,
    0.76 + active.reduce((s, c) => s + c.effects.spread, 0),
  );
  const multiplier = 1 + active.reduce((s, c) => s + c.effects.multiplier, 0);
  let serial = 0,
    panicUsed = false,
    score = 0;
  const queue: FaultEvent[] = input.initialEvents
    ? [...input.initialEvents]
    : [
        {
          eventId: "root",
          sourceNodeId: null,
          targetNodeId: target,
          faultType: "fault",
          damage: card.baseDamage * (1 + (round - 1) * 0.25),
          depth: 0,
          parentEventId: null,
        },
      ];
  const seen = new Set<string>(),
    repeats = new Map<string, number>();
  const logs: Log[] = [];
  while (queue.length && logs.length < 200) {
    if (
      !panicUsed &&
      input.panicAt !== undefined &&
      logs.length >= input.panicAt
    ) {
      panicUsed = true;
      const live = nodes.filter((n) => n.hp > 0);
      for (const n of live)
        queue.push({
          eventId: `panic-${n.id}`,
          sourceNodeId: null,
          targetNodeId: n.id,
          faultType: "fault",
          damage: 35,
          depth: 0,
          parentEventId: null,
        });
    }
    const e = queue.shift()!;
    if (
      seen.has(e.eventId) ||
      e.depth > 12 ||
      !Number.isFinite(e.damage) ||
      e.damage <= 0
    )
      continue;
    seen.add(e.eventId);
    const key = `${e.sourceNodeId}:${e.targetNodeId}:${e.faultType}`;
    if ((repeats.get(key) || 0) >= 2) continue;
    repeats.set(key, (repeats.get(key) || 0) + 1);
    const n = nodes.find((n) => n.id === e.targetNodeId);
    if (!n || n.hp === 0) continue;
    const damage = Math.min(n.hp, Math.max(0, Math.round(e.damage)));
    n.hp -= damage;
    n.status =
      n.hp === 0
        ? "destroyed"
        : n.hp < 35
          ? "critical"
          : n.hp < 80
            ? "warning"
            : "healthy";
    const combo = logs.length + 1;
    const points = Math.round(
      damage * 10 * multiplier * (1 + Math.min(combo, 50) * 0.08),
    );
    score = Math.min(Number.MAX_SAFE_INTEGER, score + points);
    logs.push({
      ...e,
      effectiveDamage: damage,
      hp: n.hp,
      status: n.status,
      score: points,
      combo,
    });
    if (e.depth < 12)
      for (const edge of edges.filter(
        (x) => x.from === n.id && x.faultTypes.includes(e.faultType),
      )) {
        const d =
          e.damage * spread * edge.weight * (0.94 + random() * 0.12) +
          (n.hp === 0 ? 16 : 0);
        if (d >= 5)
          queue.push({
            eventId: `e-${++serial}`,
            sourceNodeId: n.id,
            targetNodeId: edge.to,
            faultType: e.faultType,
            damage: d,
            depth: e.depth + 1,
            parentEventId: e.eventId,
          });
      }
  }
  return {
    nodes,
    logs,
    score,
    combo: logs.length,
    panicUsed,
    capped: queue.length > 0,
  };
}
export function finished(round: number) {
  return round >= 3;
}
export function report(score: number, destroyed: number) {
  return {
    title:
      destroyed >= 6
        ? "本番の破壊神"
        : score > 7000
          ? "伝説のデグレ職人"
          : "原因は調査中",
    summary: `架空の${destroyed}サービスが停止しました。`,
    cause: "善意のパフォーマンス改善",
    prevention: "金曜日を廃止する。レビューに「ヨシ！」だけ書かない。",
  };
}
