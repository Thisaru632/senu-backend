const express = require('express');
const router = express.Router();
const CabRate = require('../models/CabRate');

// GET all rates
router.get('/', async (req, res) => {
    try {
        const rates = await CabRate.find().sort({ rateDate: -1 });
        res.json(rates);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST a new rate
router.post('/', async (req, res) => {
    try {
        // Generate unique reference number (e.g., CR-0001)
        const lastRate = await CabRate.findOne({}, { refNo: 1 }).sort({ createdAt: -1 });
        let nextNumber = 1;
        if (lastRate && lastRate.refNo) {
            const lastNumber = parseInt(lastRate.refNo.split('-')[1]);
            if (!isNaN(lastNumber)) {
                nextNumber = lastNumber + 1;
            }
        }
        const refNo = `CR-${String(nextNumber).padStart(4, '0')}`;

        const rate = new CabRate({ ...req.body, refNo });
        const newRate = await rate.save();
        res.status(201).json(newRate);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// PATCH a rate
router.patch('/:id', async (req, res) => {
    try {
        const updated = await CabRate.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a rate
router.delete('/:id', async (req, res) => {
    try {
        await CabRate.findByIdAndDelete(req.params.id);
        res.json({ message: 'Rate deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
