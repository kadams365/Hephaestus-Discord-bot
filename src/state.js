import fs from "fs/promises";
import { existsSync, readFileSync } from "fs";

export const STATE_FILE = "./data/uptime.json";
export const DOWNTIME_FILE = "./data/downtime.json";

// ================= SAFE PARSE =================
function safeParse(filePath, defaultValue) {
  try {
    if (!existsSync(filePath)) return defaultValue;
    const content = readFileSync(filePath, "utf8");
    if (!content) return defaultValue;
    return JSON.parse(content);
  } catch (err) {
    console.error(`[SAFE PARSE] Failed to parse ${filePath}:`, err);
    return defaultValue;
  }
}

// ================= LOAD INITIAL STATE =================
export let serviceState = safeParse(STATE_FILE, {});
export let downtimeLog = safeParse(DOWNTIME_FILE, []);

// Monitor start time
export const monitorStartTime = serviceState.__monitorStartTime ?? Date.now();
serviceState.__monitorStartTime = monitorStartTime;

// ================= DEBOUNCED SAVE =================
let saveTimeout;
const DEBOUNCE_MS = 5000;

export function saveStateDebounced() {
  if (saveTimeout) return; // already scheduled

  saveTimeout = setTimeout(async () => {
    try {
      await fs.writeFile(STATE_FILE, JSON.stringify(serviceState, null, 2));
      await fs.writeFile(DOWNTIME_FILE, JSON.stringify(downtimeLog, null, 2));
      console.log("[SAVE] State saved successfully");
    } catch (err) {
      console.error("[SAVE ERROR] Failed to write state files:", err);
    } finally {
      saveTimeout = null;
    }
  }, DEBOUNCE_MS);
}

// ================= ROLLING UPTIME CALC =================
export function calculateRollingUptime(key, windowMs) {
  const now = Date.now();
  const relevantDowntime = downtimeLog
    .filter((e) => e.service === key && e.start >= now - windowMs)
    .reduce((sum, e) => sum + ((e.end ?? now) - e.start), 0);

  return ((1 - relevantDowntime / windowMs) * 100).toFixed(2);
}
