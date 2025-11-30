import { analyzeMove, calculateALML, type MoveAnalysisInput } from "@/lib/backend/move-analysis"
import { gameStateToFEN, type GameState } from "@/lib/chess-engine"
import type { MoveEvaluation } from "@/lib/backend/adaptive-ai"

export const maxDuration = 30

export async function POST(req: Request) {
  const {
    gameState,
    evaluation,
    moveHistory,
    playerStats,
  }: {
    gameState: GameState
    evaluation: MoveEvaluation
    moveHistory: string[]
    playerStats: { skillRating: number; averageAccuracy: number } | null
  } = await req.json()

  const fen = gameStateToFEN(gameState)

  const input: MoveAnalysisInput = {
    fen,
    moveFrom: evaluation.from,
    moveTo: evaluation.to,
    moveType: evaluation.type,
    centipawnLoss: evaluation.centipawnLoss || 0,
    bestMoveFrom: evaluation.bestMove?.from,
    bestMoveTo: evaluation.bestMove?.to,
    moveHistory,
    playerElo: playerStats?.skillRating || 1000,
    playerAccuracy: playerStats?.averageAccuracy || 70,
  }

  try {
    const result = await analyzeMove(input)

    return Response.json({
      analysis: result.analysis,
      almlScore: result.almlScore,
      moveScore: calculateALML(evaluation.centipawnLoss || 0, evaluation.type) / 100,
    })
  } catch (error) {
    console.error("AI analysis error:", error)
    const almlScore = calculateALML(evaluation.centipawnLoss || 0, evaluation.type)
    return Response.json({
      analysis: getFallbackAnalysis(evaluation),
      almlScore,
      moveScore: almlScore / 100,
    })
  }
}

function getFallbackAnalysis(evaluation: MoveEvaluation): string {
  const cpLoss = evaluation.centipawnLoss || 0

  switch (evaluation.type) {
    case "brilliant":
      return "Brilliant! You found an exceptional move that significantly improves your position."
    case "excellent":
      return "Excellent move! You're playing with great precision and understanding."
    case "good":
      return "Solid move. Keep up the good play!"
    case "inaccuracy":
      return `Small inaccuracy (${cpLoss}cp loss). ${evaluation.bestMove ? `${evaluation.bestMove.from}-${evaluation.bestMove.to} would give you a slightly better position.` : "Look for more active moves."}`
    case "mistake":
      return `That's a mistake (${cpLoss}cp loss). ${evaluation.bestMove ? `${evaluation.bestMove.from}-${evaluation.bestMove.to} was stronger.` : ""} Think about piece activity and king safety!`
    case "blunder":
      return `Significant error (${cpLoss}cp loss)! ${evaluation.bestMove ? `${evaluation.bestMove.from}-${evaluation.bestMove.to} was much better.` : ""} Take your time and check for tactics before moving.`
    default:
      return "Interesting move. Let's see how the game develops."
  }
}
