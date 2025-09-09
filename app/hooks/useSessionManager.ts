// hooks/useSessionManager.ts - Handles session and game rotation logic
import { useState, useEffect, useCallback } from "react";

interface SessionData {
  id: string;
  timeLeft: number;
  status: string;
  players: number;
}

interface GameRotation {
  currentGameIndex: number;
  timeUntilSwitch: number;
  games: Array<{
    id: string;
    name: string;
    emoji: string;
    description: string;
    status: string;
  }>;
}

export const useSessionManager = () => {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [gameRotation, setGameRotation] = useState<GameRotation>({
    currentGameIndex: 0,
    timeUntilSwitch: 0,
    games: [
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
    ],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch current session data
  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch("/api/current-session");
      const data = await response.json();

      if (data.success && data.session) {
        setSessionData(data.session);
        setError(null);
      } else {
        setError(data.error || "Failed to fetch session");
      }
    } catch (err) {
      console.error("Session fetch error:", err);
      setError("Network error fetching session");
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate current game based on session time
  const calculateCurrentGame = useCallback(
    (timeLeft: number) => {
      const GAME_ROTATION_INTERVAL = 600; // 10 minutes per game
      const TOTAL_SESSION_TIME = 1800; // 30 minutes total

      const elapsedTime = TOTAL_SESSION_TIME - timeLeft;
      const rotationNumber = Math.floor(elapsedTime / GAME_ROTATION_INTERVAL);
      const currentGameIndex = rotationNumber % gameRotation.games.length;

      const timeInCurrentRotation = elapsedTime % GAME_ROTATION_INTERVAL;
      const timeUntilSwitch = GAME_ROTATION_INTERVAL - timeInCurrentRotation;

      return {
        currentGameIndex,
        timeUntilSwitch: Math.max(0, timeUntilSwitch),
      };
    },
    [gameRotation.games.length]
  );

  // Update game rotation when session data changes
  useEffect(() => {
    if (sessionData) {
      const rotation = calculateCurrentGame(sessionData.timeLeft);
      setGameRotation((prev) => ({
        ...prev,
        currentGameIndex: rotation.currentGameIndex,
        timeUntilSwitch: rotation.timeUntilSwitch,
      }));
    }
  }, [sessionData, calculateCurrentGame]);

  // Poll session data every 30 seconds
  useEffect(() => {
    fetchSession();

    const sessionInterval = setInterval(fetchSession, 30000);
    return () => clearInterval(sessionInterval);
  }, [fetchSession]);

  // Update countdown every second
  useEffect(() => {
    if (!sessionData) return;

    const countdownInterval = setInterval(() => {
      setSessionData((prev) => {
        if (!prev) return prev;

        const newTimeLeft = Math.max(0, prev.timeLeft - 1);

        // If session expires, trigger new session fetch
        if (newTimeLeft === 0) {
          setTimeout(fetchSession, 1000);
        }

        return {
          ...prev,
          timeLeft: newTimeLeft,
        };
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [sessionData, fetchSession]);

  // Get current featured game
  const getCurrentGame = useCallback(() => {
    return gameRotation.games[gameRotation.currentGameIndex];
  }, [gameRotation]);

  // Check if it's time to switch games
  const shouldSwitchGame = useCallback(() => {
    return (
      gameRotation.timeUntilSwitch <= 0 &&
      sessionData &&
      sessionData.timeLeft > 0
    );
  }, [gameRotation.timeUntilSwitch, sessionData]);

  // Force create new session
  const forceNewSession = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/current-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "force_new_session" }),
      });

      const data = await response.json();
      if (data.success) {
        setSessionData(data.session);
        setError(null);
      } else {
        setError(data.error || "Failed to create new session");
      }
    } catch (err) {
      console.error("Force new session error:", err);
      setError("Failed to create new session");
    } finally {
      setLoading(false);
    }
  }, []);

  // Format time display
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  return {
    sessionData,
    gameRotation,
    loading,
    error,
    getCurrentGame,
    shouldSwitchGame,
    forceNewSession,
    formatTime,
    refreshSession: fetchSession,
  };
};
