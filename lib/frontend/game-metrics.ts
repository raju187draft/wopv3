// Frontend game metrics tracking
import { calculateAMS, calculateSTD, calculateALML } from "@/lib/backend/move-analysis"
import type { MoveEvaluation } from "@/lib/backend/adaptive-ai"

export type GameMetrics = {
  moveTypes: string[]
  almlScores: number[]
  moveTimes: number[] // in milliseconds
  startTime: number
}

export function createGameMetrics(): GameMetrics {
  return {
    moveTypes: [],
    almlScores: [],
    moveTimes: [],
    startTime: Date.now(),
  }
}

export function addMoveToMetrics(metrics: GameMetrics, evaluation: MoveEvaluation, moveTime: number): GameMetrics {
  return {
    ...metrics,
    moveTypes: [...metrics.moveTypes, evaluation.type],
    almlScores: [...metrics.almlScores, calculateALML(evaluation.centipawnLoss, evaluation.type)],
    moveTimes: [...metrics.moveTimes, moveTime],
  }
}

export function calculateFinalMetrics(metrics: GameMetrics) {
  const ams = calculateAMS(metrics.moveTypes)
  const std = calculateSTD(metrics.moveTypes)
  const avgTimePerMove =
    metrics.moveTimes.length > 0 ? metrics.moveTimes.reduce((a, b) => a + b, 0) / metrics.moveTimes.length / 1000 : 0
  const avgAlml =
    metrics.almlScores.length > 0 ? metrics.almlScores.reduce((a, b) => a + b, 0) / metrics.almlScores.length : 0
  const gameDuration = Math.round((Date.now() - metrics.startTime) / 1000)

  const numBlunders = metrics.moveTypes.filter((t) => t === "blunder").length
  const numMistakes = metrics.moveTypes.filter((t) => t === "mistake").length
  const numInaccuracies = metrics.moveTypes.filter((t) => t === "inaccuracy").length
  const numGoodMoves = metrics.moveTypes.filter((t) => t === "good").length
  const numExcellentMoves = metrics.moveTypes.filter((t) => t === "excellent").length
  const numBrilliantMoves = metrics.moveTypes.filter((t) => t === "brilliant").length

  return {
    ams,
    std_deviation: std,
    avg_time_per_move: Number(avgTimePerMove.toFixed(2)),
    avg_alml: Number(avgAlml.toFixed(2)),
    game_duration_seconds: gameDuration,
    total_moves: metrics.moveTypes.length,
    num_blunders: numBlunders,
    num_mistakes: numMistakes,
    num_inaccuracies: numInaccuracies,
    num_good_moves: numGoodMoves,
    num_excellent_moves: numExcellentMoves,
    num_brilliant_moves: numBrilliantMoves,
    alml_scores: metrics.almlScores,
  }
}

export function getAMSLabel(ams: number): string {
  if (ams >= 0.95) return "Excellent"
  if (ams >= 0.85) return "Great"
  if (ams >= 0.7) return "Good"
  if (ams >= 0.45) return "Inaccuracy"
  if (ams >= 0.2) return "Mistake"
  return "Blunder"
}
