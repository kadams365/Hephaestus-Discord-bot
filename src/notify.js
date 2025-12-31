import { EmbedBuilder } from "discord.js";

let clientRef = null;
let alertChannelId = null;

export function initNotifier(client, channelId) {
  clientRef = client;
  alertChannelId = channelId;
}

export async function notifyServiceChange(serviceName, online) {
  if (!clientRef || !alertChannelId) return;

  const channel = await clientRef.channels.fetch(alertChannelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle(online ? "Service Online" : "Service Offline")
    .setDescription(
      `**${serviceName}** is now ${online ? "ONLINE" : "OFFLINE"}`
    )
    .setColor(online ? 0x2ecc71 : 0xe74c3c)
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}
