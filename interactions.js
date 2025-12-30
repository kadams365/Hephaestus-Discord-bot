// interactions.js
import { EmbedBuilder } from "discord.js";
import {
  serviceState,
  saveStateDebounced,
  calculateRollingUptime,
} from "./state.js";
import { SERVICES } from "./services.js";

export async function handleInteraction(interaction, client) {
  if (!interaction.isChatInputCommand()) return;

  try {
    await interaction.deferReply();

    switch (interaction.commandName) {
      case "status": {
        const embed = new EmbedBuilder().setTitle("Service Status");
        for (const key of Object.keys(SERVICES)) {
          const s = serviceState[key];
          embed.addFields({
            name: SERVICES[key].name,
            value: s.maintenance
              ? "Maintenance"
              : s.online
              ? `Online\nUptime 24h: ${calculateRollingUptime(
                  key,
                  24 * 60 * 60 * 1000
                )}%`
              : "Offline",
          });
        }
        return interaction.editReply({ embeds: [embed] });
      }

      case "uptime": {
        const key = interaction.options.getString("service", true);
        return interaction.editReply(
          `${SERVICES[key].name} uptime:\n24h: ${calculateRollingUptime(
            key,
            24 * 60 * 60 * 1000
          )}%\n7d: ${calculateRollingUptime(
            key,
            7 * 24 * 60 * 60 * 1000
          )}%\n30d: ${calculateRollingUptime(key, 30 * 24 * 60 * 60 * 1000)}%`
        );
      }

      case "maintenance": {
        const key = interaction.options.getString("service", true);
        const enabled = interaction.options.getBoolean("enabled", true);
        serviceState[key].maintenance = enabled;
        saveStateDebounced();
        return interaction.editReply({
          content: `Maintenance ${enabled ? "enabled" : "disabled"} for ${
            SERVICES[key].name
          }`,
          flags: 64,
        });
      }

      case "ping": {
        const latency = Date.now() - interaction.createdTimestamp;
        const wsPing = client.ws.ping;
        return interaction.editReply(
          `Pong! Latency: ${latency}ms | WebSocket: ${wsPing}ms`
        );
      }
    }
  } catch (err) {
    console.error(err);
    if (interaction.deferred)
      await interaction.editReply({ content: "Command failed.", flags: 64 });
  }
}
