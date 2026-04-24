const express = require('express');
const router = express.Router();
const TourPackage = require('../models/TourPackage');
const multer = require('multer');
const mongoose = require('mongoose');

// Configure multer for memory storage (GridFS)
const storage = multer.memoryStorage();

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

/**
 * @route   GET /api/tour-packages/file/:id
 * @desc    View a file from GridFS
 */
router.get('/file/:id', async (req, res) => {
    try {
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: 'tour_packages'
        });

        const fileId = new mongoose.Types.ObjectId(req.params.id);
        const downloadStream = bucket.openDownloadStream(fileId);

        res.set('Content-Type', 'image/jpeg'); // Default to image/jpeg

        downloadStream.on('error', () => {
            res.status(404).json({ message: 'File not found' });
        });

        downloadStream.pipe(res);
    } catch (error) {
        res.status(500).json({ message: error.message });
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
router.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: 'tour_packages'
        });

        const uploadStream = bucket.openUploadStream(`package-${Date.now()}-${req.file.originalname}`, {
            contentType: req.file.mimetype
        });

        const fileId = uploadStream.id;
        uploadStream.end(req.file.buffer);

        await new Promise((resolve, reject) => {
            uploadStream.on('finish', resolve);
            uploadStream.on('error', reject);
        });

        const filePath = `/api/tour-packages/file/${fileId}`;
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
        const pkg = await TourPackage.findById(req.params.id);
        if (pkg && pkg.image) {
             const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
                bucketName: 'tour_packages'
            });
            try {
                const fileIdStr = pkg.image.split('/').pop();
                if (mongoose.Types.ObjectId.isValid(fileIdStr)) {
                    await bucket.delete(new mongoose.Types.ObjectId(fileIdStr));
                }
            } catch (e) {
                console.warn('GridFS Delete failed for package image', e.message);
            }
        }
        await TourPackage.findByIdAndDelete(req.params.id);
        res.json({ message: 'Package deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
