// server.js - Fixed full version
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || "CHANGE_THIS_SECRET_IN_PROD";

// simple file DB paths
const DB_PATH = path.join(__dirname, "database.json");
const ORDERS_PATH = path.join(__dirname, "orders.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");

// ---------------- ENSURE FILES ----------------
function ensureFolderSync(folder) {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
    console.log("Created folder:", folder);
  }
}

function ensureFileSync(filePath, fallbackContent = null) {
  if (!fs.existsSync(filePath)) {
    if (fallbackContent === null) fallbackContent = "";
    fs.writeFileSync(filePath, JSON.stringify(fallbackContent, null, 2), "utf8");
    console.log("Created file:", filePath);
  }
}

ensureFolderSync(UPLOADS_DIR);
ensureFileSync(DB_PATH, { admins: [] });
ensureFileSync(ORDERS_PATH, []);

// If no admin exists, create a default admin (username: admin, password: admin123)
// NOTE: change or remove in production.
(function ensureDefaultAdmin() {
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8") || "{}");
  db.admins = db.admins || [];
  if (db.admins.length === 0) {
    const defaultPassword = "admin123"; // CHANGE this in production
    const passwordHash = bcrypt.hashSync(defaultPassword, 10);
    db.admins.push({ username: "admin", passwordHash });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
    console.log("Created default admin -> username: admin , password:", defaultPassword);
  }
})();

// helper load/save
function loadJSON(pathFile) {
  if (!fs.existsSync(pathFile)) return null;
  const raw = fs.readFileSync(pathFile, "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("JSON parse error for", pathFile, e);
    return null;
  }
}
function saveJSON(pathFile, obj) {
  fs.writeFileSync(pathFile, JSON.stringify(obj, null, 2), "utf8");
}

// --- Multer setup for file uploads ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9.\-_]/g, "");
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + "-" + safe);
  }
});
const upload = multer({ storage });

// Serve uploaded files statically
app.use("/uploads", express.static(UPLOADS_DIR));

// --- Login endpoint ---
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Missing username or password" });

    const db = loadJSON(DB_PATH);
    if (!db || !db.admins) return res.status(500).json({ error: "Admin DB not found" });

    const admin = db.admins.find(a => a.username === username);
    if (!admin) return res.status(401).json({ error: "Invalid username or password" });

    const match = await bcrypt.compare(password, admin.passwordHash);
    if (!match) return res.status(401).json({ error: "Invalid username or password" });

    const token = jwt.sign({ username: admin.username }, SECRET_KEY, { expiresIn: "12h" });
    res.json({ message: "Login successful", token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Auth middleware ---
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token" });
  const token = (authHeader.split(" ")[1] || "").trim();
  if (!token) return res.status(401).json({ error: "No token" });

  jwt.verify(token, SECRET_KEY, (err, payload) => {
    if (err) return res.status(401).json({ error: "Invalid token" });
    req.user = payload;
    next();
  });
}

// --- Protected: get orders ---
app.get("/admin/orders", auth, (req, res) => {
  const orders = loadJSON(ORDERS_PATH) || [];
  res.json(orders);
});

// --- Protected: update order status (single route, fixed) ---
app.post("/admin/orders/:id/status", auth, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "Missing status" });

  const orders = loadJSON(ORDERS_PATH) || [];
  const idx = orders.findIndex(o => String(o.id) === String(id));
  if (idx === -1) return res.status(404).json({ error: "Order not found" });

  orders[idx].status = status;
  orders[idx].updatedAt = new Date().toISOString();
  saveJSON(ORDERS_PATH, orders);

  // attempt to notify Telegram (non-blocking)
  sendTelegramNotification(orders[idx], status).catch(e => {
    // already logged inside helper — ignore here
  });

  res.json({ message: "Status updated", order: orders[idx] });
});

