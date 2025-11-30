"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { ChessBoard } from "./chess-board"
import { MoveHistoryPanel } from "./move-history-panel"
import { AIFeedback } from "./ai-feedback"
import { GameSetupModal } from "./game-setup-modal"
import { GameOverModal } from "./game-over-modal"
import { EvaluationBar } from "./evaluation-bar"
import { GameControls } from "./game-controls"
import { BlunderAlert } from "./blunder-alert"
import {
  type GameState,
  createInitialState,
  makeMove,
  getValidMoves,
  moveToAlgebraic,
  type Square,
  gameStateToFEN,
  fenToGameState,
} from "@/lib/chess-engine"
import {
  type DifficultyLevel,
  type PlayerStats,
  createDefaultStats,
  evaluatePlayerMove,
  updateStatsAfterMove,
  updateStatsAfterGame,
  type MoveEvaluation,
  evaluatePosition,
} from "@/lib/backend/adaptive-ai"
import { eloToDifficulty, getAdaptiveDifficulty, STOCKFISH_LEVELS } from "@/lib/backend/stockfish-eval"
import { Button } from "@/components/ui/button"
import {
  getStoredPlayerData,
  saveStoredPlayerData,
  getDefaultPlayerData,
  hasSelectedElo,
  setHasSelectedElo,
  saveGameState as saveGameStateToStorage,
  clearLastGameState,
  getLastGameState,
  getPlayerId,
} from "@/lib/frontend/player-storage"
import {
  createGameMetrics,
  addMoveToMetrics,
  calculateFinalMetrics,
  type GameMetrics,
} from "@/lib/frontend/game-metrics"

