const express = require('express');
const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');
const router = express.Router();

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
        expiresIn: '30d'
    });
};

// @desc    Register a new staff member
// @route   POST /api/auth/signup
// @access  Public (In a real app, this might be restricted to admins)
router.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const staffExists = await Staff.findOne({ $or: [{ email }, { username }] });
        if (staffExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const staff = await Staff.create({
            username,
            email,
            password
        });

        if (staff) {
            res.status(201).json({
                _id: staff._id,
                username: staff.username,
                email: staff.email,
                token: generateToken(staff._id)
            });
        } else {
            res.status(400).json({ message: 'Invalid staff data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Authenticate staff & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const staff = await Staff.findOne({ email }).select('+password');

        if (staff && (await staff.comparePassword(password))) {
            res.json({
                _id: staff._id,
                username: staff.username,
                email: staff.email,
                token: generateToken(staff._id)
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
// This would need a middleware to protect it
router.get('/profile', async (req, res) => {
    // Middleware would set req.user
    res.json({ message: 'Profile route' });
});

module.exports = router;
