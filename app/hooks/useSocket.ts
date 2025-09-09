// hooks/useSocket.ts - Socket connection hook
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export const useSocket = (url: string = "http://localhost:3001") => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    socketRef.current = io(url);

    socketRef.current.on("connect", () => {
      setIsConnected(true);
      console.log("Connected to tournament server");
    });

    socketRef.current.on("disconnect", () => {
      setIsConnected(false);
      console.log("Disconnected from tournament server");
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [url]);

  return { socket: socketRef.current, isConnected };
};

// hooks/useTournamentSocket.ts - Tournament-specific socket hook
import { useEffect, useState } from "react";
import { useSocket } from "./useSocket";

interface TournamentSocketState {
  tournamentState: any;
  gameStarted: boolean;
  gameEnded: boolean;
  countdown: number | null;
  error: string | null;
  results: any[];
  leaderboard: any[];
}

export const useTournamentSocket = () => {
  const { socket, isConnected } = useSocket();
  const [state, setState] = useState<TournamentSocketState>({
    tournamentState: null,
    gameStarted: false,
    gameEnded: false,
    countdown: null,
    error: null,
    results: [],
    leaderboard: [],
  });

  useEffect(() => {
    if (!socket) return;

    // Tournament state updates
    socket.on("tournament-state", (tournamentState) => {
      setState((prev) => ({
        ...prev,
        tournamentState,
        error: null,
      }));
    });

    // Game events
    socket.on("game-started", (data) => {
      setState((prev) => ({
        ...prev,
        gameStarted: true,
        gameEnded: false,
        countdown: null,
      }));
    });

    socket.on("game-ended", (data) => {
      setState((prev) => ({
        ...prev,
        gameEnded: true,
        gameStarted: false,
        results: data.results,
        leaderboard: data.leaderboard,
      }));
    });

    socket.on("countdown", (count) => {
      setState((prev) => ({
        ...prev,
        countdown: count,
      }));
    });

    // Error handling
    socket.on("error", (error) => {
      setState((prev) => ({
        ...prev,
        error: error.message,
      }));
    });

    // Tournament finished
    socket.on("tournament-finished", (data) => {
      setState((prev) => ({
        ...prev,
        leaderboard: data.finalLeaderboard,
        gameEnded: true,
        gameStarted: false,
      }));
    });

    // Show next game prompt
    socket.on("show-next-game-prompt", (data) => {
      setState((prev) => ({
        ...prev,
        nextGamePrompt: data,
      }));
    });

    return () => {
      socket.off("tournament-state");
      socket.off("game-started");
      socket.off("game-ended");
      socket.off("countdown");
      socket.off("error");
      socket.off("tournament-finished");
      socket.off("show-next-game-prompt");
    };
  }, [socket]);

  // Socket action functions
  const joinTournament = (playerName: string) => {
    socket?.emit("join-tournament", playerName);
  };

  const updateScore = (score: number) => {
    socket?.emit("update-score", { score });
  };

  const completeGame = (finalScore: number) => {
    socket?.emit("game-complete", { finalScore });
  };

  const retryGame = () => {
    socket?.emit("retry-game");
  };

  const startTournament = () => {
    socket?.emit("start-tournament");
  };

  const nextGame = () => {
    socket?.emit("next-game");
  };

  return {
    ...state,
    isConnected,
    actions: {
      joinTournament,
      updateScore,
      completeGame,
      retryGame,
      startTournament,
      nextGame,
    },
  };
};

// components/GameWrapper.tsx - Wrapper component for games
import React, { useEffect, useState } from "react";
import { useTournamentSocket } from "../hooks/useTournamentSocket";

interface GameWrapperProps {
  children: React.ReactNode;
  gameType: string;
  onScoreUpdate?: (score: number) => void;
  onGameComplete?: (finalScore: number) => void;
}

export const GameWrapper: React.FC<GameWrapperProps> = ({
  children,
  gameType,
  onScoreUpdate,
  onGameComplete,
}) => {
  const tournament = useTournamentSocket();
  const [currentScore, setCurrentScore] = useState(0);
  const [gameActive, setGameActive] = useState(false);

  useEffect(() => {
    if (
      tournament.gameStarted &&
      tournament.tournamentState?.currentSession?.gameType === gameType
    ) {
      setGameActive(true);
      setCurrentScore(0);
    }

    if (tournament.gameEnded) {
      setGameActive(false);
      if (onGameComplete) {
        onGameComplete(currentScore);
      }
      tournament.actions.completeGame(currentScore);
    }
  }, [
    tournament.gameStarted,
    tournament.gameEnded,
    gameType,
    currentScore,
    onGameComplete,
  ]);

  const handleScoreUpdate = (newScore: number) => {
    if (gameActive && newScore > currentScore) {
      setCurrentScore(newScore);
      tournament.actions.updateScore(newScore);
      if (onScoreUpdate) {
        onScoreUpdate(newScore);
      }
    }
  };

  if (tournament.countdown !== null && tournament.countdown >= 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="text-center">
          <h2 className="text-4xl mb-4">Get Ready!</h2>
          <div className="text-8xl font-bold text-yellow-400">
            {tournament.countdown || "GO!"}
          </div>
        </div>
      </div>
    );
  }

  if (!gameActive) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <h2 className="text-2xl mb-4">Waiting for game to start...</h2>
          {tournament.error && (
            <div className="text-red-500 mb-4">{tournament.error}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="game-wrapper">
      {React.cloneElement(children as React.ReactElement, {
        onScoreChange: handleScoreUpdate,
        gameActive,
        currentScore,
      })}
    </div>
  );
};

