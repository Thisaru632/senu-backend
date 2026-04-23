const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const VehicleRegistration = require('../models/VehicleRegistration');

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../public/uploads/vehicle_registrations');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'bus-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only JPEG, JPG, PNG and WEBP images are allowed!'));
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

        const imagePaths = req.files ? req.files.map(file => `/uploads/vehicle_registrations/${file.filename}`) : [];

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
        const registration = await VehicleRegistration.findByIdAndDelete(req.params.id);
        if (!registration) {
            return res.status(404).json({ message: 'Registration not found' });
        }
        
        // Optional: Delete associated images from storage
        if (registration.busImages && registration.busImages.length > 0) {
            registration.busImages.forEach(imgPath => {
                const fullPath = path.join(__dirname, '../public', imgPath);
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                }
            });
        }

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
