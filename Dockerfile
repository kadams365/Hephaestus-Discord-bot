# Use Node 20 slim
FROM node:20-slim

# Set working directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy bot source code
COPY . .

# Set environment variable for data folder
ENV DATA_DIR=/usr/src/app/data

# Create data directory
RUN mkdir -p $DATA_DIR

# Create empty JSON files if missing
RUN touch ./services.json ./uptime.json ./downtime.json

# Run the bot
CMD ["node", "index.js"]
