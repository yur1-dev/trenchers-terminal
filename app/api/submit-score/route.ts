import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

function isValidSolanaAddress(address: string): boolean {
  try {
    const trimmed = address.trim();
    if (!trimmed || trimmed.length < 32 || trimmed.length > 44) return false;
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    if (!base58Regex.test(trimmed)) return false;
    const firstChar = trimmed.charAt(0);
    if (["0", "O", "I", "l"].includes(firstChar)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, username, score, sessionId } = await request.json();

    console.log("=== SCORE SUBMISSION DEBUG ===");
    console.log("Received data:", {
      walletAddress,
      username,
      score,
      sessionId,
    });

    // Validate inputs
    if (
      !walletAddress ||
      !username ||
      typeof score !== "number" ||
      !sessionId
    ) {
      console.log("❌ Missing required fields");
      return NextResponse.json(
        { error: "Missing required fields", success: false },
        { status: 400 }
      );
    }

    // Validate wallet address
    if (!isValidSolanaAddress(walletAddress)) {
      console.log("❌ Invalid wallet address:", walletAddress);
      return NextResponse.json(
        { error: "Invalid Solana wallet address", success: false },
        { status: 400 }
      );
    }

    // Validate score
    if (score < 0 || score > 10000000) {
      console.log("❌ Invalid score range:", score);
      return NextResponse.json(
        { error: "Invalid score range", success: false },
        { status: 400 }
      );
    }

    const truncatedUsername = username.substring(0, 50);

    // Check session exists and is active
    console.log("🔍 Checking session:", sessionId);
    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .select("id, status, start_time")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      console.error("❌ Session not found:", sessionError);
      return NextResponse.json(
        { error: "Session not found", success: false },
        { status: 404 }
      );
    }

    if (session.status !== "active") {
      console.log("❌ Session not active:", session.status);
      return NextResponse.json(
        { error: "Session no longer active", success: false },
        { status: 400 }
      );
    }

    // Check if score already exists and handle accordingly
    console.log("🔍 Checking for existing score...");
    const { data: existingScore, error: existingScoreError } = await supabase
      .from("scores")
      .select("id, score, timestamp")
      .eq("wallet_address", walletAddress)
      .eq("session_id", sessionId)
      .single();

    if (existingScore) {
      console.log("⚠️ Score already exists for this wallet in this session");

      if (score > existingScore.score) {
        // Update with higher score
        console.log("🔄 New score is higher, updating...");
        const { data: updatedScore, error: updateError } = await supabase
          .from("scores")
          .update({
            score: Math.floor(score),
            timestamp: new Date().toISOString(),
          })
          .eq("id", existingScore.id)
          .select()
          .single();

        if (updateError) {
          console.error("❌ Score update error:", updateError);
          return NextResponse.json(
            { error: "Failed to update score", success: false },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          scoreId: updatedScore.id,
          message: "Score updated successfully",
          updated: true,
        });
      } else {
        // Existing score is higher, just return success
        return NextResponse.json({
          success: true,
          scoreId: existingScore.id,
          message: "Score already recorded (existing score is higher)",
          existing: true,
        });
      }
    }

    // Get or create player
    console.log("👤 Processing player...");
    let player;

    const { data: existingPlayer } = await supabase
      .from("players")
      .select("*")
      .eq("wallet_address", walletAddress)
      .single();

    if (existingPlayer) {
      player = existingPlayer;
    } else {
      const { data: newPlayer, error: createError } = await supabase
        .from("players")
        .insert({
          wallet_address: walletAddress,
          username: truncatedUsername,
        })
        .select()
        .single();

      if (createError) {
        console.error("❌ Player creation error:", createError);
        return NextResponse.json(
          {
            error: `Player creation failed: ${createError.message}`,
            success: false,
          },
          { status: 500 }
        );
      }
      player = newPlayer;
    }

    // Insert new score
    console.log("💾 Inserting score...");
    const { data: scoreData, error: scoreError } = await supabase
      .from("scores")
      .insert({
        session_id: sessionId,
        player_id: player.id,
        wallet_address: walletAddress,
        username: truncatedUsername,
        score: Math.floor(score),
        verified: true,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (scoreError) {
      console.error("❌ Score insertion error:", scoreError);

      // Handle duplicate constraint error
      if (scoreError.code === "23505") {
        return NextResponse.json({
          success: true,
          message: "Score already exists for this session",
          existing: true,
        });
      }

      return NextResponse.json(
        {
          error: `Score submission failed: ${scoreError.message}`,
          success: false,
        },
        { status: 500 }
      );
    }

    console.log("✅ Score submitted successfully:", scoreData);
    return NextResponse.json({
      success: true,
      scoreId: scoreData.id,
      message: "Score submitted successfully",
    });
  } catch (error) {
    console.error("💥 Submit score error:", error);
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
