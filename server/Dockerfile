# Use Node.js base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json first
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy all other files
COPY . .  

# Expose the port
EXPOSE 5001

# Start the server
CMD ["node", "server.js"]
