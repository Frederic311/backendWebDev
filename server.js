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
  storageBucket: "gs://webdev222-9b8d1.firebasestorage.app"
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

// Middleware
app.use(cors());
app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.send('Welcome to the Artist Management API!');
});

// Import routes
const artistRoutes = require('./routes/artistRoutes')(db, bucket); // Pass db and bucket to the route
app.use('/api/artists', artistRoutes);

const userRoutes = require('./routes/userRoutes')(db); // Pass db to the route
app.use('/api/users', userRoutes);

// Real-time listener endpoint
app.get('/stream-artists', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const artistsRef = db.collection('artists');
  artistsRef.onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added' || change.type === 'modified') {
        res.write(`data: ${JSON.stringify(change.doc.data())}\n\n`);
      }
    });
  });

  req.on('close', () => {
    console.log('Connection closed');
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
