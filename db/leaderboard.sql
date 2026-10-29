-- Run once in the Neon SQL Editor before enabling the leaderboard.
CREATE TABLE IF NOT EXISTS leaderboard_scores (
  run_id uuid PRIMARY KEY,
  player_name varchar(20) NOT NULL,
  duration integer NOT NULL CHECK (duration IN (90, 180, 300, 1800)),
  score bigint NOT NULL CHECK (score >= 0 AND score <= 1000000000000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leaderboard_scores_ranking_idx
  ON leaderboard_scores (duration, score DESC, created_at ASC);