// --- Public: accept orders (with file upload) ---
app.post("/order", upload.single("paymentScreenshot"), (req, res) => {
  try {
    const orders = loadJSON(ORDERS_PATH) || [];

    const id = (orders.length ? Number(orders[orders.length - 1].id) + 1 : 1);

    // Build screenshot URL if file uploaded
    let screenshotPublicUrl = "";
    if (req.file && req.file.filename) {
      screenshotPublicUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    }

    const payload = {
      id,
      gameId: req.body.gameId || "",
      username:req.body.username || "",
      serverId: req.body.serverId || "",
      packageName: req.body.packageName || "",
      price: Number(req.body.price || 0),
      paymentMethod: req.body.paymentMethod || "",
      transactionId: req.body.transactionId || "",
      orderNote: req.body.orderNote || "",
      paymentScreenshot: screenshotPublicUrl,
      status: req.body.status || 'pending',  // Default status
      receiver: req.body.receiver || 'N/A',  // Default receiver
      createdAt: new Date().toISOString()
    };

    orders.push(payload);
    saveJSON(ORDERS_PATH, orders);

    // optional: send telegram for new order (useful)
    sendTelegramNotification(payload, "pending").catch(() => {});

    res.json({ message: "Order received", order: payload });
  } catch (err) {
    console.error("Order endpoint error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// helper: send Telegram message (only if env vars are set)
async function sendTelegramNotification(order, newStatus) {
  console.log("=== TELEGRAM DEBUG START ===");

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  console.log("Bot Token:", BOT_TOKEN);
  console.log("Chat ID:", CHAT_ID);

  if (!BOT_TOKEN || !CHAT_ID) {
    console.log("❌ Telegram skipped: TOKEN or CHAT_ID missing");
    console.log("============================");
    return;
  }

  const text = `
📣 Order Update
Order ID: ${order.id}
User Name:${order.username}
Package: ${order.packageName}
Game ID: ${order.gameId}
Server: ${order.serverId}
Payment: ${order.paymentMethod}
TX: ${order.transactionId}
Status: ${newStatus}
Time: ${new Date().toLocaleString()}
`;

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    console.log("📤 Sending request to Telegram...");

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: text,
      })
    });

    const data = await res.json();
    console.log("Telegram Response:", data);

    if (!data.ok) {
      console.log("❌ Telegram send failed!");
    } else {
      console.log("✅ Telegram message sent successfully!");
    }

  } catch (err) {
    console.log("❌ Telegram error:", err);
  }

  console.log("=== TELEGRAM DEBUG END ===");
}

// health
app.get("/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));


const http = require("http").createServer(app);
const io = require("socket.io")(http, {
    cors: { origin: "*" }
});

app.use(express.json());

/* ---------------------------
   ORDER DATABASE (TEMP)
---------------------------- */
let orders = [];  // real project = use MongoDB

/* ---------------------------
   SOCKET.IO CONNECTION
---------------------------- */
io.on("connection", socket => {
    console.log("User connected:", socket.id);

    // user register
    socket.on("register", userId => {
        socket.join(userId);
        console.log("User joined room:", userId);
    });
});

/* ---------------------------
   SAVE ORDER (USER → SERVER)
---------------------------- */
app.post("/api/order", (req, res) => {
    const order = req.body;

    // assign server orderId
    order.orderId = Date.now();
    orders.push(order);

    // notify user (order submitted)
    io.to(order.userId).emit("order_status", {
        status: "submitted",
        message: "Your order was submitted successfully!"
    });

    console.log("New Order:", order);

    res.json({ success: true, orderId: order.orderId });
});

/* ---------------------------
   ADMIN UPDATE ORDER
---------------------------- */
app.post("/api/updateOrder", (req, res) => {
    const { orderId, status, userId } = req.body;

    // update order
    const order = orders.find(o => o.orderId === orderId);
    if (order) order.status = status;

    // notify user
    io.to(userId).emit("order_status", {
        status,
        message: `Your order is now ${status.toUpperCase()}`
    });

    console.log("Order updated:", orderId, status);

    res.json({ success: true });
});

/* ---------------------------
   START SERVER
---------------------------- */
http.listen(3000, () => {
    console.log("Server running on port 3000");
});
