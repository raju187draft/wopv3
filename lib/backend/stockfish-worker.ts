// Stockfish NNUE WebWorker Service
// This service manages communication with the Stockfish WASM engine

export type StockfishMessage = {
  type: "bestmove" | "info" | "ready" | "error"
  data: string
  evaluation?: number
  depth?: number
  bestMove?: string
  ponder?: string
}

export type StockfishOptions = {
  depth?: number
  movetime?: number
  skillLevel?: number // 0-20
}

class StockfishService {
  private worker: Worker | null = null
  private isReady = false
  private messageCallbacks: Map<string, (msg: StockfishMessage) => void> = new Map()
  private readyPromise: Promise<void> | null = null
  private readyResolve: (() => void) | null = null

  async initialize(): Promise<void> {
    if (this.worker && this.isReady) return

    // Create a promise that resolves when the engine is ready
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve
    })

    return new Promise((resolve, reject) => {
      try {
        // Use the stockfish.js WASM version via CDN for browser compatibility
        const workerCode = `
          importScripts('https://unpkg.com/stockfish@16.0.0/src/stockfish-nnue-16.js');

          let engine = null;

          // The WASM module will set up Stockfish
          if (typeof Stockfish === 'function') {
            Stockfish().then((sf) => {
              engine = sf;
              engine.addMessageListener((msg) => {
                postMessage({ type: 'message', data: msg });
              });
              postMessage({ type: 'ready' });
            });
          }

          onmessage = function(e) {
            if (engine && e.data) {
              engine.postMessage(e.data);
            }
          };
        `

        const blob = new Blob([workerCode], { type: "application/javascript" })
        this.worker = new Worker(URL.createObjectURL(blob))

        this.worker.onmessage = (e) => {
          if (e.data.type === "ready") {
            this.isReady = true
            if (this.readyResolve) this.readyResolve()
            resolve()
          } else if (e.data.type === "message") {
            this.handleEngineMessage(e.data.data)
          }
        }

        this.worker.onerror = (error) => {
          console.error("[v0] Stockfish worker error:", error)
          reject(error)
        }

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!this.isReady) {
            reject(new Error("Stockfish initialization timeout"))
          }
        }, 10000)
      } catch (error) {
        reject(error)
      }
    })
  }

  private handleEngineMessage(message: string) {
    // Parse UCI protocol messages
    if (message.startsWith("bestmove")) {
      const parts = message.split(" ")
      const bestMove = parts[1]
      const ponder = parts[3]

      this.notifyCallbacks({
        type: "bestmove",
        data: message,
        bestMove,
        ponder,
      })
    } else if (message.startsWith("info")) {
      // Parse evaluation info
      const depthMatch = message.match(/depth (\d+)/)
      const scoreMatch = message.match(/score cp (-?\d+)/)
      const mateMatch = message.match(/score mate (-?\d+)/)

      let evaluation: number | undefined
      if (scoreMatch) {
        evaluation = Number.parseInt(scoreMatch[1]) / 100 // Convert centipawns to pawns
      } else if (mateMatch) {
        const mateIn = Number.parseInt(mateMatch[1])
        evaluation = mateIn > 0 ? 100 : -100 // Represent mate as +/- 100
      }

      this.notifyCallbacks({
        type: "info",
        data: message,
        depth: depthMatch ? Number.parseInt(depthMatch[1]) : undefined,
        evaluation,
      })
    }
  }

  private notifyCallbacks(msg: StockfishMessage) {
    this.messageCallbacks.forEach((callback) => callback(msg))
  }

  onMessage(id: string, callback: (msg: StockfishMessage) => void) {
    this.messageCallbacks.set(id, callback)
    return () => this.messageCallbacks.delete(id)
  }

  private send(command: string) {
    if (this.worker && this.isReady) {
      this.worker.postMessage(command)
    }
  }

  setPosition(fen: string) {
    this.send("ucinewgame")
    this.send(`position fen ${fen}`)
  }

  setSkillLevel(level: number) {
    // Stockfish skill level 0-20 (0 = weakest, 20 = strongest)
    const skillLevel = Math.max(0, Math.min(20, level))
    this.send(`setoption name Skill Level value ${skillLevel}`)
  }

  async getBestMove(fen: string, options: StockfishOptions = {}): Promise<string> {
    await this.readyPromise

    return new Promise((resolve) => {
      const callbackId = `bestmove_${Date.now()}`

      const cleanup = this.onMessage(callbackId, (msg) => {
        if (msg.type === "bestmove" && msg.bestMove) {
          cleanup()
          resolve(msg.bestMove)
        }
      })

      // Set skill level if provided
      if (options.skillLevel !== undefined) {
        this.setSkillLevel(options.skillLevel)
      }

      this.setPosition(fen)

      // Build the go command
      let goCommand = "go"
      if (options.depth) {
        goCommand += ` depth ${options.depth}`
      } else if (options.movetime) {
        goCommand += ` movetime ${options.movetime}`
      } else {
        goCommand += " depth 15" // Default depth
      }

      this.send(goCommand)

      // Timeout after 30 seconds
      setTimeout(() => {
        cleanup()
        resolve("")
      }, 30000)
    })
  }

  async evaluatePosition(fen: string, depth = 15): Promise<number> {
    await this.readyPromise

    return new Promise((resolve) => {
      const callbackId = `eval_${Date.now()}`
      let lastEval = 0
      let targetDepthReached = false

      const cleanup = this.onMessage(callbackId, (msg) => {
        if (msg.type === "info" && msg.evaluation !== undefined) {
          lastEval = msg.evaluation
          if (msg.depth && msg.depth >= depth) {
            targetDepthReached = true
          }
        }
        if (msg.type === "bestmove") {
          cleanup()
          resolve(lastEval)
        }
      })

      this.setPosition(fen)
      this.send(`go depth ${depth}`)

      // Timeout after 10 seconds
      setTimeout(() => {
        cleanup()
        resolve(lastEval)
      }, 10000)
    })
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
      this.isReady = false
    }
    this.messageCallbacks.clear()
  }
}

// Singleton instance
let stockfishInstance: StockfishService | null = null

export function getStockfishService(): StockfishService {
  if (!stockfishInstance) {
    stockfishInstance = new StockfishService()
  }
  return stockfishInstance
}

// Convert UCI move (e2e4) to from/to squares
export function parseUCIMove(uciMove: string): { from: string; to: string; promotion?: string } | null {
  if (!uciMove || uciMove.length < 4) return null

  const from = uciMove.slice(0, 2)
  const to = uciMove.slice(2, 4)
  const promotion = uciMove.length > 4 ? uciMove[4] : undefined

  return { from, to, promotion }
}

// Convert difficulty level (1-10) to Stockfish skill level (0-20)
export function difficultyToStockfishSkill(difficulty: number): number {
  // Map 1-10 to 0-20
  // Level 1 = Skill 0 (weakest)
  // Level 10 = Skill 20 (strongest)
  return Math.round((difficulty - 1) * (20 / 9))
}
