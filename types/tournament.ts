// types/tournament.ts - Enhanced tournament types
export interface Player {
  id: string;
  name: string;
  score: number;
  isActive: boolean;
  joinedAt: Date;
}

export interface GameSession {
  id: string;
  gameType: "snake" | "flappy-bird" | "terminal-artillery";
  players: Player[];
  status: "waiting" | "countdown" | "playing" | "finished" | "results";
  startTime?: Date;
  endTime?: Date;
  duration: number; // in seconds
  maxPlayers: number;
  results?: GameResults[];
}

export interface GameResults {
  playerId: string;
  playerName: string;
  score: number;
  rank: number;
  gameType: string;
  completedAt: Date;
}

export interface TournamentState {
  currentSession: GameSession | null;
  leaderboard: GameResults[];
  allPlayers: Player[];
  gameQueue: string[]; // queue of game types
  currentGameIndex: number;
  tournamentStatus: "idle" | "active" | "between-games" | "finished";
}

// hooks/useTournament.ts - Main tournament state management hook
import { useState, useCallback, useEffect } from "react";

export const useTournament = () => {
  const [state, setState] = useState<TournamentState>({
    currentSession: null,
    leaderboard: [],
    allPlayers: [],
    gameQueue: ["snake", "flappy-bird", "terminal-artillery"],
    currentGameIndex: 0,
    tournamentStatus: "idle",
  });

  // Create new game session
  const createGameSession = useCallback((gameType: string, maxPlayers = 4) => {
    const newSession: GameSession = {
      id: `session-${Date.now()}`,
      gameType: gameType as any,
      players: [],
      status: "waiting",
      duration: 120, // 2 minutes default
      maxPlayers,
      results: [],
    };

    setState((prev) => ({
      ...prev,
      currentSession: newSession,
      tournamentStatus: "active",
    }));
  }, []);

  // Add player to current session
  const addPlayerToSession = useCallback((playerName: string) => {
    setState((prev) => {
      if (
        !prev.currentSession ||
        prev.currentSession.players.length >= prev.currentSession.maxPlayers
      ) {
        return prev;
      }

      const newPlayer: Player = {
        id: `player-${Date.now()}-${Math.random()}`,
        name: playerName,
        score: 0,
        isActive: true,
        joinedAt: new Date(),
      };

      const updatedSession = {
        ...prev.currentSession,
        players: [...prev.currentSession.players, newPlayer],
      };

      return {
        ...prev,
        currentSession: updatedSession,
        allPlayers: [
          ...prev.allPlayers.filter((p) => p.name !== playerName),
          newPlayer,
        ],
      };
    });
  }, []);

  // Start game countdown
  const startGameCountdown = useCallback(() => {
    setState((prev) => {
      if (!prev.currentSession || prev.currentSession.players.length === 0) {
        return prev;
      }

      return {
        ...prev,
        currentSession: {
          ...prev.currentSession,
          status: "countdown",
          startTime: new Date(),
        },
      };
    });

    // Start countdown timer
    setTimeout(() => {
      setState((prev) => ({
        ...prev,
        currentSession: prev.currentSession
          ? {
              ...prev.currentSession,
              status: "playing",
            }
          : null,
      }));
    }, 3000); // 3 second countdown
  }, []);

  // Update player score during game
  const updatePlayerScore = useCallback((playerId: string, score: number) => {
    setState((prev) => {
      if (!prev.currentSession) return prev;

      const updatedPlayers = prev.currentSession.players.map((player) =>
        player.id === playerId ? { ...player, score } : player
      );

      return {
        ...prev,
        currentSession: {
          ...prev.currentSession,
          players: updatedPlayers,
        },
      };
    });
  }, []);

  // End current game and calculate results
  const endCurrentGame = useCallback(() => {
    setState((prev) => {
      if (!prev.currentSession || prev.currentSession.status !== "playing") {
        return prev;
      }

      const endTime = new Date();
      const sortedPlayers = [...prev.currentSession.players].sort(
        (a, b) => b.score - a.score
      );

      const results: GameResults[] = sortedPlayers.map((player, index) => ({
        playerId: player.id,
        playerName: player.name,
        score: player.score,
        rank: index + 1,
        gameType: prev.currentSession!.gameType,
        completedAt: endTime,
      }));

      const updatedSession = {
        ...prev.currentSession,
        status: "results" as const,
        endTime,
        results,
      };

      return {
        ...prev,
        currentSession: updatedSession,
        leaderboard: [...prev.leaderboard, ...results].sort(
          (a, b) => b.score - a.score
        ),
        tournamentStatus: "between-games",
      };
    });
  }, []);

  // Proceed to next game
  const proceedToNextGame = useCallback(() => {
    setState((prev) => {
      const nextGameIndex = prev.currentGameIndex + 1;

      if (nextGameIndex >= prev.gameQueue.length) {
        // Tournament finished
        return {
          ...prev,
          currentSession: null,
          tournamentStatus: "finished",
          currentGameIndex: 0,
        };
      }

      // Start next game
      const nextGameType = prev.gameQueue[nextGameIndex];
      const newSession: GameSession = {
        id: `session-${Date.now()}`,
        gameType: nextGameType as any,
        players: [],
        status: "waiting",
        duration: 120,
        maxPlayers: 4,
        results: [],
      };

      return {
        ...prev,
        currentSession: newSession,
        currentGameIndex: nextGameIndex,
        tournamentStatus: "active",
      };
    });
  }, []);

  // Reset tournament
  const resetTournament = useCallback(() => {
    setState({
      currentSession: null,
      leaderboard: [],
      allPlayers: [],
      gameQueue: ["snake", "flappy-bird", "terminal-artillery"],
      currentGameIndex: 0,
      tournamentStatus: "idle",
    });
  }, []);

  // Auto-end game after duration
  useEffect(() => {
    if (
      state.currentSession?.status === "playing" &&
      state.currentSession.startTime
    ) {
      const timer = setTimeout(() => {
        endCurrentGame();
      }, state.currentSession.duration * 1000);

      return () => clearTimeout(timer);
    }
  }, [
    state.currentSession?.status,
    state.currentSession?.startTime,
    endCurrentGame,
  ]);

  return {
    state,
    createGameSession,
    addPlayerToSession,
    startGameCountdown,
    updatePlayerScore,
    endCurrentGame,
    proceedToNextGame,
    resetTournament,
  };
};