// components/PlayersList.tsx - Shows current players
import React from "react";
import { useTournamentSocket } from "../hooks/useTournamentSocket";

export const PlayersList: React.FC = () => {
  const tournament = useTournamentSocket();
  const currentSession = tournament.tournamentState?.currentSession;

  if (!currentSession || !currentSession.players?.length) {
    return (
      <div className="players-list p-4 bg-gray-50 rounded">
        <h3 className="text-lg font-semibold mb-2">Players</h3>
        <div className="text-gray-500">No players in current game</div>
      </div>
    );
  }

  return (
    <div className="players-list p-4 bg-gray-50 rounded">
      <h3 className="text-lg font-semibold mb-2">
        Players ({currentSession.players.length}/{currentSession.maxPlayers})
      </h3>
      <div className="space-y-2">
        {currentSession.players.map((player: any) => (
          <div
            key={player.id}
            className={`flex justify-between items-center p-2 rounded ${
              player.isActive ? "bg-green-100" : "bg-gray-100"
            }`}
          >
            <span className="font-medium">{player.name}</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">{player.score} pts</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  player.isActive ? "bg-green-500" : "bg-gray-400"
                }`}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-sm text-gray-500">
        Game: {currentSession.gameType} | Status: {currentSession.status}
      </div>
    </div>
  );
};

// components/Leaderboard.tsx - Shows tournament leaderboard
import React from "react";
import { useTournamentSocket } from "../hooks/useTournamentSocket";

export const Leaderboard: React.FC = () => {
  const tournament = useTournamentSocket();
  const leaderboard =
    tournament.leaderboard || tournament.tournamentState?.leaderboard || [];

  return (
    <div className="leaderboard p-4 bg-white border rounded shadow">
      <h3 className="text-xl font-bold mb-4">Tournament Leaderboard</h3>

      {leaderboard.length === 0 ? (
        <div className="text-gray-500 text-center py-4">
          No scores yet. Play some games to see the leaderboard!
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.slice(0, 10).map((entry: any, index: number) => (
            <div
              key={`${entry.playerId}-${index}`}
              className={`flex justify-between items-center p-3 rounded ${
                index < 3
                  ? "bg-gradient-to-r from-yellow-100 to-yellow-50 border border-yellow-200"
                  : "bg-gray-50"
              }`}
            >
              <div className="flex items-center space-x-3">
                <span
                  className={`font-bold text-lg ${
                    index === 0
                      ? "text-yellow-600"
                      : index === 1
                      ? "text-gray-600"
                      : index === 2
                      ? "text-orange-600"
                      : "text-gray-800"
                  }`}
                >
                  #{index + 1}
                </span>
                <div>
                  <div className="font-semibold">{entry.playerName}</div>
                  <div className="text-sm text-gray-500">{entry.gameType}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">{entry.score}</div>
                <div className="text-sm text-gray-500">points</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tournament.gameEnded && tournament.results?.length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <h4 className="font-semibold mb-2">Last Game Results:</h4>
          <div className="space-y-1">
            {tournament.results
              .slice(0, 3)
              .map((result: any, index: number) => (
                <div
                  key={result.playerId}
                  className="flex justify-between text-sm"
                >
                  <span>
                    {index + 1}. {result.playerName}
                  </span>
                  <span>{result.score} pts</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

// components/TournamentControls.tsx - Control panel for tournament
import React, { useState } from "react";
import { useTournamentSocket } from "../hooks/useTournamentSocket";

export const TournamentControls: React.FC = () => {
  const tournament = useTournamentSocket();
  const [playerName, setPlayerName] = useState("");

  const handleJoinTournament = () => {
    if (playerName.trim()) {
      tournament.actions.joinTournament(playerName.trim());
      setPlayerName("");
    }
  };

  const handleStartTournament = () => {
    tournament.actions.startTournament();
  };

  const handleNextGame = () => {
    tournament.actions.nextGame();
  };

  const handleRetryGame = () => {
    tournament.actions.retryGame();
  };

  const tournamentState = tournament.tournamentState;

  return (
    <div className="tournament-controls p-4 bg-white border rounded shadow">
      <h3 className="text-lg font-semibold mb-4">Tournament Controls</h3>

      {!tournament.isConnected && (
        <div className="bg-red-100 text-red-700 p-2 rounded mb-4">
          Not connected to server
        </div>
      )}

      {tournament.error && (
        <div className="bg-red-100 text-red-700 p-2 rounded mb-4">
          {tournament.error}
        </div>
      )}

      {/* Tournament Status */}
      <div className="mb-4">
        <div className="text-sm text-gray-600">
          Status:
          <span className="ml-1 font-medium">
            {tournamentState?.status || "Unknown"}
          </span>
        </div>
        {tournamentState?.currentSession && (
          <div className="text-sm text-gray-600">
            Current Game: {tournamentState.currentSession.gameType}(
            {tournamentState.currentGameIndex + 1}/
            {tournamentState.gameQueue?.length})
          </div>
        )}
      </div>

      {/* Controls based on tournament state */}
      {tournamentState?.status === "idle" && (
        <button
          onClick={handleStartTournament}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 mb-2"
          disabled={!tournament.isConnected}
        >
          Start Tournament
        </button>
      )}

      {tournamentState?.status === "active" &&
        tournamentState?.currentSession?.status === "waiting" && (
          <div className="space-y-2">
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="flex-1 px-3 py-2 border rounded"
                onKeyPress={(e) => e.key === "Enter" && handleJoinTournament()}
              />
              <button
                onClick={handleJoinTournament}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                disabled={!playerName.trim() || !tournament.isConnected}
              >
                Join
              </button>
            </div>
          </div>
        )}

      {tournamentState?.status === "between-games" && (
        <div className="space-y-2">
          <button
            onClick={handleNextGame}
            className="w-full bg-purple-500 text-white py-2 px-4 rounded hover:bg-purple-600"
            disabled={!tournament.isConnected}
          >
            Next Game ({tournamentState.currentGameIndex + 1}/
            {tournamentState.gameQueue?.length})
          </button>
          <button
            onClick={handleRetryGame}
            className="w-full bg-orange-500 text-white py-2 px-4 rounded hover:bg-orange-600"
            disabled={!tournament.isConnected}
          >
            Retry Current Game
          </button>
        </div>
      )}

      {tournamentState?.status === "finished" && (
        <div className="text-center">
          <h4 className="text-lg font-semibold mb-2">Tournament Complete!</h4>
          <p className="text-gray-600 mb-4">
            Tournament will reset automatically
          </p>
          <button
            onClick={handleStartTournament}
            className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
            disabled={!tournament.isConnected}
          >
            Start New Tournament
          </button>
        </div>
      )}
    </div>
  );
};

// components/TournamentDashboard.tsx - Main dashboard component
import React from "react";
import { useTournamentSocket } from "../hooks/useTournamentSocket";
import { TournamentControls } from "./TournamentControls";
import { PlayersList } from "./PlayersList";
import { Leaderboard } from "./Leaderboard";

export const TournamentDashboard: React.FC = () => {
  const tournament = useTournamentSocket();

  return (
    <div className="tournament-dashboard min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Trenchers Terminal Tournament
          </h1>
          <p className="text-gray-600">
            Compete in Snake, Flappy Bird, and Terminal Artillery!
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Controls */}
          <div className="space-y-6">
            <TournamentControls />
            {tournament.tournamentState?.currentSession && <PlayersList />}
          </div>

          {/* Middle Column - Game Area */}
          <div className="lg:col-span-1">
            <div className="bg-white border rounded shadow p-4">
              <h3 className="text-lg font-semibold mb-4">Game Status</h3>

              {tournament.countdown !== null && tournament.countdown >= 0 && (
                <div className="text-center py-8">
                  <div className="text-6xl font-bold text-yellow-500 mb-2">
                    {tournament.countdown || "GO!"}
                  </div>
                  <div className="text-gray-600">Get ready!</div>
                </div>
              )}

              {tournament.gameStarted && (
                <div className="text-center py-8">
                  <div className="text-2xl font-semibold text-green-600 mb-2">
                    Game in Progress
                  </div>
                  <div className="text-gray-600">
                    Playing:{" "}
                    {tournament.tournamentState?.currentSession?.gameType}
                  </div>
                </div>
              )}

              {tournament.gameEnded && tournament.results?.length > 0 && (
                <div className="text-center py-4">
                  <h4 className="text-xl font-semibold mb-4">Game Results!</h4>
                  <div className="space-y-2">
                    {tournament.results
                      .slice(0, 3)
                      .map((result: any, index: number) => (
                        <div
                          key={result.playerId}
                          className="flex justify-between items-center p-2 rounded bg-gray-50"
                        >
                          <span className="font-medium">
                            {index + 1}. {result.playerName}
                          </span>
                          <span className="text-blue-600 font-bold">
                            {result.score} pts
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {!tournament.gameStarted &&
                !tournament.gameEnded &&
                tournament.countdown === null && (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-xl mb-2">Ready to Play</div>
                    <div>Join the tournament to start!</div>
                  </div>
                )}
            </div>
          </div>

          {/* Right Column - Leaderboard */}
          <div>
            <Leaderboard />
          </div>
        </div>
      </div>
    </div>
  );
};
