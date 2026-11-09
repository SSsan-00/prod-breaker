import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
if (!process.env.DATABASE_URL) throw Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);
const statements = readFileSync(new URL("../db/leaderboard.sql", import.meta.url), "utf8").split(";").map((s) => s.trim()).filter(Boolean);
await sql.transaction(statements.map((statement) => sql.query(statement)));
console.log("KEEPER leaderboard migration complete; BREAKER records untouched.");
