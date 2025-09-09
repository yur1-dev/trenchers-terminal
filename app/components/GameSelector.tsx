// components/GameSelector.tsx - Enhanced with auto game switching
import React, { useState, useEffect, useCallback } from "react";

interface GameSelectorProps {
  walletAddress: string;
  tournament: any;
  onGameSelect: (gameType: string) => void;
  onDisconnectWallet: () => void;
}

const GameSelector: React.FC<GameSelectorProps> = ({
  walletAddress,
  tournament,
  onGameSelect,
  onDisconnectWallet,
}) => {
  const [currentGameIndex, setCurrentGameIndex] = useState(0);
  const [timeUntilSwitch, setTimeUntilSwitch] = useState(0);
  const [autoSwitchEnabled, setAutoSwitchEnabled] = useState(true);

  const games = [
    {
      id: "terminal-artillery",
      name: "TERMINAL ARTILLERY",
      emoji: "🎯",
      description: "Ballistic warfare in cyberspace",
      status: "available",
    },
    {
      id: "flappy-bird",
      name: "CYBER BIRD",
      emoji: "🐦",
      description: "Navigate through digital obstacles",
      status: "available",
    },
    {
      id: "snake",
      name: "DATA SNAKE",
      emoji: "🐍",
      description: "Consume data packets to grow",
      status: "available",
    },
  ];

  // Calculate when the next game switch should happen
  const calculateSwitchTime = useCallback(() => {
    if (!tournament?.timeLeft) return 0;

    // Games rotate every 10 minutes (600 seconds)
    const gameRotationInterval = 600;
    const elapsedTime = 1800 - tournament.timeLeft; // 30min total - time left
    const timeInCurrentRotation = elapsedTime % gameRotationInterval;

    return gameRotationInterval - timeInCurrentRotation;
  }, [tournament]);

  // Determine which game should be active based on time
  const getCurrentGameIndex = useCallback(() => {
    if (!tournament?.timeLeft) return 0;

    const gameRotationInterval = 600; // 10 minutes per game
    const elapsedTime = 1800 - tournament.timeLeft;
    const rotationNumber = Math.floor(elapsedTime / gameRotationInterval);

    return rotationNumber % games.length;
  }, [tournament, games.length]);

  // Update game rotation and countdown
  useEffect(() => {
    if (!tournament || !autoSwitchEnabled) return;

    const interval = setInterval(() => {
      const newGameIndex = getCurrentGameIndex();
      const switchTime = calculateSwitchTime();

      setCurrentGameIndex(newGameIndex);
      setTimeUntilSwitch(switchTime);

      // Auto-switch if we're in a game and it's time to switch
      if (newGameIndex !== currentGameIndex) {
        console.log(`Auto-switching to game: ${games[newGameIndex].name}`);
        // You could automatically call onGameSelect here if desired
        // onGameSelect(games[newGameIndex].id);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [
    tournament,
    autoSwitchEnabled,
    getCurrentGameIndex,
    calculateSwitchTime,
    currentGameIndex,
    games,
    onGameSelect,
  ]);

  // Initialize on mount
  useEffect(() => {
    if (tournament) {
      const gameIndex = getCurrentGameIndex();
      const switchTime = calculateSwitchTime();
      setCurrentGameIndex(gameIndex);
      setTimeUntilSwitch(switchTime);
    }
  }, [tournament, getCurrentGameIndex, calculateSwitchTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleGameSelect = (gameId: string) => {
    onGameSelect(gameId);
  };

  const handleAutoSwitch = () => {
    if (tournament) {
      const activeGame = games[currentGameIndex];
      onGameSelect(activeGame.id);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">TOURNAMENT LOBBY</h1>
          <p className="text-gray-400">Wallet: {walletAddress}</p>
        </div>
        <button
          onClick={onDisconnectWallet}
          className="bg-red-600 hover:bg-red-700 px-4 py-2 text-white font-bold rounded"
        >
          DISCONNECT
        </button>
      </div>

      {/* Tournament Status with Game Rotation */}
      <div className="bg-gray-900 border border-gray-600 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">TOURNAMENT STATUS</h2>
        {tournament ? (
          <div className="space-y-2">
            <p className="text-green-400">Tournament Active: {tournament.id}</p>
            <p className="text-gray-400">
              Total Time Left: {formatTime(tournament.timeLeft)}
            </p>

            {/* Game Rotation Info */}
            <div className="mt-4 p-4 bg-cyan-900 bg-opacity-30 border border-cyan-400 rounded">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-cyan-400 font-bold">
                  CURRENT FEATURED GAME
                </h3>
                <div className="flex items-center space-x-2">
                  <span className="text-xs">AUTO-SWITCH:</span>
                  <button
                    onClick={() => setAutoSwitchEnabled(!autoSwitchEnabled)}
                    className={`px-2 py-1 text-xs font-bold rounded ${
                      autoSwitchEnabled
                        ? "bg-green-600 text-white"
                        : "bg-gray-600 text-gray-300"
                    }`}
                  >
                    {autoSwitchEnabled ? "ON" : "OFF"}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <span className="text-2xl">
                  {games[currentGameIndex]?.emoji}
                </span>
                <div>
                  <p className="text-white font-bold">
                    {games[currentGameIndex]?.name}
                  </p>
                  <p className="text-cyan-300 text-sm">
                    Next switch in: {formatTime(timeUntilSwitch)}
                  </p>
                </div>
              </div>

              <button
                onClick={handleAutoSwitch}
                className="mt-3 bg-cyan-600 hover:bg-cyan-700 px-4 py-2 text-white font-bold rounded text-sm"
              >
                PLAY FEATURED GAME
              </button>
            </div>

            {/* Game Rotation Schedule */}
            <div className="mt-4 p-3 bg-gray-800 rounded text-sm">
              <p className="text-yellow-400 font-bold mb-2">
                ROTATION SCHEDULE (10min each):
              </p>
              <div className="grid grid-cols-3 gap-2">
                {games.map((game, index) => (
                  <div
                    key={game.id}
                    className={`p-2 rounded text-center ${
                      index === currentGameIndex
                        ? "bg-cyan-600 text-white"
                        : "bg-gray-700 text-gray-400"
                    }`}
                  >
                    <div className="text-lg">{game.emoji}</div>
                    <div className="text-xs">{game.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-yellow-400">No active tournament</p>
        )}
      </div>

      {/* Manual Game Selection */}
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-4">OR CHOOSE ANY GAME</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {games.map((game, index) => (
          <div
            key={game.id}
            className={`bg-gray-900 border rounded-lg p-6 ${
              index === currentGameIndex && tournament
                ? "border-cyan-400 shadow-cyan-400/20 shadow-lg"
                : "border-gray-600"
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="text-4xl">{game.emoji}</div>
              {index === currentGameIndex && tournament && (
                <div className="bg-cyan-600 text-xs px-2 py-1 rounded font-bold">
                  FEATURED
                </div>
              )}
            </div>

            <h3 className="text-xl font-bold mb-2">{game.name}</h3>
            <p className="text-gray-400 mb-4">{game.description}</p>

            {game.status === "available" ? (
              <button
                onClick={() => handleGameSelect(game.id)}
                className={`w-full px-4 py-2 text-white font-bold rounded ${
                  index === currentGameIndex && tournament
                    ? "bg-cyan-600 hover:bg-cyan-700"
                    : "bg-gray-600 hover:bg-gray-700"
                }`}
              >
                PLAY NOW
              </button>
            ) : (
              <button
                disabled
                className="w-full bg-gray-700 px-4 py-2 text-gray-500 font-bold rounded cursor-not-allowed"
              >
                COMING SOON
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Game Rotation Explanation */}
      {tournament && (
        <div className="mt-8 p-4 bg-yellow-900 bg-opacity-20 border border-yellow-600 rounded">
          <h3 className="text-yellow-400 font-bold mb-2">
            HOW GAME ROTATION WORKS:
          </h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Each tournament session lasts 30 minutes</li>
            <li>• Featured game changes every 10 minutes</li>
            <li>• You can play any game at any time</li>
            <li>• Featured games are highlighted for discovery</li>
            <li>• Auto-switch can be toggled on/off</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default GameSelector;
