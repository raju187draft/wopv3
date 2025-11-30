// Backend utilities for game statistics
import { createClient } from "@/lib/supabase/server"

export type GameStatsRecord = {
  player_id: string
  player_elo: number
  result: "win" | "loss" | "draw"
  ai_elo: number
  total_moves: number
  game_duration_seconds?: number
  ams: number
  std_deviation: number
  avg_time_per_move?: number
  num_blunders: number
  num_mistakes: number
  num_inaccuracies: number
  num_good_moves: number
  num_excellent_moves: number
  num_brilliant_moves: number
  alml_scores: number[]
  avg_alml: number
}

export async function saveGameStats(stats: GameStatsRecord) {
  const supabase = await createClient()

  const { data, error } = await supabase.from("game_stats").insert(stats).select().single()

  if (error) {
    console.error("Error saving game stats:", error)
    throw error
  }

  return data
}

export async function getPlayerStats(playerId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("game_stats")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching player stats:", error)
    throw error
  }

  return data
}

export async function getPlayerHistory(playerId: string, limit = 10) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("game_stats")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("Error fetching player history:", error)
    throw error
  }

  return data
}
