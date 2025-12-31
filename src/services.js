// services.js
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import net from "net";
import https from "https";
import { status } from "minecraft-server-util";

import { serviceState, downtimeLog, saveStateDebounced } from "./state.js";
import { notifyServiceChange } from "./notify.js";
import { POLL_INTERVAL, MAX_BACKOFF } from "./config.js";

/* ================= CONFIG ================= */
const DATA_DIR = path.resolve(process.cwd(), "data");
export const SERVICES_FILE = path.join(DATA_DIR, "services.json");
export const DOWNTIME_FILE = path.join(DATA_DIR, "downtime.json");
export const UPTIME_FILE = path.join(DATA_DIR, "uptime.json");

// Flap protection
const failureStreak = {};
const successStreak = {};
const FAIL_THRESHOLD = 3; // Consecutive failures before offline alert
const RECOVER_THRESHOLD = 2; // Consecutive successes before online alert

/* ================= SAFETY NET ================= */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function safeLoadJson(filePath) {
  try {
    if (fs.existsSync(filePath) && fs.lstatSync(filePath).isDirectory()) {
      console.error(`[SAFETY] ${filePath} is a directory — recreating`);
      fs.rmSync(filePath, { recursive: true, force: true });
    }

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "{}", "utf8");
      return {};
    }

    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) return {};

    return JSON.parse(raw);
  } catch (err) {
    console.error(`[SAFETY] Failed to load ${filePath}:`, err);
    fs.writeFileSync(filePath, "{}", "utf8");
    return {};
  }
}

/* ================= LOAD / SAVE SERVICES ================= */
ensureDataDir();
export let SERVICES = safeLoadJson(SERVICES_FILE);

export function saveServices() {
  try {
    fs.writeFileSync(SERVICES_FILE, JSON.stringify(SERVICES, null, 2));
  } catch (err) {
    console.error(`[SAVE ERROR] Failed to save services:`, err);
  }
}

/* ================= SERVICE CHECKS ================= */
export async function checkHTTP(url) {
  try {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const res = await fetch(url, { timeout: 5000, redirect: "manual", agent });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

export function checkTCP(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);

    socket.connect(port, host, () => {
      socket.destroy();
      resolve(true);
    });

    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export async function checkMinecraft(host, port) {
  try {
    await status(String(host), Number(port), { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/* ================= FAILURE BACKOFF ================= */
const failureCounts = {};

/* ================= CORE MONITOR ================= */
export async function checkService(key) {
  const svc = SERVICES[key];
  if (!svc) return;

  const now = Date.now();
  let online = false;

  try {
    if (svc.type === "http") online = await checkHTTP(svc.url);
    else if (svc.type === "tcp") online = await checkTCP(svc.host, svc.port);
    else if (svc.type === "minecraft")
      online = await checkMinecraft(svc.host, svc.port);
  } catch (err) {
    console.error(`Check error for ${key}:`, err.message);
    online = false;
  }

  const state = serviceState[key] ?? {
    online: false,
    since: now,
    maintenance: false,
  };

  // MAINTENANCE MODE
  if (state.maintenance) {
    state.online = online;
    serviceState[key] = state;
    return;
  }

  // ================= FLAP-PROTECTED ALERTS =================
  const prevOnline = state.online;

  if (online) {
    successStreak[key] = (successStreak[key] ?? 0) + 1;
    failureStreak[key] = 0;

    if (!prevOnline && successStreak[key] >= RECOVER_THRESHOLD) {
      state.online = true;
      state.since = now;
      await notifyServiceChange(svc.name ?? key, true);

      // Close downtime
      const last = [...downtimeLog]
        .reverse()
        .find((e) => e.service === key && e.end === null);
      if (last) last.end = now;

      saveStateDebounced();
      successStreak[key] = 0;
    }
  } else {
    failureStreak[key] = (failureStreak[key] ?? 0) + 1;
    successStreak[key] = 0;

    if (prevOnline && failureStreak[key] >= FAIL_THRESHOLD) {
      state.online = false;
      state.since = now;
      await notifyServiceChange(svc.name ?? key, false);

      downtimeLog.push({ service: key, start: now, end: null });
      saveStateDebounced();
      failureStreak[key] = 0;
    }
  }

  // UPDATE STATE
  state.online = online;
  serviceState[key] = state;

  // EXPONENTIAL BACKOFF
  if (!online) {
    failureCounts[key] = (failureCounts[key] ?? 0) + 1;
    const nextPoll = Math.min(
      POLL_INTERVAL * 2 ** (failureCounts[key] - 1),
      MAX_BACKOFF
    );
    setTimeout(() => checkService(key), nextPoll);
  } else {
    failureCounts[key] = 0;
  }

  return { ...state, online };
}
