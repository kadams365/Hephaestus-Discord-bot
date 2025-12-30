import fs from "fs";
import path from "path";

// Use DATA_DIR env variable or fallback to current working directory
const DATA_DIR = process.env.DATA_DIR || process.cwd();

export const STATE_FILE = path.join(DATA_DIR, "uptime.json");
export const DOWNTIME_FILE = path.join(DATA_DIR, "downtime.json");

// Load or initialize state
export let serviceState = fs.existsSync(STATE_FILE)
  ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))
  : {};

export let downtimeLog = fs.existsSync(DOWNTIME_FILE)
  ? JSON.parse(fs.readFileSync(DOWNTIME_FILE, "utf8"))
  : [];

// Monitor start time
const monitorStartTime = serviceState.__monitorStartTime ?? Date.now();
serviceState.__monitorStartTime = monitorStartTime;

// Debounced save
let saveTimeout;
export function saveStateDebounced() {
  if (saveTimeout) return;
  saveTimeout = setTimeout(() => {
    fs.writeFileSync(STATE_FILE, JSON.stringify(serviceState, null, 2));
    fs.writeFileSync(DOWNTIME_FILE, JSON.stringify(downtimeLog, null, 2));
    saveTimeout = null;
  }, 5000);
}
