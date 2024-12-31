const express = require('express');
const router = express.Router();

module.exports = (db) => {
  // Create an artist
  router.post('/', async (req, res) => {
    try {
      const artist = req.body;
      await db.collection('artists').add(artist);
      res.status(201).send('Artist created successfully!');
    } catch (err) {
      res.status(400).send(err.message);
    }
  });

  // Get all artists with pagination
  router.get('/', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
      const artistsSnapshot = await db.collection('artists').offset(offset).limit(limit).get();
      const artists = artistsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.send(artists);
    } catch (err) {
      res.status(500).send(err.message);
    }
  });

  // Get an artist by ID
  router.get('/:id', async (req, res) => {
    try {
      const doc = await db.collection('artists').doc(req.params.id).get();
      if (!doc.exists) {
        return res.status(404).send('Artist not found');
      }
      res.send({ id: doc.id, ...doc.data() });
    } catch (err) {
      res.status(500).send(err.message);
    }
  });

  // Update an artist
  router.put('/:id', async (req, res) => {
    try {
      const artist = req.body;
      await db.collection('artists').doc(req.params.id).update(artist);
      res.send('Artist updated successfully!');
    } catch (err) {
      res.status(400).send(err.message);
    }
  });

  // Delete an artist
  router.delete('/:id', async (req, res) => {
    try {
      await db.collection('artists').doc(req.params.id).delete();
      res.send('Artist deleted successfully!');
    } catch (err) {
      res.status(500).send(err.message);
    }
  });

  // Rate an artist
  router.post('/:id/rate', async (req, res) => {
    try {
      const artistDoc = await db.collection('artists').doc(req.params.id).get();
      if (!artistDoc.exists) {
        return res.status(404).send('Artist not found');
      }
      const artist = artistDoc.data();
      const { rating } = req.body;
      if (artist.ratings && artist.ratings.includes(rating)) {
        return res.status(400).send('User cannot rate the same artist twice.');
      }
      artist.ratings = artist.ratings || [];
      artist.ratings.push(rating);
      artist.averageRating = artist.ratings.reduce((a, b) => a + b, 0) / artist.ratings.length;
      await db.collection('artists').doc(req.params.id).set(artist, { merge: true });
      res.send('Artist rated successfully!');
    } catch (err) {
      res.status(500).send(err.message);
    }
  });

  return router;
};
