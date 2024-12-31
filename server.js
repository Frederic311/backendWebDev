const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables

const app = express();
const port = process.env.PORT || 3000;

// Firebase Admin SDK configuration using environment variables
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
  }),
  databaseURL: "https://webdev222-9b8d1.firebaseio.com"
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
