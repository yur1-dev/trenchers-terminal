// Replace your app/api/current-session/route.ts with this:

import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    console.log("=== CURRENT SESSION API START ===");

    // Check environment variables
    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing environment variables");
      return NextResponse.json(
        {
          error: "Server configuration error",
          success: false,
          details: {
            url_exists: !!supabaseUrl,
            key_exists: !!supabaseKey,
          },
        },
        { status: 500 }
      );
    }

    console.log("Environment variables OK");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to get current active session
    console.log("Fetching active session...");
    const { data: session, error } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("status", "active")
      .order("start_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log("Session query result:", { session, error });

    if (error) {
      console.error("Session query error:", error);
      return NextResponse.json(
        {
          error: `Database error: ${error.message}`,
          success: false,
          details: error,
        },
        { status: 500 }
      );
    }

    const now = new Date();

    // FIXED: Check if existing session has expired (30 minutes = 1800 seconds)
    if (session) {
      const sessionStart = new Date(session.start_time);
      const elapsed = Math.floor(
        (now.getTime() - sessionStart.getTime()) / 1000
      );

      console.log(
        `Session elapsed time: ${elapsed} seconds (${Math.floor(
          elapsed / 60
        )} minutes)`
      );
      console.log(`Session expires at: ${1800} seconds (30 minutes)`);

      // FIXED: Only expire if actually 30 minutes have passed
      if (elapsed >= 1800) {
        console.log(
          "Session actually expired after 30 minutes, ending it and creating new one..."
        );

        // End the expired session
        await supabase
          .from("game_sessions")
          .update({
            status: "ended",
            end_time: now.toISOString(),
          })
          .eq("id", session.id);

        // Process payouts here if needed
        console.log("Session ended, payouts should be processed");

        // Create new session
        const { data: newSession, error: createError } = await supabase
          .from("game_sessions")
          .insert({
            entry_fee: 0.1,
            prize_pool: 0,
            status: "active",
            max_players: 50,
            start_time: now.toISOString(),
          })
          .select()
          .single();

        if (createError) {
          console.error("New session creation error:", createError);
          return NextResponse.json(
            {
              error: `Failed to create new session: ${createError.message}`,
              success: false,
              details: createError,
            },
            { status: 500 }
          );
        }

        console.log("New session created after expiry:", newSession);

        return NextResponse.json({
          success: true,
          session: {
            ...newSession,
            players: 0,
            timeLeft: 10, // 30 minutes
          },
          message: "New session started - previous session ended",
        });
      } else {
        // FIXED: Session is still active, don't end it
        console.log(
          `Session is still active (${elapsed} seconds elapsed, need 1800)`
        );
      }
    }

    // If no session exists, create one
    if (!session) {
      console.log("No active session found, creating new one...");

      const { data: newSession, error: createError } = await supabase
        .from("game_sessions")
        .insert({
          entry_fee: 0.1,
          prize_pool: 0,
          status: "active",
          max_players: 50,
          start_time: now.toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error("Session creation error:", createError);
        return NextResponse.json(
          {
            error: `Failed to create session: ${createError.message}`,
            success: false,
            details: createError,
          },
          { status: 500 }
        );
      }

      console.log("New session created:", newSession);

      return NextResponse.json({
        success: true,
        session: {
          ...newSession,
          players: 0,
          timeLeft: 1800, // 30 minutes
        },
      });
    }

    // Calculate player count and time left for existing session
    console.log("Processing existing session:", session.id);

    // Get unique player count
    const { data: playerData, error: countError } = await supabase
      .from("scores")
      .select("wallet_address")
      .eq("session_id", session.id);

    let playerCount = 0;
    if (playerData && !countError) {
      const uniqueWallets = new Set(playerData.map((p) => p.wallet_address));
      playerCount = uniqueWallets.size;
    }

    // Calculate time left (30 minutes = 1800 seconds)
    const sessionStart = new Date(session.start_time);
    const elapsed = Math.floor((now.getTime() - sessionStart.getTime()) / 1000);
    const timeLeft = Math.max(0, 1800 - elapsed);

    const sessionData = {
      ...session,
      players: playerCount,
      timeLeft: timeLeft,
    };

    console.log("Returning session data:", sessionData);
    console.log("=== CURRENT SESSION API END ===");

    return NextResponse.json({
      success: true,
      session: sessionData,
    });
  } catch (error) {
    console.error("=== CURRENT SESSION API ERROR ===");
    console.error("Error details:", error);

    return NextResponse.json(
      {
        error: `Server error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        success: false,
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// POST method to force create new session or trigger payout
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    console.log("=== SESSION POST ACTION:", action, " ===");

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (action === "force_new_session") {
      // End current active sessions
      await supabase
        .from("game_sessions")
        .update({
          status: "ended",
          end_time: new Date().toISOString(),
        })
        .eq("status", "active");

      // Create new session
      const { data: newSession, error } = await supabase
        .from("game_sessions")
        .insert({
          entry_fee: 0.1,
          prize_pool: 0,
          status: "active",
          max_players: 50,
          start_time: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("New session creation error:", error);
        return NextResponse.json(
          {
            error: `Failed to create new session: ${error.message}`,
            success: false,
          },
          { status: 500 }
        );
      }

      console.log("New session created:", newSession);

      return NextResponse.json({
        success: true,
        session: {
          ...newSession,
          players: 0,
          timeLeft: 1800, // 30 minutes
        },
        message: "New game session started",
      });
    }

    if (action === "process_payouts") {
      // Get current active session
      const { data: session } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("status", "active")
        .single();

      if (!session) {
        return NextResponse.json(
          {
            error: "No active session found",
            success: false,
          },
          { status: 404 }
        );
      }

      // Get top 3 scores for this session
      const { data: topScores } = await supabase
        .from("scores")
        .select("*")
        .eq("session_id", session.id)
        .order("score", { ascending: false })
        .limit(3);

      console.log("Top scores for payout:", topScores);

      // Here you would implement the actual payout logic
      // For now, just log what would happen
      if (topScores && topScores.length > 0) {
        const prizePool = session.prize_pool || 1.0; // Default prize pool
        const payouts = {
          first: prizePool * 0.6,
          second: prizePool * 0.25,
          third: prizePool * 0.15,
        };

        console.log("Payouts would be:", {
          first: {
            wallet: topScores[0]?.wallet_address,
            amount: payouts.first,
          },
          second: {
            wallet: topScores[1]?.wallet_address,
            amount: payouts.second,
          },
          third: {
            wallet: topScores[2]?.wallet_address,
            amount: payouts.third,
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: "Payouts processed",
        session_id: session.id,
        top_scores: topScores,
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
    console.error("Session POST error:", error);
    return NextResponse.json(
      {
        error: `Server error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        success: false,
      },
      { status: 500 }
    );
  }
}
