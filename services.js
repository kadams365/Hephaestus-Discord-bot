// services.js
import fetch from "node-fetch";
import net from "net";
import https from "https";
import { status } from "minecraft-server-util";
import { serviceState, downtimeLog, saveStateDebounced } from "./state.js";

/* ================= SERVICES ================= */
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

/* ================= SERVICE CHECKS ================= */
export async function checkHTTP(url) {
  try {
    // Accept self-signed certificates for LAN servers
    const agent = new https.Agent({ rejectUnauthorized: false });
    const res = await fetch(url, { timeout: 5000, redirect: "manual", agent });
    const online = res.status >= 200 && res.status < 400;

    return online;
  } catch (err) {
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
    // Ensure host is string and port is number
    host = String(host);
    port = Number(port);

    // Only check if server responds
    await status(host, port, { timeout: 5000 });
    return true;
  } catch (err) {
    return false;
  }
}

/* ================= FAILURE BACKOFF ================= */
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

  // Exponential backoff for offline services
  if (!online) {
    failureCounts[key] = (failureCounts[key] ?? 0) + 1;
    const nextPoll = Math.min(
      POLL_INTERVAL * Math.pow(2, failureCounts[key] - 1),
      MAX_BACKOFF
    );
    setTimeout(() => checkService(key, POLL_INTERVAL, MAX_BACKOFF), nextPoll);
  } else failureCounts[key] = 0;

  return { ...state, changed };
}
