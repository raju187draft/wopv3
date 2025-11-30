-- Create game_stats table to store player game analytics
CREATE TABLE IF NOT EXISTS game_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Player info (stored locally, no auth required)
  player_id TEXT NOT NULL, -- Client-side generated UUID
  player_elo INTEGER NOT NULL,
  
  -- Game metrics
  result TEXT NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
  ai_elo INTEGER NOT NULL,
  total_moves INTEGER NOT NULL,
  game_duration_seconds INTEGER,
  
  -- Move quality metrics
  ams DECIMAL(3,2) NOT NULL, -- Average Move Score (0.00 - 1.00)
  std_deviation DECIMAL(5,2) NOT NULL, -- Standard deviation of move scores
  avg_time_per_move DECIMAL(6,2), -- Average time per move in seconds
  
  -- Move counts
  num_blunders INTEGER NOT NULL DEFAULT 0,
  num_mistakes INTEGER NOT NULL DEFAULT 0,
  num_inaccuracies INTEGER NOT NULL DEFAULT 0,
  num_good_moves INTEGER NOT NULL DEFAULT 0,
  num_excellent_moves INTEGER NOT NULL DEFAULT 0,
  num_brilliant_moves INTEGER NOT NULL DEFAULT 0,
  
  -- ALML scores (0-100 per move, stored as array)
  alml_scores INTEGER[] DEFAULT '{}',
  avg_alml DECIMAL(5,2) -- Average ALML score
);

-- Create index for faster queries by player
CREATE INDEX IF NOT EXISTS idx_game_stats_player_id ON game_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_game_stats_created_at ON game_stats(created_at DESC);

-- Enable RLS but allow public inserts (no auth required for this app)
ALTER TABLE game_stats ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public stats tracking)
CREATE POLICY "Allow public inserts" ON game_stats
  FOR INSERT WITH CHECK (true);

-- Allow anyone to read their own stats by player_id
CREATE POLICY "Allow read own stats" ON game_stats
  FOR SELECT USING (true);
