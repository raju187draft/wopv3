// Backend move analysis utilities
import { GoogleGenAI } from "@google/genai"

export type MoveAnalysisInput = {
  fen: string
  moveFrom: string
  moveTo: string
  moveType: string
  centipawnLoss: number
  bestMoveFrom?: string
  bestMoveTo?: string
  moveHistory: string[]
  playerElo: number
  playerAccuracy: number
}

export type MoveAnalysisResult = {
  analysis: string
  almlScore: number // 0-100 rating for the move
}

// AMS scoring based on move type
export function getMoveScore(moveType: string): number {
  switch (moveType) {
    case "brilliant":
    case "excellent":
      return 1.0
    case "good":
      return 0.9
    case "inaccuracy":
      return 0.5
    case "mistake":
      return 0.25
    case "blunder":
      return 0.0
    default:
      return 0.75
  }
}

// Calculate Average Move Score from evaluations
export function calculateAMS(moveTypes: string[]): number {
  if (moveTypes.length === 0) return 0
  const total = moveTypes.reduce((sum, type) => sum + getMoveScore(type), 0)
  return Number((total / moveTypes.length).toFixed(2))
}

// Calculate standard deviation of move scores
export function calculateSTD(moveTypes: string[]): number {
  if (moveTypes.length === 0) return 0
  const scores = moveTypes.map(getMoveScore)
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  const squaredDiffs = scores.map((score) => Math.pow(score - mean, 2))
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / scores.length
  return Number(Math.sqrt(avgSquaredDiff).toFixed(2))
}

// Convert centipawn loss to ALML score (0-100)
export function calculateALML(centipawnLoss: number, moveType: string): number {
  // ALML: 100 = perfect move, 0 = catastrophic blunder
  if (moveType === "brilliant" || moveType === "excellent") return 100
  if (moveType === "good") return 90

  // For other moves, calculate based on centipawn loss
  // 0cp = 100, 50cp = 75, 100cp = 50, 200cp = 25, 300+cp = 0
  const score = Math.max(0, 100 - centipawnLoss / 3)
  return Math.round(score)
}

export async function analyzeMove(input: MoveAnalysisInput): Promise<MoveAnalysisResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

  const prompt = `You are a chess coach analyzing a player's move. Be encouraging but honest.

Current position (FEN): ${input.fen}
Move played: ${input.moveFrom} to ${input.moveTo}
Move evaluation: ${input.moveType}
Centipawn loss: ${input.centipawnLoss} cp
${input.bestMoveFrom ? `Better move was: ${input.bestMoveFrom} to ${input.bestMoveTo}` : ""}
Recent moves: ${input.moveHistory.slice(-10).join(", ") || "Game just started"}
Player ELO rating: ~${input.playerElo}
Player accuracy this game: ${input.playerAccuracy}%

Provide a brief, helpful comment (2-3 sentences max) about this move:
- If it's a blunder/mistake: Explain WHY it's bad and what tactical/strategic element they missed
- If it's an inaccuracy: Gently point out the better continuation
- If it's good/excellent/brilliant: Encourage them and explain what made it strong
- If there's a tactical theme (fork, pin, skewer, discovered attack, etc.), mention it
- Tailor your language to their skill level (simpler for lower ELO, more technical for higher)
- Be conversational and supportive, like a friendly coach

Response (keep it short and helpful):`

  try {
    const { text } = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      maxOutputTokens: 300,
      temperature: 0.7,
    })

    const almlScore = calculateALML(input.centipawnLoss, input.moveType)

    return {
      analysis: text || getFallbackAnalysis(input.moveType, input.centipawnLoss, input.bestMoveFrom, input.bestMoveTo),
      almlScore,
    }
  } catch (error) {
    console.error("AI analysis error:", error)
    return {
      analysis: getFallbackAnalysis(input.moveType, input.centipawnLoss, input.bestMoveFrom, input.bestMoveTo),
      almlScore: calculateALML(input.centipawnLoss, input.moveType),
    }
  }
}

function getFallbackAnalysis(moveType: string, cpLoss: number, bestFrom?: string, bestTo?: string): string {
  switch (moveType) {
    case "brilliant":
      return "Brilliant! You found an exceptional move that significantly improves your position."
    case "excellent":
      return "Excellent move! You're playing with great precision and understanding."
    case "good":
      return "Solid move. Keep up the good play!"
    case "inaccuracy":
      return `Small inaccuracy (${cpLoss}cp loss). ${bestFrom && bestTo ? `${bestFrom}-${bestTo} would give you a slightly better position.` : "Look for more active moves."}`
    case "mistake":
      return `That's a mistake (${cpLoss}cp loss). ${bestFrom && bestTo ? `${bestFrom}-${bestTo} was stronger.` : ""} Think about piece activity and king safety!`
    case "blunder":
      return `Significant error (${cpLoss}cp loss)! ${bestFrom && bestTo ? `${bestFrom}-${bestTo} was much better.` : ""} Take your time and check for tactics before moving.`
    default:
      return "Interesting move. Let's see how the game develops."
  }
}
