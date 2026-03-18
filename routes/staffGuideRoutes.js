const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const StaffGuide = require('../models/StaffGuide');
const { protect } = require('../middleware/authMiddleware');

// Configure Multer for PDF storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../public/uploads/staff-guides');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

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
// @desc    Upload a new staff guide
// @access  Private (Admin/Superadmin)
router.post('/upload', protect, adminOnly, upload.single('guide'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload a PDF file' });
        }

        const { title, description, category } = req.body;
        
        const guide = new StaffGuide({
            title: title || req.file.originalname,
            description,
            category,
            fileName: req.file.filename,
            filePath: req.file.path,
            fileUrl: `/uploads/staff-guides/${req.file.filename}`,
            size: req.file.size,
            uploadedBy: req.user._id
        });

        const savedGuide = await guide.save();
        res.status(201).json(savedGuide);
    } catch (error) {
        console.error('Upload Error:', error);
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

        // Delete file from storage
        const fullPath = path.join(__dirname, '..', 'public', guide.fileUrl);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }

        await StaffGuide.findByIdAndDelete(req.params.id);
        res.json({ message: 'Guide deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
