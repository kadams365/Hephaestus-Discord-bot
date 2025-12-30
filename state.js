import fs from "fs";
import { STATE_FILE, DOWNTIME_FILE } from "./config.js";

export let serviceState = fs.existsSync(STATE_FILE)
  ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))
  : {};

export let downtimeLog = fs.existsSync(DOWNTIME_FILE)
  ? JSON.parse(fs.readFileSync(DOWNTIME_FILE, "utf8"))
  : [];

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
