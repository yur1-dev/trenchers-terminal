// components/TournamentWrapper.tsx - Main wrapper that handles auto switching
import React, { useState, useEffect, useCallback } from "react";
import GameSelector from "./GameSelector";
import { useSessionManager } from "../hooks/useSessionManager";

interface TournamentWrapperProps {
  walletAddress: string;
  onGameSelect: (gameType: string) => void;
  onDisconnectWallet: () => void;
  children?: React.ReactNode;
}

const TournamentWrapper: React.FC<TournamentWrapperProps> = ({
  walletAddress,
  onGameSelect,
  onDisconnectWallet,
  children,
}) => {
  const {
    sessionData,
    gameRotation,
    loading,
    error,
    getCurrentGame,
    shouldSwitchGame,
    formatTime,
    refreshSession,
  } = useSessionManager();

  const [autoSwitchEnabled, setAutoSwitchEnabled] = useState(true);
  const [lastSwitchTime, setLastSwitchTime] = useState(0);
  const [showSwitchNotification, setShowSwitchNotification] = useState(false);

  // Handle automatic game switching
  const handleAutoSwitch = useCallback(() => {
    if (!autoSwitchEnabled || !sessionData) return;

    const currentGame = getCurrentGame();
    const now = Date.now();

    // Prevent rapid switching (min 5 seconds between switches)
    if (now - lastSwitchTime < 5000) return;

    if (shouldSwitchGame() && currentGame) {
      console.log(`Auto-switching to: ${currentGame.name}`);

      setShowSwitchNotification(true);
      setLastSwitchTime(now);

      // Show notification for 3 seconds
      setTimeout(() => setShowSwitchNotification(false), 3000);

      // Trigger game switch
      onGameSelect(currentGame.id);
    }
  }, [
    autoSwitchEnabled,
    sessionData,
    getCurrentGame,
    shouldSwitchGame,
    lastSwitchTime,
    onGameSelect,
  ]);

  // Check for auto-switch every second
  useEffect(() => {
    if (!autoSwitchEnabled) return;

    const switchInterval = setInterval(handleAutoSwitch, 1000);
    return () => clearInterval(switchInterval);
  }, [handleAutoSwitch, autoSwitchEnabled]);

  // Handle manual game selection
  const handleGameSelect = useCallback(
    (gameId: string) => {
      // Disable auto-switch temporarily when user manually selects
      setAutoSwitchEnabled(false);
      onGameSelect(gameId);

      // Re-enable auto-switch after 30 seconds
      setTimeout(() => setAutoSwitchEnabled(true), 30000);
    },
    [onGameSelect]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white font-mono">
        <div className="text-center">
          <div className="text-4xl mb-4">⚡</div>
          <div className="text-xl">LOADING TOURNAMENT DATA...</div>
          <div className="text-sm text-gray-400 mt-2">
            Connecting to game servers
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white font-mono">
        <div className="text-center p-8 border border-red-500 rounded bg-red-900 bg-opacity-20">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="text-xl text-red-400 mb-4">TOURNAMENT ERROR</div>
          <div className="text-sm text-gray-300 mb-6">{error}</div>
          <button
            onClick={refreshSession}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-bold"
          >
            RETRY CONNECTION
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Auto-switch notification */}
      {showSwitchNotification && (
        <div className="fixed top-4 right-4 z-50 bg-cyan-600 text-white p-4 rounded-lg shadow-lg border border-cyan-400 animate-pulse">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">🎮</div>
            <div>
              <div className="font-bold">AUTO-SWITCHING GAMES</div>
              <div className="text-sm">
                Now featuring: {getCurrentGame()?.name}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auto-switch status indicator */}
      <div className="fixed bottom-4 right-4 z-40">
        <div
          className={`px-3 py-2 rounded-full text-xs font-bold ${
            autoSwitchEnabled
              ? "bg-green-600 text-white"
              : "bg-gray-600 text-gray-300"
          }`}
        >
          AUTO-SWITCH: {autoSwitchEnabled ? "ON" : "OFF"}
        </div>
      </div>

      {/* Game rotation progress bar */}
      {sessionData && gameRotation.timeUntilSwitch > 0 && (
        <div className="fixed top-0 left-0 right-0 z-30 bg-black bg-opacity-90 p-2">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
              <span>Current: {getCurrentGame()?.name}</span>
              <span>Switch in: {formatTime(gameRotation.timeUntilSwitch)}</span>
            </div>
            <div className="bg-gray-700 h-2 rounded overflow-hidden">
              <div
                className="bg-cyan-500 h-full transition-all duration-1000 ease-linear"
                style={{
                  width: `${
                    ((600 - gameRotation.timeUntilSwitch) / 600) * 100
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="pt-12">
        {children || (
          <GameSelector
            walletAddress={walletAddress}
            tournament={sessionData}
            onGameSelect={handleGameSelect}
            onDisconnectWallet={onDisconnectWallet}
          />
        )}
      </div>

      {/* Session controls (admin/debug) */}
      {process.env.NODE_ENV === "development" && (
        <div className="fixed bottom-4 left-4 z-40 space-y-2">
          <button
            onClick={() => setAutoSwitchEnabled(!autoSwitchEnabled)}
            className={`block px-3 py-1 text-xs font-bold rounded ${
              autoSwitchEnabled
                ? "bg-green-600 hover:bg-green-700"
                : "bg-gray-600 hover:bg-gray-700"
            }`}
          >
            {autoSwitchEnabled ? "DISABLE AUTO" : "ENABLE AUTO"}
          </button>

          <button
            onClick={handleAutoSwitch}
            className="block bg-yellow-600 hover:bg-yellow-700 px-3 py-1 text-xs font-bold rounded"
          >
            FORCE SWITCH
          </button>

          <button
            onClick={refreshSession}
            className="block bg-blue-600 hover:bg-blue-700 px-3 py-1 text-xs font-bold rounded"
          >
            REFRESH
          </button>
        </div>
      )}
    </div>
  );
};

export default TournamentWrapper;
