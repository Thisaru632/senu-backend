const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');
const SuperTeamMember = require('../models/SuperTeamMember');

// Multer Memory Storage Configuration
const storage = multer.memoryStorage();

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp|pdf/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(require('path').extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only JPEG, JPG, PNG, WEBP, and PDF files are allowed!'));
    }
});

/**
 * @route   GET /api/super-team/file/:id
 * @desc    View a file from GridFS
 */
router.get('/file/:id', async (req, res) => {
    try {
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: 'super_team_docs'
        });

        const fileId = new mongoose.Types.ObjectId(req.params.id);
        const downloadStream = bucket.openDownloadStream(fileId);

        downloadStream.on('error', () => {
            res.status(404).json({ message: 'File not found' });
        });

        downloadStream.pipe(res);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/**
 * @route   POST /api/super-team
 * @desc    Submit a new super team registration
 */
router.post('/', upload.fields([
    { name: 'ownerNicFrontFile', maxCount: 1 },
    { name: 'ownerNicBackFile', maxCount: 1 },
    { name: 'driverDocFrontFile', maxCount: 1 },
    { name: 'driverDocBackFile', maxCount: 1 }
]), async (req, res) => {
    try {
        const { 
            ownerName, ownerNIC, ownerPhone, ownerDate,
            driverName, driverNIC, driverPhone, driverLicenseNo, driverDate 
        } = req.body;

        // Validation
        if (!ownerName || !ownerNIC || !ownerPhone || !driverName || !driverNIC || !driverPhone || !driverLicenseNo) {
            return res.status(400).json({ message: 'All text fields are required' });
        }

        if (!req.files || !req.files['ownerNicFrontFile'] || !req.files['ownerNicBackFile'] || !req.files['driverDocFrontFile'] || !req.files['driverDocBackFile']) {
            return res.status(400).json({ message: 'Both front and back images for Owner NIC and Driver License/NIC are required' });
        }

        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: 'super_team_docs'
        });

        const uploadFileToGridFS = async (file) => {
            const uploadStream = bucket.openUploadStream(`superteam-${Date.now()}-${file.originalname}`, {
                contentType: file.mimetype
            });
            
            const fileId = uploadStream.id;
            uploadStream.end(file.buffer);

            await new Promise((resolve, reject) => {
                uploadStream.on('finish', resolve);
                uploadStream.on('error', reject);
            });

            return `/api/super-team/file/${fileId}`;
        };

        const ownerNicFrontImage = await uploadFileToGridFS(req.files['ownerNicFrontFile'][0]);
        const ownerNicBackImage = await uploadFileToGridFS(req.files['ownerNicBackFile'][0]);
        const driverDocFrontImage = await uploadFileToGridFS(req.files['driverDocFrontFile'][0]);
        const driverDocBackImage = await uploadFileToGridFS(req.files['driverDocBackFile'][0]);

        const newMember = new SuperTeamMember({
            ownerName, ownerNIC, ownerPhone, ownerDate, 
            ownerNicFrontImage, ownerNicBackImage,
            driverName, driverNIC, driverPhone, driverLicenseNo, driverDate, 
            driverDocFrontImage, driverDocBackImage
        });

        await newMember.save();

        res.status(201).json({
            message: 'Super Team membership submitted successfully',
            member: newMember
        });
    } catch (err) {
        console.error('[SuperTeam] Error:', err);
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   GET /api/super-team
 * @desc    Get all registrations
 */
router.get('/', async (req, res) => {
    try {
        const members = await SuperTeamMember.find().sort({ createdAt: -1 });
        res.json(members);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
