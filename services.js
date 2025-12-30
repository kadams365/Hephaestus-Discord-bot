// services.js
import fetch from "node-fetch";
import net from "net";
import https from "https";
import { status } from "minecraft-server-util";
import { serviceState, downtimeLog, saveStateDebounced } from "./state.js";

export const SERVICES = {
  jellyfin: {
    name: "Jellyfin",
    type: "http",
    url: "https://jellyfin.routernet.org",
  },
  minecraft: {
    name: "Minecraft (Foreverworld)",
    type: "minecraft",
    host: "forever.routernet.org",
    port: 25566,
  },
  truenas: {
    name: "TrueNAS",
    type: "http",
    url: "https://truenas.routernet.lan",
  },
};

// HTTP check (handles LAN self-signed certs)
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

// TCP check
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
      console.log(`[CHECK] TCP ${host}:${port} → OFFLINE`);
      resolve(false);
    });
    socket.on("timeout", () => {
      socket.destroy();
      console.log(`[CHECK] TCP ${host}:${port} → TIMEOUT`);
      resolve(false);
    });
  });
}

export async function checkMinecraft(host, port) {
  try {
    // Ensure proper types
    host = String(host);
    port = Number(port);

    // Check server online, ignore result
    await status(host, port, { timeout: 5000 });

    console.log(`[CHECK] Minecraft ${host}:${port} → ONLINE`);
    return true;
  } catch (err) {
    console.warn(`[CHECK] Minecraft ${host}:${port} failed: ${err.message}`);
    return false;
  }
}

// Service polling with backoff
const failureCounts = {};
export async function checkService(key, POLL_INTERVAL, MAX_BACKOFF) {
  const svc = SERVICES[key];
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
      POLL_INTERVAL * 2 ** (failureCounts[key] - 1),
      MAX_BACKOFF
    );
    setTimeout(() => checkService(key, POLL_INTERVAL, MAX_BACKOFF), nextPoll);
  } else failureCounts[key] = 0;

  return { ...state, changed };
}
