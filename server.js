const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Firebase Admin SDK configuration
const serviceAccount = require('./practical3webdev-firebase-adminsdk-h2luo-c9a6cde481.json'); // Update this path to the location of your JSON file
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://console.firebase.google.com/u/0/project/practical3webdev/firestore/databases/-default-/data"
});

const db = admin.firestore();

// Middleware
app.use(cors());
app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.send('Welcome to the Artist Management API!');
});

// Import routes
const artistRoutes = require('./routes/artistRoutes');
app.use('/api/artists', artistRoutes(db));

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
