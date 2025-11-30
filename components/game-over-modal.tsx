"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Trophy, Frown, Minus, RotateCcw } from "lucide-react"
import type { PlayerStats } from "@/lib/backend/adaptive-ai"
import type { GameMetrics } from "@/lib/frontend/game-metrics"
import { calculateFinalMetrics, getAMSLabel } from "@/lib/frontend/game-metrics"

type GameOverModalProps = {
  open: boolean
  result: "win" | "loss" | "draw" | null
  playerStats: PlayerStats | null
  aiElo: number
  gameMetrics: GameMetrics
  onNewGame: () => void
  onClose: () => void
}

export function GameOverModal({
  open,
  result,
  playerStats,
  aiElo,
  gameMetrics,
  onNewGame,
  onClose,
}: GameOverModalProps) {
  if (!result) return null

  const metrics = calculateFinalMetrics(gameMetrics)

  const getResultIcon = () => {
    switch (result) {
      case "win":
        return <Trophy className="w-12 h-12 text-yellow-500" />
      case "loss":
        return <Frown className="w-12 h-12 text-red-500" />
      case "draw":
        return <Minus className="w-12 h-12 text-muted-foreground" />
    }
  }

  const getResultText = () => {
    switch (result) {
      case "win":
        return "Victory!"
      case "loss":
        return "Defeat"
      case "draw":
        return "Draw"
    }
  }

  const getResultColor = () => {
    switch (result) {
      case "win":
        return "text-yellow-500"
      case "loss":
        return "text-red-500"
      case "draw":
        return "text-muted-foreground"
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex flex-col items-center gap-3 text-center">
            {getResultIcon()}
            <span className={`text-3xl font-bold ${getResultColor()}`}>{getResultText()}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Player vs AI */}
          <div className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Your ELO</div>
              <div className="text-xl font-bold font-mono text-primary">{playerStats?.skillRating || 1000}</div>
            </div>
            <div className="text-muted-foreground text-lg">vs</div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground">AI ELO</div>
              <div className="text-xl font-bold font-mono">{aiElo}</div>
            </div>
          </div>

          {/* Game Statistics */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Game Statistics</h3>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 bg-secondary/20 rounded">
                <div className="text-xs text-muted-foreground">AMS (Avg Move Score)</div>
                <div className="font-mono font-bold">
                  {metrics.ams.toFixed(2)} - {getAMSLabel(metrics.ams)}
                </div>
              </div>
              <div className="p-2 bg-secondary/20 rounded">
                <div className="text-xs text-muted-foreground">Avg ALML Score</div>
                <div className="font-mono font-bold">{metrics.avg_alml.toFixed(0)}/100</div>
              </div>
              <div className="p-2 bg-secondary/20 rounded">
                <div className="text-xs text-muted-foreground">Std Deviation</div>
                <div className="font-mono font-bold">{metrics.std_deviation.toFixed(2)}</div>
              </div>
              <div className="p-2 bg-secondary/20 rounded">
                <div className="text-xs text-muted-foreground">Avg Time/Move</div>
                <div className="font-mono font-bold">{metrics.avg_time_per_move.toFixed(1)}s</div>
              </div>
            </div>

            {/* Move Quality Breakdown */}
            <div className="p-3 bg-secondary/20 rounded space-y-2">
              <div className="text-xs text-muted-foreground mb-2">Move Quality</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-green-500">Excellent:</span>
                  <span className="font-mono">{metrics.num_excellent_moves}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-500">Good:</span>
                  <span className="font-mono">{metrics.num_good_moves}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-yellow-500">Inaccurate:</span>
                  <span className="font-mono">{metrics.num_inaccuracies}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-orange-500">Mistakes:</span>
                  <span className="font-mono">{metrics.num_mistakes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-500">Blunders:</span>
                  <span className="font-mono">{metrics.num_blunders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-mono">{metrics.total_moves}</span>
                </div>
              </div>
            </div>
          </div>

          <Button onClick={onNewGame} className="w-full" size="lg">
            <RotateCcw className="w-4 h-4 mr-2" />
            Play Again
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
