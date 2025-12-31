// interactions.js
import { EmbedBuilder } from "discord.js";
import {
  serviceState,
  downtimeLog,
  saveStateDebounced,
  calculateRollingUptime,
} from "./state.js";
import { SERVICES, saveServices, checkService } from "./services.js";

export async function handleInteraction(
  interaction,
  client,
  POLL_INTERVAL,
  MAX_BACKOFF
) {
  if (!interaction.isChatInputCommand()) return;

  try {
    await interaction.deferReply();

    switch (interaction.commandName) {
      // ================= STATUS =================
      case "status": {
        try {
          const embed = new EmbedBuilder().setTitle("Service Status");

          for (const key of Object.keys(SERVICES)) {
            const svc = SERVICES[key];
            const state = serviceState[key] ?? {
              online: false,
              since: Date.now(),
            };

            const online = state.online;

            const sinceMs = Date.now() - (state.since ?? Date.now());
            const sinceH = Math.floor(sinceMs / 1000 / 60 / 60);
            const sinceM = Math.floor((sinceMs / 1000 / 60) % 60);
            const sinceStr = `${sinceH}h ${sinceM}m`;

            const uptime24h = calculateRollingUptime(key, 24 * 60 * 60 * 1000);
            const hostInfo = svc.url ?? svc.host ?? "N/A";

            embed.addFields({
              name: svc.name ?? key,
              value: `${hostInfo}\nStatus: ${
                online ? "Online" : "Offline"
              } | Since: ${sinceStr}\nUptime 24h: ${uptime24h}%`,
            });
          }

          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [embed] });
          } else {
            await interaction.reply({ embeds: [embed] });
          }
        } catch (err) {
          console.error("Error in /status command:", err);
          try {
            if (interaction.deferred || interaction.replied) {
              await interaction.editReply({
                content: "Failed to fetch service status.",
                ephemeral: true,
              });
            } else {
              await interaction.reply({
                content: "Failed to fetch service status.",
                ephemeral: true,
              });
            }
          } catch {}
        }
        break;
      }

      // ================= UPTIME =================
      case "uptime": {
        const key = interaction.options.getString("service", true);
        const uptime24h = calculateRollingUptime(key, 24 * 60 * 60 * 1000);
        const uptime7d = calculateRollingUptime(key, 7 * 24 * 60 * 60 * 1000);
        const uptime30d = calculateRollingUptime(key, 30 * 24 * 60 * 60 * 1000);
        return interaction.editReply(
          `${SERVICES[key].name} uptime:\n24h: ${uptime24h}%\n7d: ${uptime7d}%\n30d: ${uptime30d}%`
        );
      }

      // ================= MAINTENANCE =================
      case "maintenance": {
        const key = interaction.options.getString("service", true);
        const enabled = interaction.options.getBoolean("enabled", true);
        serviceState[key].maintenance = enabled;
        saveStateDebounced();
        return interaction.editReply({
          content: `Maintenance ${enabled ? "enabled" : "disabled"} for ${
            SERVICES[key].name
          }`,
          flags: 64, // ephemeral
        });
      }

      // ================= PING =================
      case "ping": {
        const latency = Date.now() - interaction.createdTimestamp;
        const wsPing = client.ws.ping;
        return interaction.editReply(
          `Pong! Latency: ${latency}ms | WebSocket: ${wsPing}ms`
        );
      }

      // ================= HELP =================
      case "help": {
        const embed = new EmbedBuilder()
          .setTitle("Bot Commands")
          .setDescription("List of available commands and usage")
          .addFields(
            { name: "/status", value: "Show status of all services" },
            {
              name: "/uptime [service]",
              value: "Show uptime percentage for a service",
            },
            {
              name: "/maintenance [service] [enabled]",
              value: "Enable/disable maintenance mode",
            },
            { name: "/ping", value: "Check bot latency" },
            { name: "/info", value: "Show bot info and system uptime" },
            {
              name: "/addservice [name] [type] [url/host]",
              value: "Add a new service to monitor",
            },
            {
              name: "/removeservice [name]",
              value: "Remove a service from monitoring",
            }
          );
        return interaction.editReply({ embeds: [embed] });
      }

      // ================= INFO =================
      case "info": {
        const uptimeMs =
          Date.now() -
          Math.min(
            ...Object.values(serviceState).map((s) => s.since || Date.now())
          );
        const embed = new EmbedBuilder().setTitle("Bot Info").addFields(
          { name: "Version", value: "1.0.0" },
          {
            name: "Services Monitored",
            value: `${Object.keys(SERVICES).length}`,
          },
          {
            name: "System Uptime",
            value: `${Math.floor(uptimeMs / 1000 / 60)} minutes`,
          }
        );
        return interaction.editReply({ embeds: [embed] });
      }

      // ================= ADD SERVICE =================
      case "addservice": {
        const name = interaction.options.getString("name", true);
        const type = interaction.options.getString("type", true); // "http" or "minecraft"
        const urlOrHost = interaction.options.getString("url_or_host", true);
        const portInput = interaction.options.getInteger("port");

        if (SERVICES[name]) {
          return interaction.editReply({
            content: `Service "${name}" already exists.`,
            flags: 64,
          });
        }

        const newService = { name, type };
        if (type === "http") newService.url = urlOrHost;
        else if (type === "minecraft") {
          newService.host = urlOrHost;
          newService.port = portInput ?? 25565;
        } else
          return interaction.editReply({
            content: "Invalid type. Use 'http' or 'minecraft'.",
            flags: 64,
          });

        SERVICES[name] = newService;
        saveServices();

        // Initialize state and start monitoring
        serviceState[name] = {
          online: false,
          since: Date.now(),
          maintenance: false,
        };
        checkService(name, POLL_INTERVAL, MAX_BACKOFF);

        return interaction.editReply({
          content: `Service "${name}" added and monitoring started.`,
        });
      }

      // ================= REMOVE SERVICE =================
      case "removeservice": {
        const name = interaction.options.getString("name", true);
        if (!SERVICES[name]) {
          return interaction.editReply({
            content: `Service "${name}" not found.`,
            flags: 64,
          });
        }
        delete SERVICES[name];
        delete serviceState[name];
        saveServices();
        saveStateDebounced();
        return interaction.editReply({
          content: `Service "${name}" removed from monitoring.`,
        });
      }

      default:
        return interaction.editReply({
          content: "Unknown command.",
          flags: 64,
        });
    }
  } catch (err) {
    console.error(err);
    if (interaction.deferred)
      await interaction.editReply({ content: "Command failed.", flags: 64 });
  }
}
