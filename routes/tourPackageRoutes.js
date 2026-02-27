const express = require('express');
const router = express.Router();
const TourPackage = require('../models/TourPackage');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for image upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/uploads/packages');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, 'package-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

// @desc    Get all tour packages
// @route   GET /api/tour-packages
router.get('/', async (req, res) => {
    try {
        const packages = await TourPackage.find({ status: 'active' });
        res.json(packages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Upload image for package
// @route   POST /api/tour-packages/upload
router.post('/upload', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        const filePath = `/uploads/packages/${req.file.filename}`;
        res.json({ url: filePath });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get all packages for staff (including inactive)
// @route   GET /api/tour-packages/all
router.get('/all', async (req, res) => {
    try {
        const packages = await TourPackage.find().sort({ createdAt: -1 });
        res.json(packages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Create a new tour package
// @route   POST /api/tour-packages
router.post('/', async (req, res) => {
    try {
        const newPackage = new TourPackage(req.body);
        const savedPackage = await newPackage.save();
        res.status(201).json(savedPackage);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// @desc    Update a tour package
// @route   PATCH /api/tour-packages/:id
router.patch('/:id', async (req, res) => {
    try {
        const updatedPackage = await TourPackage.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json(updatedPackage);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// @desc    Delete a tour package
// @route   DELETE /api/tour-packages/:id
router.delete('/:id', async (req, res) => {
    try {
        await TourPackage.findByIdAndDelete(req.params.id);
        res.json({ message: 'Package deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
