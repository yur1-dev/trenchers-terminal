// app/games/flappy-bird/FlappyBird.tsx
"use client";
import React from "react";

interface FlappyBirdProps {
  onBackToSelector: () => void;
  walletConnected: boolean;
  walletAddress: string;
  fullWalletAddress: string;
  onScoreSubmit: (score: number) => void;
  tournamentMode: boolean;
  tournamentData: any;
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
  const handleDemoScore = () => {
    const randomScore = Math.floor(Math.random() * 1000) + 100;
    onScoreSubmit(randomScore);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-400 to-blue-600 flex items-center justify-center text-white font-mono">
      <div className="text-center p-8 rounded-lg bg-black bg-opacity-50 border border-blue-400">
        <div className="text-6xl mb-4">🐦</div>
        <h1 className="text-4xl font-bold mb-4 text-yellow-400">FLAPPY BIRD</h1>
        <p className="text-xl mb-8 text-gray-300">Coming Soon...</p>

        {tournamentMode && (
          <div className="mb-6 p-4 bg-yellow-900 bg-opacity-30 border border-yellow-400">
            <div className="text-yellow-400 font-bold">TOURNAMENT MODE</div>
            <div className="text-sm text-gray-300">
              Time: {tournamentData?.timeLeft || 0}s remaining
            </div>
            <div className="text-sm text-gray-300">Player: {walletAddress}</div>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleDemoScore}
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-6 mr-4"
          >
            SUBMIT DEMO SCORE
          </button>

          <button
            onClick={onBackToSelector}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6"
          >
            BACK TO SELECTOR
          </button>
        </div>

        <div className="mt-6 text-sm text-gray-400">
          <p>This is a placeholder component.</p>
          <p>The actual Flappy Bird game will be implemented here.</p>
        </div>
      </div>
    </div>
  );
};

export default FlappyBird;
