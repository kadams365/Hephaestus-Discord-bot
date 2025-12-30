// index.js
import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import { SERVICES, checkService } from "./services.js";
import { handleInteraction } from "./interactions.js";
import { serviceState, monitorStartTime } from "./state.js";

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
const POLL_INTERVAL = 60_000;
const MAX_BACKOFF = 10 * 60_000;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("Missing required environment variables");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Slash commands
const commands = [
  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Show status of all services"),
  new SlashCommandBuilder()
    .setName("uptime")
    .setDescription("Show uptime percentage")
    .addStringOption((o) =>
      o
        .setName("service")
        .setDescription("Service name")
        .setRequired(true)
        .addChoices(
          ...Object.entries(SERVICES).map(([k, v]) => ({
            name: v.name,
            value: k,
          }))
        )
    ),
  new SlashCommandBuilder()
    .setName("maintenance")
    .setDescription("Toggle maintenance mode")
    .addStringOption((o) =>
      o
        .setName("service")
        .setDescription("Service name")
        .setRequired(true)
        .addChoices(
          ...Object.entries(SERVICES).map(([k, v]) => ({
            name: v.name,
            value: k,
          }))
        )
    )
    .addBooleanOption((o) =>
      o.setName("enabled").setDescription("Enable/disable").setRequired(true)
    ),
  new SlashCommandBuilder().setName("ping").setDescription("Check bot latency"),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all bot commands"),
  new SlashCommandBuilder().setName("info").setDescription("Show bot info"),
  new SlashCommandBuilder()
    .setName("addservice")
    .setDescription("Add a new service to monitoring")
    .addStringOption((o) =>
      o.setName("name").setDescription("Service name").setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName("type")
        .setDescription("Service type: http/minecraft/tcp")
        .setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("url_or_host").setDescription("URL or host").setRequired(true)
    )
    .addIntegerOption((o) =>
      o
        .setName("port")
        .setDescription("Port for TCP or Minecraft")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("removeservice")
    .setDescription("Remove a service from monitoring")
    .addStringOption((o) =>
      o.setName("name").setDescription("Service name").setRequired(true)
    ),
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
(async () => {
  console.log("Clearing old slash commands...");
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: [],
  });
  console.log("Registering slash commands...");
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands,
  });
  console.log("Slash commands registered");
})();

// Interaction handling
client.on("interactionCreate", (interaction) =>
  handleInteraction(interaction, client)
);

// Polling services
async function pollServices() {
  for (const key of Object.keys(SERVICES))
    await checkService(key, POLL_INTERVAL, MAX_BACKOFF);
}

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  for (const key of Object.keys(SERVICES)) {
    if (!serviceState[key])
      serviceState[key] = {
        online: false,
        since: Date.now(),
        maintenance: false,
      };
    await checkService(key, POLL_INTERVAL, MAX_BACKOFF);
  }
  setInterval(pollServices, POLL_INTERVAL);
});

client.login(DISCORD_TOKEN);
process.on("unhandledRejection", console.error);
