import "dotenv/config";

export const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID, ALERT_CHANNEL_ID } =
  process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID || !ALERT_CHANNEL_ID) {
  console.error("Missing required environment variables");
  process.exit(1);
}

export const POLL_INTERVAL = 60_000;
export const MAX_BACKOFF = 10 * 60_000; // 10 minutes
export const STATE_FILE = "./uptime.json";
export const DOWNTIME_FILE = "./downtime.json";
