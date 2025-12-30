# Use official Node.js 20 LTS image
FROM node:20-slim

# Set working directory
WORKDIR /usr/src/app

# Copy package files and install dependencies first (for caching)
COPY package*.json ./
RUN npm install

# Copy the rest of the bot code
COPY . .

# Set environment variable for data folder inside container
ENV DATA_DIR=/usr/src/app/data

# Create data directory
RUN mkdir -p $DATA_DIR

# Expose port (not strictly necessary unless you add HTTP server)
#EXPOSE 3000

# Run the bot
CMD ["node", "index.js"]