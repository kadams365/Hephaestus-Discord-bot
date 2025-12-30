# Hephaestus Discord Bot

A Discord bot for monitoring services such as HTTP servers, Minecraft servers, and TCP services. Supports uptime tracking, maintenance mode, and dynamic service management.

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

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/Hephaestus-Discord-bot.git
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
```

---

## Commands

| Command | Description | Options |
|---------|-------------|---------|
| `/status` | Show status of all services | - |
| `/uptime` | Show uptime percentage | `service`: name of service |
| `/maintenance` | Enable or disable maintenance mode | `service`: name, `enabled`: true/false |
| `/ping` | Check bot latency | - |
| `/help` | Show all bot commands | - |
| `/info` | Show bot info (version, uptime, total services) | - |
| `/addservice` | Add a new service to monitoring | `name`: service name, `type`: http/minecraft/tcp, `url_or_host`: URL or host, optional `port` |
| `/removeservice` | Remove a service from monitoring | `name`: service name |

---

## Service Management

All monitored services are stored in `services.json`:

```json
{
  "jellyfin": {
    "name": "Jellyfin",
    "type": "http",
    "url": "https://jellyfin.example.com"
  },
  "minecraft": {
    "name": "Minecraft (Foreverworld)",
    "type": "minecraft",
    "host": "forever.example.com",
    "port": 25565
  }
}

