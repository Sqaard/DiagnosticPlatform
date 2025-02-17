import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

const PORT = process.env.SOCKET_PORT; // WebSocket server port
const IP = process.env.SOCKET_IP;
const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket server is running on ws://${IP}:${PORT}`);

let latestData = null;  // To store the latest received data

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  // Send the latest data to the client when they connect
  if (latestData) {
    ws.send(JSON.stringify(latestData)); // Send current latestData to the client
  }

  // Handle incoming messages from the client (e.g., sensor data)
  ws.on('message', (message) => {
    console.log('Received message from client:', message.toString());
    
    try {
      const parsedData = JSON.parse(message.toString());

      // Store or process the received data
      latestData = parsedData;

      // Optionally: Do any processing or validation here (e.g., store in a database)

      // Broadcast the new data to all clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(latestData)); // Send the latest data to all connected clients
        }
      });
    } catch (error) {
      console.error('Error parsing incoming data:', error);
    }
  });

  // Handle client disconnection
  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

console.log(`WebSocket server is ready on ws://${IP}:${PORT}`);
