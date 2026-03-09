require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const path = require('path');
const Booking = require('../models/Booking');
const Contact = require('../models/Contact');

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// HIGH PRIORITY DEBUG
app.get('/api/ping', (req, res) => res.json({ message: 'pong' }));

// Database Connection for Serverless
let isConnected = false;
const connectDB = async () => {
    if (mongoose.connection.readyState === 1) return;

    if (!process.env.MONGO_URI) {
        console.error('CRITICAL: MONGO_URI is not defined in environment variables');
        return;
    }

    try {
        const db = await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });
        isConnected = db.connections[0].readyState === 1;
        console.log('MongoDB Connected Successfully');
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
        throw err;
    }
};

// Middleware to ensure DB connection before handling request
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        res.status(500).json({
            message: "Database connection failed",
            error: err.message
        });
    }
});

// Routes - adjusted paths for api/ directory
const bookingRoutes = require('../routes/bookingRoutes');
const contactRoutes = require('../routes/contactRoute');
const authRoutes = require('../routes/authRoutes');
const rateCardRoutes = require('../routes/rateCardRoutes');
const tourPackageRoutes = require('../routes/tourPackageRoutes');
const promoCodeRoutes = require('../routes/promoCodeRoutes');
const customerRoutes = require('../routes/customerRoutes');

app.use('/api/bookings', bookingRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/rate-cards', rateCardRoutes);
app.use('/api/tour-packages', tourPackageRoutes);
app.use('/api/promo-codes', promoCodeRoutes);
app.use('/api/customers', customerRoutes);

// Health check and root route
const rootHandler = (req, res) => {
    res.json({
        message: "Senu Cabs API is running!",
        status: "Healthy",
        version: "1.0.0",
        path: req.url
    });
};

app.get('/', rootHandler);
app.get('/api', rootHandler);
app.get('/api/index', rootHandler);

// Catch-all 404 for API routes
app.use((req, res) => {
    console.log(`404: ${req.method} ${req.url}`);
    res.status(404).json({
        message: `Route ${req.originalUrl} not found`,
        debug: {
            url: req.url,
            path: req.path,
            originalUrl: req.originalUrl
        }
    });
});

// Export the app for Vercel
module.exports = app;

// For local development
if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        // Connect to DB after starting the server
        connectDB().catch(err => {
            console.error('Initial MongoDB connection failed:', err);
        });
    });
}
