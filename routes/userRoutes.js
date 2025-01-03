const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

module.exports = (db) => {
    // Middleware to verify Firebase ID Token
    const verifyToken = async (req, res, next) => {
        const idToken = req.headers.authorization?.split('Bearer ')[1];
        if (!idToken) {
            return res.status(401).send({ message: 'Unauthorized' });
        }
        try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            req.user = decodedToken;
            next();
        } catch (error) {
            res.status(401).send({ message: 'Unauthorized', error });
        }
    };

    // Create a new user in Firestore
    router.post('/register', async (req, res) => {
        const { name, email, password } = req.body;
        try {
            const userRecord = await admin.auth().createUser({ email, password });
            await db.collection('users').doc(userRecord.uid).set({
                name,
                email,
                follow_artist: [], // Initialize follow_artist as an empty array
                ratings: {} // Initialize ratings as an empty object
            });
            res.status(201).send({ message: 'User registered successfully', userId: userRecord.uid });
        } catch (error) {
            console.error("Error registering user:", error);
            res.status(500).send({ message: 'Failed to register user', error });
        }
    });

    // Log in a user (Firebase handles authentication)
    router.post('/login', async (req, res) => {
        const { email, password } = req.body;
        try {
            const userRecord = await admin.auth().getUserByEmail(email);
            const idToken = await admin.auth().createCustomToken(userRecord.uid); // Use createCustomToken to get a token
            res.send({
                message: 'User logged in successfully',
                idToken,
                userId: userRecord.uid // Return the userId of the logged-in user
            });
        } catch (error) {
            console.error("Error logging in user:", error);
            res.status(500).send({ message: 'Failed to log in user', error });
        }
    });


    // Get all users without authentication
    router.get('/all', async (req, res) => {
        try {
            const usersSnapshot = await db.collection('users').get();
            const users = usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            res.send(users);
        } catch (error) {
            console.error("Error fetching users:", error);
            res.status(500).send({ message: 'Failed to fetch users', error });
        }
    });

    // Follow an artist by ID
    router.post('/follow/:artistId', async (req, res) => {
        const { artistId } = req.params;
        const { userId } = req.body;

        try {
            if (!userId) {
                return res.status(400).send({ message: 'User ID is required' });
            }

            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) {
                return res.status(404).send({ message: 'User not found' });
            }

            let follow_artist = userDoc.data().follow_artist || [];
            if (follow_artist.includes(parseInt(artistId))) {
                return res.status(400).send({ message: 'Artist already followed' });
            }

            follow_artist.push(parseInt(artistId));
            await db.collection('users').doc(userId).update({ follow_artist });

            res.send({ message: 'Artist followed successfully', follow_artist });
        } catch (error) {
            console.error("Error following artist:", error);
            res.status(500).send({ message: 'Failed to follow artist', error });
        }
    });


    // Rate an artist by ID
    router.post('/rate/:artistId', async (req, res) => {
        const { artistId } = req.params;
        const { userId, rating } = req.body;

        try {
            if (!userId) {
                return res.status(400).send({ message: 'User ID is required' });
            }

            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) {
                return res.status(404).send({ message: 'User not found' });
            }

            const artistDoc = await db.collection('artists').doc(artistId).get();
            if (!artistDoc.exists) {
                return res.status(404).send({ message: 'Artist not found' });
            }

            if (typeof rating !== 'number' || rating < 1 || rating > 5) {
                return res.status(400).send({ message: 'Rating must be a number between 1 and 5.' });
            }

            let ratings = userDoc.data().ratings || {};
            if (ratings[artistId] !== undefined) {
                return res.status(400).send({ message: 'User cannot rate the same artist twice.' });
            }

            // Update the user's ratings
            ratings[artistId] = rating;
            await db.collection('users').doc(userId).update({ ratings });

            // Add the rating to the ratings collection for aggregation
            await db.collection('ratings').add({ artist_id: artistId, rating: rating });

            // Calculate the average rating for the artist
            const artistRatingsSnapshot = await db.collection('ratings').where('artist_id', '==', artistId).get();
            let totalRating = 0;
            let ratingCount = artistRatingsSnapshot.size;

            artistRatingsSnapshot.forEach(doc => {
                totalRating += doc.data().rating;
            });

            const averageRating = (ratingCount === 0) ? 0 : totalRating / ratingCount;

            await db.collection('artists').doc(artistId).update({ averageRating });

            res.send({ message: 'Artist rated successfully', averageRating });
        } catch (error) {
            console.error("Error rating artist:", error);
            res.status(500).send({ message: 'Failed to rate artist', error });
        }
    });



    // Protect routes with verifyToken middleware
    router.get('/profile', verifyToken, async (req, res) => {
        const userId = req.user.uid;
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) {
                return res.status(404).send({ message: 'User not found' });
            }
            res.send(userDoc.data());
        } catch (error) {
            res.status(500).send({ message: 'Failed to retrieve user profile', error });
        }
    });

    return router;
};
