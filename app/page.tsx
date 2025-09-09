"use client";
import type React from "react";
import { useState, useEffect, useRef, useCallback } from "react";

interface GameObject {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  type: string;
  health?: number;
  maxHealth?: number;
  bounces?: number;
  trail?: Array<{ x: number; y: number; alpha: number }>;
  lastShot?: number;
  shootCooldown?: number;
  rotationAngle?: number;
  orbitParticles?: Array<{ angle: number; distance: number; speed: number }>;
  weaponType?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type?: string;
}

interface EnemyProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  damage: number;
}

interface LeaderboardEntry {
  id: string;
  wallet_address: string;
  username: string;
  score: number;
  rank: number;
  timestamp: string;
}

interface GameSession {
  id: string;
  entry_fee: number;
  prize_pool: number;
  players: number;
  timeLeft: number;
  status: string;
}

interface ChatMessage {
  id: number;
  type: string;
  message: string;
  username: string;
  walletAddress: string;
  timestamp: string;
}

// Weapon types
interface WeaponType {
  name: string;
  damage: number;
  speed: number;
  cooldown: number;
  color: string;
  size: number;
  bounces: number;
  piercing?: boolean;
  spread?: number;
  count?: number;
}

const WEAPONS: { [key: string]: WeaponType } = {
  basic: {
    name: "BASIC_CANNON",
    damage: 1,
    speed: 8,
    cooldown: 200,
    color: "#ffffff",
    size: 6,
    bounces: 3,
  },
  rapid: {
    name: "RAPID_FIRE",
    damage: 1,
    speed: 10,
    cooldown: 100,
    color: "#ffff00",
    size: 4,
    bounces: 1,
  },
  heavy: {
    name: "HEAVY_CANNON",
    damage: 3,
    speed: 6,
    cooldown: 800,
    color: "#ff4444",
    size: 12,
    bounces: 5,
    piercing: true,
  },
  spread: {
    name: "SPREAD_SHOT",
    damage: 1,
    speed: 7,
    cooldown: 400,
    color: "#44ff44",
    size: 5,
    bounces: 2,
    spread: 0.5,
    count: 5,
  },
  laser: {
    name: "PLASMA_BEAM",
    damage: 2,
    speed: 15,
    cooldown: 300,
    color: "#ff44ff",
    size: 3,
    bounces: 0,
    piercing: true,
  },
};

// Background stars
interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  twinkle: number;
}

// Updated Solana wallet validation
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

