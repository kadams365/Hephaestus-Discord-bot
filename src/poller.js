import { checkService, SERVICES } from "./services.js";

export async function pollServices(POLL_INTERVAL, MAX_BACKOFF) {
  for (const key of Object.keys(SERVICES)) {
    await checkService(key, POLL_INTERVAL, MAX_BACKOFF);
  }
}
