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
    // Helper function to check if artist name is unique
    const isArtistNameUnique = async (artistName) => {
        const snapshot = await db.collection('artists').where('artistName', '==', artistName).get();
        return snapshot.empty;
    };

    // Helper function to check if stage name is unique
    const isStageNameUnique = async (stageName) => {
        const snapshot = await db.collection('artists').where('stageName', '==', stageName).get();
        return snapshot.empty;
    };

    // Create an artist
    router.post('/', upload.single('artistImage'), async (req, res) => {
        try {
            const { artistName, stageName, numberOfAlbums, careerStartDate, socialMediaLinks, recordLabel, publishingHouse } = req.body;

            if (!artistName) {
                return res.status(400).send({ artistName: 'Artist name is required' });
            }
            if (!careerStartDate) {
                return res.status(400).send({ careerStartDate: 'Career start date is required' });
            }

            // Validation: Unique artist name and stage name
            const isArtistNameUniqueCheck = await isArtistNameUnique(artistName);
            const isStageNameUniqueCheck = await isStageNameUnique(stageName);

            if (!isArtistNameUniqueCheck) {
                return res.status(400).send({ artistName: 'Artist name already exists.' });
            }

            if (stageName && !isStageNameUniqueCheck) {
                return res.status(400).send({ stageName: 'Stage name already exists.' });
            }

            // Validation: Positive number of albums
            if (numberOfAlbums && numberOfAlbums <= 0) {
                return res.status(400).send({ numberOfAlbums: 'Number of albums must be a positive number.' });
            }

            // Validation: Career start date not in the future
            const careerStart = new Date(careerStartDate);
            const today = new Date();
            if (careerStart > today) {
                return res.status(400).send({ careerStartDate: 'Career start date cannot be in the future.' });
            }

            const artist = {
                artistName: artistName,
                stageName: stageName || '',
                numberOfAlbums: numberOfAlbums ? parseInt(numberOfAlbums) : 0,
                careerStartDate: careerStartDate,
                socialMediaLinks: socialMediaLinks ? socialMediaLinks.split(',').map(link => link.trim()) : [],
                recordLabel: recordLabel || '',
                publishingHouse: publishingHouse || '',
                artistImage: '',
                rating: 0, // Initialize rating to 0
            };

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
                  artist.artistImage = publicUrl;

                    const artistRef = await db.collection('artists').add(artist);
                    res.status(201).send({ id: artistRef.id, ...artist });
                });

                blobStream.end(req.file.buffer);
            } else {
                const artistRef = await db.collection('artists').add(artist);
                res.status(201).send({ id: artistRef.id, ...artist });
            }
        } catch (err) {
            console.error("Error creating artist:", err); // Log the full error for debugging
            res.status(500).send({ message: 'Failed to create artist.' }); // Generic error message for the client
        }
    });

    // Get all artists
    router.get('/', async (req, res) => {
        try {
            const artistsSnapshot = await db.collection('artists').get();
            const artists = artistsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            res.send(artists);
        } catch (err) {
            res.status(500).send({ message: err.message });
        }
    });

    // Get an artist by ID
    router.get('/:id', async (req, res) => {
        try {
            const doc = await db.collection('artists').doc(req.params.id).get();
            if (!doc.exists) {
                return res.status(404).send({ message: 'Artist not found' });
            }
            res.send({ id: doc.id, ...doc.data() });
        } catch (err) {
            res.status(500).send({ message: err.message });
        }
    });

    // Update an artist
    router.put('/:id', upload.single('artistImage'), async (req, res) => {
      try {
          const { artistName, stageName, numberOfAlbums, careerStartDate, socialMediaLinks, recordLabel, publishingHouse, rating } = req.body;
          const artistId = req.params.id;

          const artistDoc = await db.collection('artists').doc(artistId).get();
          if (!artistDoc.exists) {
              return res.status(404).send({ message: 'Artist not found' });
          }
          const existingArtist = artistDoc.data();

          if (!artistName) {
              return res.status(400).send({ artistName: 'Artist name is required' });
          }
          if (!careerStartDate) {
              return res.status(400).send({ careerStartDate: 'Career start date is required' });
          }

          const isArtistNameUniqueCheck = artistName !== existingArtist.artistName ? await isArtistNameUnique(artistName) : true;
          const isStageNameUniqueCheck = stageName !== existingArtist.stageName ? await isStageNameUnique(stageName) : true;

          if (!isArtistNameUniqueCheck) {
              return res.status(400).send({ artistName: 'Artist name already exists.' });
          }

          if (stageName && !isStageNameUniqueCheck) {
              return res.status(400).send({ stageName: 'Stage name already exists.' });
          }

          if (numberOfAlbums && numberOfAlbums <= 0) {
              return res.status(400).send({ numberOfAlbums: 'Number of albums must be a positive number.' });
          }

          const careerStart = new Date(careerStartDate);
          const today = new Date();
          if (careerStart > today) {
              return res.status(400).send({ careerStartDate: 'Career start date cannot be in the future.' });
          }

          const artist = {
              artistName: artistName,
              stageName: stageName || '',
              numberOfAlbums: numberOfAlbums ? parseInt(numberOfAlbums) : 0,
              careerStartDate: careerStartDate,
              socialMediaLinks: socialMediaLinks ? socialMediaLinks.split(',').map(link => link.trim()) : [],
              recordLabel: recordLabel || '',
              publishingHouse: publishingHouse || '',
              rating: rating !== undefined ? rating : (existingArtist.rating !== undefined ? existingArtist.rating : 0),
          };

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
                  artist.artistImage = publicUrl;

                  await db.collection('artists').doc(artistId).update(artist);
                  res.send('Artist updated successfully!');
              });

              blobStream.end(req.file.buffer);

          } else {
              await db.collection('artists').doc(artistId).update(artist);
              res.send('Artist updated successfully!');
          }
      } catch (err) {
          console.error("Error updating artist:", err);
          res.status(500).send({ message: 'Failed to update artist.' });
      }
  });

      // Delete an artist
      router.delete('/:id', async (req, res) => {
          try {
              const artistDoc = await db.collection('artists').doc(req.params.id).get();
              if (!artistDoc.exists) {
                  return res.status(404).send({ message: 'Artist not found' });
              }

              const artist = artistDoc.data();
              const imageUrl = artist.artistImage;
              if (imageUrl) {
                  const imageName = imageUrl.split('/').pop();
                  if (imageName) {
                      try {
                          await bucket.file(imageName).delete();
                      } catch (deleteError) {
                          console.error("Error deleting image:", deleteError);
                          // It's important to decide how to handle this.
                          // You might want to log the error and continue deleting the artist,
                          // or return an error to the client. Here, we log and continue.
                      }
                  }
              }

              await db.collection('artists').doc(req.params.id).delete();
              res.send('Artist and image deleted successfully!');
          } catch (err) {
              console.error("Error deleting artist:", err);
              res.status(500).send({ message: 'Failed to delete artist.' });
          }
      });

      // Rate an artist
      router.post('/:id/rate', async (req, res) => {
          try {
              const artistDoc = await db.collection('artists').doc(req.params.id).get();
              if (!artistDoc.exists) {
                  return res.status(404).send({ message: 'Artist not found' });
              }
              const artist = artistDoc.data();
              const { rating } = req.body;

              if (typeof rating !== 'number' || rating < 1 || rating > 5) {
                  return res.status(400).send({ message: 'Rating must be a number between 1 and 5.' });
              }

              artist.ratings = artist.ratings || [];
              if (artist.ratings.includes(rating)) {
                  return res.status(400).send({ message: 'User cannot rate the same artist twice.' });
              }

              artist.ratings.push(rating);
              const totalRatings = artist.ratings.length;
              artist.averageRating = totalRatings > 0 ? artist.ratings.reduce((a, b) => a + b, 0) / totalRatings : 0;

              await db.collection('artists').doc(req.params.id).set(artist, { merge: true });
              res.send('Artist rated successfully!');
          } catch (err) {
              console.error("Error rating artist:", err);
              res.status(500).send({ message: 'Failed to rate artist.' });
          }
      });

      return router;
  };