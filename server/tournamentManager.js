// server/tournamentManager.js - Server-side tournament management
class TournamentManager {
  constructor(io) {
    this.io = io;
    this.currentTournament = {
      id: null,
      currentSession: null,
      leaderboard: [],
      allPlayers: [],
      gameQueue: ["snake", "flappy-bird", "terminal-artillery"],
      currentGameIndex: 0,
      status: "idle",
    };
    this.gameTimers = new Map();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on("connection", (socket) => {
      console.log(`Player connected: ${socket.id}`);

      // Send current tournament state to new connection
      socket.emit("tournament-state", this.currentTournament);

      // Handle joining tournament
      socket.on("join-tournament", (playerName) => {
        this.handleJoinTournament(socket, playerName);
      });

      // Handle game score updates
      socket.on("update-score", (data) => {
        this.handleScoreUpdate(socket, data);
      });

      // Handle game completion
      socket.on("game-complete", (data) => {
        this.handleGameComplete(socket, data);
      });

      // Handle retry game request
      socket.on("retry-game", () => {
        this.handleRetryGame(socket);
      });

      // Handle start tournament
      socket.on("start-tournament", () => {
        this.startTournament();
      });

      // Handle next game
      socket.on("next-game", () => {
        this.proceedToNextGame();
      });

      // Handle disconnect
      socket.on("disconnect", () => {
        this.handleDisconnect(socket);
      });
    });
  }

  handleJoinTournament(socket, playerName) {
    if (!playerName || playerName.trim() === "") {
      socket.emit("error", { message: "Player name is required" });
      return;
    }

    // Check if tournament is in a joinable state
    if (
      !this.currentTournament.currentSession ||
      this.currentTournament.currentSession.status !== "waiting"
    ) {
      socket.emit("error", { message: "Cannot join at this time" });
      return;
    }

    // Check if player already exists
    const existingPlayer = this.currentTournament.currentSession.players.find(
      (p) => p.name === playerName
    );

    if (existingPlayer) {
      // Reconnect existing player
      existingPlayer.socketId = socket.id;
      existingPlayer.isActive = true;
    } else {
      // Add new player
      if (
        this.currentTournament.currentSession.players.length >=
        this.currentTournament.currentSession.maxPlayers
      ) {
        socket.emit("error", { message: "Game is full" });
        return;
      }

      const newPlayer = {
        id: `player-${Date.now()}-${Math.random()}`,
        name: playerName.trim(),
        socketId: socket.id,
        score: 0,
        isActive: true,
        joinedAt: new Date(),
      };

      this.currentTournament.currentSession.players.push(newPlayer);
      this.currentTournament.allPlayers.push(newPlayer);
    }

    // Broadcast updated state
    this.broadcastTournamentState();

    // Auto-start if enough players
    if (this.currentTournament.currentSession.players.length >= 2) {
      setTimeout(() => {
        this.startGameCountdown();
      }, 2000);
    }
  }

  handleScoreUpdate(socket, data) {
    if (
      !this.currentTournament.currentSession ||
      this.currentTournament.currentSession.status !== "playing"
    ) {
      return;
    }

    const player = this.currentTournament.currentSession.players.find(
      (p) => p.socketId === socket.id
    );

    if (player && typeof data.score === "number") {
      player.score = Math.max(player.score, data.score); // Keep highest score
      this.broadcastTournamentState();
    }
  }

  handleGameComplete(socket, data) {
    const player = this.currentTournament.currentSession?.players.find(
      (p) => p.socketId === socket.id
    );

    if (player) {
      player.score = data.finalScore || player.score;
      player.completedAt = new Date();

      // Check if all players completed
      const activePlayers =
        this.currentTournament.currentSession.players.filter((p) => p.isActive);
      const completedPlayers = activePlayers.filter((p) => p.completedAt);

      if (completedPlayers.length === activePlayers.length) {
        this.endCurrentGame();
      }
    }
  }

  handleRetryGame(socket) {
    if (
      this.currentTournament.status === "between-games" ||
      this.currentTournament.status === "finished"
    ) {
      // Reset current game for retry
      if (this.currentTournament.currentSession) {
        this.currentTournament.currentSession.players.forEach((player) => {
          player.score = 0;
          delete player.completedAt;
        });
        this.currentTournament.currentSession.status = "waiting";
        this.currentTournament.status = "active";
        this.broadcastTournamentState();
      }
    }
  }

  handleDisconnect(socket) {
    if (this.currentTournament.currentSession) {
      const player = this.currentTournament.currentSession.players.find(
        (p) => p.socketId === socket.id
      );

      if (player) {
        player.isActive = false;
        this.broadcastTournamentState();
      }
    }
  }

  startTournament() {
    if (this.currentTournament.status !== "idle") return;

    this.currentTournament.id = `tournament-${Date.now()}`;
    this.currentTournament.status = "active";
    this.currentTournament.currentGameIndex = 0;
    this.currentTournament.leaderboard = [];

    this.createGameSession(this.currentTournament.gameQueue[0]);
  }

  createGameSession(gameType) {
    this.currentTournament.currentSession = {
      id: `session-${Date.now()}`,
      gameType,
      players: [],
      status: "waiting",
      startTime: null,
      endTime: null,
      duration: 120, // 2 minutes
      maxPlayers: 4,
      results: [],
    };

    this.broadcastTournamentState();
    this.io.emit("game-session-created", {
      gameType,
      sessionId: this.currentTournament.currentSession.id,
    });
  }

