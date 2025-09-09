import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const limit = parseInt(searchParams.get("limit") || "50");

  console.log("=== LEADERBOARD API DEBUG ===");
  console.log("Request params:", { sessionId, limit });

  if (!sessionId) {
    console.log("❌ No session ID provided");
    return NextResponse.json(
      {
        error: "Session ID required",
        success: false,
      },
      { status: 400 }
    );
  }

  try {
    // First, verify the session exists
    console.log("🔍 Verifying session exists...");
    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .select("id, status, start_time")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      console.log("❌ Session not found:", sessionError);
      return NextResponse.json(
        {
          error: "Session not found",
          sessionId,
          success: false,
        },
        { status: 404 }
      );
    }

    console.log("✅ Session found:", session);

    // Get all scores for this session with detailed logging
    console.log("🔍 Fetching scores for session...");
    const { data: scores, error: scoresError } = await supabase
      .from("scores")
      .select(
        `
        id,
        session_id,
        player_id,
        wallet_address,
        username,
        score,
        timestamp,
        verified
      `
      )
      .eq("session_id", sessionId)
      .eq("verified", true)
      .order("score", { ascending: false })
      .limit(Math.min(limit, 100));

    if (scoresError) {
      console.error("❌ Scores query error:", scoresError);
      return NextResponse.json(
        {
          error: `Database error: ${scoresError.message}`,
          details: scoresError,
          success: false,
        },
        { status: 500 }
      );
    }

    console.log(`✅ Found ${scores?.length || 0} verified scores`);

    // Also get unverified scores for debugging
    const { data: unverifiedScores } = await supabase
      .from("scores")
      .select("id, score, verified")
      .eq("session_id", sessionId)
      .eq("verified", false);

    console.log(`ℹ️ Found ${unverifiedScores?.length || 0} unverified scores`);

    // If no scores found, let's debug further
    if (!scores || scores.length === 0) {
      console.log("🔍 No scores found, checking all scores in database...");

      const { data: allScores } = await supabase
        .from("scores")
        .select("session_id, verified, score, timestamp")
        .order("timestamp", { ascending: false })
        .limit(10);

      console.log("Recent scores in database:", allScores);

      const { data: allSessions } = await supabase
        .from("game_sessions")
        .select("id, status, start_time")
        .order("start_time", { ascending: false })
        .limit(5);

      console.log("Recent sessions in database:", allSessions);
    }

    // Add rank to each score
    const leaderboard = (scores || []).map((score, index) => ({
      ...score,
      rank: index + 1,
    }));

    console.log("📊 Final leaderboard:", leaderboard);
    console.log("=== END LEADERBOARD API DEBUG ===");

    return NextResponse.json({
      success: true,
      leaderboard,
      sessionId,
      totalScores: leaderboard.length,
      debug: {
        sessionExists: true,
        sessionStatus: session.status,
        scoresFound: scores?.length || 0,
        unverifiedScores: unverifiedScores?.length || 0,
      },
    });
  } catch (error) {
    console.error("💥 Leaderboard fetch error:", error);
    return NextResponse.json(
      {
        error: `Server error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        stack: error instanceof Error ? error.stack : undefined,
        success: false,
      },
      { status: 500 }
    );
  }
}

// Debug endpoint - keep this for troubleshooting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "debug") {
      console.log("🔧 Running debug action...");

      // Get all sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from("game_sessions")
        .select("*")
        .order("start_time", { ascending: false })
        .limit(5);

      // Get all scores
      const { data: allScores, error: scoresError } = await supabase
        .from("scores")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(20);

      // Get all players
      const { data: players, error: playersError } = await supabase
        .from("players")
        .select("*")
        .limit(10);

      // Get current active session
      const { data: activeSession } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("status", "active")
        .order("start_time", { ascending: false })
        .limit(1);

      return NextResponse.json({
        debug: true,
        timestamp: new Date().toISOString(),
        sessions: sessions || [],
        allScores: allScores || [],
        players: players || [],
        activeSession: activeSession || [],
        errors: {
          sessions: sessionsError,
          scores: scoresError,
          players: playersError,
        },
      });
    }

    if (action === "createTestData") {
      console.log("🧪 Creating test data...");

      // Get or create test session
      const { data: existingSession } = await supabase
        .from("game_sessions")
        .select("id")
        .eq("status", "active")
        .single();

      let sessionId = existingSession?.id;

      if (!sessionId) {
        const { data: newSession, error } = await supabase
          .from("game_sessions")
          .insert({
            status: "active",
            entry_fee: 0.1,
            prize_pool: 0,
            max_players: 50,
          })
          .select("id")
          .single();

        if (error) {
          return NextResponse.json(
            { error: "Failed to create session", success: false },
            { status: 500 }
          );
        }
        sessionId = newSession.id;
      }

      // Create test player and score
      const testWallet = `TEST${Date.now()}${Math.random()
        .toString(36)
        .substring(7)}`;
      const testUsername = `TestPlayer_${Math.random()
        .toString(36)
        .substring(7)}`;

      const { data: player, error: playerError } = await supabase
        .from("players")
        .upsert({
          wallet_address: testWallet,
          username: testUsername,
        })
        .select("id")
        .single();

      if (playerError) {
        return NextResponse.json(
          { error: "Failed to create player", success: false },
          { status: 500 }
        );
      }

      const testScore = Math.floor(Math.random() * 10000) + 1000;

      const { data: score, error: scoreError } = await supabase
        .from("scores")
        .insert({
          session_id: sessionId,
          player_id: player.id,
          wallet_address: testWallet,
          username: testUsername,
          score: testScore,
          verified: true,
        })
        .select()
        .single();

      if (scoreError) {
        return NextResponse.json(
          {
            error: `Failed to create score: ${scoreError.message}`,
            success: false,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        testData: { sessionId, player, score },
        message: "Test data created successfully",
      });
    }

    return NextResponse.json(
      {
        error: "Invalid action",
        success: false,
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("💥 Debug endpoint error:", error);
    return NextResponse.json(
      {
        error: `Debug error: ${
          error instanceof Error ? error.message : "Unknown"
        }`,
        success: false,
      },
      { status: 500 }
    );
  }
}
