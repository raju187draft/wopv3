"use client"

import type { MoveEvaluation } from "@/lib/backend/adaptive-ai"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

type MoveHistoryPanelProps = {
  moves: string[]
  evaluations: MoveEvaluation[]
  currentIndex: number
  playerColor: "w" | "b"
}

export function MoveHistoryPanel({ moves, evaluations, currentIndex, playerColor }: MoveHistoryPanelProps) {
  const pairs: { white: string; black?: string; whiteEval?: MoveEvaluation; blackEval?: MoveEvaluation }[] = []

  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      white: moves[i],
      black: moves[i + 1],
      whiteEval: evaluations[i],
      blackEval: evaluations[i + 1],
    })
  }

  const getEvalColor = (evalType?: string) => {
    if (!evalType) return ""
    switch (evalType) {
      case "brilliant":
        return "text-cyan-400"
      case "excellent":
        return "text-green-400"
      case "good":
        return "text-green-300"
      case "inaccuracy":
        return "text-yellow-400"
      case "mistake":
        return "text-orange-400"
      case "blunder":
        return "text-red-400"
      default:
        return ""
    }
  }

  return (
    <Card className="bg-card border-border h-full flex flex-col">
      <CardHeader className="py-1.5 px-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium">Move History</CardTitle>
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-mono">
            {playerColor === "w" ? "White" : "Black"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-2 flex-1 min-h-0 flex flex-col">
        <ScrollArea className="h-[180px]">
          {pairs.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-3">No moves yet</p>
          ) : (
            <div className="space-y-px pr-2">
              {pairs.map((pair, index) => (
                <div
                  key={index}
                  className="flex items-center text-[11px] font-mono py-0.5 hover:bg-secondary/30 rounded px-1"
                >
                  <span className="w-5 text-muted-foreground">{index + 1}.</span>
                  <span className={`w-12 ${getEvalColor(pair.whiteEval?.type)}`}>{pair.white}</span>
                  <span className={`w-12 ${getEvalColor(pair.blackEval?.type)}`}>{pair.black || ""}</span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
