import { SlashCommandBuilder } from "discord.js";
import { SERVICES } from "./services.js";

export const commands = [
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
].map((c) => c.toJSON());
