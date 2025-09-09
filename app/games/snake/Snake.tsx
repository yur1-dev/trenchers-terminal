"use client"
import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"

interface SnakeProps {
  onBackToSelector: () => void
  walletConnected: boolean
  walletAddress: string
  fullWalletAddress: string
  onScoreSubmit: (score: number) => void
  tournamentMode: boolean
  tournamentData: any
}

interface Position {
  x: number
  y: number
}

interface Food {
  x: number
  y: number
  type: "normal" | "bonus" | "speed"
  value: number
}

const GRID_SIZE = 20
const CANVAS_WIDTH = 600
const CANVAS_HEIGHT = 400
const INITIAL_SPEED = 150

const Snake: React.FC<SnakeProps> = ({
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
  const lastTimeRef = useRef<number>(0)

  const [gameState, setGameState] = useState<"menu" | "playing" | "paused" | "gameOver">("menu")
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }])
  const [direction, setDirection] = useState<Position>({ x: 1, y: 0 })
  const [nextDirection, setNextDirection] = useState<Position>({ x: 1, y: 0 })
  const [food, setFood] = useState<Food>({ x: 15, y: 15, type: "normal", value: 10 })
  const [score, setScore] = useState(0)
  const [speed, setSpeed] = useState(INITIAL_SPEED)
  const [level, setLevel] = useState(1)

  // Generate random food position
  const generateFood = useCallback((currentSnake: Position[]): Food => {
    let newFood: Position
    do {
      newFood = {
        x: Math.floor(Math.random() * (CANVAS_WIDTH / GRID_SIZE)),
        y: Math.floor(Math.random() * (CANVAS_HEIGHT / GRID_SIZE)),
      }
    } while (currentSnake.some((segment) => segment.x === newFood.x && segment.y === newFood.y))

    // Random food types with different probabilities
    const rand = Math.random()
    let type: "normal" | "bonus" | "speed"
    let value: number

    if (rand < 0.7) {
      type = "normal"
      value = 10
    } else if (rand < 0.9) {
      type = "bonus"
      value = 50
    } else {
      type = "speed"
      value = 25
    }

    return { ...newFood, type, value }
  }, [])

  // Initialize game
  const initGame = useCallback(() => {
    const initialSnake = [{ x: 10, y: 10 }]
    setSnake(initialSnake)
    setDirection({ x: 1, y: 0 })
    setNextDirection({ x: 1, y: 0 })
    setFood(generateFood(initialSnake))
    setScore(0)
    setSpeed(INITIAL_SPEED)
    setLevel(1)
  }, [generateFood])

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameState === "playing") {
        switch (e.key.toLowerCase()) {
          case "w":
          case "arrowup":
            if (direction.y === 0) setNextDirection({ x: 0, y: -1 })
            break
          case "s":
          case "arrowdown":
            if (direction.y === 0) setNextDirection({ x: 0, y: 1 })
            break
          case "a":
          case "arrowleft":
            if (direction.x === 0) setNextDirection({ x: -1, y: 0 })
            break
          case "d":
          case "arrowright":
            if (direction.x === 0) setNextDirection({ x: 1, y: 0 })
            break
          case " ":
            e.preventDefault()
            setGameState("paused")
            break
        }
      } else if (gameState === "paused" && e.key === " ") {
        e.preventDefault()
        setGameState("playing")
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [gameState, direction])

  // Game logic
  const updateGame = useCallback(() => {
    setSnake((currentSnake) => {
      const newSnake = [...currentSnake]
      const head = { ...newSnake[0] }

      // Update direction
      setDirection(nextDirection)
      head.x += nextDirection.x
      head.y += nextDirection.y

      // Check wall collision
      if (head.x < 0 || head.x >= CANVAS_WIDTH / GRID_SIZE || head.y < 0 || head.y >= CANVAS_HEIGHT / GRID_SIZE) {
        setGameState("gameOver")
        return currentSnake
      }

      // Check self collision
      if (newSnake.some((segment) => segment.x === head.x && segment.y === head.y)) {
        setGameState("gameOver")
        return currentSnake
      }

      newSnake.unshift(head)

      // Check food collision
      if (head.x === food.x && head.y === food.y) {
        // Don't remove tail (snake grows)
        setScore((prev) => {
          const newScore = prev + food.value

          // Level up every 200 points
          const newLevel = Math.floor(newScore / 200) + 1
          if (newLevel > level) {
            setLevel(newLevel)
            setSpeed((prev) => Math.max(50, prev - 10)) // Increase speed
          }

          return newScore
        })

        // Handle special food effects
        if (food.type === "speed") {
          setSpeed((prev) => Math.max(50, prev - 20))
        }

        // Generate new food
        setFood(generateFood(newSnake))
      } else {
        // Remove tail (normal movement)
        newSnake.pop()
      }

      return newSnake
    })
  }, [nextDirection, food, level, generateFood])

  // Game loop
  useEffect(() => {
    if (gameState === "playing") {
      const gameLoop = (currentTime: number) => {
        if (currentTime - lastTimeRef.current >= speed) {
          updateGame()
          lastTimeRef.current = currentTime
        }
        gameLoopRef.current = requestAnimationFrame(gameLoop)
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }
  }, [gameState, speed, updateGame])

  // Handle game over
  useEffect(() => {
    if (gameState === "gameOver") {
      onScoreSubmit(score)
    }
  }, [gameState, score, onScoreSubmit])

  // Render game
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = "#000000"
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw grid
    ctx.strokeStyle = "#333333"
    ctx.lineWidth = 1
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CANVAS_HEIGHT)
      ctx.stroke()
    }
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(CANVAS_WIDTH, y)
      ctx.stroke()
    }

    // Draw snake
    snake.forEach((segment, index) => {
      if (index === 0) {
        // Head
        ctx.fillStyle = "#00ff00"
        ctx.fillRect(segment.x * GRID_SIZE + 1, segment.y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2)

        // Eyes
        ctx.fillStyle = "#ffffff"
        const eyeSize = 3
        const eyeOffset = 5
        if (direction.x === 1) {
          // Moving right
          ctx.fillRect(segment.x * GRID_SIZE + GRID_SIZE - eyeOffset, segment.y * GRID_SIZE + 4, eyeSize, eyeSize)
          ctx.fillRect(
            segment.x * GRID_SIZE + GRID_SIZE - eyeOffset,
            segment.y * GRID_SIZE + GRID_SIZE - 7,
            eyeSize,
            eyeSize,
          )
        } else if (direction.x === -1) {
          // Moving left
          ctx.fillRect(segment.x * GRID_SIZE + 2, segment.y * GRID_SIZE + 4, eyeSize, eyeSize)
          ctx.fillRect(segment.x * GRID_SIZE + 2, segment.y * GRID_SIZE + GRID_SIZE - 7, eyeSize, eyeSize)
        } else if (direction.y === -1) {
          // Moving up
          ctx.fillRect(segment.x * GRID_SIZE + 4, segment.y * GRID_SIZE + 2, eyeSize, eyeSize)
          ctx.fillRect(segment.x * GRID_SIZE + GRID_SIZE - 7, segment.y * GRID_SIZE + 2, eyeSize, eyeSize)
        } else {
          // Moving down
          ctx.fillRect(segment.x * GRID_SIZE + 4, segment.y * GRID_SIZE + GRID_SIZE - eyeOffset, eyeSize, eyeSize)
          ctx.fillRect(
            segment.x * GRID_SIZE + GRID_SIZE - 7,
            segment.y * GRID_SIZE + GRID_SIZE - eyeOffset,
            eyeSize,
            eyeSize,
          )
        }
      } else {
        // Body
        const alpha = Math.max(0.3, 1 - index * 0.05)
        ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`
        ctx.fillRect(segment.x * GRID_SIZE + 2, segment.y * GRID_SIZE + 2, GRID_SIZE - 4, GRID_SIZE - 4)
      }
    })

    // Draw food
    const foodColors = {
      normal: "#ff0000",
      bonus: "#ffff00",
      speed: "#ff00ff",
    }

    ctx.fillStyle = foodColors[food.type]
    ctx.fillRect(food.x * GRID_SIZE + 2, food.y * GRID_SIZE + 2, GRID_SIZE - 4, GRID_SIZE - 4)

    // Add food type indicator
    if (food.type !== "normal") {
      ctx.fillStyle = "#ffffff"
      ctx.font = "12px monospace"
      ctx.textAlign = "center"
      const text = food.type === "bonus" ? "$" : "⚡"
      ctx.fillText(text, food.x * GRID_SIZE + GRID_SIZE / 2, food.y * GRID_SIZE + GRID_SIZE / 2 + 4)
    }

    // Draw game over overlay
    if (gameState === "gameOver") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      ctx.fillStyle = "#ff0000"
      ctx.font = "bold 36px monospace"
      ctx.textAlign = "center"
      ctx.fillText("GAME OVER", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20)

      ctx.fillStyle = "#ffffff"
      ctx.font = "18px monospace"
      ctx.fillText(`Final Score: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)
    }

    // Draw pause overlay
    if (gameState === "paused") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)"
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      ctx.fillStyle = "#ffff00"
      ctx.font = "bold 36px monospace"
      ctx.textAlign = "center"
      ctx.fillText("PAUSED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)

      ctx.fillStyle = "#ffffff"
      ctx.font = "14px monospace"
      ctx.fillText("Press SPACE to continue", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30)
    }
  }, [snake, food, direction, gameState, score])

  const startGame = () => {
    initGame()
    setGameState("playing")
  }

  const pauseGame = () => {
    setGameState(gameState === "paused" ? "playing" : "paused")
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-700 flex items-center justify-center text-white font-mono">
      <div className="text-center p-8 rounded-lg bg-black bg-opacity-50 border border-green-400">
        <div className="text-6xl mb-4">🐍</div>
        <h1 className="text-4xl font-bold mb-4 text-green-400">DATA SNAKE</h1>

        {tournamentMode && (
          <div className="mb-6 p-4 bg-green-900 bg-opacity-30 border border-green-400">
            <div className="text-green-400 font-bold">TOURNAMENT MODE</div>
            <div className="text-sm text-gray-300">Time: {tournamentData?.timeLeft || 0}s remaining</div>
            <div className="text-sm text-gray-300">Player: {walletAddress}</div>
          </div>
        )}

        {gameState === "menu" && (
          <div className="space-y-4">
            <p className="text-xl mb-8 text-gray-300">Consume data packets to grow!</p>

            <div className="text-sm text-gray-400 mb-6">
              <div className="mb-2">Controls:</div>
              <div>WASD or Arrow Keys - Move</div>
              <div>SPACE - Pause/Resume</div>
            </div>

            <button
              onClick={startGame}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded mr-4"
            >
              START GAME
            </button>

            <button
              onClick={onBackToSelector}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-8 rounded"
            >
              BACK TO SELECTOR
            </button>
          </div>
        )}

        {(gameState === "playing" || gameState === "paused" || gameState === "gameOver") && (
          <div className="space-y-4">
            {/* Game Stats */}
            <div className="flex justify-between items-center text-sm mb-4">
              <div>Score: {score}</div>
              <div>Level: {level}</div>
              <div>Length: {snake.length}</div>
            </div>

            {/* Game Canvas */}
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="border-2 border-green-400 bg-black"
            />

            {/* Game Controls */}
            <div className="flex justify-center space-x-4 mt-4">
              {gameState === "playing" && (
                <button
                  onClick={pauseGame}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded"
                >
                  PAUSE
                </button>
              )}

              {gameState === "paused" && (
                <button
                  onClick={pauseGame}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                >
                  RESUME
                </button>
              )}

              {gameState === "gameOver" && (
                <>
                  <button
                    onClick={startGame}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                  >
                    PLAY AGAIN
                  </button>
                </>
              )}

              <button
                onClick={onBackToSelector}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
              >
                BACK TO SELECTOR
              </button>
            </div>

            {/* Food Legend */}
            <div className="text-xs text-gray-400 mt-4">
              <div className="flex justify-center space-x-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 mr-1"></div>
                  <span>Normal (+10)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-yellow-500 mr-1"></div>
                  <span>Bonus (+50)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-purple-500 mr-1"></div>
                  <span>Speed (+25)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Snake
