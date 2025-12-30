# Hephaestus Discord Bot

A Discord bot to monitor HTTP, TCP, and Minecraft servers with uptime tracking and maintenance mode.

---

## Quick Start

### 1. Clone & Install (Optional)

```bash
git clone https://github.com/kadams365/Hephaestus-Discord-bot.git
cd Hephaestus-Discord-bot
npm install
```

### 2. Configure

Create a `.env` file with your bot credentials:

```
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_client_id
GUILD_ID=your_guild_id
ALERT_CHANNEL_ID=alert_channel_id
DATA_DIR=/usr/src/app/data
```

### 3. Services

Default services are in `services.json`. Example:

```json
{
  "jellyfin": {
    "name": "Jellyfin",
    "type": "http",
    "url": "https://jellyfin.com"
  },
  "minecraft": {
    "name": "Minecraft (Foreverworld)",
    "type": "minecraft",
    "host": "minecraft.example.com",
    "port": 25565
  }
}
```

- Use `/addservice` or `/removeservice` in Discord to manage services dynamically.

---

## Commands

- `/status` → Show status of all services
- `/uptime` → Show uptime percentage for a service
- `/maintenance` → Toggle maintenance mode
- `/ping` → Check bot latency
- `/help` → Show all bot commands
- `/info` → Bot info (version, uptime, total services)
- `/addservice` → Add a new service
- `/removeservice` → Remove a service

---

## Docker

### Dockerfile

```dockerfile
FROM node:24
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
CMD ["node", "./index.js"]
```

### Build & Run

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

### Docker Compose

```yaml
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

```bash
docker compose up -d
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

## Tips

- Clear old slash commands if you see duplicates:

  ```js
  rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
  ```

- Ensure `services.json` is writable for dynamic `/addservice` commands.
- Self-signed HTTPS servers are accepted in LAN.
