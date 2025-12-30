// state.js
import fs from "fs";

export const STATE_FILE = "./uptime.json";
export const DOWNTIME_FILE = "./downtime.json";

// Safe JSON parsing function
function safeParse(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const content = fs.readFileSync(filePath, "utf8");
    if (!content) return defaultValue;
    return JSON.parse(content);
  } catch {
    return defaultValue;
  }
}

// Initialize state with safe parsing
export let serviceState = safeParse(STATE_FILE, {});
export let downtimeLog = safeParse(DOWNTIME_FILE, []);

export const monitorStartTime = serviceState.__monitorStartTime ?? Date.now();
serviceState.__monitorStartTime = monitorStartTime;

let saveTimeout;
export function saveStateDebounced() {
  if (saveTimeout) return;
  saveTimeout = setTimeout(() => {
    fs.writeFileSync(STATE_FILE, JSON.stringify(serviceState, null, 2));
    fs.writeFileSync(DOWNTIME_FILE, JSON.stringify(downtimeLog, null, 2));
    saveTimeout = null;
  }, 5000);
}

export function calculateRollingUptime(key, windowMs) {
  const now = Date.now();
  const relevantDowntime = downtimeLog
    .filter((e) => e.service === key && e.start >= now - windowMs)
    .reduce((sum, e) => sum + ((e.end ?? now) - e.start), 0);
  return ((1 - relevantDowntime / windowMs) * 100).toFixed(2);
}
