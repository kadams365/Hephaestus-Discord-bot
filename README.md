# Hephaestus Discord Bot

A Discord bot for monitoring services such as HTTP servers, Minecraft servers, and TCP services. Supports uptime tracking, maintenance mode, and dynamic service management.

**Quick Start Guide:** [Quick Start](./Quick_Start.md)

---

## Features

- Monitor HTTP, TCP, and Minecraft servers.
- Track uptime and downtime.
- Enable/disable maintenance mode for services.
- Add or remove services dynamically without editing config files.
- Discord slash commands for status, uptime, and management.
- Docker-ready for easy deployment.

---

## Requirements

- Node.js v24+
- Discord bot token
- Git (for cloning repo)
- Optional: Docker (for containerized usage)

---

## Installation (Choose 1)

1. Clone the repository:

```bash
git clone https://github.com/kadams365/Hephaestus-Discord-bot.git
cd Hephaestus-Discord-bot
```

2. Install dependencies:

```bash
npm install
```

3. Create a .env file with your bot credentials:

```bash
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_client_id
GUILD_ID=your_guild_id
ALERT_CHANNEL_ID=alert_channel_id
DATA_DIR=/usr/src/app/data
```

4. Build & Run

```bash
docker build -t hephaestus-bot .
docker run -d \
  --name hephaestus-bot \
  -e DISCORD_TOKEN=your_bot_token \
  -e CLIENT_ID=your_client_id \
  -e GUILD_ID=your_guild_id \
  -v $(pwd)/services.json:/app/services.json \
  -v $(pwd)/uptime.json:/app/uptime.json \
  hephaestus-bot
```

Docker Compose Example

```bash
services:
  hephaestus-bot:
    image: ghcr.io/kadams365/hephaestus:latest
    container_name: hephaestus-bot
    environment:
      DISCORD_TOKEN: ${DISCORD_TOKEN}
      CLIENT_ID: ${CLIENT_ID}
      GUILD_ID: ${GUILD_ID}
      ALERT_CHANNEL_ID: ${ALERT_CHANNEL_ID}
      DATA_DIR: ${DATA_DIR}
    volumes:
      - ./services.json:/usr/src/app/services.json
      - ./uptime.json:/usr/src/app/uptime.json
      - ./downtime.json:/usr/src/app/downtime.json
    restart: unless-stopped
```

Run with:

```bash
docker compose up -d
```

---

## Commands

| Command          | Description                                     | Options                                                                                       |
| ---------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `/status`        | Show status of all services                     | -                                                                                             |
| `/uptime`        | Show uptime percentage                          | `service`: name of service                                                                    |
| `/maintenance`   | Enable or disable maintenance mode              | `service`: name, `enabled`: true/false                                                        |
| `/ping`          | Check bot latency                               | -                                                                                             |
| `/help`          | Show all bot commands                           | -                                                                                             |
| `/info`          | Show bot info (version, uptime, total services) | -                                                                                             |
| `/addservice`    | Add a new service to monitoring                 | `name`: service name, `type`: http/minecraft/tcp, `url_or_host`: URL or host, optional `port` |
| `/removeservice` | Remove a service from monitoring                | `name`: service name                                                                          |

---

## Service Management

All monitored services are stored in `services.json`:

```json
{
  "jellyfin": {
    "name": "Jellyfin",
    "type": "http",
    "url": "https://jellyfin.com"
  },
  "minecraft": {
    "name": "Minecraft",
    "type": "minecraft",
    "host": "minecraft.example.com",
    "port": 25565
  }
}
```

---

## Logging

The bot logs all service checks to the console:

```
[CHECK] HTTP https://example.com → ONLINE
[CHECK] Minecraft minecraft.example.com:25565 → ONLINE
[CHECK] TCP 192.168.1.10:22 → OFFLINE
```

---

## Troubleshooting & Tips

Duplicate slash commands: Clear old commands using rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] }) before registering new ones.

Minecraft check errors: Ensure host is a string and port is a number.

Services not saving: Make sure services.json is writable by the bot.

Self-signed HTTPS: HTTP checks accept self-signed certificates for LAN servers.
