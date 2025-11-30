import { saveGameStats, type GameStatsRecord } from "@/lib/backend/game-stats"

export async function POST(req: Request) {
  try {
    const stats: GameStatsRecord = await req.json()

    const result = await saveGameStats(stats)

    return Response.json({ success: true, data: result })
  } catch (error) {
    console.error("Error saving game stats:", error)
    return Response.json({ success: false, error: "Failed to save game stats" }, { status: 500 })
  }
}
