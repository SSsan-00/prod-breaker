import { beforeEach, expect, it, vi } from "vitest";
const score={runId:"11111111-1111-4111-8111-111111111111",duration:90,score:1234,replay:{version:1 as const,seed:42,inputs:"f38A",upgrades:[]}};
beforeEach(()=>{localStorage.clear();vi.resetModules();vi.restoreAllMocks();});
it("keeps failed submissions for retry and replaces the name for the same run",async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(new Response("",{status:503})).mockResolvedValue(new Response("{}",{status:200}));vi.stubGlobal("fetch",fetch);
  const {enqueueScore,savePlayerName,flushScores}=await import("../src/lib/score-submission");
  savePlayerName("定時の守り人");await enqueueScore(score);expect(JSON.parse(localStorage.getItem("pk-pending-scores")!)).toHaveLength(1);
  savePlayerName("夜勤の守り人");await enqueueScore(score);await flushScores();
  expect(JSON.parse(fetch.mock.calls[1][1].body).name).toBe("夜勤の守り人");expect(JSON.parse(localStorage.getItem("pk-pending-scores")!)).toEqual([]);
});
it("works with localStorage unavailable and keeps a stable fallback name",async()=>{
  vi.spyOn(Storage.prototype,"getItem").mockImplementation(()=>{throw Error();});vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw Error();});
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("{}",{status:200})));
  const {playerName,savePlayerName,enqueueScore}=await import("../src/lib/score-submission");expect(playerName()).toBe(playerName());savePlayerName("守る人");expect(playerName()).toBe("守る人");await expect(enqueueScore(score)).resolves.toBeUndefined();
});
