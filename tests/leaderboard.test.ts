import { describe, expect, it, vi } from "vitest";
import { validName } from "../src/lib/leaderboard";
import { GET, POST } from "../src/app/api/leaderboard/route";

describe("leaderboard validation", () => {
  it("accepts short names but rejects empty, controls and overlong names", () => {
    expect(validName("本番環境の破壊神")).toBe(true);
    for (const value of ["", "  ", " a", "a\nb", "a\u200bb", "あ".repeat(21)]) expect(validName(value)).toBe(false);
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
      enqueueScore({ runId: "1f5f5190-35b4-4009-a15b-3cb46af16213", duration: 90, score: 123 });
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      await vi.waitFor(() => expect(JSON.parse(localStorage.getItem("pb-pending-scores") || "[]")).toHaveLength(1));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await flushScores();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ name: "本番の破壊神", runId: "1f5f5190-35b4-4009-a15b-3cb46af16213", duration: 90, score: 123 });
      expect(JSON.parse(localStorage.getItem("pb-pending-scores") || "[]")).toEqual([]);
    } finally { vi.unstubAllGlobals(); localStorage.clear(); }
  });
});
