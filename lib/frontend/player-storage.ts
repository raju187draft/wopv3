// Frontend utilities for localStorage player data
import { v4 as uuidv4 } from "uuid"

export type StoredPlayerData = {
  playerId: string
  selectedElo: number
  hasSelectedElo: boolean
  lastGameState?: {
    gameHistory: string[] // FEN strings
    moveNotations: string[]
    playerColor: "w" | "b"
    currentDifficulty: number
    historyIndex: number
  }
  playerStats: {
    gamesPlayed: number
    wins: number
    losses: number
    draws: number
    blunders: number
    mistakes: number
    inaccuracies: number
    goodMoves: number
    excellentMoves: number
    brilliantMoves: number
    averageAccuracy: number
    currentStreak: number
    skillRating: number
    tacticsScore: number
    positionScore: number
    endgameScore: number
    totalCentipawnLoss: number
    totalMovesAnalyzed: number
  } | null
}

const STORAGE_KEY = "chessmind_player_data"

export function getPlayerId(): string {
  const data = getStoredPlayerData()
  if (data?.playerId) return data.playerId

  const newId = uuidv4()
  saveStoredPlayerData({ ...getDefaultPlayerData(), playerId: newId })
  return newId
}

export function getDefaultPlayerData(): StoredPlayerData {
  return {
    playerId: uuidv4(),
    selectedElo: 1000,
    hasSelectedElo: false,
    playerStats: null,
  }
}

export function getStoredPlayerData(): StoredPlayerData | null {
  if (typeof window === "undefined") return null

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored)
  } catch {
    return null
  }
}

export function saveStoredPlayerData(data: StoredPlayerData): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function hasSelectedElo(): boolean {
  const data = getStoredPlayerData()
  return data?.hasSelectedElo ?? false
}

export function setHasSelectedElo(elo: number): void {
  const data = getStoredPlayerData() || getDefaultPlayerData()
  data.hasSelectedElo = true
  data.selectedElo = elo
  saveStoredPlayerData(data)
}

export function saveGameState(gameState: StoredPlayerData["lastGameState"]): void {
  const data = getStoredPlayerData() || getDefaultPlayerData()
  data.lastGameState = gameState
  saveStoredPlayerData(data)
}

export function clearLastGameState(): void {
  const data = getStoredPlayerData()
  if (data) {
    data.lastGameState = undefined
    saveStoredPlayerData(data)
  }
}

export function getLastGameState(): StoredPlayerData["lastGameState"] | null {
  const data = getStoredPlayerData()
  return data?.lastGameState ?? null
}

export function updatePlayerStats(stats: StoredPlayerData["playerStats"]): void {
  const data = getStoredPlayerData() || getDefaultPlayerData()
  data.playerStats = stats
  saveStoredPlayerData(data)
}
