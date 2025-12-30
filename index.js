import { Client, GatewayIntentBits, REST, Routes } from "discord.js";
import {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID,
  POLL_INTERVAL,
  MAX_BACKOFF,
} from "./config.js";
import { commands } from "./commands.js";
import { handleInteraction } from "./interactions.js";
import { pollServices } from "./poller.js";
import { serviceState, monitorStartTime } from "./state.js";
import { SERVICES, checkService } from "./services.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  console.log("Registering slash commands...");
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands,
  });
  console.log("Slash commands registered");
})();

client.on("interactionCreate", (interaction) =>
  handleInteraction(interaction, client)
);

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
  setInterval(() => pollServices(POLL_INTERVAL, MAX_BACKOFF), POLL_INTERVAL);
});

client.login(DISCORD_TOKEN);
process.on("unhandledRejection", console.error);