const TerminalArtillery: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number | undefined>(undefined);
  const [gameState, setGameState] = useState<
    "menu" | "playing" | "gameOver" | "spectating"
  >("menu");
  const [walletConnected, setWalletConnected] = useState<boolean>(false);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [fullWalletAddress, setFullWalletAddress] = useState<string>("");
  const [walletInput, setWalletInput] = useState<string>("");
  const [walletError, setWalletError] = useState<string>("");
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(1800);

  // Chat states
  const [chatOpen, setChatOpen] = useState(false);
  const [chatConnected, setChatConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState("");
  const socketRef = useRef<any>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // Weapon system
  const [currentWeapon, setCurrentWeapon] = useState<string>("basic");
  const [weaponAmmo, setWeaponAmmo] = useState<{ [key: string]: number }>({
    basic: Infinity,
    rapid: 100,
    heavy: 20,
    spread: 50,
    laser: 30,
  });

  // Use refs for frequently updated values to prevent re-renders
  const forceFieldActiveRef = useRef<boolean>(false);
  const forceFieldCooldownRef = useRef<number>(0);
  const screenShakeRef = useRef<{
    intensity: number;
    duration: number;
    x: number;
    y: number;
  }>({
    intensity: 0,
    duration: 0,
    x: 0,
    y: 0,
  });
  const backgroundStarsRef = useRef<Star[]>([]);
  const lastShotTimeRef = useRef<number>(0);

  // Display states (updated less frequently)
  const [forceFieldDisplay, setForceFieldDisplay] = useState<{
    active: boolean;
    cooldown: number;
  }>({
    active: false,
    cooldown: 0,
  });
  const [sessionEnded, setSessionEnded] = useState(false);

  const forceFieldDuration = 180; // 3 seconds
  const forceFieldCooldownTime = 600; // 10 seconds

  // Debug and loading states
  const [debugMode, setDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [submitError, setSubmitError] = useState<string>("");
  const [scoreSubmitted, setScoreSubmitted] = useState(false);

  // Real data from API
  const [currentSession, setCurrentSession] = useState<GameSession | null>(
    null
  );
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Increased canvas size
  const canvasSize = { width: 800, height: 600 };

  // Game objects
  const playerRef = useRef<GameObject>({
    x: 500,
    y: 700,
    vx: 0,
    vy: 0,
    radius: 15,
    color: "#ffffff",
    type: "player",
    health: 100,
    maxHealth: 100,
  });

  const bouncyBallsRef = useRef<GameObject[]>([]);
  const enemiesRef = useRef<GameObject[]>([]);
  const enemyProjectilesRef = useRef<EnemyProjectile[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const mouseRef = useRef<{ x: number; y: number; pressed: boolean }>({
    x: 0,
    y: 0,
    pressed: false,
  });

  const addDebugInfo = useCallback((message: string) => {
    console.log(`[DEBUG] ${message}`);
    setDebugInfo(
      (prev) => `${prev}\n${new Date().toLocaleTimeString()}: ${message}`
    );
  }, []);

  // REPLACE the entire socket useEffect with this minimal version:

  // useEffect(() => {
  //   if (walletConnected && !socketRef.current) {
  //     console.log("Attempting minimal socket connection...");
  //     addDebugInfo("Starting minimal socket connection...");

  //     const connectSocket = async () => {
  //       try {
  //         // Import socket.io-client
  //         const { io } = await import("socket.io-client");

  //         console.log("Creating socket connection with minimal config...");

  //         // Connect with minimal configuration
  //         const socket = io({
  //           timeout: 10000,
  //           forceNew: true,
  //         });

  //         socketRef.current = socket;
  //         addDebugInfo("Socket instance created with minimal config");

  //         // Simple connection handler
  //         socket.on("connect", () => {
  //           console.log("✅ Socket connected!", socket.id);
  //           setChatConnected(true);
  //           setChatError("");
  //           addDebugInfo(`Connected with ID: ${socket.id}`);

  //           // Try to join chat
  //           socket.emit("join_chat", {
  //             walletAddress: fullWalletAddress,
  //             username: `Player_${walletAddress}`,
  //           });
  //         });

  //         socket.on("connect_error", (error) => {
  //           console.error("❌ Connection failed:", error);
  //           setChatConnected(false);
  //           setChatError("Connection failed");
  //           addDebugInfo(`Connection failed: ${error}`);
  //         });

  //         socket.on("disconnect", () => {
  //           console.log("🔌 Disconnected");
  //           setChatConnected(false);
  //           addDebugInfo("Disconnected from server");
  //         });

  //         // Chat events
  //         socket.on("chat_joined", (data) => {
  //           console.log("📨 Joined chat:", data);
  //           setChatMessages(data.recentMessages || []);
  //           setOnlineCount(data.onlineCount || 0);
  //           addDebugInfo(`Joined chat with ${data.onlineCount} users`);
  //         });

  //         socket.on("new_message", (message) => {
  //           console.log("💬 New message:", message);
  //           setChatMessages((prev) => [...prev, message]);
  //         });

  //         socket.on("user_joined", (data) => {
  //           setOnlineCount(data.onlineCount || 0);
  //         });

  //         socket.on("user_left", (data) => {
  //           setOnlineCount(data.onlineCount || 0);
  //         });

  //         socket.on("error", (error) => {
  //           console.error("💥 Socket error:", error);
  //           setChatError("Chat error occurred");
  //           addDebugInfo(`Socket error: ${error}`);
  //         });
  //       } catch (error) {
  //         console.error("🚨 Failed to create socket:", error);
  //         setChatError("Failed to initialize chat");
  //         addDebugInfo(`Init error: ${error}`);
  //       }
  //     };

  //     connectSocket();
  //   }
  // }, [walletConnected, fullWalletAddress, walletAddress, addDebugInfo]);

  // Replace the socket useEffect with this:
  useEffect(() => {
    if (walletConnected) {
      console.log("Chat disabled - focusing on game");
      setChatConnected(false);
      setChatError("Chat temporarily disabled");
      setOnlineCount(0);

      // Mock socket to prevent errors
      socketRef.current = {
        emit: () => {},
        disconnect: () => {},
        on: () => {},
      };
    }
  }, [walletConnected]);
  const sendChatMessage = useCallback(() => {
    if (!chatInput.trim() || !socketRef.current || !chatConnected) return;

    socketRef.current.emit("send_message", {
      message: chatInput.trim(),
    });

    setChatInput("");
  }, [chatInput, chatConnected]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  // FIXED - Cleanup socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // Initialize background stars
  useEffect(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 100; i++) {
      stars.push({
        x: Math.random() * canvasSize.width,
        y: Math.random() * canvasSize.height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.5 + 0.1,
        twinkle: Math.random() * Math.PI * 2,
      });
    }
    backgroundStarsRef.current = stars;
  }, []);

  // Update display states periodically (not every frame)
  useEffect(() => {
    const interval = setInterval(() => {
      setForceFieldDisplay({
        active: forceFieldActiveRef.current,
        cooldown: forceFieldCooldownRef.current,
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Enhanced screen shake function using refs
  const triggerScreenShake = useCallback(
    (intensity: number, duration: number) => {
      screenShakeRef.current = {
        intensity,
        duration,
        x: (Math.random() - 0.5) * intensity,
        y: (Math.random() - 0.5) * intensity,
      };

      setTimeout(() => {
        screenShakeRef.current = { intensity: 0, duration: 0, x: 0, y: 0 };
      }, duration);
    },
    []
  );

  // Fetch current session data
  const fetchCurrentSession = useCallback(async () => {
    try {
      addDebugInfo("Fetching current session...");
      const response = await fetch("/api/current-session");
      const data = await response.json();

      if (data.session) {
        setCurrentSession(data.session);
        setTimeLeft(data.session.timeLeft || 1800);
        addDebugInfo(`Session loaded: ${data.session.id}`);
      } else {
        addDebugInfo("No session data received");
      }
    } catch (error) {
      console.error("Error fetching session:", error);
      addDebugInfo(`Session fetch error: ${error}`);
    }
  }, [addDebugInfo]);

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    if (!currentSession) {
      addDebugInfo("Cannot fetch leaderboard: no current session");
      return;
    }

    try {
      addDebugInfo(`Fetching leaderboard for session: ${currentSession.id}`);
      const response = await fetch(
        `/api/leaderboard?sessionId=${currentSession.id}&limit=10`
      );
      const data = await response.json();

      if (data.success && data.leaderboard) {
        setLeaderboard(data.leaderboard);
        addDebugInfo(`Leaderboard loaded: ${data.leaderboard.length} entries`);
      } else {
        addDebugInfo(`Leaderboard error: ${data.error || "Unknown error"}`);
        console.error("Leaderboard error:", data);
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      addDebugInfo(`Leaderboard fetch error: ${error}`);
    }
  }, [currentSession, addDebugInfo]);

  // Debug function to create test data
  const createTestData = useCallback(async () => {
    try {
      addDebugInfo("Creating test data...");
      const response = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createTestData" }),
      });
      const data = await response.json();

      if (data.success) {
        addDebugInfo("Test data created successfully");
        await fetchLeaderboard();
      } else {
        addDebugInfo(`Test data creation failed: ${data.error}`);
      }
    } catch (error) {
      addDebugInfo(`Test data error: ${error}`);
    }
  }, [fetchLeaderboard, addDebugInfo]);

  // Initialize app data
  useEffect(() => {
    fetchCurrentSession();
  }, [fetchCurrentSession]);

  useEffect(() => {
    if (currentSession) {
      fetchLeaderboard();
      const interval = setInterval(async () => {
        await fetchLeaderboard();
        if (Math.random() < 0.1) {
          await fetchCurrentSession();
        }
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [currentSession?.id, fetchLeaderboard, fetchCurrentSession]);

  // Handle wallet address input
  const handleWalletSubmit = useCallback(() => {
    const trimmedAddress = walletInput.trim();

    if (!trimmedAddress) {
      setWalletError("Please enter a wallet address");
      return;
    }

    if (!isValidSolanaAddress(trimmedAddress)) {
      setWalletError(
        "Invalid Solana wallet address format. Please check your address."
      );
      return;
    }

    setFullWalletAddress(trimmedAddress);
    const formattedAddress =
      trimmedAddress.length > 10
        ? trimmedAddress.substring(0, 4) +
          "..." +
          trimmedAddress.substring(trimmedAddress.length - 4)
        : trimmedAddress;

    setWalletAddress(formattedAddress);
    setWalletConnected(true);
    setWalletError("");
    addDebugInfo(`Wallet connected: ${formattedAddress}`);
  }, [walletInput, addDebugInfo]);

  const initGame = useCallback(() => {
    playerRef.current = {
      x: canvasSize.width / 2,
      y: canvasSize.height - 100,
      vx: 0,
      vy: 0,
      radius: 15,
      color: "#ffffff",
      type: "player",
      health: 100,
      maxHealth: 100,
    };

    bouncyBallsRef.current = [];
    enemiesRef.current = [];
    enemyProjectilesRef.current = [];
    particlesRef.current = [];
    lastShotTimeRef.current = 0;
    forceFieldActiveRef.current = false;
    forceFieldCooldownRef.current = 0;

    setScore(0);
    setLevel(1);
    setLives(3);
    setSubmitError("");
    setScoreSubmitted(false);
    setSessionEnded(false);
    setCurrentWeapon("basic");
    setWeaponAmmo({
      basic: Infinity,
      rapid: 100,
      heavy: 20,
      spread: 50,
      laser: 30,
    });

    addDebugInfo("Game initialized");
  }, [addDebugInfo]);

  const createBouncyBall = useCallback(
    (
      x: number,
      y: number,
      targetX: number,
      targetY: number,
      weaponType: string = "basic"
    ) => {
      const weapon = WEAPONS[weaponType];
      const now = Date.now();

      if (now - lastShotTimeRef.current < weapon.cooldown) {
        return;
      }

      if (weaponAmmo[weaponType] <= 0) {
        return;
      }

      lastShotTimeRef.current = now;

      if (weaponType !== "basic") {
        setWeaponAmmo((prev) => ({
          ...prev,
          [weaponType]: prev[weaponType] - 1,
        }));
      }

      const baseAngle = Math.atan2(targetY - y, targetX - x);
      const projectileCount = weapon.count || 1;
      const spread = weapon.spread || 0;

      for (let i = 0; i < projectileCount; i++) {
        let angle = baseAngle;

        if (projectileCount > 1) {
          const spreadStep = spread / (projectileCount - 1);
          angle = baseAngle - spread / 2 + i * spreadStep;
        }

        bouncyBallsRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * weapon.speed,
          vy: Math.sin(angle) * weapon.speed,
          radius: weapon.size,
          color: weapon.color,
          type: "bouncyBall",
          bounces: weapon.bounces,
          trail: [],
          weaponType: weaponType,
        });
      }

      const flashCount = weapon.damage * 3;
      createParticles(x, y, weapon.color, flashCount, "spark");
      triggerScreenShake(weapon.damage * 2, 50 + weapon.damage * 25);
    },
    [weaponAmmo, triggerScreenShake]
  );

  const spawnEnemy = useCallback(() => {
    const enemyTypes = [
      {
        color: "#ff4444",
        radius: 20,
        health: 2,
        speed: 2,
        bouncy: false,
        shootCooldown: 120,
      },
      {
        color: "#ff8800",
        radius: 15,
        health: 1,
        speed: 4,
        bouncy: true,
        shootCooldown: 180,
      },
      {
        color: "#8800ff",
        radius: 25,
        health: 3,
        speed: 1.5,
        bouncy: false,
        shootCooldown: 90,
      },
      {
        color: "#00ff88",
        radius: 30,
        health: 5,
        speed: 1,
        bouncy: false,
        shootCooldown: 60,
      },
    ];

    const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    const side = Math.random() < 0.5 ? 0 : canvasSize.width;

    const orbitParticles = [];
    const particleCount = Math.floor(Math.random() * 4) + 3;
    for (let i = 0; i < particleCount; i++) {
      orbitParticles.push({
        angle: (i / particleCount) * Math.PI * 2,
        distance: type.radius + 15 + Math.random() * 10,
        speed: 0.05 + Math.random() * 0.1,
      });
    }

    enemiesRef.current.push({
      x: side,
      y: Math.random() * 300 + 50,
      vx: side === 0 ? type.speed : -type.speed,
      vy: type.bouncy ? (Math.random() - 0.5) * 3 : 0,
      radius: type.radius,
      color: type.color,
      type: "enemy",
      health: type.health,
      maxHealth: type.health,
      bounces: type.bouncy ? 5 : 0,
      trail: [],
      lastShot: 0,
      shootCooldown: type.shootCooldown,
      rotationAngle: 0,
      orbitParticles: orbitParticles,
    });

    createParticles(
      side,
      Math.random() * 300 + 50,
      type.color,
      25,
      "explosion"
    );
  }, []);

  const createEnemyProjectile = useCallback((enemy: GameObject) => {
    const player = playerRef.current;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      const speed = 3;
      enemyProjectilesRef.current.push({
        x: enemy.x,
        y: enemy.y,
        vx: (dx / distance) * speed,
        vy: (dy / distance) * speed,
        radius: 4,
        color: "#ff0000",
        damage: 1,
      });
    }
  }, []);

  const createParticles = useCallback(
    (x: number, y: number, color: string, count = 10, type = "default") => {
      for (let i = 0; i < count; i++) {
        let particle: Particle;

        switch (type) {
          case "explosion":
            particle = {
              x: x + (Math.random() - 0.5) * 30,
              y: y + (Math.random() - 0.5) * 30,
              vx: (Math.random() - 0.5) * 12,
              vy: (Math.random() - 0.5) * 12,
              life: 90,
              maxLife: 90,
              color,
              size: Math.random() * 6 + 3,
              type: "explosion",
            };
            break;
          case "spark":
            particle = {
              x: x + (Math.random() - 0.5) * 10,
              y: y + (Math.random() - 0.5) * 10,
              vx: (Math.random() - 0.5) * 15,
              vy: (Math.random() - 0.5) * 15,
              life: 30,
              maxLife: 30,
              color,
              size: Math.random() * 3 + 1,
              type: "spark",
            };
            break;
          default:
            particle = {
              x: x + (Math.random() - 0.5) * 20,
              y: y + (Math.random() - 0.5) * 20,
              vx: (Math.random() - 0.5) * 8,
              vy: (Math.random() - 0.5) * 8,
              life: 60,
              maxLife: 60,
              color,
              size: Math.random() * 4 + 2,
              type: "default",
            };
        }

        particlesRef.current.push(particle);
      }
    },
    []
  );

  // Submit score function
  const submitScore = useCallback(
    async (finalScore: number) => {
      if (scoreSubmitted || !currentSession || !fullWalletAddress) {
        addDebugInfo(
          "Score submission blocked - already submitted or missing data"
        );
        return;
      }

      setScoreSubmitted(true);
      setLoading(true);
      setSubmitError("");

      try {
        addDebugInfo(
          `Submitting score: ${finalScore} for session: ${currentSession.id}`
        );

        const requestBody = {
          walletAddress: fullWalletAddress,
          username: `Player_${walletAddress}`,
          score: finalScore,
          sessionId: currentSession.id,
        };

        const response = await fetch("/api/submit-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        const result = await response.json();

        if (result.success) {
          addDebugInfo("Score submitted successfully!");
          setTimeout(async () => {
            await fetchLeaderboard();
          }, 1500);
        } else {
          const errorMsg = result.error || "Unknown error";
          setSubmitError(errorMsg);
          addDebugInfo(`Score submission failed: ${errorMsg}`);
          setScoreSubmitted(false);
        }
      } catch (error) {
        const errorMsg = `Network error: ${error}`;
        setSubmitError(errorMsg);
        addDebugInfo(`Score submission error: ${errorMsg}`);
        setScoreSubmitted(false);
      } finally {
        setLoading(false);
      }
    },
    [
      currentSession,
      fullWalletAddress,
      walletAddress,
      fetchLeaderboard,
      addDebugInfo,
      scoreSubmitted,
    ]
  );

  // Handle game over
  const handleGameOver = useCallback(() => {
    if (gameState !== "playing" || scoreSubmitted) {
      addDebugInfo("Game over blocked - already processed");
      return;
    }

    addDebugInfo(`Game over! Final score: ${score}`);
    submitScore(score);

    if (timeLeft > 0) {
      setGameState("spectating");
    } else {
      setGameState("gameOver");
    }

    triggerScreenShake(20, 1000);
  }, [
    gameState,
    scoreSubmitted,
    score,
    submitScore,
    addDebugInfo,
    timeLeft,
    triggerScreenShake,
  ]);

  const updateGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (
      !canvas ||
      !["playing", "spectating"].includes(gameState) ||
      !walletConnected
    )
      return;

    if (forceFieldCooldownRef.current > 0) {
      forceFieldCooldownRef.current--;
    }

    if (gameState === "playing") {
      const player = playerRef.current;
      if (keysRef.current["a"] || keysRef.current["ArrowLeft"])
        player.vx = Math.max(player.vx - 0.5, -8);
      if (keysRef.current["d"] || keysRef.current["ArrowRight"])
        player.vx = Math.min(player.vx + 0.5, 8);
      if (keysRef.current["w"] || keysRef.current["ArrowUp"])
        player.vy = Math.max(player.vy - 0.5, -8);
      if (keysRef.current["s"] || keysRef.current["ArrowDown"])
        player.vy = Math.min(player.vy + 0.5, 8);

      player.vx *= 0.9;
      player.vy *= 0.9;
      player.x += player.vx;
      player.y += player.vy;

      player.x = Math.max(
        player.radius,
        Math.min(canvas.width - player.radius, player.x)
      );
      player.y = Math.max(
        player.radius,
        Math.min(canvas.height - player.radius, player.y)
      );
    }

    backgroundStarsRef.current = backgroundStarsRef.current
      .map((star) => ({
        ...star,
        twinkle: star.twinkle + star.speed,
        y: star.y + star.speed * 0.3,
      }))
      .filter((star) => star.y < canvasSize.height);

    if (Math.random() < 0.02 && backgroundStarsRef.current.length < 100) {
      backgroundStarsRef.current.push({
        x: Math.random() * canvasSize.width,
        y: 0,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.5 + 0.1,
        twinkle: Math.random() * Math.PI * 2,
      });
    }

    bouncyBallsRef.current = bouncyBallsRef.current.filter((ball) => {
      ball.x += ball.vx;
      ball.y += ball.vy;

      if (!ball.trail) ball.trail = [];
      ball.trail.push({ x: ball.x, y: ball.y, alpha: 1 });
      if (ball.trail.length > 15) ball.trail.shift();
      ball.trail.forEach((point, i) => {
        point.alpha = i / ball.trail!.length;
      });

      if (ball.x <= ball.radius || ball.x >= canvas.width - ball.radius) {
        ball.vx *= -0.8;
        ball.x =
          ball.x <= ball.radius ? ball.radius : canvas.width - ball.radius;
        if (ball.bounces) ball.bounces--;
        createParticles(ball.x, ball.y, ball.color, 10, "spark");
        triggerScreenShake(3, 100);
      }
      if (ball.y <= ball.radius || ball.y >= canvas.height - ball.radius) {
        ball.vy *= -0.8;
        ball.y =
          ball.y <= ball.radius ? ball.radius : canvas.height - ball.radius;
        if (ball.bounces) ball.bounces--;
        createParticles(ball.x, ball.y, ball.color, 10, "spark");
        triggerScreenShake(3, 100);
      }

      return ball.bounces === undefined || ball.bounces > 0;
    });

    enemiesRef.current = enemiesRef.current.filter((enemy) => {
      enemy.x += enemy.vx;
      enemy.y += enemy.vy;

      if (enemy.rotationAngle !== undefined) {
        enemy.rotationAngle += 0.08;
      }

      if (enemy.orbitParticles) {
        enemy.orbitParticles.forEach((particle) => {
          particle.angle += particle.speed;
        });
      }

      if (gameState === "playing") {
        if (enemy.lastShot === undefined) enemy.lastShot = 0;
        enemy.lastShot++;

        if (enemy.lastShot >= (enemy.shootCooldown || 120)) {
          const player = playerRef.current;
          const dx = player.x - enemy.x;
          const dy = player.y - enemy.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 400) {
            createEnemyProjectile(enemy);
            enemy.lastShot = 0;
            createParticles(enemy.x, enemy.y, enemy.color, 12, "spark");
          }
        }
      }

      if (enemy.bounces && enemy.bounces > 0) {
        if (enemy.x <= enemy.radius || enemy.x >= canvas.width - enemy.radius) {
          enemy.vx *= -1;
          enemy.x =
            enemy.x <= enemy.radius
              ? enemy.radius
              : canvas.width - enemy.radius;
        }
        if (
          enemy.y <= enemy.radius ||
          enemy.y >= canvas.height - enemy.radius
        ) {
          enemy.vy *= -1;
          enemy.y =
            enemy.y <= enemy.radius
              ? enemy.radius
              : canvas.height - enemy.radius;
        }
      }

      return (
        enemy.x > -50 &&
        enemy.x < canvas.width + 50 &&
        enemy.y > -50 &&
        enemy.y < canvas.height + 50
      );
    });

    enemyProjectilesRef.current = enemyProjectilesRef.current.filter(
      (projectile) => {
        projectile.x += projectile.vx;
        projectile.y += projectile.vy;
        createParticles(projectile.x, projectile.y, projectile.color + "40", 1);
        return (
          projectile.x > 0 &&
          projectile.x < canvas.width &&
          projectile.y > 0 &&
          projectile.y < canvas.height
        );
      }
    );

    particlesRef.current = particlesRef.current.filter((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;

      if (particle.type === "explosion") {
        particle.vx *= 0.95;
        particle.vy *= 0.95;
      } else if (particle.type === "spark") {
        particle.vx *= 0.98;
        particle.vy *= 0.98;
        particle.vy += 0.1;
      } else {
        particle.vx *= 0.98;
        particle.vy *= 0.98;
      }

      particle.life--;
      return particle.life > 0;
    });

    if (gameState === "playing") {
      bouncyBallsRef.current.forEach((ball, ballIndex) => {
        enemiesRef.current.forEach((enemy, enemyIndex) => {
          const dx = ball.x - enemy.x;
          const dy = ball.y - enemy.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < ball.radius + enemy.radius) {
            const weapon = WEAPONS[ball.weaponType || "basic"];
            enemy.health! -= weapon.damage;

            createParticles(enemy.x, enemy.y, enemy.color, 25, "explosion");
            triggerScreenShake(weapon.damage * 3, 150);

            if (enemy.health! <= 0) {
              setScore((prev) => {
                const newScore = prev + 100 * weapon.damage;
                addDebugInfo(`Score updated: ${newScore}`);
                return newScore;
              });
              createParticles(enemy.x, enemy.y, "#ffffff", 40, "explosion");
              triggerScreenShake(10, 250);
              enemiesRef.current.splice(enemyIndex, 1);
            }

            if (!weapon.piercing) {
              bouncyBallsRef.current.splice(ballIndex, 1);
            }
          }
        });
      });

      const player = playerRef.current;
      enemyProjectilesRef.current.forEach((projectile, projectileIndex) => {
        const dx = player.x - projectile.x;
        const dy = player.y - projectile.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < player.radius + projectile.radius) {
          if (forceFieldActiveRef.current) {
            createParticles(
              projectile.x,
              projectile.y,
              "#00ffff",
              25,
              "explosion"
            );
            triggerScreenShake(4, 100);
          } else {
            createParticles(player.x, player.y, "#ff4444", 20, "explosion");
            triggerScreenShake(15, 400);
            setLives((prev) => {
              const newLives = prev - projectile.damage;
              if (newLives <= 0) {
                handleGameOver();
              }
              return Math.max(0, newLives);
            });
          }
          enemyProjectilesRef.current.splice(projectileIndex, 1);
        }
      });

      enemiesRef.current.forEach((enemy, enemyIndex) => {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < player.radius + enemy.radius) {
          if (forceFieldActiveRef.current) {
            const pushForce = 20;
            const angle = Math.atan2(dy, dx);
            enemy.x -= Math.cos(angle) * pushForce;
            enemy.y -= Math.sin(angle) * pushForce;
            createParticles(enemy.x, enemy.y, "#00ffff", 25, "explosion");
            triggerScreenShake(8, 200);
          } else {
            createParticles(player.x, player.y, "#ff4444", 30, "explosion");
            triggerScreenShake(18, 500);
            enemiesRef.current.splice(enemyIndex, 1);
            setLives((prev) => {
              const newLives = prev - 1;
              if (newLives <= 0) {
                handleGameOver();
              }
              return newLives;
            });
          }
        }
      });

      if (Math.random() < 0.02 + level * 0.005) {
        spawnEnemy();
      }

      if (score > level * 1500) {
        setLevel((prev) => prev + 1);
        triggerScreenShake(8, 300);

        setWeaponAmmo((prev) => ({
          ...prev,
          rapid: prev.rapid + 20,
          heavy: prev.heavy + 5,
          spread: prev.spread + 15,
          laser: prev.laser + 10,
        }));
      }
    }
  }, [
    gameState,
    walletConnected,
    level,
    spawnEnemy,
    createParticles,
    createEnemyProjectile,
    handleGameOver,
    addDebugInfo,
    triggerScreenShake,
  ]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const shake = screenShakeRef.current;
    ctx.save();
    ctx.translate(shake.x, shake.y);

    ctx.fillStyle = "#000000";
    ctx.fillRect(
      -shake.x,
      -shake.y,
      canvas.width + Math.abs(shake.x * 2),
      canvas.height + Math.abs(shake.y * 2)
    );

    backgroundStarsRef.current.forEach((star) => {
      const alpha = (Math.sin(star.twinkle) + 1) * 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });

    const time = Date.now() * 0.001;
    ctx.strokeStyle = `rgba(0, 255, 255, 0.3)`;
    ctx.lineWidth = 1;

    for (let x = 0; x < canvas.width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, -shake.y);
      ctx.lineTo(x, canvas.height - shake.y);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(-shake.x, y);
      ctx.lineTo(canvas.width - shake.x, y);
      ctx.stroke();
    }

    particlesRef.current.forEach((particle) => {
      const alpha = particle.life / particle.maxLife;
      let size = particle.size * alpha;

      if (particle.type === "explosion") {
        const growthPhase = Math.min(
          1,
          (particle.maxLife - particle.life) / (particle.maxLife * 0.3)
        );
        size = particle.size * growthPhase * alpha;
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 10;
      } else if (particle.type === "spark") {
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 5;
      }

      ctx.fillStyle =
        particle.color +
        Math.floor(alpha * 255)
          .toString(16)
          .padStart(2, "0");
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    bouncyBallsRef.current.forEach((ball) => {
      if (ball.trail) {
        ball.trail.forEach((point, i) => {
          const alpha = point.alpha * 0.7;
          const trailSize = ball.radius * alpha * 0.8;

          ctx.shadowColor = ball.color;
          ctx.shadowBlur = 8;
          ctx.fillStyle =
            ball.color +
            Math.floor(alpha * 255)
              .toString(16)
              .padStart(2, "0");
          ctx.beginPath();
          ctx.arc(point.x, point.y, trailSize, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.shadowColor = ball.color;
      ctx.shadowBlur = 15;
      ctx.fillStyle = ball.color;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    enemyProjectilesRef.current.forEach((projectile) => {
      ctx.shadowColor = projectile.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = projectile.color;
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    enemiesRef.current.forEach((enemy) => {
      if (enemy.orbitParticles) {
        enemy.orbitParticles.forEach((particle) => {
          const particleX =
            enemy.x + Math.cos(particle.angle) * particle.distance;
          const particleY =
            enemy.y + Math.sin(particle.angle) * particle.distance;

          ctx.shadowColor = enemy.color;
          ctx.shadowBlur = 8;
          ctx.fillStyle = enemy.color;
          ctx.beginPath();
          ctx.arc(particleX, particleY, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      if (enemy.rotationAngle !== undefined) {
        ctx.strokeStyle = enemy.color + "60";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          enemy.x,
          enemy.y,
          enemy.radius + 10,
          enemy.rotationAngle,
          enemy.rotationAngle + Math.PI
        );
        ctx.stroke();
      }

      ctx.shadowColor = enemy.color;
      ctx.shadowBlur = 15;
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (enemy.health && enemy.maxHealth) {
        const barWidth = enemy.radius * 2;
        const barHeight = 4;
        const healthPercent = enemy.health / enemy.maxHealth;

        ctx.fillStyle = "#333333";
        ctx.fillRect(
          enemy.x - barWidth / 2,
          enemy.y - enemy.radius - 12,
          barWidth,
          barHeight
        );
        ctx.fillStyle = "#00ff00";
        ctx.fillRect(
          enemy.x - barWidth / 2,
          enemy.y - enemy.radius - 12,
          barWidth * healthPercent,
          barHeight
        );
      }
    });

    if (gameState === "playing") {
      const player = playerRef.current;

      if (forceFieldActiveRef.current) {
        for (let i = 0; i < 3; i++) {
          const radius = player.radius + 20 + i * 8;
          const alpha = (Math.sin(time * 4 + i * 1.5) + 1) * 0.3;

          ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
          ctx.lineWidth = 3 - i;
          ctx.beginPath();
          ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.shadowColor = player.color;
      ctx.shadowBlur = 20;
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (gameState === "playing") {
      ctx.strokeStyle = `rgba(255, 255, 255, 0.8)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mouseRef.current.x - 12, mouseRef.current.y);
      ctx.lineTo(mouseRef.current.x + 12, mouseRef.current.y);
      ctx.moveTo(mouseRef.current.x, mouseRef.current.y - 12);
      ctx.lineTo(mouseRef.current.x, mouseRef.current.y + 12);
      ctx.stroke();
    }

    if (sessionEnded) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(
        -shake.x,
        -shake.y,
        canvas.width + Math.abs(shake.x * 2),
        canvas.height + Math.abs(shake.y * 2)
      );

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 36px Courier New";
      ctx.textAlign = "center";
      ctx.fillText("SESSION ENDED", canvas.width / 2, canvas.height / 2 - 20);

      ctx.font = "18px Courier New";
      ctx.fillText(
        "REWARDS WILL BE DISTRIBUTED",
        canvas.width / 2,
        canvas.height / 2 + 30
      );
    }

    ctx.restore();
  }, [gameState, sessionEnded]);

  // Timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (
      currentSession &&
      currentSession.timeLeft > 0 &&
      walletConnected &&
      !sessionEnded &&
      timeLeft > 0
    ) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          const newTimeLeft = prev - 1;
          if (newTimeLeft <= 0) {
            setSessionEnded(true);
            addDebugInfo("Session ended - rewards will be distributed");
            if (gameState === "playing" && !scoreSubmitted) {
              handleGameOver();
            }
            return 0;
          }
          return newTimeLeft;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [
    currentSession,
    walletConnected,
    sessionEnded,
    timeLeft,
    gameState,
    scoreSubmitted,
    handleGameOver,
    addDebugInfo,
  ]);

  // Force field duration effect
  useEffect(() => {
    let forceFieldTimer: NodeJS.Timeout;
    if (forceFieldActiveRef.current) {
      forceFieldTimer = setTimeout(() => {
        forceFieldActiveRef.current = false;
      }, forceFieldDuration * 16.67);
    }
    return () => clearTimeout(forceFieldTimer);
  }, [forceFieldDisplay.active, forceFieldDuration]);

  // Game loop
  useEffect(() => {
    const gameLoop = () => {
      updateGame();
      render();
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    if (
      (gameState === "playing" || gameState === "spectating") &&
      walletConnected
    ) {
      gameLoop();
    } else if (walletConnected) {
      render();
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, walletConnected, updateGame, render]);

  // Event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;

      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (
          gameState === "playing" &&
          !forceFieldActiveRef.current &&
          forceFieldCooldownRef.current === 0
        ) {
          forceFieldActiveRef.current = true;
          forceFieldCooldownRef.current = forceFieldCooldownTime;
          addDebugInfo("Force field activated!");
          triggerScreenShake(8, 250);
        }
      }

      if (gameState === "playing") {
        if (e.key >= "1" && e.key <= "5") {
          const weaponKeys = ["basic", "rapid", "heavy", "spread", "laser"];
          const weaponIndex = parseInt(e.key) - 1;
          const weaponName = weaponKeys[weaponIndex];

          if (weaponAmmo[weaponName] > 0 || weaponName === "basic") {
            setCurrentWeapon(weaponName);
            addDebugInfo(`Switched to ${WEAPONS[weaponName].name}`);
          }
        }
      }

      if (e.key === "t" || e.key === "T") {
        if (walletConnected && !chatInput) {
          e.preventDefault();
          setChatOpen((prev) => !prev);
        }
      }

      if (e.key === "Enter" && !walletConnected && walletInput.trim()) {
        handleWalletSubmit();
      }
      if (e.key === "F12" || (e.ctrlKey && e.key === "`")) {
        e.preventDefault();
        setDebugMode((prev) => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x =
        (e.clientX - rect.left) * (canvasSize.width / rect.width);
      mouseRef.current.y =
        (e.clientY - rect.top) * (canvasSize.height / rect.height);
    };

    const handleMouseDown = (e: MouseEvent) => {
      mouseRef.current.pressed = true;
      if (gameState === "playing" && walletConnected) {
        createBouncyBall(
          playerRef.current.x,
          playerRef.current.y,
          mouseRef.current.x,
          mouseRef.current.y,
          currentWeapon
        );
      }
    };

    const handleMouseUp = () => {
      mouseRef.current.pressed = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("mousemove", handleMouseMove);
      canvas.addEventListener("mousedown", handleMouseDown);
      canvas.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (canvas) {
        canvas.removeEventListener("mousemove", handleMouseMove);
        canvas.removeEventListener("mousedown", handleMouseDown);
        canvas.removeEventListener("mouseup", handleMouseUp);
      }
    };
  }, [
    gameState,
    walletConnected,
    walletInput,
    currentWeapon,
    weaponAmmo,
    createBouncyBall,
    handleWalletSubmit,
    addDebugInfo,
    triggerScreenShake,
    chatInput,
  ]);

  const startGame = () => {
    if (!walletConnected) return;
    initGame();
    setGameState("playing");
  };

  const backToMenu = () => {
    setGameState("menu");
    setSessionEnded(false);
  };

  const disconnectWallet = () => {
    setWalletConnected(false);
    setWalletAddress("");
    setFullWalletAddress("");
    setWalletInput("");
    setWalletError("");
    setGameState("menu");
    setSessionEnded(false);
    addDebugInfo("Wallet disconnected");

    if (socketRef.current) {
      socketRef.current.disconnect();
      setChatConnected(false);
      setChatOpen(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${mins
        .toString()
        .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const getShieldClassName = () => {
    if (forceFieldDisplay.active) return "text-cyan-400";
    if (forceFieldDisplay.cooldown > 0) return "text-red-400";
    return "text-green-400";
  };

  const getShieldText = () => {
    if (forceFieldDisplay.active) return "ACTIVE";
    if (forceFieldDisplay.cooldown > 0)
      return `${Math.ceil(forceFieldDisplay.cooldown / 60)}s`;
    return "READY";
  };

  const getGameStateDisplay = () => {
    if (sessionEnded) return "SESSION_ENDED";
    if (gameState === "spectating") return "SPECTATING";
    return gameState.toUpperCase();
  };

  return (
    <div
      className="min-h-screen bg-black flex font-mono text-white overflow-hidden"
      style={{ fontFamily: "Courier New, monospace" }}
    >
      {/* Debug Panel */}
      {debugMode && (
        <div className="fixed top-0 right-0 w-96 h-screen bg-black bg-opacity-90 border-l border-gray-600 p-4 overflow-y-auto z-50">
          <div className="mb-4">
            <h3 className="text-yellow-400 font-bold mb-2">DEBUG PANEL</h3>
            <button
              onClick={() => setDebugMode(false)}
              className="text-red-400 text-sm"
            >
              Close (F12)
            </button>
          </div>

          <div className="mb-4">
            <button
              onClick={createTestData}
              className="bg-yellow-600 text-black px-2 py-1 text-sm mr-2"
            >
              Create Test Data
            </button>
            <button
              onClick={fetchLeaderboard}
              className="bg-blue-600 text-white px-2 py-1 text-sm mr-2"
            >
              Refresh Leaderboard
            </button>
            <button
              onClick={() => setDebugInfo("")}
              className="bg-red-600 text-white px-2 py-1 text-sm"
            >
              Clear Log
            </button>
          </div>

          <div className="mb-4">
            <h4 className="text-green-400 font-bold mb-1">Current State:</h4>
            <div className="text-xs text-gray-300">
              <div>Session: {currentSession?.id || "None"}</div>
              <div>Wallet: {fullWalletAddress || "None"}</div>
              <div>Game State: {gameState}</div>
              <div>Score: {score}</div>
              <div>Current Weapon: {currentWeapon}</div>
              <div>Leaderboard Entries: {leaderboard.length}</div>
              <div>Score Submitted: {scoreSubmitted ? "Yes" : "No"}</div>
              <div>Session Ended: {sessionEnded ? "Yes" : "No"}</div>
              <div>Time Left: {timeLeft}s</div>
              <div>Chat Connected: {chatConnected ? "Yes" : "No"}</div>
              <div>Online Users: {onlineCount}</div>
            </div>
          </div>

          <div>
            <h4 className="text-blue-400 font-bold mb-1">Debug Log:</h4>
            <pre className="text-xs text-gray-300 whitespace-pre-wrap h-64 overflow-y-auto">
              {debugInfo || "No debug info yet..."}
            </pre>
          </div>
        </div>
      )}

      {/* Chat Panel */}
      {chatOpen && walletConnected && (
        <div className="fixed top-0 left-0 w-80 h-screen bg-black bg-opacity-95 border-r border-gray-600 z-40 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-600 bg-gray-900">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">GLOBAL CHAT</h3>
              <button
                onClick={() => setChatOpen(false)}
                className="text-red-400 hover:text-red-300"
              >
                [X]
              </button>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              <span
                className={`inline-block w-2 h-2 rounded-full mr-2 ${
                  chatConnected ? "bg-green-400" : "bg-red-400"
                }`}
              ></span>
              {chatConnected ? `${onlineCount} online` : "Disconnected"}
            </div>
            {chatError && (
              <div className="text-red-400 text-xs mt-1">{chatError}</div>
            )}
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {chatMessages.map((msg) => (
              <div key={msg.id} className="text-sm">
                {msg.type === "system" ? (
                  <div className="text-yellow-400 italic">* {msg.message}</div>
                ) : (
                  <div>
                    <span className="text-gray-400">
                      [
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      ]
                    </span>
                    <span className="text-cyan-400 ml-1">{msg.username}:</span>
                    <span className="text-white ml-1">{msg.message}</span>
                  </div>
                )}
              </div>
            ))}
            <div ref={chatMessagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-gray-600">
            <div className="flex space-x-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    sendChatMessage();
                  }
                }}
                placeholder="Type message..."
                className="flex-1 bg-gray-800 text-white px-3 py-2 text-sm border border-gray-600 focus:border-cyan-400 focus:outline-none"
                maxLength={200}
                disabled={!chatConnected}
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatConnected || !chatInput.trim()}
                className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white px-3 py-2 text-sm font-bold"
              >
                SEND
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Press T to toggle chat • Max 200 chars
            </div>
          </div>
        </div>
      )}

      {/* Main Menu */}
      {!walletConnected && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center space-y-8 max-w-4xl w-full">
            <div className="relative inline-block">
              <h1
                className="text-4xl md:text-6xl lg:text-6xl font-black mt-6 tracking-wider font-mono text-white"
                style={{ textShadow: "0 0 20px #ffffff" }}
              >
                &gt;TRENCHERS_TERMINAL.EXE
              </h1>
            </div>
            <p className="text-lg md:text-xl font-mono mb-8 tracking-wide text-gray-300">
              [AIM] [FIRE] [SURVIVE] BALLISTIC_WARFARE
            </p>

            <div className="bg-black border border-gray-600 rounded p-6 max-w-2xl mx-auto">
              <h3
                className="text-xl md:text-2xl font-bold mb-6 flex items-center justify-center space-x-3 font-mono text-white"
                style={{ textShadow: "0 0 5px #ffffff" }}
              >
                <span>&gt;</span>
                <span>MISSION_BRIEFING.TXT</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-400 mb-6">
                <div className="text-center">
                  <div className="text-3xl md:text-4xl mb-4 font-mono text-white">
                    [WASD]
                  </div>
                  <p className="text-sm font-mono">
                    Navigate through the terminal grid
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-3xl md:text-4xl mb-4 font-mono text-white">
                    [CLICK]
                  </div>
                  <p className="text-sm font-mono">
                    Launch ballistic projectiles
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-3xl md:text-4xl mb-4 font-mono text-white">
                    [1-5]
                  </div>
                  <p className="text-sm font-mono">Switch weapon systems</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl md:text-4xl mb-4 font-mono text-white">
                    [T]
                  </div>
                  <p className="text-sm font-mono">Toggle global chat</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-mono text-gray-300 mb-2">
                    &gt; ENTER_SOLANA_WALLET_ADDRESS:
                  </label>
                  <input
                    type="text"
                    value={walletInput}
                    onChange={(e) => {
                      setWalletInput(e.target.value);
                      if (walletError) setWalletError("");
                    }}
                    placeholder="4xP7fXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX (paste your Solana wallet address)"
                    className="w-full p-3 bg-black border border-gray-600 text-white font-mono text-sm focus:border-cyan-400 focus:outline-none"
                    style={{ fontFamily: "Courier New, monospace" }}
                  />
                  {walletError && (
                    <p className="text-red-400 text-sm font-mono mt-2">
                      &gt; ERROR: {walletError}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 font-mono mt-1">
                    &gt; This wallet will receive rewards from your gameplay
                  </p>
                </div>

                <button
                  onClick={handleWalletSubmit}
                  disabled={!walletInput.trim()}
                  className="w-full font-bold py-4 px-8 rounded transition-all font-mono bg-white text-black border border-gray-300 hover:bg-gray-200 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  <span>&gt; CONNECT_WALLET</span>
                </button>
              </div>

              <div className="mt-4 text-center">
                <button
                  onClick={() => setDebugMode(true)}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  [F12 for debug panel]
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Interface */}
      {walletConnected && (
        <div
          className="flex-1 flex flex-col"
          style={{ marginLeft: chatOpen ? "320px" : "0" }}
        >
          {/* Compact Header */}
          <div className="p-3 border-b border-gray-600 bg-gray-900">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <h1 className="text-lg font-bold text-white">
                  TERMINAL_ARTILLERY
                </h1>
                <span className="text-cyan-400">W:{walletAddress}</span>
                <button
                  disabled
                  className="text-xs px-2 py-1 border rounded bg-gray-600 text-gray-400 cursor-not-allowed"
                >
                  CHAT [DISABLED]
                </button>
              </div>
              <button
                onClick={disconnectWallet}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                DISCONNECT
              </button>
            </div>

            {gameState === "playing" && (
              <div className="flex justify-between items-center mt-2 text-xs">
                <div className="flex space-x-4">
                  <span>SC:{score.toLocaleString()}</span>
                  <span>T:{formatTime(timeLeft)}</span>
                  <span>L:{lives}</span>
                  <span>LV:{level}</span>
                  <span className={getShieldClassName()}>
                    S:{getShieldText()}
                  </span>
                </div>
                <div className="text-yellow-400">
                  {WEAPONS[currentWeapon].name} (
                  {weaponAmmo[currentWeapon] === Infinity
                    ? "∞"
                    : weaponAmmo[currentWeapon]}
                  )
                </div>
              </div>
            )}

            {gameState === "menu" && !sessionEnded && (
              <button
                onClick={startGame}
                className="mt-2 bg-white text-black px-4 py-1 font-bold hover:bg-gray-200 transition-all text-sm"
              >
                START GAME
              </button>
            )}

            {(gameState === "gameOver" || gameState === "spectating") && (
              <div className="mt-2 flex space-x-2 text-sm">
                {!sessionEnded && (
                  <>
                    <button
                      onClick={startGame}
                      className="bg-white text-black px-3 py-1 font-bold hover:bg-gray-200"
                    >
                      RETRY
                    </button>
                    <button
                      onClick={backToMenu}
                      className="bg-gray-700 text-white px-3 py-1 font-bold hover:bg-gray-600"
                    >
                      MENU
                    </button>
                  </>
                )}
                <span className="text-yellow-400">
                  FINAL: {score.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Game Area */}
          <div className="flex-1 flex justify-center items-center p-4">
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                className="border-2 border-white bg-black"
              />

              {/* Leaderboard */}
              <div className="absolute top-0 left-full ml-4 w-64 border border-gray-600 bg-gray-900 bg-opacity-50 h-fit">
                <div className="p-3 border-b border-gray-600 bg-black bg-opacity-50">
                  <h2 className="text-sm font-bold text-white">LEADERBOARD</h2>
                  <div className="text-xs text-gray-400 mt-1">
                    Time: {formatTime(timeLeft)} | Players:{" "}
                    {currentSession?.players || 0}
                  </div>
                </div>

                <div className="p-3 max-h-80 overflow-y-auto">
                  {leaderboard.length === 0 ? (
                    <div className="text-center text-gray-400 text-xs">
                      No scores yet
                    </div>
                  ) : (
                    leaderboard.map((entry) => {
                      const isCurrentPlayer =
                        entry.wallet_address === fullWalletAddress;
                      const displayWallet =
                        entry.wallet_address.length > 10
                          ? entry.wallet_address.substring(0, 4) +
                            "..." +
                            entry.wallet_address.substring(
                              entry.wallet_address.length - 4
                            )
                          : entry.wallet_address;

                      return (
                        <div
                          key={entry.id}
                          className={`mb-2 p-2 text-xs border ${
                            isCurrentPlayer
                              ? "border-white bg-gray-800"
                              : "border-gray-600"
                          }`}
                        >
                          <div className="flex justify-between">
                            <span>#{entry.rank}</span>
                            <span>{displayWallet}</span>
                            <span className="font-bold">
                              {entry.score.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TerminalArtillery;
