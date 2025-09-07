const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = process.env.PORT || 3000;

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

let onlineUsers = new Map();
let messages = [];

function isValidSolanaAddress(address) {
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

app
  .prepare()
  .then(() => {
    const httpServer = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);

        // Handle the socket API endpoint manually
        if (parsedUrl.pathname === "/api/socket" && req.method === "GET") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              success: true,
              message: "Socket server running",
              connected: onlineUsers.size,
              timestamp: new Date().toISOString(),
            })
          );
          return;
        }

        // Let Next.js handle all other requests
        await handler(req, res, parsedUrl);
      } catch (err) {
        console.error("Error occurred handling", req.url, err);
        res.statusCode = 500;
        res.end("Internal server error");
      }
    });

    // Initialize Socket.IO
    const io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    io.on("connection", (socket) => {
      console.log("User connected:", socket.id);

      socket.on("join_chat", (userData) => {
        try {
          const { walletAddress, username } = userData;

          if (!isValidSolanaAddress(walletAddress)) {
            socket.emit("error", { message: "Invalid wallet address" });
            return;
          }

          const userInfo = {
            walletAddress,
            username: username || `Player_${walletAddress.slice(0, 4)}`,
            joinedAt: new Date().toISOString(),
          };

          onlineUsers.set(socket.id, userInfo);
          console.log(
            `${userInfo.username} joined chat. Total users: ${onlineUsers.size}`
          );

          socket.emit("chat_joined", {
            onlineCount: onlineUsers.size,
            recentMessages: messages.slice(-20),
          });

          socket.broadcast.emit("user_joined", {
            username: userInfo.username,
            onlineCount: onlineUsers.size,
          });
        } catch (error) {
          console.error("Join chat error:", error);
          socket.emit("error", { message: "Failed to join chat" });
        }
      });

      socket.on("send_message", (data) => {
        try {
          const user = onlineUsers.get(socket.id);
          if (!user) {
            socket.emit("error", { message: "User not found. Please rejoin." });
            return;
          }

          const { message } = data;

          if (!message || typeof message !== "string" || message.length > 200) {
            socket.emit("error", { message: "Invalid message" });
            return;
          }

          const chatMessage = {
            id: Date.now() + Math.random(),
            type: "text",
            message: message.trim(),
            username: user.username,
            walletAddress: user.walletAddress,
            timestamp: new Date().toISOString(),
          };

          messages.push(chatMessage);
          if (messages.length > 100) {
            messages = messages.slice(-100);
          }

          io.emit("new_message", chatMessage);
          console.log(`${user.username}: ${message}`);
        } catch (error) {
          console.error("Send message error:", error);
          socket.emit("error", { message: "Failed to send message" });
        }
      });

      socket.on("disconnect", (reason) => {
        console.log("Client disconnected:", socket.id, "Reason:", reason);
        const user = onlineUsers.get(socket.id);
        if (user) {
          onlineUsers.delete(socket.id);
          socket.broadcast.emit("user_left", {
            username: user.username,
            onlineCount: onlineUsers.size,
          });
          console.log(
            `${user.username} left chat. Total users: ${onlineUsers.size}`
          );
        }
      });

      socket.on("error", (error) => {
        console.error("Socket error:", error);
      });
    });

    httpServer.listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Socket.IO server running`);
    });
  })
  .catch((ex) => {
    console.error(ex.stack);
    process.exit(1);
  });
