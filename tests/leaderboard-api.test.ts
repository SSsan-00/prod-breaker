import { beforeEach, expect, it, vi } from "vitest";
const { sql, verify } = vi.hoisted(() => ({sql:vi.fn(),verify:vi.fn()}));
vi.mock("@neondatabase/serverless",()=>({neon:()=>sql}));
vi.mock("@/game/replay",()=>({verifyReplay:verify}));
import {GET,POST} from "../src/app/api/leaderboard/route";
const entry={name:"本番の守り人",duration:90,score:1234,runId:"11111111-1111-4111-8111-111111111111",replay:{}};
const request=(body:unknown)=>new Request("https://keeper.test/api/leaderboard",{method:"POST",body:JSON.stringify(body)});
beforeEach(()=>{vi.stubEnv("DATABASE_URL","test");sql.mockReset();verify.mockReset();verify.mockReturnValue(true);sql.mockResolvedValue([{run_id:entry.runId}]);});
it("queries only KEEPER records in the selected mode",async()=>{
  expect((await GET(new Request("https://keeper.test/api/leaderboard?duration=90"))).status).toBe(200);
  expect(sql.mock.calls[0][0].join(" ")).toContain("FROM keeper_scores");
  expect((await GET(new Request("https://keeper.test/api/leaderboard?duration=1800"))).status).toBe(400);
});
it("rejects invalid names and forged scores before database writes",async()=>{
  expect((await POST(request({...entry,name:"\u0000"}))).status).toBe(400);
  verify.mockReturnValue(false);
  expect((await POST(request({...entry,score:99999999}))).status).toBe(400);expect(sql).not.toHaveBeenCalled();
});
it("writes parameterized scores and updates only the name on matching run IDs",async()=>{
  expect((await POST(request(entry))).status).toBe(200);
  const query=sql.mock.calls[0][0].join(" ");expect(query).toContain("INSERT INTO keeper_scores");expect(query).toContain("ON CONFLICT (run_id) DO UPDATE SET player_name");expect(query).not.toContain("本番の守り人");
  sql.mockResolvedValue([]);expect((await POST(request(entry))).status).toBe(409);
});
it("bounds request size and reports database failure without exposing secrets",async()=>{
  expect((await POST(request({padding:"x".repeat(80001)}))).status).toBe(413);
  sql.mockRejectedValue(Error("private connection"));const response=await POST(request(entry));expect(response.status).toBe(503);expect(await response.text()).not.toContain("private");
});