// components/TournamentManager.tsx - Main tournament component
import React from "react";

interface TournamentManagerProps {
  tournament: ReturnType<typeof useTournament>;
}

export const TournamentManager: React.FC<TournamentManagerProps> = ({
  tournament,
}) => {
  const { state, createGameSession, proceedToNextGame, resetTournament } =
    tournament;

  const handleStartTournament = () => {
    if (state.gameQueue.length > 0) {
      createGameSession(state.gameQueue[0]);
    }
  };

  const handleNextGame = () => {
    proceedToNextGame();
  };

  const renderTournamentStatus = () => {
    switch (state.tournamentStatus) {
      case "idle":
        return (
          <div className="text-center p-6">
            <h2 className="text-2xl mb-4">Tournament Ready</h2>
            <button
              onClick={handleStartTournament}
              className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
            >
              Start Tournament
            </button>
          </div>
        );

      case "between-games":
        return (
          <div className="text-center p-6">
            <h2 className="text-2xl mb-4">Game Complete!</h2>
            {state.currentSession?.results && (
              <div className="mb-4">
                <h3 className="text-xl mb-2">Results:</h3>
                {state.currentSession.results
                  .slice(0, 3)
                  .map((result, index) => (
                    <div key={result.playerId} className="mb-1">
                      {index + 1}. {result.playerName} - {result.score} points
                    </div>
                  ))}
              </div>
            )}
            <button
              onClick={handleNextGame}
              className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 mr-2"
            >
              Next Game ({state.currentGameIndex + 1}/{state.gameQueue.length})
            </button>
          </div>
        );

      case "finished":
        return (
          <div className="text-center p-6">
            <h2 className="text-2xl mb-4">Tournament Complete!</h2>
            <div className="mb-4">
              <h3 className="text-xl mb-2">Final Leaderboard:</h3>
              {state.leaderboard.slice(0, 10).map((result, index) => (
                <div key={`${result.playerId}-${index}`} className="mb-1">
                  {index + 1}. {result.playerName} - {result.score} points (
                  {result.gameType})
                </div>
              ))}
            </div>
            <button
              onClick={resetTournament}
              className="bg-purple-500 text-white px-6 py-2 rounded hover:bg-purple-600"
            >
              Start New Tournament
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="tournament-manager">
      {renderTournamentStatus()}

      {state.currentSession && (
        <div className="current-game p-4 border rounded">
          <h3 className="text-lg mb-2">
            Current Game: {state.currentSession.gameType}(
            {state.currentSession.status})
          </h3>
          <div className="players-list">
            <h4>
              Players ({state.currentSession.players.length}/
              {state.currentSession.maxPlayers}):
            </h4>
            {state.currentSession.players.map((player) => (
              <div key={player.id} className="player-item flex justify-between">
                <span>{player.name}</span>
                <span>{player.score} points</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
