/**
 * Storage layer for applications.
 * - If MONGODB_URI is set  -> uses MongoDB (persists across restarts/redeploys)
 * - Otherwise              -> uses local data/applications.json (easy local dev)
 *
 * Jobs stay in data/jobs.json (static content) and are read in server.js.
 */

const fs = require("fs");
const path = require("path");

const APPLICATIONS_FILE = path.join(__dirname, "data", "applications.json");
const MONGODB_URI = process.env.MONGODB_URI || "";
const STATUSES = ["Received", "Under review", "Shortlisted", "Rejected"];

let mode = "file";
let Application = null;

/* ---------- file helpers ---------- */
function ensureFile() {
  const dir = path.dirname(APPLICATIONS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(APPLICATIONS_FILE)) fs.writeFileSync(APPLICATIONS_FILE, "[]");
}
function readFile() {
  try { return JSON.parse(fs.readFileSync(APPLICATIONS_FILE, "utf-8")); }
  catch { return []; }
}
function writeFile(data) {
  fs.writeFileSync(APPLICATIONS_FILE, JSON.stringify(data, null, 2));
}
function stripMongoFields(doc) {
  const { _id, __v, ...rest } = doc;
  return rest;
}

/* ---------- init ---------- */
let readyPromise = null;
function init() {
  if (!readyPromise) readyPromise = _init();
  return readyPromise;
}

async function _init() {
  if (MONGODB_URI) {
    const mongoose = require("mongoose");
    mongoose.set("strictQuery", true);
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    const schema = new mongoose.Schema(
      {
        id: { type: String, unique: true, index: true },
        jobId: String,
        jobTitle: String,
        fullName: String,
        email: String,
        phone: String,
        college: String,
        branch: String,
        graduationYear: String,
        cgpa: String,
        resumeLink: String,
        coverNote: String,
        submittedAt: String,
        status: { type: String, default: "Received" },
      },
      { collection: "applications" }
    );
    Application = mongoose.models.Application || mongoose.model("Application", schema);
    mode = "mongo";
    console.log("  Storage: MongoDB");
  } else {
    ensureFile();
    mode = "file";
    console.log("  Storage: local JSON file  (set MONGODB_URI to use MongoDB)");
  }
}

/* ---------- operations ---------- */
async function addApplication(app) {
  if (mode === "mongo") {
    await Application.create(app);
    return app;
  }
  const all = readFile();
  all.push(app);
  writeFile(all);
  return app;
}

async function listApplications() {
  if (mode === "mongo") {
    const docs = await Application.find().sort({ submittedAt: -1 }).lean();
    return docs.map(stripMongoFields);
  }
  return readFile().slice().reverse(); // newest first
}

async function updateStatus(id, status) {
  if (mode === "mongo") {
    const res = await Application.updateOne({ id }, { $set: { status } });
    return res.matchedCount > 0;
  }
  const all = readFile();
  const found = all.find((a) => a.id === id);
  if (!found) return false;
  found.status = status;
  writeFile(all);
  return true;
}

module.exports = {
  init,
  addApplication,
  listApplications,
  updateStatus,
  STATUSES,
  get mode() { return mode; },
};
