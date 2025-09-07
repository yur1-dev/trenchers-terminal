// types/game.ts
export interface Player {
  id: string;
  wallet: string;
  username: string;
  score: number;
  timestamp: string;
  rank: number;
}

export interface GameSession {
  id: string;
  entryFee: number;
  prizePool: number;
  timeLeft: number;
  players: number;
  status: "active" | "ended";
  startTime: string;
  endTime?: string;
  maxPlayers: number;
}

export interface GameMessage {
  type: "GAME_SCORE_UPDATE" | "GAME_OVER" | "GAME_READY" | "START_GAME";
  data?: {
    score?: number;
    finalScore?: number;
    playerData?: {
      wallet: string;
      username: string;
    };
  };
}

export interface LeaderboardEntry {
  id: string;
  session_id: string;
  player_id: string;
  wallet_address: string;
  username: string;
  score: number;
  timestamp: string;
  verified: boolean;
  rank: number;
}

export interface PrizeDistribution {
  first: number;
  second: number;
  third: number;
}

export interface PayoutResult {
  rank: number;
  walletAddress: string;
  amount: number;
  signature?: string;
  error?: string;
  success: boolean;
}

export interface GameStats {
  totalGames: number;
  bestScore: number;
  averageScore: number;
  recentScores: Array<{
    score: number;
    timestamp: string;
    rank: number;
  }>;
}

export interface GameConfig {
  gameDuration: number; // seconds
  entryFee: number; // SOL
  maxPlayers: number;
  prizePoolPercentages: {
    first: number;
    second: number;
    third: number;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export type GameState = "waiting" | "playing" | "gameOver" | "loading";

export interface WalletValidation {
  isValid: boolean;
  address?: string;
  error?: string;
}

export interface ScoreSubmission {
  walletAddress: string;
  username: string;
  score: number;
  sessionId: string;
  timestamp?: string;
}
