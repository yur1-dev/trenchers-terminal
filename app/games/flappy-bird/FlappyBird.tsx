"use client"
import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"

interface FlappyBirdProps {
  onBackToSelector?: () => void
  walletConnected: boolean
  walletAddress: string
  fullWalletAddress: string
  onScoreSubmit: (score: number) => void
  tournamentMode: boolean
  tournamentData: any
}

interface Bird {
  x: number
  y: number
  velocity: number
}

interface Pipe {
  x: number
  topHeight: number
  bottomY: number
  passed: boolean
}

interface LeaderboardEntry {
  id: string
  wallet_address: string
  username: string
  score: number
  rank: number
  timestamp: string
}

const FlappyBird: React.FC<FlappyBirdProps> = ({
  onBackToSelector,
  walletConnected,
  walletAddress,
  fullWalletAddress,
  onScoreSubmit,
  tournamentMode,
  tournamentData,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<number>()
  const birdRef = useRef<Bird>({ x: 150, y: 300, velocity: 0 })
  const pipesRef = useRef<Pipe[]>([])
  const gameStateRef = useRef<"menu" | "playing" | "gameOver">("menu")
  const scoreRef = useRef(0)

  const [gameState, setGameState] = useState<"menu" | "playing" | "gameOver">("menu")
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  // Game constants
  const CANVAS_WIDTH = 800
  const CANVAS_HEIGHT = 600
  const BIRD_SIZE = 30
  const PIPE_WIDTH = 80
  const PIPE_GAP = 200
  const GRAVITY = 0.6
  const JUMP_FORCE = -12
  const PIPE_SPEED = 3

  // Game state
  const [bird, setBird] = useState<Bird>({ x: 150, y: 300, velocity: 0 })
  const [pipes, setPipes] = useState<Pipe[]>([])

  useEffect(() => {
    birdRef.current = bird
  }, [bird])

  useEffect(() => {
    pipesRef.current = pipes
  }, [pipes])

  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  useEffect(() => {
    scoreRef.current = score
  }, [score])

  const fetchLeaderboard = useCallback(async () => {
    if (!tournamentData?.id) return

    try {
      const response = await fetch(`/api/leaderboard?sessionId=${tournamentData.id}&limit=10`)
      const data = await response.json()

      if (data.success && data.leaderboard) {
        setLeaderboard(data.leaderboard)
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error)
    }
  }, [tournamentData?.id])

  useEffect(() => {
    if (tournamentMode && tournamentData?.id) {
      fetchLeaderboard()
      const interval = setInterval(fetchLeaderboard, 30000)
      return () => clearInterval(interval)
    }
  }, [tournamentMode, fetchLeaderboard])

  // Initialize game
  const initGame = useCallback(() => {
    const newBird = { x: 150, y: 300, velocity: 0 }
    setBird(newBird)
    birdRef.current = newBird
    setPipes([])
    pipesRef.current = []
    setScore(0)
    scoreRef.current = 0
    setGameState("menu")
    gameStateRef.current = "menu"
  }, [])

  // Start game
  const startGame = useCallback(() => {
    const newBird = { x: 150, y: 300, velocity: 0 }
    const newPipes = [
      {
        x: CANVAS_WIDTH,
        topHeight: Math.random() * (CANVAS_HEIGHT - PIPE_GAP - 100) + 50,
        bottomY: 0,
        passed: false,
      },
    ]
    newPipes[0].bottomY = newPipes[0].topHeight + PIPE_GAP

    setBird(newBird)
    birdRef.current = newBird
    setPipes(newPipes)
    pipesRef.current = newPipes
    setScore(0)
    scoreRef.current = 0
    setGameState("playing")
    gameStateRef.current = "playing"
  }, [])

  const jump = useCallback(() => {
    console.log("[v0] Jump called, current game state:", gameStateRef.current)

    if (gameStateRef.current === "menu") {
      console.log("[v0] Starting game from menu")
      startGame()
    } else if (gameStateRef.current === "playing") {
      console.log("[v0] Bird jumping, current velocity:", birdRef.current.velocity)
      const newBird = { ...birdRef.current, velocity: JUMP_FORCE }
      setBird(newBird)
      birdRef.current = newBird
    } else if (gameStateRef.current === "gameOver") {
      console.log("[v0] Restarting game from game over")
      initGame()
    }
  }, [startGame, initGame])

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      console.log("[v0] Key pressed:", e.code)
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault()
        jump()
      }
    }

    const handleClick = () => {
      console.log("[v0] Canvas clicked")
      jump()
    }

    window.addEventListener("keydown", handleKeyPress)
    const canvas = canvasRef.current
    if (canvas) {
      canvas.addEventListener("click", handleClick)
    }

    return () => {
      window.removeEventListener("keydown", handleKeyPress)
      if (canvas) {
        canvas.removeEventListener("click", handleClick)
      }
    }
  }, [jump])

  useEffect(() => {
    if (gameStateRef.current !== "playing") return

    const gameLoop = () => {
      // Update bird using refs
      const currentBird = birdRef.current
      const newBird = {
        ...currentBird,
        y: currentBird.y + currentBird.velocity,
        velocity: currentBird.velocity + GRAVITY,
      }

      setBird(newBird)
      birdRef.current = newBird

      // Check ground and ceiling collision
      if (newBird.y <= 0 || newBird.y >= CANVAS_HEIGHT - BIRD_SIZE) {
        console.log("[v0] Bird hit ground/ceiling, game over")
        setGameState("gameOver")
        gameStateRef.current = "gameOver"
        if (scoreRef.current > highScore) {
          setHighScore(scoreRef.current)
        }
        onScoreSubmit(scoreRef.current)
        return
      }

      // Update pipes using refs
      const currentPipes = pipesRef.current
      let newPipes = currentPipes.map((pipe) => ({ ...pipe, x: pipe.x - PIPE_SPEED }))

      // Remove pipes that are off screen
      newPipes = newPipes.filter((pipe) => pipe.x > -PIPE_WIDTH)

      // Add new pipe when needed
      const lastPipe = newPipes[newPipes.length - 1]
      if (!lastPipe || lastPipe.x < CANVAS_WIDTH - 300) {
        const topHeight = Math.random() * (CANVAS_HEIGHT - PIPE_GAP - 100) + 50
        newPipes.push({
          x: CANVAS_WIDTH,
          topHeight,
          bottomY: topHeight + PIPE_GAP,
          passed: false,
        })
      }

      // Check pipe collision and scoring
      newPipes.forEach((pipe) => {
        // Check if bird passed pipe for scoring
        if (!pipe.passed && newBird.x > pipe.x + PIPE_WIDTH) {
          pipe.passed = true
          const newScore = scoreRef.current + 1
          setScore(newScore)
          scoreRef.current = newScore
          console.log("[v0] Score increased to:", newScore)
        }

        // Check collision with pipes
        if (
          newBird.x < pipe.x + PIPE_WIDTH &&
          newBird.x + BIRD_SIZE > pipe.x &&
          (newBird.y < pipe.topHeight || newBird.y + BIRD_SIZE > pipe.bottomY)
        ) {
          console.log("[v0] Bird hit pipe, game over")
          setGameState("gameOver")
          gameStateRef.current = "gameOver"
          if (scoreRef.current > highScore) {
            setHighScore(scoreRef.current)
          }
          onScoreSubmit(scoreRef.current)
          return
        }
      })

      setPipes(newPipes)
      pipesRef.current = newPipes

      if (gameStateRef.current === "playing") {
        gameLoopRef.current = requestAnimationFrame(gameLoop)
      }
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop)

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }
  }, [gameState, highScore, onScoreSubmit])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas with black background
    ctx.fillStyle = "#000000"
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw grid pattern for terminal effect
    ctx.strokeStyle = "#333333"
    ctx.lineWidth = 1
    for (let x = 0; x < CANVAS_WIDTH; x += 50) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CANVAS_HEIGHT)
      ctx.stroke()
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += 50) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(CANVAS_WIDTH, y)
      ctx.stroke()
    }

    // Draw pipes in terminal green
    ctx.fillStyle = "#00ff00"
    pipes.forEach((pipe) => {
      // Top pipe
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight)
      // Bottom pipe
      ctx.fillRect(pipe.x, pipe.bottomY, PIPE_WIDTH, CANVAS_HEIGHT - pipe.bottomY)

      // Pipe caps with brighter green
      ctx.fillStyle = "#44ff44"
      ctx.fillRect(pipe.x - 5, pipe.topHeight - 30, PIPE_WIDTH + 10, 30)
      ctx.fillRect(pipe.x - 5, pipe.bottomY, PIPE_WIDTH + 10, 30)
      ctx.fillStyle = "#00ff00"
    })

    // Draw bird in terminal cyan
    ctx.fillStyle = "#00ffff"
    ctx.beginPath()
    ctx.arc(bird.x + BIRD_SIZE / 2, bird.y + BIRD_SIZE / 2, BIRD_SIZE / 2, 0, Math.PI * 2)
    ctx.fill()

    // Bird eye
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.arc(bird.x + BIRD_SIZE / 2 + 5, bird.y + BIRD_SIZE / 2 - 5, 3, 0, Math.PI * 2)
    ctx.fill()

    // Bird beak in yellow
    ctx.fillStyle = "#ffff00"
    ctx.beginPath()
    ctx.moveTo(bird.x + BIRD_SIZE, bird.y + BIRD_SIZE / 2)
    ctx.lineTo(bird.x + BIRD_SIZE + 10, bird.y + BIRD_SIZE / 2 - 3)
    ctx.lineTo(bird.x + BIRD_SIZE + 10, bird.y + BIRD_SIZE / 2 + 3)
    ctx.fill()

    // Draw ground in gray
    ctx.fillStyle = "#666666"
    ctx.fillRect(0, CANVAS_HEIGHT - 20, CANVAS_WIDTH, 20)

    // Draw score with terminal styling
    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 36px 'Courier New', monospace"
    ctx.textAlign = "center"
    ctx.strokeStyle = "#00ffff"
    ctx.lineWidth = 2
    ctx.strokeText(score.toString(), CANVAS_WIDTH / 2, 60)
    ctx.fillText(score.toString(), CANVAS_WIDTH / 2, 60)
  })

  return (
    <div className="min-h-screen bg-black flex font-mono text-white" style={{ fontFamily: "Courier New, monospace" }}>
      {/* Game Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {tournamentMode && (
          <div className="mb-4 p-4 bg-gray-900 border border-cyan-400 rounded">
            <div className="text-cyan-400 font-bold text-center">&gt; CYBER_BIRD_TOURNAMENT.EXE</div>
            <div className="text-sm text-gray-300 text-center">
              TIME_LEFT: {tournamentData?.timeLeft || 0}s | PLAYER: {walletAddress}
            </div>
          </div>
        )}

        <div className="relative">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onClick={jump}
            className="border-2 border-white cursor-pointer bg-black"
            style={{ imageRendering: "pixelated" }}
          />

          {gameState === "menu" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80">
              <div className="text-center p-8 bg-gray-900 border border-cyan-400 text-white rounded">
                <h1 className="text-4xl font-bold mb-4 text-cyan-400" style={{ textShadow: "0 0 10px #00ffff" }}>
                  &gt; CYBER_BIRD.EXE
                </h1>
                <p className="text-lg mb-4 text-gray-300">[SPACE] OR [CLICK] TO START</p>
                <p className="text-sm text-yellow-400">HIGH_SCORE: {highScore}</p>
              </div>
            </div>
          )}

          {gameState === "gameOver" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80">
              <div className="text-center p-8 bg-gray-900 border border-red-400 text-white rounded">
                <h2 className="text-3xl font-bold mb-4 text-red-400">&gt; SYSTEM_CRASH</h2>
                <p className="text-xl mb-2 text-white">FINAL_SCORE: {score}</p>
                <p className="text-lg mb-4 text-yellow-400">HIGH_SCORE: {highScore}</p>
                <p className="text-sm mb-4 text-gray-300">[SPACE] OR [CLICK] TO RESTART</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-sm text-gray-400">
          <p>&gt; CONTROLS: [SPACE] OR [MOUSE_CLICK] TO JUMP</p>
          <p>&gt; OBJECTIVE: AVOID GREEN BARRIERS AND MAXIMIZE SCORE</p>
        </div>
      </div>

      <div className="w-80 bg-gray-900 border-l border-gray-600 p-4 overflow-y-auto">
        <div className="mb-6">
          <h3 className="text-cyan-400 font-bold mb-4 text-center" style={{ textShadow: "0 0 5px #00ffff" }}>
            &gt; LEADERBOARD.DAT
          </h3>

          {tournamentMode && (
            <div className="mb-4 p-3 bg-black border border-yellow-400 rounded">
              <div className="text-yellow-400 text-sm font-bold mb-1">&gt; TOURNAMENT_STATUS:</div>
              <div className="text-white text-xs">SESSION: {tournamentData?.id?.slice(-8) || "N/A"}</div>
              <div className="text-white text-xs">PRIZE_POOL: ${tournamentData?.prize_pool || 0}</div>
              <div className="text-white text-xs">PLAYERS: {tournamentData?.players || 0}</div>
            </div>
          )}

          <div className="space-y-2">
            {leaderboard.length > 0 ? (
              leaderboard.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`p-2 rounded border ${
                    entry.wallet_address === fullWalletAddress
                      ? "bg-cyan-900 border-cyan-400 text-cyan-400"
                      : "bg-gray-800 border-gray-600 text-gray-300"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span className="text-yellow-400 font-bold">#{entry.rank}</span>
                      <span className="text-xs">
                        {entry.wallet_address === fullWalletAddress
                          ? "YOU"
                          : `${entry.wallet_address.slice(0, 4)}...${entry.wallet_address.slice(-4)}`}
                      </span>
                    </div>
                    <span className="font-bold text-white">{entry.score}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{new Date(entry.timestamp).toLocaleTimeString()}</div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-8">
                <div className="text-sm">&gt; NO_SCORES_RECORDED</div>
                <div className="text-xs mt-2">BE THE FIRST TO SCORE!</div>
              </div>
            )}
          </div>

          <div className="mt-6 p-3 bg-black border border-gray-600 rounded">
            <div className="text-green-400 text-sm font-bold mb-2">&gt; YOUR_STATS:</div>
            <div className="text-xs text-gray-300">
              <div>CURRENT_SCORE: {score}</div>
              <div>HIGH_SCORE: {highScore}</div>
              <div>STATUS: {gameState.toUpperCase()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FlappyBird
