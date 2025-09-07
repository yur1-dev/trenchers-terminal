// Create this as: app/api/test-db/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    console.log("Testing database connection...");
    console.log("URL:", supabaseUrl);
    console.log("Key length:", supabaseKey?.length);

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        error: "Missing environment variables",
        details: {
          url: !!supabaseUrl,
          key: !!supabaseKey,
        },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test 1: Check tables exist
    const { data: sessions, error: sessionError } = await supabase
      .from("game_sessions")
      .select("*")
      .limit(3);

    const { data: players, error: playerError } = await supabase
      .from("players")
      .select("*")
      .limit(3);

    const { data: scores, error: scoreError } = await supabase
      .from("scores")
      .select("*")
      .limit(3);

    // Test 2: Try to create a session
    const { data: newSession, error: createError } = await supabase
      .from("game_sessions")
      .insert({
        entry_fee: 0.1,
        prize_pool: 0,
        status: "active",
        max_players: 50,
      })
      .select()
      .single();

    // Clean up test session
    if (newSession) {
      await supabase.from("game_sessions").delete().eq("id", newSession.id);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: {
        tables: {
          game_sessions: {
            accessible: !sessionError,
            count: sessions?.length || 0,
            error: sessionError?.message,
          },
          players: {
            accessible: !playerError,
            count: players?.length || 0,
            error: playerError?.message,
          },
          scores: {
            accessible: !scoreError,
            count: scores?.length || 0,
            error: scoreError?.message,
          },
        },
        session_creation: {
          success: !createError,
          error: createError?.message,
          test_session_created: !!newSession,
        },
      },
      data: {
        existing_sessions: sessions || [],
        existing_players: players || [],
        existing_scores: scores || [],
      },
    });
  } catch (error) {
    console.error("Database test error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
