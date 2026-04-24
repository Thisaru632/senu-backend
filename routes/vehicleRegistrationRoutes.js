const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');
const VehicleRegistration = require('../models/VehicleRegistration');

// Multer Memory Storage Configuration (for GridFS upload)
const storage = multer.memoryStorage();

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(require('path').extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only JPEG, JPG, PNG and WEBP images are allowed!'));
    }
});

/**
 * @route   GET /api/vehicle-registrations/file/:id
 * @desc    View a file from GridFS
 */
router.get('/file/:id', async (req, res) => {
    try {
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: 'vehicle_registrations'
        });

        const fileId = new mongoose.Types.ObjectId(req.params.id);
        const downloadStream = bucket.openDownloadStream(fileId);

        // Try to determine content type or default to image/jpeg
        res.set('Content-Type', 'image/jpeg'); 

        downloadStream.on('error', () => {
            res.status(404).json({ message: 'File not found' });
        });

        downloadStream.pipe(res);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/**
 * @route   POST /api/vehicle-registrations
 * @desc    Submit a new vehicle registration with multiple images
 */
router.post('/', upload.array('busImages', 10), async (req, res) => {
    try {
        const { driverName, whatsappNo, busLocation } = req.body;

        if (!driverName || !whatsappNo || !busLocation) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: 'vehicle_registrations'
        });

        const imagePaths = [];

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const uploadStream = bucket.openUploadStream(`bus-${Date.now()}-${file.originalname}`, {
                    contentType: file.mimetype
                });
                
                const fileId = uploadStream.id;
                uploadStream.end(file.buffer);

                // Wait for upload to finish
                await new Promise((resolve, reject) => {
                    uploadStream.on('finish', resolve);
                    uploadStream.on('error', reject);
                });

                imagePaths.push(`/api/vehicle-registrations/file/${fileId}`);
            }
        }

        const newRegistration = new VehicleRegistration({
            driverName,
            whatsappNo,
            busLocation,
            busImages: imagePaths
        });

        await newRegistration.save();

        res.status(201).json({
            message: 'Vehicle registration submitted successfully',
            registration: newRegistration
        });
    } catch (err) {
        console.error('[VehicleRegistration] Error:', err);
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   DELETE /api/vehicle-registrations/:id
 * @desc    Delete a vehicle registration
 */
router.delete('/:id', async (req, res) => {
    try {
        const registration = await VehicleRegistration.findById(req.params.id);
        if (!registration) {
            return res.status(404).json({ message: 'Registration not found' });
        }
        
        // Delete associated images from GridFS
        if (registration.busImages && registration.busImages.length > 0) {
            const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
                bucketName: 'vehicle_registrations'
            });

            for (const imgPath of registration.busImages) {
                try {
                    // Extract file ID from path /api/vehicle-registrations/file/ID
                    const fileIdStr = imgPath.split('/').pop();
                    if (mongoose.Types.ObjectId.isValid(fileIdStr)) {
                        await bucket.delete(new mongoose.Types.ObjectId(fileIdStr));
                    }
                } catch (e) {
                    console.warn('GridFS Delete failed for', imgPath, e.message);
                }
            }
        }

        await VehicleRegistration.findByIdAndDelete(req.params.id);
        res.json({ message: 'Registration deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   PATCH /api/vehicle-registrations/:id/status
 * @desc    Update status of a registration (Approve/Reject)
 */
router.patch('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['Pending', 'Approved', 'Rejected', 'Registered'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const registration = await VehicleRegistration.findById(req.params.id);
        if (!registration) {
            return res.status(404).json({ message: 'Registration not found' });
        }

        registration.status = status;
        await registration.save();

        res.json({ message: `Registration ${status.toLowerCase()} successfully`, registration });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   GET /api/vehicle-registrations/pending-count
 * @desc    Get count of pending registrations
 */
router.get('/pending-count', async (req, res) => {
    try {
        const count = await VehicleRegistration.countDocuments({ status: 'Pending' });
        res.json({ count });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   GET /api/vehicle-registrations
 * @desc    Get all registrations (for admin)
 */
router.get('/', async (req, res) => {
    try {
        const registrations = await VehicleRegistration.find().sort({ createdAt: -1 });
        res.json(registrations);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
