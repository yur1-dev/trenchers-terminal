import { NextResponse } from "next/server";

// Simple in-memory storage for this demo
let isSocketServerReady = false;

export async function GET() {
  console.log("GET request to /api/socket - App Router version");

  try {
    // For App Router, we can't directly access the underlying server
    // So we'll just return a success response indicating the endpoint is ready
    isSocketServerReady = true;

    return NextResponse.json({
      success: true,
      message: "Socket endpoint ready - App Router version",
      timestamp: new Date().toISOString(),
      router: "app-router",
    });
  } catch (error) {
    console.error("Socket API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to initialize",
        message: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error: "POST not supported",
      message: "Use WebSocket connection instead",
    },
    { status: 405 }
  );
}
