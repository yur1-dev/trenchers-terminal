import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface Player {
  id: string;
  wallet_address: string;
  username: string;
  created_at: string;
}

export interface GameSession {
  id: string;
  entry_fee: number;
  prize_pool: number;
  start_time: string;
  end_time?: string;
  status: "active" | "ended";
  max_players: number;
}

export interface Score {
  id: string;
  session_id: string;
  player_id: string;
  wallet_address: string;
  username: string;
  score: number;
  timestamp: string;
  verified: boolean;
}
