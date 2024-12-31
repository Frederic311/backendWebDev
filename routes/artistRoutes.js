const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
  },
});

module.exports = (db, bucket) => {
  // Helper function to check if artist name already exists
  const isArtistNameUnique = async (artistName) => {
    const snapshot = await db.collection('artists').where('artistName', '==', artistName).get();
    return snapshot.empty;
  };

  // Create an artist
  router.post('/', upload.single('artistImage'), async (req, res) => {
    try {
      const { artistName, numberOfAlbums, careerStartDate } = req.body;

      // Validation: Unique artist name
      const isUnique = await isArtistNameUnique(artistName);
      if (!isUnique) {
        return res.status(400).send({ message: 'Artist name already exists. Please choose another name.' });
      }

      // Validation: Positive number of albums
      if (numberOfAlbums <= 0) {
        return res.status(400).send({ message: 'Number of albums must be a positive number.' });
      }

      // Validation: Career start date not in the future
      const careerStart = new Date(careerStartDate);
      const today = new Date();
      if (careerStart > today) {
        return res.status(400).send({ message: 'Career start date cannot be in the future.' });
      }

      const artist = req.body;

      if (req.file) {
        const blob = bucket.file(Date.now() + path.extname(req.file.originalname));
        const blobStream = blob.createWriteStream({
          metadata: {
            contentType: req.file.mimetype,
          },
        });

        blobStream.on('error', (err) => {
          res.status(500).send({ message: err.message });
        });

        blobStream.on('finish', async () => {
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

          artist.artistImage = publicUrl; // Add the image URL to the artist data

          // Add artist to Firestore
          const artistRef = await db.collection('artists').add(artist);
          res.status(201).send({ id: artistRef.id, ...artist });
        });

        blobStream.end(req.file.buffer);
      } else {
        // Add artist to Firestore without image
        const artistRef = await db.collection('artists').add(artist);
        res.status(201).send({ id: artistRef.id, ...artist });
      }
    } catch (err) {
      res.status(400).send({ message: err.message });
    }
  });

  // Update an artist
  router.put('/:id', async (req, res) => {
    try {
      const { artistName, numberOfAlbums, careerStartDate } = req.body;
      const artistId = req.params.id;

      // Validation: Unique artist name
      const isUnique = await isArtistNameUnique(artistName);
      const artistDoc = await db.collection('artists').doc(artistId).get();
      if (!artistDoc.exists) {
        return res.status(404).send('Artist not found');
      }
      const existingArtist = artistDoc.data();
      if (artistName !== existingArtist.artistName && !isUnique) {
        return res.status(400).send({ message: 'Artist name already exists. Please choose another name.' });
      }

      // Validation: Positive number of albums
      if (numberOfAlbums <= 0) {
        return res.status(400).send({ message: 'Number of albums must be a positive number.' });
      }

      // Validation: Career start date not in the future
      const careerStart = new Date(careerStartDate);
      const today = new Date();
      if (careerStart > today) {
        return res.status(400).send({ message: 'Career start date cannot be in the future.' });
      }

      const artist = req.body;
      await db.collection('artists').doc(artistId).update(artist);
      res.send('Artist updated successfully!');
    } catch (err) {
      res.status(400).send({ message: err.message });
    }
  });

  // Other routes...

  return router;
};
