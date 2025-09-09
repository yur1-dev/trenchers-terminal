const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const MESSAGES_FILE = path.join(process.cwd(), "chat_messages.json");
let onlineUsers = new Map();

// Ensure messages file exists
if (!fs.existsSync(MESSAGES_FILE)) {
  fs.writeFileSync(MESSAGES_FILE, "[]");
}

function loadMessages() {
  try {
    if (fs.existsSync(MESSAGES_FILE)) {
      const data = fs.readFileSync(MESSAGES_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading messages:", error);
  }
  return [];
}

function saveMessage(message) {
  try {
    const messages = loadMessages();
    const newMessage = {
      ...message,
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
    };

    messages.push(newMessage);

    // Keep only last 100 messages
    const recentMessages = messages.slice(-100);
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(recentMessages, null, 2));

    return newMessage;
  } catch (error) {
    console.error("Error saving message:", error);
    return null;
  }
}

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

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    // Send existing messages to new client
    const existingMessages = loadMessages();
    socket.emit("message_history", existingMessages);

    socket.on("join", ({ walletAddress }) => {
      console.log("User joining:", walletAddress, socket.id);

      if (!isValidSolanaAddress(walletAddress)) {
        socket.emit("error", "Invalid wallet address");
        return;
      }

      socket.walletAddress = walletAddress;
      onlineUsers.set(socket.id, { 
        walletAddress, 
        joinedAt: new Date() 
      });

      // Broadcast updated user count
      io.emit("user_count", onlineUsers.size);
      console.log(`User count: ${onlineUsers.size}`);
    });

    socket.on("message", ({ message, walletAddress }) => {
      console.log("Message received:", { message, walletAddress, socketId: socket.id });

      if (!message || !walletAddress) {
        socket.emit("error", "Missing message or wallet address");
        return;
      }

      if (!isValidSolanaAddress(walletAddress)) {
        socket.emit("error", "Invalid wallet address");
        return;
      }

      if (message.length > 500) {
        socket.emit("error", "Message too long");
        return;
      }

      const newMessage = saveMessage({
        message: message.trim(),
        walletAddress,
        username: `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`,
      });

      if (newMessage) {
        console.log("Broadcasting message:", newMessage);
        io.emit("message", newMessage);
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      onlineUsers.delete(socket.id);
      io.emit("user_count", onlineUsers.size);
      console.log(`User count after disconnect: ${onlineUsers.size}`);
    });
  });

  server
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});