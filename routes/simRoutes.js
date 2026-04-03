const express = require('express');
const router = express.Router();
const Sim = require('../models/Sim');

// GET all sims
router.get('/', async (req, res) => {
    try {
        const sims = await Sim.find().sort({ simNumber: 1 });
        res.json(sims);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST a new sim or update existing one by simNumber
router.post('/', async (req, res) => {
    try {
        const { simNumber, phoneNumber } = req.body;
        
        const sim = await Sim.findOneAndUpdate(
            { simNumber },
            { phoneNumber },
            { upsert: true, new: true }
        );

        res.status(201).json(sim);
    } catch (err) {
        console.error('Error saving SIM:', err);
        res.status(400).json({ message: err.message });
    }
});

// DELETE a sim
router.delete('/:id', async (req, res) => {
    try {
        await Sim.findByIdAndDelete(req.params.id);
        res.json({ message: 'SIM deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
