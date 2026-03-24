const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const RateCard = require('../models/RateCard');
const RateAdjustment = require('../models/RateAdjustment');
const GlobalSetting = require('../models/GlobalSetting');
const NightSurcharge = require('../models/NightSurcharge');

const os = require('os');

// Use os.tmpdir() for compatibility with serverless environments like Vercel
const upload = multer({ dest: os.tmpdir() });

console.log('[RateCardRouter] Initializing routes...');

/**
 * @route   GET /api/rate-cards/settings
 * @desc    Get all global settings (like non-peak time charge toggle)
 */
router.get('/settings', async (req, res) => {
    try {
        const settings = await GlobalSetting.find();
        const settingsMap = settings.reduce((acc, s) => {
            acc[s.key] = s.value;
            return acc;
        }, {});
        res.json(settingsMap);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   POST /api/rate-cards/settings
 * @desc    Update a global setting
 */
router.post('/settings', async (req, res) => {
    try {
        const { key, value, description } = req.body;
        if (!key) return res.status(400).json({ message: 'Key is required' });

        const setting = await GlobalSetting.findOneAndUpdate(
            { key },
            { value, description, lastUpdated: new Date() },
            { upsert: true, new: true }
        );

        res.json({ message: `Successfully updated ${key}`, setting });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

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
 * @route   GET /api/rate-cards/categories
 * @desc    Get unique vehicle categories from rate cards
 */
router.get('/categories', async (req, res) => {
    try {
        const categories = await RateCard.distinct('vehicle');
        res.json(categories);
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
        const { percentage, vehicle, type, validFrom, validTo } = req.body;
        console.log('[RateCardRouter] POST /adjust called:', { percentage, vehicle, type, validFrom, validTo });
        const pct = parseFloat(percentage);

        if (isNaN(pct)) return res.status(400).json({ message: 'Invalid percentage' });

        const query = { vehicle: vehicle || 'All', type: type || 'All' };
        const update = {
            percentage: pct,
            validFrom: validFrom ? new Date(validFrom) : null,
            validTo: validTo ? new Date(validTo) : null,
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
 * @route   GET /api/rate-cards/night-surcharge
 * @desc    Get all active night surcharge rules
 */
router.get('/night-surcharge', async (req, res) => {
    try {
        console.log('[RateCardRouter] GET /night-surcharge called');
        const surcharges = await NightSurcharge.find().sort({ lastUpdated: -1 });
        res.json(surcharges);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   POST /api/rate-cards/night-surcharge
 * @desc    Add or update a night surcharge rule
 */
router.post('/night-surcharge', async (req, res) => {
    try {
        const { vehicle, type, minKm, maxKm, startTime, endTime, amount } = req.body;
        console.log('[RateCardRouter] POST /night-surcharge called:', req.body);
        
        const amt = parseFloat(amount);
        if (isNaN(amt)) return res.status(400).json({ message: 'Invalid amount' });

        // Update if all filters match exactly, otherwise create new
        const query = { 
            vehicle: vehicle || 'All', 
            type: type || 'All',
            minKm: parseInt(minKm) || 0,
            maxKm: parseInt(maxKm) || 99999,
            startTime: startTime || '00:00',
            endTime: endTime || '04:00'
        };

        const update = {
            amount: amt,
            lastUpdated: new Date()
        };

        const result = await NightSurcharge.findOneAndUpdate(
            query,
            update,
            { upsert: true, new: true }
        );

        res.json({ message: `Successfully added/updated night surcharge rule`, result });
    } catch (err) {
        console.error(`[RateCard] Night surcharge error:`, err);
        res.status(500).json({ message: err.message });
    }
});

router.delete('/night-surcharge/:id', async (req, res) => {
    try {
        await NightSurcharge.findByIdAndDelete(req.params.id);
        res.json({ message: 'Night surcharge rule removed successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   PATCH /api/rate-cards/night-surcharge/:id
 * @desc    Update status of a specific night surcharge rule
 */
router.patch('/night-surcharge/:id', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['Active', 'Inactive'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }
        await NightSurcharge.findByIdAndUpdate(req.params.id, { status, lastUpdated: new Date() });
        res.json({ message: `Night surcharge rule marked as ${status}` });
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
                const formattedData = results
                    .map((row, index) => {
                        if (index === 0) {
                            console.log('[RateCardUpload] First row keys:', Object.keys(row));
                        }
                        const getVal = (possibleNames) => {
                            const key = Object.keys(row).find(k => {
                                // Remove BOM and non-printable characters, then normalize spaces
                                const cleanK = k.replace(/[^\x20-\x7E\s]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
                                return possibleNames.some(name => {
                                    const cleanName = name.toLowerCase().replace(/\s+/g, ' ').trim();
                                    return cleanK === cleanName || cleanK.includes(cleanName);
                                });
                            });
                            return key ? row[key]?.trim() : null;
                        };

                        // Clean numeric values (remove LKR, commas, etc.)
                        const cleanNum = (val) => {
                            if (!val) return 0;
                            // Remove anything that isn't a digit, dot or minus sign
                            const cleaned = val.toString().replace(/[^\d.-]/g, '');
                            return parseFloat(cleaned) || 0;
                        };

                        const vehicle = getVal(['vehicle', 'Vehicle', 'Model', 'Vehicle Name']) || 'Unknown';
                        const ratePercent = getVal(['rate %', 'Rate %', 'rate_percent', 'rate percentage']) || '100%';
                        const hrs = parseInt(getVal(['hrs', 'Hrs', 'Hours', 'Hour', 'no of hrs'])) || 0;

                        // Guideline 1: Nano and SUV must be removed
                        if (['nano', 'suv'].includes(vehicle.toLowerCase().trim())) return null;

                        // Guideline 2: Get only 100% rates
                        if (ratePercent !== '100%' && ratePercent !== '100') return null;

                        // Guideline 3: 28h, 52h, 76h packages must be removed
                        if ([28, 52, 76].includes(hrs)) return null;

                        return {
                            type: getVal(['type', 'Type', 'trip type', 'Trip']) || 'Return',
                            category: getVal(['category', 'Category', 'Vehicle Category', 'Cat']),
                            vehicle: vehicle,
                            days: parseInt(getVal(['days', 'Days', 'Day', 'no of days', 'Duration (Days)'])) || 1,
                            km: parseInt(getVal(['km', 'KM', 'Distance', 'km limit', 'KM Limit'])) || 0,
                            hrs: hrs,
                            ratePercent: ratePercent,
                            rateAmount: cleanNum(getVal(['rate', 'Rate', 'Amount', 'Basic Rate', 'package rate', 'Basic Package Rate'])),
                            extraKMRate: cleanNum(getVal(['extra km', 'Extra KM', 'km_rate', 'ext km', 'ext_km', 'ext. km', 'ext.km', 'Extra KM Rate', 'KM Rate', 'pk rate', 'price/km', 'per km', 'Extra KM Charge', 'extra km fee', 'rate per km', 'per km rate'])) ,
                            extraHrRate1: cleanNum(getVal(['extra hr', 'Extra Hr', 'hr_rate_1', 'Ext Hrs', 'ext hr', 'ext. hr', 'Extra Hour Rate', 'Extra Hr Rate', 'Price/Hr', 'Extra Hr Fee'])),
                            extraHrRate2: cleanNum(getVal(['extra hr 2', 'Extra Hr 2', 'hr_rate_2', 'ext hr 2', 'ext. hr 2', 'Extra Hour Rate 2', 'Extra Hr Rate 2', 'Extra Hr Fee 2'])),
                            status: getVal(['status', 'Status', 'state', 'Approval Status']) || 'Approved'
                        };
                    })
                    .filter(item => item !== null);

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
