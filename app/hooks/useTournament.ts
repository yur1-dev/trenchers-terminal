// ============================================================================
// hooks/useTournament.ts
// ============================================================================

import { useState, useCallback, useEffect } from "react";

interface Tournament {
  id: string;
  timeLeft: number;
  phase: "waiting" | "active" | "completed";
  currentGame: string;
  gameSequence: string[];
  currentGameIndex: number;
  leaderboard: Array<{
    walletAddress: string;
    username: string;
    totalScore: number;
    rank: number;
  }>;
}

export const useTournament = () => {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isParticipant, setIsParticipant] = useState(false);

  const createTournament = useCallback(() => {
    const newTournament: Tournament = {
      id: `tournament_${Date.now()}`,
      timeLeft: 300, // 5 minutes
      phase: "waiting",
      currentGame: "terminal-artillery",
      gameSequence: ["terminal-artillery", "flappy-bird", "snake"],
      currentGameIndex: 0,
      leaderboard: [],
    };

    setTournament(newTournament);
  }, []);

  const joinTournament = useCallback((walletAddress: string) => {
    setIsParticipant(true);
    // Add player to tournament
  }, []);

  const submitScore = useCallback(
    (walletAddress: string, score: number, gameId: string) => {
      setTournament((prev) => {
        if (!prev) return prev;

        const existingEntry = prev.leaderboard.find(
          (entry) => entry.walletAddress === walletAddress
        );

        const newLeaderboard = [...prev.leaderboard];

        if (existingEntry) {
          existingEntry.totalScore += score;
        } else {
          newLeaderboard.push({
            walletAddress,
            username: `Player_${walletAddress.slice(0, 4)}`,
            totalScore: score,
            rank: 0,
          });
        }

        // Sort and assign ranks
        newLeaderboard.sort((a, b) => b.totalScore - a.totalScore);
        newLeaderboard.forEach((entry, index) => {
          entry.rank = index + 1;
        });

        return { ...prev, leaderboard: newLeaderboard };
      });
    },
    []
  );

  const updateTournament = useCallback((updates: Partial<Tournament>) => {
    setTournament((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  // Tournament timer
  useEffect(() => {
    if (!tournament || tournament.phase === "completed") return;

    const timer = setInterval(() => {
      setTournament((prev) => {
        if (!prev) return prev;

        const newTimeLeft = prev.timeLeft - 1;
        if (newTimeLeft <= 0) {
          return { ...prev, phase: "completed", timeLeft: 0 };
        }

        return { ...prev, timeLeft: newTimeLeft };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [tournament?.phase]);

  return {
    tournament,
    isParticipant,
    createTournament,
    joinTournament,
    submitScore,
    updateTournament,
  };
};

export { useWallet as useWalletSession } from "./useWallet";
