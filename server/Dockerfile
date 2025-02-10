# Use Node.js base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first
COPY package.json ./

# Install dependencies
RUN npm install

# Copy all other files
COPY . .  

# Expose the port
EXPOSE 5001

# Start the server
CMD ["node", "server.js"]
