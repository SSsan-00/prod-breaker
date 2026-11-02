import { describe, expect, it, vi } from "vitest";
import { defaultNames, randomPlayerName, REPLAY_REJECTED, validName } from "../src/lib/leaderboard";
import { GET, POST } from "../src/app/api/leaderboard/route";
import { finishReplay, recordInput, type Recorder } from "../src/game/replay";
import { verifyReplay } from "../src/game/verify-replay";
import { chooseUpgrade, createWorld, stepWorld } from "../src/game/survivor";

const sqlMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock("@neondatabase/serverless", () => ({ neon: () => sqlMock }));
const placeholderReplay = { version: 1 as const, seed: 42, inputs: "", upgrades: [] };

it("replays a completed run and rejects forged scores, missing inputs and invalid upgrades", () => {
  const recorder: Recorder = { seed: 42, inputs: [], upgrades: [] };
  let world = createWorld(42, 90);
  for (let i = 0; i < 2800 && world.phase !== "won" && world.phase !== "lost"; i++) {
    if (world.phase === "upgrade") {
      recorder.upgrades.push([recorder.inputs.length / 3, world.choices[0]]);
      world = chooseUpgrade(world, world.choices[0]);
    }
    world = stepWorld(world, recordInput(recorder, { x: Math.cos(i / 40), y: Math.sin(i / 40), panic: i % 700 === 0 }));
  }
  const replay = finishReplay(recorder);
  expect(verifyReplay(replay, 90, world.score)).toBe(true);
  expect(verifyReplay(replay, 90, world.score + 1)).toBe(false);
  expect(verifyReplay({ ...replay, inputs: replay.inputs.slice(0, -4) }, 90, world.score)).toBe(false);
  expect(verifyReplay({ ...replay, upgrades: [[0, "where"]] }, 90, world.score)).toBe(false);
});

it("writes only a valid replay and rejects a fabricated score", async () => {
  const saved = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://example.invalid/db";
  sqlMock.mockClear();
  try {
    const recorder: Recorder = { seed: 42, inputs: [], upgrades: [] };
    let world = createWorld(42, 90);
    while (world.phase !== "won" && world.phase !== "lost") {
      if (world.phase === "upgrade") {
        recorder.upgrades.push([recorder.inputs.length / 3, world.choices[0]]);
        world = chooseUpgrade(world, world.choices[0]);
      }
      world = stepWorld(world, recordInput(recorder, { x: 0, y: 0 }));
    }
    const body = { name: "本番の破壊神", duration: 90, score: world.score, runId: "1f5f5190-35b4-4009-a15b-3cb46af16213", replay: finishReplay(recorder) };
    const post = (value: unknown) => POST(new Request("http://localhost/api/leaderboard", { method: "POST", body: JSON.stringify(value) }));
    expect((await post({ ...body, replay: undefined })).status).toBe(400);
    const forged = await post({ ...body, score: body.score + 1 });
    expect(forged.status).toBe(400);
    expect((await forged.json()).code).toBe(REPLAY_REJECTED);
    expect(sqlMock).not.toHaveBeenCalled();
    expect((await post(body)).status).toBe(200);
    expect(sqlMock).toHaveBeenCalledTimes(1);
  } finally { if (saved === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = saved; }
});

describe("leaderboard validation", () => {
  it("accepts short names but rejects empty, controls and overlong names", () => {
    expect(validName("本番環境の破壊神")).toBe(true);
    for (const value of ["", "  ", " a", "a\nb", "a\u200bb", "あ".repeat(21)]) expect(validName(value)).toBe(false);
  });
  it("always chooses a different valid default name", () => {
    for (const current of defaultNames) {
      const next = randomPlayerName(current);
      expect(defaultNames).toContain(next);
      expect(next).not.toBe(current);
      expect(validName(next)).toBe(true);
    }
  });
  it("rejects invalid data and fails gracefully without Neon", async () => {
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      expect((await GET(new Request("http://localhost/api/leaderboard?duration=120"))).status).toBe(400);
      expect((await GET(new Request("http://localhost/api/leaderboard?duration=90"))).status).toBe(503);
      const post = (body: unknown) => POST(new Request("http://localhost/api/leaderboard", { method: "POST", body: JSON.stringify(body) }));
      const entry = { name: "本番の破壊神", duration: 1800, score: 12345, runId: "1f5f5190-35b4-4009-a15b-3cb46af16213" };
      expect((await post({ ...entry, score: -1 })).status).toBe(400);
      expect((await post({ ...entry, runId: "bad" })).status).toBe(400);
      expect((await post({ ...entry, name: "" })).status).toBe(400);
      expect((await post(entry)).status).toBe(503);
    } finally { if (saved !== undefined) process.env.DATABASE_URL = saved; else delete process.env.DATABASE_URL; }
  });
});

describe("automatic score submission", () => {
  it("keeps a failed submission and retries it without changing its run id or name", async () => {
    const { enqueueScore, flushScores, savePlayerName } = await import("../src/lib/score-submission");
    localStorage.clear();
    savePlayerName("本番の破壊神");
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    try {
      enqueueScore({ runId: "1f5f5190-35b4-4009-a15b-3cb46af16213", duration: 90, score: 123, replay: placeholderReplay });
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      await vi.waitFor(() => expect(JSON.parse(localStorage.getItem("pb-pending-scores") || "[]")).toHaveLength(1));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await flushScores();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ name: "本番の破壊神", runId: "1f5f5190-35b4-4009-a15b-3cb46af16213", duration: 90, score: 123, replay: placeholderReplay });
      expect(JSON.parse(localStorage.getItem("pb-pending-scores") || "[]")).toEqual([]);
    } finally { vi.unstubAllGlobals(); localStorage.clear(); }
  });
});

describe("result name update", () => {
  it("sends the new name even when the original submission is still in flight", async () => {
    const { enqueueScore, savePlayerName } = await import("../src/lib/score-submission");
    localStorage.clear();
    let finishFirst!: (value: { ok: boolean }) => void;
    const first = new Promise<{ ok: boolean }>((resolve) => { finishFirst = resolve; });
    const fetchMock = vi.fn().mockReturnValueOnce(first).mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const entry = { runId: "fcd9130b-318c-412e-b18e-604aef7e5411", duration: 90, score: 123, replay: placeholderReplay };
      savePlayerName("古い名前"); enqueueScore(entry);
      savePlayerName("新しい名前"); enqueueScore(entry);
      finishFirst({ ok: true });
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ ...entry, name: "新しい名前" });
      await vi.waitFor(() => expect(JSON.parse(localStorage.getItem("pb-pending-scores") || "[]")).toEqual([]));
    } finally { vi.unstubAllGlobals(); localStorage.clear(); }
  });
});
