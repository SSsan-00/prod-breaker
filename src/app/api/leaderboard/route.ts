import { neon } from "@neondatabase/serverless";
import { durations, validName } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";
const available = () => process.env.DATABASE_URL;
const validDuration = (value: unknown): value is number => typeof value === "number" && durations.some((d) => d === value);
const unavailable = () => Response.json({ error: "スコアボードは現在利用できません。" }, { status: 503 });

export async function GET(request: Request) {
  const duration = Number(new URL(request.url).searchParams.get("duration"));
  if (!validDuration(duration)) return Response.json({ error: "不正なモードです。" }, { status: 400 });
  const url = available();
  if (!url) return unavailable();
  try {
    const sql = neon(url);
    const rows = await sql`SELECT player_name, score, created_at FROM leaderboard_scores WHERE duration = ${duration} ORDER BY score DESC, created_at ASC LIMIT 30`;
    return Response.json({ scores: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch { return unavailable(); }
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 2048) return Response.json({ error: "リクエストが大きすぎます。" }, { status: 413 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "不正なリクエストです。" }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "不正なリクエストです。" }, { status: 400 });
  const { name, duration, score, runId } = body as Record<string, unknown>;
  if (!validName(name) || !validDuration(duration) || typeof score !== "number" || !Number.isSafeInteger(score) || score < 0 || score > 1_000_000_000_000 || typeof runId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId))
    return Response.json({ error: "入力内容を確認してください。" }, { status: 400 });
  const url = available();
  if (!url) return unavailable();
  try {
    const sql = neon(url);
    await sql`INSERT INTO leaderboard_scores (run_id, player_name, duration, score) VALUES (${runId}, ${name}, ${duration}, ${score}) ON CONFLICT (run_id) DO NOTHING`;
    return Response.json({ ok: true });
  } catch { return unavailable(); }
}
