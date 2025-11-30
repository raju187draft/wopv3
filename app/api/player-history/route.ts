import { getPlayerHistory } from "@/lib/backend/game-stats"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const playerId = searchParams.get("playerId")
  const limit = Number.parseInt(searchParams.get("limit") || "10")

  if (!playerId) {
    return Response.json({ success: false, error: "Player ID required" }, { status: 400 })
  }

  try {
    const history = await getPlayerHistory(playerId, limit)
    return Response.json({ success: true, data: history })
  } catch (error) {
    console.error("Error fetching player history:", error)
    return Response.json({ success: false, error: "Failed to fetch player history" }, { status: 500 })
  }
}
