// File: types/tournament.ts
export interface TournamentSession {
  id: string;
  phase: "waiting" | "active" | "transitioning" | "completed";
  currentGame: "terminal-artillery" | "flappy-bird" | "snake";
  gameSequence: string[];
  currentGameIndex: number;
  timeLeft: number;
  gameDuration: number;
  transitionTime: number;
  prizePool: number;
  entryFee: number;
  participants: TournamentParticipant[];
  leaderboard: TournamentScore[];
  startTime: number;
  endTime: number;
  minParticipants: number;
  maxParticipants: number;
}

export interface TournamentParticipant {
  walletAddress: string;
  username: string;
  joinedAt: number;
  totalScore: number;
  gameScores: { [game: string]: number };
  rank: number;
  isActive: boolean;
  hasSubmittedScore: boolean;
  lastActivity: number;
}

export interface TournamentScore {
  walletAddress: string;
  username: string;
  totalScore: number;
  gameBreakdown: { [game: string]: number };
  rank: number;
  prizeAmount: number;
  percentile: number;
}

export interface PrizeDistribution {
  rank: number;
  percentage: number;
  amount: number;
}

export interface TournamentConfig {
  GAME_SEQUENCE: string[];
  GAME_DURATION: number;
  TRANSITION_TIME: number;
  MIN_PARTICIPANTS: number;
  MAX_PARTICIPANTS: number;
  ENTRY_FEE: number;
}

export interface GameTransition {
  from: string;
  to: string;
  countdown: number;
  message: string;
}

export interface TournamentResult {
  success: boolean;
  error?: string;
  data?: any;
}
