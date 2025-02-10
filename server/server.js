import express from 'express';
import cors from 'cors';
//simple Node.js server to handle POST requests and forward the data to the React app in Real-Time
const app = express();
const port = 5001; // Use a different port than your Flask server

app.use(cors());
app.use(express.json());

// Store the latest data
let latestData = null;

// Endpoint to receive POST requests
app.post('/data', (req, res) => {
  latestData = req.body; // Store the incoming data
  console.log('Received data:', latestData);
  res.status(200).send('Data received');
});

// Endpoint for React app to fetch the latest data
app.get('/data', (req, res) => {
  res.status(200).json(latestData);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});