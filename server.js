const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const app = express();
const PORT = 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const UPLOADS = path.join(ROOT, "uploads");
const DB_FILE = path.join(ROOT, "db.json");

fs.mkdirSync(UPLOADS, { recursive: true });
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    users: [], guestbook: [], submissions: []
  }, null, 2));
}

function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

// Serialize writes to avoid overlapping writes to the JSON file.
let writeQueue = Promise.resolve();
function writeDB(data) {
  writeQueue = writeQueue.then(() =>
    fs.promises.writeFile(DB_FILE, JSON.stringify(data, null, 2))
  );
  return writeQueue;
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}
function safeUser(user) {
  return { id: user.id, username: user.username, createdAt: user.createdAt };
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS),
  filename: (_req, _file, cb) => cb(null, crypto.randomUUID() + ".img")
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
  }
});

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));
app.use(express.static(PUBLIC));

app.use("/uploads", express.static(UPLOADS, {
  dotfiles: "deny",
  index: false,
  setHeaders(res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'");
  }
}));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", lab: "Bara Cyber Lab" });
});

app.get("/api/guestbook", (_req, res) => {
  try {
    res.json(readDB().guestbook.slice(-100).reverse());
  } catch {
    res.status(500).json({ error: "Database tidak dapat dibaca" });
  }
});

app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== "string" || typeof password !== "string" ||
        !/^[a-zA-Z0-9_]{3,24}$/.test(username) ||
        password.length < 8 || password.length > 128) {
      return res.status(400).json({
        error: "Username 3-24 karakter; password 8-128 karakter."
      });
    }

    const db = readDB();
    if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(409).json({ error: "Username sudah digunakan" });
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const user = {
      id: crypto.randomUUID(),
      username,
      salt,
      passwordHash: hashPassword(password, salt),
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    await writeDB(db);
    res.status(201).json({ user: safeUser(user) });
  } catch {
    res.status(500).json({ error: "Gagal menyimpan pengguna" });
  }
});

// Demo login only: does not create a server-side session or secure cookie.
app.post("/api/login", (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Data login tidak valid" });
    }
    const user = readDB().users.find(
      u => u.username.toLowerCase() === username.toLowerCase()
    );
    if (!user || password.length > 128 ||
        hashPassword(password, user.salt) !== user.passwordHash) {
      return res.status(401).json({ error: "Login gagal" });
    }
    res.json({ user: safeUser(user) });
  } catch {
    res.status(500).json({ error: "Gagal memproses login" });
  }
});

app.post("/api/guestbook", async (req, res) => {
  try {
    const { username, message } = req.body || {};
    if (typeof username !== "string" || typeof message !== "string" ||
        username.length < 1 || username.length > 40 ||
        message.length < 1 || message.length > 1000) {
      return res.status(400).json({ error: "Data guestbook tidak valid" });
    }
    const db = readDB();
    db.guestbook.push({
      id: crypto.randomUUID(), username, message,
      createdAt: new Date().toISOString()
    });
    db.guestbook = db.guestbook.slice(-500);
    await writeDB(db);
    res.status(201).json({ ok: true });
  } catch {
    res.status(500).json({ error: "Gagal menyimpan pesan" });
  }
});

app.post("/api/upload", (req, res) => {
  upload.single("file")(req, res, err => {
    if (err) {
      return res.status(400).json({
        error: "Upload gagal: gunakan gambar JPEG, PNG, atau WebP maksimal 2 MB."
      });
    }
    if (!req.file) {
      return res.status(400).json({ error: "File gambar tidak valid" });
    }
    res.status(201).json({
      filename: req.file.filename,
      url: "/uploads/" + encodeURIComponent(req.file.filename)
    });
  });
});

// Local JSON API demo. Request body is bounded and storage is capped at 500 records.
app.post("/api/submit", async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return res.status(400).json({ error: "Kirim objek JSON" });
    }
    const db = readDB();
    db.submissions.push({
      id: crypto.randomUUID(),
      receivedAt: new Date().toISOString(),
      payload
    });
    db.submissions = db.submissions.slice(-500);
    await writeDB(db);
    res.status(201).json({ ok: true });
  } catch {
    res.status(500).json({ error: "Gagal menyimpan submission" });
  }
});

app.use((_req, res) => res.status(404).json({ error: "Endpoint tidak ditemukan" }));

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Cyber Lab aktif: http://127.0.0.1:${PORT}`);
  console.log("Mode lokal — jangan diekspos ke jaringan publik.");
});
