import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import net from "net";
import https from "https";
import { status } from "minecraft-server-util";
import { serviceState, downtimeLog, saveStateDebounced } from "./state.js";

/* ================= CONFIG ================= */

const DATA_DIR = process.env.DATA_DIR || "./data";
export const SERVICES_FILE = path.join(DATA_DIR, "services.json");

/* ================= SAFETY NET ================= */

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function ensureJsonFile(filePath) {
  try {
    // If path exists but is a directory → delete it
    if (fs.existsSync(filePath) && fs.lstatSync(filePath).isDirectory()) {
      console.error(
        `[SAFETY] ${filePath} is a directory — replacing with file`
      );
      fs.rmSync(filePath, { recursive: true, force: true });
    }

    // If file does not exist → create empty JSON
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "{}", "utf8");
      return {};
    }

    // Read & parse JSON
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) return {};

    return JSON.parse(raw);
  } catch (err) {
    console.error(`[SAFETY] Corrupt JSON in ${filePath}:`, err);
    fs.writeFileSync(filePath, "{}", "utf8");
    return {};
  }
}

/* ================= LOAD SERVICES ================= */

ensureDataDir();
export let SERVICES = ensureJsonFile(SERVICES_FILE);

/* ================= SAVE SERVICES ================= */

export function saveServices() {
  try {
    fs.writeFileSync(SERVICES_FILE, JSON.stringify(SERVICES, null, 2));
  } catch (err) {
    console.error(`[ERROR] Failed to save services.json`, err);
  }
}

/* ================= SERVICE CHECKS ================= */

export async function checkHTTP(url) {
  try {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const res = await fetch(url, {
      timeout: 5000,
      redirect: "manual",
      agent,
    });

    const online = res.status >= 200 && res.status < 400;
    console.log(
      `[CHECK] HTTP ${url} → ${online ? "ONLINE" : "OFFLINE"} (${res.status})`
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
    await status(String(host), Number(port), { timeout: 5000 });
    console.log(`[CHECK] Minecraft ${host}:${port} → ONLINE`);
    return true;
  } catch (err) {
    console.warn(`[CHECK] Minecraft ${host}:${port} failed: ${err.message}`);
    return false;
  }
}

/* ================= FAILURE BACKOFF ================= */

const failureCounts = {};

export async function checkService(key, POLL_INTERVAL, MAX_BACKOFF) {
  const svc = SERVICES[key];
  if (!svc) return;

  const now = Date.now();
  let online = false;

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
    if (!online) {
      downtimeLog.push({ service: key, start: now, end: null });
    } else {
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
      POLL_INTERVAL * 2 ** (failureCounts[key] - 1),
      MAX_BACKOFF
    );
    setTimeout(() => checkService(key, POLL_INTERVAL, MAX_BACKOFF), nextPoll);
  } else {
    failureCounts[key] = 0;
  }

  return { ...state, changed };
}
