const express = require('express');
const router = express.Router();
const PromoCode = require('../models/PromoCode');

/**
 * @route   GET /api/promo-codes
 * @desc    Get all promo codes
 */
router.get('/', async (req, res) => {
    try {
        const rawCodes = await PromoCode.find().sort({ createdAt: -1 });

        // Map legacy fields for old data
        const promoCodes = rawCodes.map(promo => {
            const obj = promo.toObject();
            if (obj.discountPercentage !== undefined && obj.discountValue === undefined) {
                obj.discountValue = obj.discountPercentage;
                obj.discountType = 'Percentage';
            }
            return obj;
        });

        res.json(promoCodes);
    } catch (err) {
        console.error(`[PromoCode] Fetch error:`, err);
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   POST /api/promo-codes
 * @desc    Create a new promo code
 */
router.post('/', async (req, res) => {
    try {
        const { code, discountType, discountValue, applicableVehicle, description, validFrom, validTo, status } = req.body;

        // Check for duplicates
        const existing = await PromoCode.findOne({ code: code.toUpperCase() });
        if (existing) {
            return res.status(400).json({ message: 'Promo code already exists' });
        }

        const newPromo = new PromoCode({
            code,
            discountType,
            discountValue,
            applicableVehicle: applicableVehicle || 'All',
            description,
            validFrom: validFrom || null,
            validTo: validTo || null,
            status: status || 'Active'
        });

        await newPromo.save();
        res.status(201).json({ message: 'Promo code created successfully', promoCode: newPromo });
    } catch (err) {
        console.error(`[PromoCode] Create error:`, err);
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   PUT /api/promo-codes/:id
 * @desc    Update a promo code
 */
router.put('/:id', async (req, res) => {
    try {
        const { code, discountType, discountValue, applicableVehicle, description, validFrom, validTo, status } = req.body;

        const update = {
            code,
            discountType,
            discountValue,
            applicableVehicle: applicableVehicle || 'All',
            description,
            validFrom: validFrom || null,
            validTo: validTo || null,
            status
        };

        const promoCode = await PromoCode.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!promoCode) {
            return res.status(404).json({ message: 'Promo code not found' });
        }

        res.json({ message: 'Promo code updated successfully', promoCode });
    } catch (err) {
        console.error(`[PromoCode] Update error:`, err);
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route   DELETE /api/promo-codes/:id
 * @desc    Delete a promo code
 */
router.delete('/:id', async (req, res) => {
    try {
        const promoCode = await PromoCode.findByIdAndDelete(req.params.id);
        if (!promoCode) {
            return res.status(404).json({ message: 'Promo code not found' });
        }
        res.json({ message: 'Promo code deleted successfully' });
    } catch (err) {
        console.error(`[PromoCode] Delete error:`, err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
