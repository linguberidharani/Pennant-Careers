/**
 * Pennant Careers — recruitment portal (demo project build)
 * -----------------------------------------------------------
 *  - serves the responsive front-end in /public
 *  - public API: jobs + application submission
 *  - password-protected admin API: view / manage applications
 *  - applications stored in MongoDB (if MONGODB_URI set) or a local JSON file
 *
 * Config via environment variables (or a .env file — see .env.example):
 *   ADMIN_PASSWORD, SESSION_SECRET, MONGODB_URI, PORT, NODE_ENV
 */

require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

// ---- config ----------------------------------------------------------------
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123"; // CHANGE before deploy
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const SESSION_HOURS = 8;
const STATUSES = db.STATUSES;

const JOBS_FILE = path.join(__dirname, "data", "jobs.json");

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ensure storage is ready before handling API requests (needed on serverless/Vercel)
app.use("/api", (req, res, next) => {
  db.init().then(() => next()).catch((err) => {
    console.error(err);
    res.status(500).json({ ok: false, error: "Storage not ready." });
  });
});

// ---- jobs (static content, read from file) ---------------------------------
function readJobs() {
  try { return JSON.parse(fs.readFileSync(JOBS_FILE, "utf-8")); }
  catch { return []; }
}

// ---- auth helpers ----------------------------------------------------------
function getCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const p = part.trim();
    const i = p.indexOf("=");
    if (i > -1 && p.slice(0, i) === name) return decodeURIComponent(p.slice(i + 1));
  }
  return null;
}
function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return body + "." + sig;
}
function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch { return null; }
}
function checkPassword(input) {
  const a = crypto.createHash("sha256").update(String(input)).digest();
  const b = crypto.createHash("sha256").update(String(ADMIN_PASSWORD)).digest();
  return crypto.timingSafeEqual(a, b);
}
function setSession(req, res) {
  const token = signToken({ role: "admin", exp: Date.now() + SESSION_HOURS * 3600 * 1000 });
  const secure = process.env.NODE_ENV === "production" || req.headers["x-forwarded-proto"] === "https";
  res.setHeader(
    "Set-Cookie",
    `padmin=${token}; HttpOnly; Path=/; Max-Age=${SESSION_HOURS * 3600}; SameSite=Lax${secure ? "; Secure" : ""}`
  );
}
function clearSession(res) {
  res.setHeader("Set-Cookie", "padmin=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
}
function requireAdmin(req, res, next) {
  const data = verifyToken(getCookie(req, "padmin"));
  if (!data || data.role !== "admin") {
    return res.status(401).json({ ok: false, error: "Not authorized. Please sign in." });
  }
  next();
}

// small helper so async route errors return JSON instead of crashing
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "Server error." });
});

// ===========================================================================
// PUBLIC API — jobs
// ===========================================================================
app.get("/api/jobs", (req, res) => {
  res.json(
    readJobs().map((j) => ({
      id: j.id, title: j.title, team: j.team, location: j.location,
      type: j.type, experience: j.experience, salary: j.salary,
      tags: j.tags, postedOn: j.postedOn, featured: j.featured || false,
    }))
  );
});

app.get("/api/jobs/:id", (req, res) => {
  const job = readJobs().find((j) => j.id === req.params.id);
  if (!job) return res.status(404).json({ ok: false, error: "Job not found" });
  res.json(job);
});

// ===========================================================================
// PUBLIC API — submit application
// ===========================================================================
app.post("/api/applications", wrap(async (req, res) => {
  const b = req.body || {};
  const required = ["fullName", "email", "phone", "jobId"];
  const missing = required.filter((k) => !b[k] || String(b[k]).trim() === "");
  if (missing.length) {
    return res.status(400).json({ ok: false, error: `Please fill: ${missing.join(", ")}` });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.email))) {
    return res.status(400).json({ ok: false, error: "Enter a valid email address." });
  }
  const job = readJobs().find((j) => j.id === b.jobId);
  if (!job) return res.status(400).json({ ok: false, error: "Unknown job." });

  const application = {
    id: "APP-" + Date.now().toString(36).toUpperCase(),
    jobId: b.jobId,
    jobTitle: job.title,
    fullName: String(b.fullName).trim(),
    email: String(b.email).trim(),
    phone: String(b.phone).trim(),
    college: String(b.college || "").trim(),
    branch: String(b.branch || "").trim(),
    graduationYear: String(b.graduationYear || "").trim(),
    cgpa: String(b.cgpa || "").trim(),
    resumeLink: String(b.resumeLink || "").trim(),
    coverNote: String(b.coverNote || "").trim(),
    submittedAt: new Date().toISOString(),
    status: "Received",
  };
  await db.addApplication(application);
  res.json({ ok: true, id: application.id, message: "Application received." });
}));

// ===========================================================================
// ADMIN AUTH
// ===========================================================================
app.post("/api/admin/login", (req, res) => {
  const password = (req.body || {}).password;
  if (!password || !checkPassword(password)) {
    return res.status(401).json({ ok: false, error: "Incorrect password." });
  }
  setSession(req, res);
  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({ ok: true, role: "admin" });
});

// ===========================================================================
// ADMIN API — applications (protected)
// ===========================================================================
app.get("/api/applications", requireAdmin, wrap(async (req, res) => {
  res.json(await db.listApplications());
}));

app.patch("/api/applications/:id", requireAdmin, wrap(async (req, res) => {
  const status = (req.body || {}).status;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ ok: false, error: "Invalid status." });
  }
  const ok = await db.updateStatus(req.params.id, status);
  if (!ok) return res.status(404).json({ ok: false, error: "Application not found." });
  res.json({ ok: true });
}));

app.get("/api/applications.csv", requireAdmin, wrap(async (req, res) => {
  const apps = await db.listApplications();
  const cols = [
    "id", "jobTitle", "fullName", "email", "phone", "college", "branch",
    "graduationYear", "cgpa", "resumeLink", "coverNote", "status", "submittedAt",
  ];
  const cell = (v) => {
    const s = String(v == null ? "" : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(",")].concat(apps.map((a) => cols.map((c) => cell(a[c])).join(",")));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="applications.csv"');
  res.send(lines.join("\n"));
}));

// ---- SPA fallback ----------------------------------------------------------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---- start -----------------------------------------------------------------
// Locally (node server.js) we start a listening server.
// On serverless platforms (e.g. Vercel) the app is imported instead — the
// storage-ready middleware above connects lazily on the first request.
if (require.main === module) {
  db.init()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`\n  Pennant Careers running at  http://localhost:${PORT}`);
        console.log(
          ADMIN_PASSWORD === "admin123"
            ? "  Admin password: admin123  (set ADMIN_PASSWORD to change)\n"
            : "  Admin password: (set via ADMIN_PASSWORD)\n"
        );
      });
    })
    .catch((err) => {
      console.error("\n  Startup failed:", err.message);
      console.error("  Check your MONGODB_URI (or unset it to use the local JSON file).\n");
      process.exit(1);
    });
}

module.exports = app;
