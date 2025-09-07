// app/api/network-test/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  console.log("Testing network connectivity to:", supabaseUrl);

  try {
    // Test 1: Basic fetch to Supabase
    console.log("Test 1: Basic fetch test...");
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: "HEAD",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      },
    });

    console.log("Basic fetch status:", response.status);

    // Test 2: Test with different fetch options
    console.log("Test 2: Fetch with timeout...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response2 = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: "HEAD",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log("Timeout fetch status:", response2.status);

    return NextResponse.json({
      success: true,
      tests: {
        basicFetch: response.status,
        timeoutFetch: response2.status,
      },
      url: supabaseUrl,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Network test failed:", error);

    return NextResponse.json(
      {
        error: "Network test failed",
        details: {
          message: error instanceof Error ? error.message : "Unknown error",
          name: error instanceof Error ? error.name : undefined,
          cause: error instanceof Error ? error.cause : undefined,
        },
        url: supabaseUrl,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
