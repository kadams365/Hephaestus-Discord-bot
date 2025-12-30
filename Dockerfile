# Use official Node LTS
FROM node:20-slim

# Set working directory inside container
WORKDIR /usr/src/app

# Copy package files first to install dependencies (cache optimization)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of your bot files
COPY . .

# Expose ports if needed (not necessary for Discord bots)
# EXPOSE 3000

# Run the bot
CMD ["node", "index.js"]