export function ChessGame() {
  const [gameState, setGameState] = useState<GameState>(createInitialState())
  const [gameHistory, setGameHistory] = useState<GameState[]>([createInitialState()])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [validMoves, setValidMoves] = useState<Square[]>([])
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null)
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [moveNotations, setMoveNotations] = useState<string[]>([])
  const [currentEvaluation, setCurrentEvaluation] = useState<MoveEvaluation | null>(null)
  const [gameEvaluations, setGameEvaluations] = useState<MoveEvaluation[]>([])
  const [aiAnalysis, setAIAnalysis] = useState<string>("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const [playerColor, setPlayerColor] = useState<"w" | "b">("w")
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [currentDifficulty, setCurrentDifficulty] = useState<DifficultyLevel>(5)
  const [positionEval, setPositionEval] = useState<number>(0)

  const [showGameOverModal, setShowGameOverModal] = useState(false)
  const [gameResult, setGameResult] = useState<"win" | "loss" | "draw" | null>(null)

  const [showBlunderAlert, setShowBlunderAlert] = useState(false)
  const [blunderBestMove, setBlunderBestMove] = useState<{ from: Square; to: Square } | null>(null)
  const [blunderUndoIndex, setBlunderUndoIndex] = useState<number | null>(null)

  const [gameMetrics, setGameMetrics] = useState<GameMetrics>(createGameMetrics())
  const lastMoveTime = useRef<number>(Date.now())

  const [hasInitialElo, setHasInitialElo] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  const aiMoveInProgress = useRef(false)
  const gameEndedRef = useRef(false)
  const waitingForBlunderDecision = useRef(false)

  useEffect(() => {
    const stored = getStoredPlayerData()
    const hasElo = hasSelectedElo()
    setHasInitialElo(hasElo)

    if (stored?.playerStats) {
      setPlayerStats(stored.playerStats)
    }

    const lastGame = getLastGameState()
    if (lastGame && hasElo) {
      try {
        const lastFen = lastGame.gameHistory[lastGame.historyIndex]
        if (lastFen) {
          const resumedState = fenToGameState(lastFen)
          if (resumedState) {
            const rebuiltHistory: GameState[] = []
            for (const fen of lastGame.gameHistory) {
              const state = fenToGameState(fen)
              if (state) rebuiltHistory.push(state)
            }

            if (rebuiltHistory.length > 0) {
              setGameHistory(rebuiltHistory)
              setGameState(rebuiltHistory[lastGame.historyIndex] || rebuiltHistory[rebuiltHistory.length - 1])
              setHistoryIndex(lastGame.historyIndex)
              setMoveNotations(lastGame.moveNotations)
              setPlayerColor(lastGame.playerColor)
              setCurrentDifficulty(lastGame.currentDifficulty as DifficultyLevel)
              setGameStarted(true)
              setIsInitialized(true)
              return
            }
          }
        }
      } catch (e) {
        console.error("Failed to resume game:", e)
        clearLastGameState()
      }
    }

    if (!hasElo) {
      setShowSetupModal(true)
    }

    setIsInitialized(true)
  }, [])

  useEffect(() => {
    if (!gameStarted || !isInitialized) return
    if (gameState.isCheckmate || gameState.isStalemate || gameState.isDraw) return

    const fens = gameHistory.map((state) => gameStateToFEN(state))
    saveGameStateToStorage({
      gameHistory: fens,
      moveNotations,
      playerColor,
      currentDifficulty,
      historyIndex,
    })
  }, [gameHistory, moveNotations, playerColor, currentDifficulty, historyIndex, gameStarted, isInitialized, gameState])

  useEffect(() => {
    if (playerStats && isInitialized) {
      const data = getStoredPlayerData() || getDefaultPlayerData()
      data.playerStats = playerStats
      saveStoredPlayerData(data)
    }
  }, [playerStats, isInitialized])

  useEffect(() => {
    setPositionEval(evaluatePosition(gameState))
  }, [gameState])

  useEffect(() => {
    if (!playerStats) return
    if (!gameStarted) return
    if (gameEndedRef.current) return

    const isGameOver = gameState.isCheckmate || gameState.isStalemate || gameState.isDraw
    if (!isGameOver) return

    gameEndedRef.current = true

    let result: "win" | "loss" | "draw"
    if (gameState.isCheckmate) {
      result = gameState.turn === playerColor ? "loss" : "win"
    } else {
      result = "draw"
    }

    setGameResult(result)
    setShowGameOverModal(true)

    const updatedStats = updateStatsAfterGame(playerStats, result, currentDifficulty)
    setPlayerStats(updatedStats)

    clearLastGameState()

    const finalMetrics = calculateFinalMetrics(gameMetrics)
    const playerId = getPlayerId()
    const aiElo = STOCKFISH_LEVELS[currentDifficulty]?.elo || 1000

    fetch("/api/save-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        player_id: playerId,
        player_elo: playerStats.skillRating,
        result,
        ai_elo: aiElo,
        total_moves: finalMetrics.total_moves,
        game_duration_seconds: finalMetrics.game_duration_seconds,
        ams: finalMetrics.ams,
        std_deviation: finalMetrics.std_deviation,
        avg_time_per_move: finalMetrics.avg_time_per_move,
        num_blunders: finalMetrics.num_blunders,
        num_mistakes: finalMetrics.num_mistakes,
        num_inaccuracies: finalMetrics.num_inaccuracies,
        num_good_moves: finalMetrics.num_good_moves,
        num_excellent_moves: finalMetrics.num_excellent_moves,
        num_brilliant_moves: finalMetrics.num_brilliant_moves,
        alml_scores: finalMetrics.alml_scores,
        avg_alml: finalMetrics.avg_alml,
      }),
    }).catch(console.error)
  }, [
    gameState.isCheckmate,
    gameState.isStalemate,
    gameState.isDraw,
    gameState.turn,
    playerColor,
    currentDifficulty,
    playerStats,
    gameStarted,
    gameMetrics,
  ])

  const requestAIAnalysis = async (state: GameState, evaluation: MoveEvaluation) => {
    if (evaluation.type === "good" || evaluation.type === "excellent") return

    setIsAnalyzing(true)
    try {
      const response = await fetch("/api/analyze-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameState: state,
          evaluation,
          moveHistory: moveNotations,
          playerStats: playerStats
            ? { skillRating: playerStats.skillRating, averageAccuracy: playerStats.averageAccuracy }
            : null,
        }),
      })
      const data = await response.json()
      setAIAnalysis(data.analysis)
    } catch (error) {
      console.error("Failed to get AI analysis:", error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleBlunderUndo = useCallback(() => {
    if (blunderUndoIndex !== null && blunderUndoIndex >= 0) {
      // Go back to the position before the blunder
      setHistoryIndex(blunderUndoIndex)
      setGameState(gameHistory[blunderUndoIndex])
      // Remove the blunder move from notations
      setMoveNotations((prev) => prev.slice(0, blunderUndoIndex))
      // Also remove from game evaluations
      setGameEvaluations((prev) => prev.slice(0, -1))
      setSelectedSquare(null)
      setValidMoves([])
      setLastMove(null)
      setShowBlunderAlert(false)
      setBlunderBestMove(null)
      setBlunderUndoIndex(null)
      waitingForBlunderDecision.current = false
      // Reset the game history to remove the blunder move
      setGameHistory((prev) => prev.slice(0, blunderUndoIndex + 1))
    }
  }, [blunderUndoIndex, gameHistory])

  const handleDismissBlunder = useCallback(() => {
    setShowBlunderAlert(false)
    setBlunderBestMove(null)
    setBlunderUndoIndex(null)
    waitingForBlunderDecision.current = false
  }, [])

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (!gameStarted || !playerStats) return
      if (gameState.turn !== playerColor) return
      if (isThinking) return
      if (gameState.isCheckmate || gameState.isStalemate || gameState.isDraw) return
      if (showBlunderAlert) return

      const [row, col] = [8 - Number.parseInt(square[1]), square.charCodeAt(0) - 97]
      const clickedPiece = gameState.board[row]?.[col]

      if (selectedSquare) {
        if (clickedPiece && clickedPiece.color === playerColor) {
          setSelectedSquare(square)
          setValidMoves(getValidMoves(gameState, square))
          return
        }

        if (validMoves.includes(square)) {
          const stateBefore = gameState
          const indexBeforeMove = historyIndex
          const newState = makeMove(gameState, selectedSquare, square)

          if (newState) {
            const moveTime = Date.now() - lastMoveTime.current
            lastMoveTime.current = Date.now()

            const evaluation = evaluatePlayerMove(stateBefore, selectedSquare, square)
            setCurrentEvaluation(evaluation)
            setGameEvaluations((prev) => [...prev, evaluation])
            setPlayerStats((prev) => (prev ? updateStatsAfterMove(prev, evaluation) : prev))

            setGameMetrics((prev) => addMoveToMetrics(prev, evaluation, moveTime))

            if (evaluation.type === "blunder" || evaluation.type === "mistake") {
              // Apply the move first
              setGameState(newState)
              setGameHistory((prev) => [...prev.slice(0, historyIndex + 1), newState])
              setHistoryIndex((prev) => prev + 1)
              setLastMove({ from: selectedSquare, to: square })
              const notation = moveToAlgebraic(stateBefore, newState.history[newState.history.length - 1])
              setMoveNotations((prev) => [...prev, notation])

              setBlunderUndoIndex(indexBeforeMove)
              waitingForBlunderDecision.current = true

              if (evaluation.bestMove) {
                setBlunderBestMove(evaluation.bestMove)
              }
              setShowBlunderAlert(true)
              requestAIAnalysis(stateBefore, evaluation)
            } else {
              if (evaluation.type !== "good" && evaluation.type !== "excellent") {
                requestAIAnalysis(stateBefore, evaluation)
              } else {
                setAIAnalysis("")
              }

              setGameState(newState)
              setGameHistory((prev) => [...prev.slice(0, historyIndex + 1), newState])
              setHistoryIndex((prev) => prev + 1)
              setLastMove({ from: selectedSquare, to: square })
              const notation = moveToAlgebraic(stateBefore, newState.history[newState.history.length - 1])
              setMoveNotations((prev) => [...prev, notation])

              const newDifficulty = getAdaptiveDifficulty(
                eloToDifficulty(playerStats.skillRating),
                playerStats,
                gameEvaluations,
              ) as DifficultyLevel
              setCurrentDifficulty(newDifficulty)
            }
          }
        }

        setSelectedSquare(null)
        setValidMoves([])
      } else {
        if (clickedPiece && clickedPiece.color === playerColor) {
          setSelectedSquare(square)
          setValidMoves(getValidMoves(gameState, square))
        }
      }
    },
    [
      gameState,
      selectedSquare,
      validMoves,
      gameStarted,
      playerColor,
      isThinking,
      playerStats,
      gameEvaluations,
      historyIndex,
      showBlunderAlert,
    ],
  )

  const handleStartGame = (color: "w" | "b", initialElo: number) => {
    if (!hasInitialElo) {
      setHasSelectedElo(initialElo)
      setHasInitialElo(true)
    }

    const stats = playerStats || createDefaultStats(initialElo)
    setPlayerStats(stats)
    setPlayerColor(color)
    const difficulty = eloToDifficulty(stats.skillRating) as DifficultyLevel
    setCurrentDifficulty(difficulty)

    const initialState = createInitialState()
    setGameState(initialState)
    setGameHistory([initialState])
    setHistoryIndex(0)
    setSelectedSquare(null)
    setValidMoves([])
    setLastMove(null)
    setMoveNotations([])
    setCurrentEvaluation(null)
    setGameEvaluations([])
    setAIAnalysis("")
    setShowSetupModal(false)
    setShowGameOverModal(false)
    setGameResult(null)
    setShowBlunderAlert(false)
    setBlunderBestMove(null)
    setBlunderUndoIndex(null)
    waitingForBlunderDecision.current = false
    setGameMetrics(createGameMetrics())
    lastMoveTime.current = Date.now()
    gameEndedRef.current = false
    aiMoveInProgress.current = false
    setGameStarted(true)
  }

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = Math.max(0, historyIndex - 2)
      setHistoryIndex(newIndex)
      setGameState(gameHistory[newIndex])
      setMoveNotations((prev) => prev.slice(0, newIndex))
      setSelectedSquare(null)
      setValidMoves([])
      setLastMove(null)
    }
  }

  const handleRedo = () => {
    if (historyIndex < gameHistory.length - 1) {
      const newIndex = Math.min(gameHistory.length - 1, historyIndex + 2)
      setHistoryIndex(newIndex)
      setGameState(gameHistory[newIndex])
    }
  }

  const handleCopyPGN = () => {
    const pairs: string[] = []
    for (let i = 0; i < moveNotations.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1
      const white = moveNotations[i]
      const black = moveNotations[i + 1] || ""
      pairs.push(`${moveNum}. ${white} ${black}`)
    }
    navigator.clipboard.writeText(pairs.join(" "))
  }

  const handleNewGame = () => {
    setShowSetupModal(true)
  }

  const handleCloseSetupModal = () => {
    if (hasInitialElo) {
      setShowSetupModal(false)
    }
  }

  const isFirstGame = !hasInitialElo
  const aiElo = STOCKFISH_LEVELS[currentDifficulty]?.elo || 1000

  if (!isInitialized) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen bg-background overflow-hidden flex flex-col">
      <GameSetupModal
        open={showSetupModal}
        onStartGame={handleStartGame}
        onClose={handleCloseSetupModal}
        isFirstGame={isFirstGame}
        currentElo={playerStats?.skillRating || 1000}
      />

      <GameOverModal
        open={showGameOverModal}
        result={gameResult}
        playerStats={playerStats}
        aiElo={aiElo}
        gameMetrics={gameMetrics}
        onNewGame={() => {
          setShowGameOverModal(false)
          setShowSetupModal(true)
        }}
        onClose={() => setShowGameOverModal(false)}
      />

      <BlunderAlert
        open={showBlunderAlert}
        evaluationType={currentEvaluation?.type || "blunder"}
        bestMove={blunderBestMove}
        onUndo={handleBlunderUndo}
        onDismiss={handleDismissBlunder}
      />

      {/* Compact Header */}
      <header className="flex-shrink-0 h-12 px-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
            C
          </div>
          <span className="font-bold text-foreground">ChessMind AI</span>
        </div>

        {gameStarted && playerStats ? (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              ELO: <span className="font-mono font-bold text-primary">{playerStats.skillRating}</span>
            </span>
            <span className="text-muted-foreground">
              vs AI: <span className="font-mono">~{aiElo}</span>
            </span>
            <span className="text-muted-foreground">
              Lv: <span className="font-bold">{currentDifficulty}</span>
            </span>
          </div>
        ) : (
          <Button size="sm" onClick={() => setShowSetupModal(true)} className="h-7 px-3 text-xs">
            Start Game
          </Button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 flex">
        {/* Left: Evaluation Bar */}
        <div className="flex-shrink-0 w-8 p-1 flex items-stretch">
          <EvaluationBar evaluation={positionEval} playerColor={playerColor} />
        </div>

        {/* Center: Chess Board */}
        <div className="flex-shrink-0 p-2 flex items-center justify-center">
          <ChessBoard
            gameState={gameState}
            selectedSquare={selectedSquare}
            validMoves={validMoves}
            lastMove={lastMove}
            onSquareClick={handleSquareClick}
            flipped={playerColor === "b"}
            isThinking={isThinking}
            playerColor={playerColor}
            highlightSquares={blunderBestMove ? [blunderBestMove.from, blunderBestMove.to] : undefined}
          />
        </div>

        {/* Right: Sidebar */}
        <div className="flex-1 min-w-0 flex flex-col p-2 gap-2 max-w-sm">
          {/* Player Info Cards */}
          {playerStats && (
            <div className="flex-shrink-0 space-y-1.5">
              <div className="flex items-center justify-between p-2 rounded bg-card border border-border text-xs">
                <span className="text-muted-foreground">You:</span>
                <span className="font-mono font-bold text-primary">{playerStats.skillRating}</span>
                <span className="text-muted-foreground">Lv.{currentDifficulty}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-card border border-border text-xs">
                <span className="text-muted-foreground">AI:</span>
                <span className="font-mono">~{aiElo}</span>
                <span className="text-muted-foreground">Lv.{currentDifficulty}</span>
              </div>
            </div>
          )}

          {/* AI Feedback */}
          <div className="flex-shrink-0">
            <AIFeedback
              evaluation={currentEvaluation}
              analysis={aiAnalysis}
              isAnalyzing={isAnalyzing}
              isThinking={isThinking}
            />
          </div>

          {/* Move History - takes remaining space */}
          <div className="flex-1 min-h-0">
            <MoveHistoryPanel
              moves={moveNotations}
              evaluations={gameEvaluations}
              currentIndex={historyIndex}
              playerColor={playerColor}
            />
          </div>

          {/* Game Controls */}
          <div className="flex-shrink-0">
            <GameControls
              onUndo={handleUndo}
              onRedo={handleRedo}
              onCopyPGN={handleCopyPGN}
              onNewGame={handleNewGame}
              canUndo={historyIndex > 0}
              canRedo={historyIndex < gameHistory.length - 1}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
