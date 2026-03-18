const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');
const StaffGuide = require('../models/StaffGuide');
const { protect } = require('../middleware/authMiddleware');

// Storage in Memory (for GridFS upload)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only PDF files are allowed!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

const adminOnly = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as an admin' });
    }
};

// @route   POST /api/staff-guides/upload
// @desc    Upload a new staff guide to GridFS (Database)
// @access  Private (Admin/Superadmin)
router.post('/upload', protect, adminOnly, upload.single('guide'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload a PDF file' });
        }

        const { title, description, category } = req.body;
        
        // Setup GridFS
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: 'staff_guides'
        });

        const uploadStream = bucket.openUploadStream(req.file.originalname, {
            contentType: req.file.mimetype
        });

        const fileId = uploadStream.id;

        uploadStream.end(req.file.buffer);

        uploadStream.on('error', (err) => {
            return res.status(500).json({ message: 'Error saving to database' });
        });

        uploadStream.on('finish', async () => {
            const guide = new StaffGuide({
                title: title || req.file.originalname,
                description,
                category,
                fileName: req.file.originalname,
                fileId: fileId,
                fileUrl: `/api/staff-guides/file/${fileId}`,
                size: req.file.size,
                uploadedBy: req.user._id
            });

            const savedGuide = await guide.save();
            res.status(201).json(savedGuide);
        });

    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/staff-guides/file/:id
// @desc    View a file from GridFS
// @access  Public (Handled by frontend security)
router.get('/file/:id', async (req, res) => {
    try {
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: 'staff_guides'
        });

        const fileId = new mongoose.Types.ObjectId(req.params.id);
        const downloadStream = bucket.openDownloadStream(fileId);

        res.set('Content-Type', 'application/pdf');
        res.set('Accept-Ranges', 'bytes');

        downloadStream.on('error', () => {
            res.status(404).json({ message: 'File not found' });
        });

        downloadStream.pipe(res);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/staff-guides
// @desc    List all staff guides
// @access  Private (Any staff)
router.get('/', protect, async (req, res) => {
    try {
        const guides = await StaffGuide.find()
            .populate('uploadedBy', 'fullName username')
            .sort({ createdAt: -1 });
        res.json(guides);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   DELETE /api/staff-guides/:id
// @desc    Delete a staff guide
// @access  Private (Admin/Superadmin)
router.delete('/:id', protect, adminOnly, async (req, res) => {
    try {
        const guide = await StaffGuide.findById(req.params.id);
        if (!guide) {
            return res.status(404).json({ message: 'Guide not found' });
        }

        // Delete from GridFS
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: 'staff_guides'
        });
        
        try {
            await bucket.delete(new mongoose.Types.ObjectId(guide.fileId));
        } catch (e) {
            console.warn('GridFS Delete failed, moving on...', e);
        }

        await StaffGuide.findByIdAndDelete(req.params.id);
        res.json({ message: 'Guide deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
