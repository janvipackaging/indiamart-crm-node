// server.js
require('dotenv').config(); // Load .env file for local dev, Render uses its own env vars
const express = require('express');
const updateStatusHandler = require('./api/update-status'); // Import the webhook handler from your existing file

const app = express();
// Render provides the PORT environment variable; default to 10000 for flexibility
const PORT = process.env.PORT || 10000;

// Middleware to parse incoming JSON requests (like from Google Apps Script)
app.use(express.json());

// Define the route for your Google Apps Script webhook
// It listens for POST requests on the /api/update-status path
app.post('/api/update-status', updateStatusHandler);

// Optional: A simple root route to check if the server is running
app.get('/', (req, res) => {
  res.status(200).send('IndiaMART CRM Web Service is active.');
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server listening for webhooks on port ${PORT}`);
});