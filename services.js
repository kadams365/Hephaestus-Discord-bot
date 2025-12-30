import fs from "fs";
import fetch from "node-fetch";
import net from "net";
import https from "https";
import { status } from "minecraft-server-util";
import { serviceState, downtimeLog, saveStateDebounced } from "./state.js";

export const SERVICES_FILE = "./services.json";

// ================= SAFE LOAD SERVICES =================
function ensureFile(path) {
  try {
    if (!fs.existsSync(path)) {
      fs.writeFileSync(path, JSON.stringify({}, null, 2));
      return {};
    }
    const raw = fs.readFileSync(path, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch (err) {
    console.error(`Error reading ${path}:`, err);
    return {};
  }
}

// Load services safely (empty if file missing/empty)
export let SERVICES = ensureFile(SERVICES_FILE);

// ================= SAVE SERVICES =================
export function saveServices() {
  try {
    fs.writeFileSync(SERVICES_FILE, JSON.stringify(SERVICES, null, 2));
  } catch (err) {
    console.error(`Error saving ${SERVICES_FILE}:`, err);
  }
}

// ================= SERVICE CHECKS =================
export async function checkHTTP(url) {
  try {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const res = await fetch(url, { timeout: 5000, redirect: "manual", agent });
    const online = res.status >= 200 && res.status < 400;
    console.log(
      `[CHECK] HTTP ${url} → ${online ? "ONLINE" : "OFFLINE"} (status ${
        res.status
      })`
    );
    return online;
  } catch (err) {
    console.warn(`[CHECK] HTTP ${url} failed: ${err.message}`);
    return false;
  }
}

export function checkTCP(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    socket.connect(port, host, () => {
      socket.destroy();
      console.log(`[CHECK] TCP ${host}:${port} → ONLINE`);
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
    host = String(host);
    port = Number(port);
    await status(host, port, { timeout: 5000 });
    console.log(`[CHECK] Minecraft ${host}:${port} → ONLINE`);
    return true;
  } catch (err) {
    console.warn(`[CHECK] Minecraft ${host}:${port} failed: ${err.message}`);
    return false;
  }
}

// ================= FAILURE BACKOFF =================
const failureCounts = {};

export async function checkService(key, POLL_INTERVAL, MAX_BACKOFF) {
  const svc = SERVICES[key];
  const now = Date.now();
  let online = false;

  if (!svc) return;

  if (svc.type === "http") online = await checkHTTP(svc.url);
  else if (svc.type === "tcp") online = await checkTCP(svc.host, svc.port);
  else if (svc.type === "minecraft")
    online = await checkMinecraft(svc.host, svc.port);

  const state = serviceState[key] ?? {
    online: false,
    since: now,
    maintenance: false,
  };
  const changed = state.online !== online;

  if (changed) {
    if (!online) downtimeLog.push({ service: key, start: now, end: null });
    else {
      const last = [...downtimeLog]
        .reverse()
        .find((e) => e.service === key && e.end === null);
      if (last) last.end = now;
      state.since = now;
    }
    saveStateDebounced();
  }

  state.online = online;
  serviceState[key] = state;

  if (!online) {
    failureCounts[key] = (failureCounts[key] ?? 0) + 1;
    const nextPoll = Math.min(
      POLL_INTERVAL * Math.pow(2, failureCounts[key] - 1),
      MAX_BACKOFF
    );
    setTimeout(() => checkService(key, POLL_INTERVAL, MAX_BACKOFF), nextPoll);
  } else {
    failureCounts[key] = 0;
  }

  return { ...state, changed };
}