  startGameCountdown() {
    if (
      !this.currentTournament.currentSession ||
      this.currentTournament.currentSession.status !== "waiting"
    ) {
      return;
    }

    this.currentTournament.currentSession.status = "countdown";
    this.broadcastTournamentState();

    // Countdown sequence
    let countdown = 3;
    const countdownInterval = setInterval(() => {
      this.io.emit("countdown", countdown);
      countdown--;

      if (countdown < 0) {
        clearInterval(countdownInterval);
        this.startGame();
      }
    }, 1000);
  }

  startGame() {
    if (!this.currentTournament.currentSession) return;

    this.currentTournament.currentSession.status = "playing";
    this.currentTournament.currentSession.startTime = new Date();

    this.broadcastTournamentState();
    this.io.emit("game-started", {
      gameType: this.currentTournament.currentSession.gameType,
      duration: this.currentTournament.currentSession.duration,
    });

    // Set game timer
    const gameTimer = setTimeout(() => {
      this.endCurrentGame();
    }, this.currentTournament.currentSession.duration * 1000);

    this.gameTimers.set(this.currentTournament.currentSession.id, gameTimer);
  }

  endCurrentGame() {
    if (
      !this.currentTournament.currentSession ||
      this.currentTournament.currentSession.status !== "playing"
    ) {
      return;
    }

    // Clear game timer
    const timer = this.gameTimers.get(this.currentTournament.currentSession.id);
    if (timer) {
      clearTimeout(timer);
      this.gameTimers.delete(this.currentTournament.currentSession.id);
    }

    this.currentTournament.currentSession.status = "results";
    this.currentTournament.currentSession.endTime = new Date();

    // Calculate results
    const sortedPlayers = [
      ...this.currentTournament.currentSession.players,
    ].sort((a, b) => b.score - a.score);

    const results = sortedPlayers.map((player, index) => ({
      playerId: player.id,
      playerName: player.name,
      score: player.score,
      rank: index + 1,
      gameType: this.currentTournament.currentSession.gameType,
      completedAt: new Date(),
    }));

    this.currentTournament.currentSession.results = results;
    this.currentTournament.leaderboard.push(...results);
    this.currentTournament.status = "between-games";

    // Sort overall leaderboard
    this.currentTournament.leaderboard.sort((a, b) => b.score - a.score);

    this.broadcastTournamentState();
    this.io.emit("game-ended", {
      results,
      leaderboard: this.currentTournament.leaderboard.slice(0, 10),
    });

    // Auto-proceed to next game after showing results
    setTimeout(() => {
      this.showNextGamePrompt();
    }, 5000);
  }

  showNextGamePrompt() {
    const hasNextGame =
      this.currentTournament.currentGameIndex + 1 <
      this.currentTournament.gameQueue.length;

    this.io.emit("show-next-game-prompt", {
      hasNextGame,
      nextGameType: hasNextGame
        ? this.currentTournament.gameQueue[
            this.currentTournament.currentGameIndex + 1
          ]
        : null,
      currentGameIndex: this.currentTournament.currentGameIndex,
      totalGames: this.currentTournament.gameQueue.length,
    });
  }

  proceedToNextGame() {
    const nextGameIndex = this.currentTournament.currentGameIndex + 1;

    if (nextGameIndex >= this.currentTournament.gameQueue.length) {
      this.endTournament();
      return;
    }

    this.currentTournament.currentGameIndex = nextGameIndex;
    const nextGameType = this.currentTournament.gameQueue[nextGameIndex];

    this.createGameSession(nextGameType);
    this.currentTournament.status = "active";
  }

  endTournament() {
    this.currentTournament.status = "finished";
    this.currentTournament.currentSession = null;

    // Clear any remaining timers
    this.gameTimers.forEach((timer) => clearTimeout(timer));
    this.gameTimers.clear();

    this.broadcastTournamentState();
    this.io.emit("tournament-finished", {
      finalLeaderboard: this.currentTournament.leaderboard.slice(0, 10),
    });

    // Auto-reset after 30 seconds
    setTimeout(() => {
      this.resetTournament();
    }, 30000);
  }

  resetTournament() {
    this.currentTournament = {
      id: null,
      currentSession: null,
      leaderboard: [],
      allPlayers: [],
      gameQueue: ["snake", "flappy-bird", "terminal-artillery"],
      currentGameIndex: 0,
      status: "idle",
    };

    this.gameTimers.forEach((timer) => clearTimeout(timer));
    this.gameTimers.clear();

    this.broadcastTournamentState();
    this.io.emit("tournament-reset");
  }

  broadcastTournamentState() {
    this.io.emit("tournament-state", {
      ...this.currentTournament,
      timestamp: Date.now(),
    });
  }

  // Get current tournament state (for HTTP API)
  getTournamentState() {
    return {
      ...this.currentTournament,
      timestamp: Date.now(),
    };
  }
}

module.exports = TournamentManager;

// server/server.js - Integration with your existing server
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const TournamentManager = require("./tournamentManager");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Initialize tournament manager
const tournamentManager = new TournamentManager(io);

// API routes
app.get("/api/tournament/state", (req, res) => {
  res.json(tournamentManager.getTournamentState());
});

app.post("/api/tournament/start", (req, res) => {
  tournamentManager.startTournament();
  res.json({ success: true });
});

app.post("/api/tournament/reset", (req, res) => {
  tournamentManager.resetTournament();
  res.json({ success: true });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Tournament server running on port ${PORT}`);
});
