"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Undo2, ArrowRight } from "lucide-react"
import type { Square } from "@/lib/chess-engine"

type BlunderAlertProps = {
  open: boolean
  evaluationType: "blunder" | "mistake" | string
  bestMove: { from: Square; to: Square } | null
  onUndo: () => void
  onDismiss: () => void
}

export function BlunderAlert({ open, evaluationType, bestMove, onUndo, onDismiss }: BlunderAlertProps) {
  const isBlunder = evaluationType === "blunder"

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
      <DialogContent className="sm:max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className={`w-6 h-6 ${isBlunder ? "text-red-500" : "text-orange-500"}`} />
            <span className={isBlunder ? "text-red-500" : "text-orange-500"}>
              {isBlunder ? "Blunder!" : "Mistake!"}
            </span>
          </DialogTitle>
          <DialogDescription>
            {isBlunder ? "That move significantly weakens your position." : "That move loses some advantage."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {bestMove && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Best Move Was:</div>
              <div className="flex items-center gap-2 text-lg font-mono font-bold text-green-500">
                {bestMove.from}
                <ArrowRight className="w-4 h-4" />
                {bestMove.to}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={onUndo} variant="default" className="flex-1">
              <Undo2 className="w-4 h-4 mr-2" />
              Undo & Try Again
            </Button>
            <Button onClick={onDismiss} variant="outline" className="flex-1 bg-transparent">
              Continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
