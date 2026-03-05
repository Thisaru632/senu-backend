const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const RateCard = require('../models/RateCard');
const RateAdjustment = require('../models/RateAdjustment');

const os = require('os');

// Use os.tmpdir() for compatibility with serverless environments like Vercel
const upload = multer({ dest: os.tmpdir() });

console.log('[RateCardRouter] Initializing routes...');

/**
 * @route   GET /api/rate-cards/adjust
 * @desc    Get all active rate adjustments
 */
router.get('/adjust', async (req, res) => {
    try {
        console.log('[RateCardRouter] GET /adjust called');
        const adjustments = await RateAdjustment.find().sort({ lastUpdated: -1 });
        res.json(adjustments);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   POST /api/rate-cards/adjust
 * @desc    Add or update a rate adjustment rule
 */
router.post('/adjust', async (req, res) => {
    try {
        const { percentage, vehicle, type } = req.body;
        console.log('[RateCardRouter] POST /adjust called:', { percentage, vehicle, type });
        const pct = parseFloat(percentage);

        if (isNaN(pct)) return res.status(400).json({ message: 'Invalid percentage' });

        const query = { vehicle: vehicle || 'All', type: type || 'All' };
        const update = {
            percentage: pct,
            lastUpdated: new Date()
        };

        const adjustment = await RateAdjustment.findOneAndUpdate(
            query,
            update,
            { upsert: true, new: true }
        );

        res.json({ message: `Successfully updated ${vehicle || 'All'} adjustment to ${pct}%`, adjustment });
    } catch (err) {
        console.error(`[RateCard] Adjustment error:`, err);
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   DELETE /api/rate-cards/adjust/:id
 * @desc    Reset (delete) a specific adjustment
 */
router.delete('/adjust/:id', async (req, res) => {
    try {
        await RateAdjustment.findByIdAndDelete(req.params.id);
        res.json({ message: 'Adjustment reset successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   GET /api/rate-cards
 * @desc    Get all rate card entries with optional status filter
 */
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        const filter = status ? { status } : {};
        console.log(`[RateCard] Fetching with filter:`, filter);
        const rateCards = await RateCard.find(filter).sort({ createdAt: -1 });
        res.json(rateCards);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   PATCH /api/rate-cards/:id/status
 * @desc    Update status of a rate card
 */
router.patch('/:id/status', async (req, res) => {
    console.log(`[RateCard] Status update request for ${req.params.id} to ${req.body.status}`);
    try {
        const { status } = req.body;
        if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const rateCard = await RateCard.findById(req.params.id);
        if (!rateCard) {
            console.log(`[RateCard] Not found: ${req.params.id}`);
            return res.status(404).json({ message: 'Rate card not found' });
        }

        rateCard.status = status;
        await rateCard.save();

        console.log(`[RateCard] Successfully updated ${req.params.id} to ${status}`);
        res.json({ message: `Rate card status updated to ${status}`, rateCard });
    } catch (err) {
        console.error(`[RateCard] Update error:`, err);
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   POST /api/rate-cards/upload
 * @desc    Upload CSV and parse into RateCard collection
 */
router.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const results = [];
    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('error', (error) => {
            console.error('CSV Parsing Error:', error);
            res.status(500).json({ message: 'Error parsing CSV file' });
        })
        .on('end', async () => {
            try {
                if (results.length === 0) {
                    fs.unlinkSync(req.file.path);
                    return res.status(400).json({ message: 'CSV file is empty' });
                }

                // Map CSV data to our RateCard schema
                // Mapping handles variations in header names based on common exports
                const formattedData = results.map(row => {
                    // Extract values by looking at keys (some CSVs might have spaces or weird characters)
                    const getVal = (possibleNames) => {
                        const key = Object.keys(row).find(k =>
                            possibleNames.some(name => k.toLowerCase().trim() === name.toLowerCase())
                        );
                        return key ? row[key] : null;
                    };

                    return {
                        type: getVal(['type', 'Type']) || 'Return',
                        vehicle: getVal(['vehicle', 'Vehicle', 'Model']) || 'Unknown',
                        days: parseInt(getVal(['days', 'Days', 'Day'])) || 1,
                        km: parseInt(getVal(['km', 'KM', 'Distance'])) || 0,
                        hrs: parseInt(getVal(['hrs', 'Hrs', 'Hours', 'Hour'])) || 0,
                        ratePercent: getVal(['rate %', 'Rate %', 'rate_percent']) || '100%',
                        rateAmount: parseFloat(getVal(['rate', 'Rate', 'Amount', 'Basic Rate'])) || 0,
                        extraKMRate: parseFloat(getVal(['extra km', 'Extra KM', 'km_rate'])) || 0,
                        extraHrRate1: parseFloat(getVal(['extra hr', 'Extra Hr', 'hr_rate_1', 'Ext Hrs'])) || 0,
                        extraHrRate2: parseFloat(getVal(['extra hr 2', 'Extra Hr 2', 'hr_rate_2'])) || 0,
                        status: getVal(['status', 'Status']) || 'Pending'
                    };
                });

                // Option: Clear existing data before inserting new ones from manage page
                // This makes it a "replacement" upload which is usually what's wanted for rate cards
                await RateCard.deleteMany({});

                await RateCard.insertMany(formattedData);

                // Clean up uploaded file
                fs.unlinkSync(req.file.path);

                res.status(201).json({
                    message: 'Rate card updated successfully',
                    count: formattedData.length
                });
            } catch (err) {
                console.error('Database Error:', err);
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                res.status(500).json({ message: 'Error saving data to database: ' + err.message });
            }
        });
});


/**
 * @route   DELETE /api/rate-cards
 * @desc    Clear all rate card entries
 */
router.delete('/', async (req, res) => {
    try {
        await RateCard.deleteMany({});
        res.json({ message: 'Rate card cleared successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
