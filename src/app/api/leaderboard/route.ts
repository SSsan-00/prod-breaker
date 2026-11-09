import { neon } from "@neondatabase/serverless";
import { validName, durations } from "@/lib/leaderboard";
import { verifyReplay } from "@/game/replay";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const validDuration = (value: unknown): value is number => typeof value === "number" && durations.some((d) => d === value);
const unavailable = () => Response.json({ error: "接続できませんでした。スコアは次回接続時に再送します。" }, { status: 503 });
export async function GET(request: Request) {
  const duration = Number(new URL(request.url).searchParams.get("duration"));
  if (!validDuration(duration)) return Response.json({ error: "不正なモードです。" }, { status: 400 });
  if (!process.env.DATABASE_URL) return unavailable();
  try {
    const sql = neon(process.env.DATABASE_URL);
    const scores = await sql`SELECT player_name, score, created_at FROM keeper_scores WHERE duration = ${duration} ORDER BY score DESC, created_at ASC LIMIT 30`;
    return Response.json({ scores }, { headers: { "Cache-Control": "no-store" } });
  } catch { return unavailable(); }
}
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 80000) return Response.json({ error: "リクエストが大きすぎます。" }, { status: 413 });
  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 80000) return Response.json({ error: "リクエストが大きすぎます。" }, { status: 413 });
    body = JSON.parse(raw);
  } catch { return Response.json({ error: "不正なリクエストです。" }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "不正なリクエストです。" }, { status: 400 });
  const { name, score, duration, runId, replay } = body as Record<string, unknown>;
  if (!validName(name) || !validDuration(duration) || typeof score !== "number" || !Number.isSafeInteger(score) || score < 0 || score > 1e12 || typeof runId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) return Response.json({ error: "入力内容を確認してください。" }, { status: 400 });
  if (!verifyReplay(replay, duration, score)) return Response.json({ error: "プレイ記録を検証できませんでした。", code: "REPLAY_REJECTED" }, { status: 400 });
  if (!process.env.DATABASE_URL) return unavailable();
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`INSERT INTO keeper_scores (run_id, player_name, duration, score) VALUES (${runId}, ${name}, ${duration}, ${score}) ON CONFLICT (run_id) DO UPDATE SET player_name = EXCLUDED.player_name WHERE keeper_scores.duration = EXCLUDED.duration AND keeper_scores.score = EXCLUDED.score RETURNING run_id`;
    return rows.length ? Response.json({ ok: true }) : Response.json({ error: "登録済みの記録と一致しません。" }, { status: 409 });
  } catch { return unavailable(); }
}
