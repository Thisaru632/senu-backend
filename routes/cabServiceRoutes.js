const express = require('express');
const router = express.Router();
const CabService = require('../models/CabService');

// GET all cab services
router.get('/', async (req, res) => {
    try {
        const services = await CabService.find().sort({ createdAt: -1 });
        res.json(services);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST a new cab service
router.post('/', async (req, res) => {
    try {
        const { serviceName, hotlineNumbers, location, serviceType, comments, status } = req.body;
        
        const service = new CabService({
            serviceName,
            hotlineNumbers,
            location,
            serviceType,
            comments,
            status: status || 'Active'
        });

        const newService = await service.save();
        res.status(201).json(newService);
    } catch (err) {
        console.error('Error creating cab service:', err);
        res.status(400).json({ message: err.message });
    }
});

// PATCH a cab service
router.patch('/:id', async (req, res) => {
    try {
        const updated = await CabService.findByIdAndUpdate(
            req.params.id, 
            { ...req.body, lastUpdated: new Date() }, 
            { new: true }
        );
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a cab service
router.delete('/:id', async (req, res) => {
    try {
        await CabService.findByIdAndDelete(req.params.id);
        res.json({ message: 'Cab service deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
