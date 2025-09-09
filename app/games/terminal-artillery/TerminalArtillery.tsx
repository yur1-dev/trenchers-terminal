// ============================================================================
// games/TerminalArtillery.tsx (Simplified version)
// ============================================================================

import React, { useRef, useEffect, useState } from "react";

interface TerminalArtilleryProps {
  walletAddress: string;
  fullWalletAddress: string;
  tournament: any;
  onScoreSubmit: (score: number) => void;
  onBackToSelector: () => void;
}

const TerminalArtillery: React.FC<TerminalArtilleryProps> = ({
  walletAddress,
  fullWalletAddress,
  tournament,
  onScoreSubmit,
  onBackToSelector,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<"menu" | "playing" | "gameOver">(
    "menu"
  );
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);

  // Simple game loop
  useEffect(() => {
    if (gameState !== "playing") return;

    const gameLoop = setInterval(() => {
      // Simple score increment for demo
      setScore((prev) => prev + 10);
    }, 1000);

    return () => clearInterval(gameLoop);
  }, [gameState]);

  // Auto-submit score when game ends
  useEffect(() => {
    if (gameState === "gameOver") {
      onScoreSubmit(score);
    }
  }, [gameState, score, onScoreSubmit]);

  const startGame = () => {
    setGameState("playing");
    setScore(0);
    setLives(3);
  };

  const endGame = () => {
    setGameState("gameOver");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Header */}
      <div className="p-4 border-b border-gray-600 bg-gray-900">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-bold">TERMINAL_ARTILLERY</h1>
            <span className="text-cyan-400">W:{walletAddress}</span>
            {tournament && (
              <span className="text-yellow-400">
                T:{formatTime(tournament.timeLeft || 0)}
              </span>
            )}
          </div>
          <button
            onClick={onBackToSelector}
            className="text-red-400 hover:text-red-300 text-sm"
          >
            BACK TO LOBBY
          </button>
        </div>

        {gameState === "playing" && (
          <div className="flex space-x-4 mt-2 text-sm">
            <span>SCORE: {score.toLocaleString()}</span>
            <span>LIVES: {lives}</span>
          </div>
        )}
      </div>

      {/* Game Area */}
      <div className="flex-1 flex justify-center items-center p-8">
        <div className="text-center">
          {gameState === "menu" && (
            <div>
              <h2 className="text-4xl mb-8">TERMINAL ARTILLERY</h2>
              <button
                onClick={startGame}
                className="bg-white text-black px-8 py-4 font-bold hover:bg-gray-200"
              >
                START GAME
              </button>
            </div>
          )}

          {gameState === "playing" && (
            <div>
              <canvas
                ref={canvasRef}
                width={800}
                height={600}
                className="border-2 border-white bg-black mb-4"
              />
              <div className="space-x-4">
                <button
                  onClick={endGame}
                  className="bg-red-600 hover:bg-red-700 px-4 py-2 text-white font-bold"
                >
                  END GAME
                </button>
              </div>
            </div>
          )}

          {gameState === "gameOver" && (
            <div>
              <h2 className="text-4xl mb-4">GAME OVER</h2>
              <p className="text-xl mb-8">
                Final Score: {score.toLocaleString()}
              </p>
              <div className="space-x-4">
                <button
                  onClick={startGame}
                  className="bg-white text-black px-8 py-4 font-bold hover:bg-gray-200"
                >
                  PLAY AGAIN
                </button>
                <button
                  onClick={onBackToSelector}
                  className="bg-gray-600 hover:bg-gray-700 px-8 py-4 text-white font-bold"
                >
                  BACK TO LOBBY
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TerminalArtillery;
