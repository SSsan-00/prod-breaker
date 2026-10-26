import { describe, it, expect, vi } from "vitest";
import {
  cascade,
  cards,
  topology,
  uptime,
  finished,
  hand,
  type FaultEvent,
} from "../src/game/engine";
import { read, write } from "../src/lib/storage";
const input = () => ({
  nodes: topology(),
  card: cards[3],
  target: "DB" as const,
  acquired: [],
  seed: 42,
  round: 1,
});
describe("deterministic cascade", () => {
  it("replays the same seed and applies real damage", () => {
    const a = cascade(input());
    expect(a).toEqual(cascade(input()));
    expect(a.logs.length).toBeGreaterThan(2);
    expect(a.nodes.every((n) => n.hp >= 0 && n.hp <= 100)).toBe(true);
    expect(a.logs.some((e) => e.targetNodeId === "API")).toBe(true);
  });
  it("rejects incompatible placements", () =>
    expect(() =>
      cascade({ ...input(), card: cards[0], target: "WEB" }),
    ).toThrow());
  it("terminates cycles with event and depth bounds", () => {
    for (let seed = 0; seed < 100; seed++) {
      const a = cascade({
        ...input(),
        seed,
        acquired: cards,
        round: 3,
        panicAt: 1,
      });
      expect(a.logs.length).toBeLessThanOrEqual(200);
      expect(a.logs.every((e) => e.depth <= 12)).toBe(true);
      expect(new Set(a.logs.map((e) => e.eventId)).size).toBe(a.logs.length);
    }
  });
  it("ignores duplicate ids and invalid numeric damage", () => {
    const event: FaultEvent = {
      eventId: "same",
      sourceNodeId: null,
      targetNodeId: "DB",
      faultType: "fault",
      damage: 10,
      depth: 12,
      parentEventId: null,
    };
    const a = cascade({
      ...input(),
      initialEvents: [event, event, { ...event, eventId: "nan", damage: NaN }],
    });
    expect(a.logs).toHaveLength(1);
    expect(a.nodes.find((n) => n.id === "DB")?.hp).toBe(90);
    expect(a.score).toBe(108);
  });
  it("scores actual effective damage with combo", () => {
    const a = cascade(input());
    expect(a.score).toBe(a.logs.reduce((s, e) => s + e.score, 0));
    expect(a.combo).toBe(a.logs.length);
    expect(a.logs[0].score).toBe(
      Math.round(a.logs[0].effectiveDamage * 10 * 1.08),
    );
  });
  it("injects panic once deterministically", () => {
    const a = cascade({ ...input(), panicAt: 1 });
    expect(a.panicUsed).toBe(true);
    expect(a).toEqual(cascade({ ...input(), panicAt: 1 }));
    expect(
      a.logs.filter((e) => e.eventId.startsWith("panic-")).length,
    ).toBeLessThanOrEqual(7);
    expect(a.score).toBeGreaterThan(cascade(input()).score);
  });
  it("has consistent weighted uptime and three rounds", () => {
    expect(uptime(topology())).toBe(100);
    expect(uptime(topology().map((n) => ({ ...n, hp: 0 })))).toBe(0);
    expect(finished(2)).toBe(false);
    expect(finished(3)).toBe(true);
  });
  it("deals 3 distinct cards with a universally compatible choice", () => {
    for (let s = 0; s < 100; s++) {
      const h = hand(s, 1);
      expect(h).toHaveLength(3);
      expect(new Set(h.map((c) => c.id)).size).toBe(3);
      expect(h.some((c) => c.targetTags.includes("all"))).toBe(true);
    }
  });
  it("survives unavailable storage", () => {
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
