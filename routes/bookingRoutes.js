const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const PromoCode = require('../models/PromoCode');

const { protectCustomer } = require('../middleware/customerAuth');

// GET all bookings
router.get('/', async (req, res) => {
    try {
        const bookings = await Booking.find().sort({ createdAt: -1 });
        res.json(bookings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET customer's own bookings
router.get('/my-bookings', protectCustomer, async (req, res) => {
    try {
        const bookings = await Booking.find({ email: req.customer.email }).sort({ createdAt: -1 });
        res.json(bookings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST a new booking
router.post('/', async (req, res) => {
    const {
        vehicleType,
        vehicleName,
        tripType,
        pickupLocation,
        dropoffLocation,
        destinations,
        dateTime,
        numberOfDays,
        maxPersons,
        maxBags,
        name,
        telephone,
        additionalPhones,
        email,
        remark,
        matchedPackage,
        promoCode,
        discount,
        routeDistance,
        routeDuration,
        totalPrice,
        provinceAdjustment,
        seasonalAdjustment,
        discountPercentage
    } = req.body;

    // Debug log — confirms what the backend received
    console.log('[BOOKING] Full request body:', JSON.stringify(req.body, null, 2));
    console.log('[BOOKING] Received matchedPackage:', !!matchedPackage);
    console.log('[BOOKING] Received promo:', promoCode, 'discount:', discount);

    const booking = new Booking({
        vehicleType,
        vehicleName,
        tripType,
        pickupLocation,
        dropoffLocation,
        destinations: destinations || [],
        dateTime,
        numberOfDays,
        maxPersons,
        maxBags,
        name,
        telephone,
        additionalPhones: additionalPhones || [],
        email,
        remark,
        matchedPackage,
        promoCode,
        discount,
        routeDistance: routeDistance || 0,
        routeDuration: routeDuration || 0,
        totalPrice: totalPrice || 0,
        provinceAdjustment: provinceAdjustment || 0,
        seasonalAdjustment: seasonalAdjustment || 0,
        discountPercentage: discountPercentage || 0
    });

    try {
        const newBooking = await booking.save();
        console.log('[BOOKING] Saved destinations:', newBooking.destinations);

        // Increment promo code usage count if provided
        if (promoCode) {
            try {
                const updatedPromo = await PromoCode.findOneAndUpdate(
                    { code: promoCode.toUpperCase() },
                    { $inc: { usageCount: 1 } },
                    { new: true }
                );
                if (updatedPromo) {
                    console.log(`[BOOKING] Incremented usageCount for promo: ${promoCode}, new count: ${updatedPromo.usageCount}`);
                } else {
                    console.log(`[BOOKING] Promo code ${promoCode} not found for usage tracking.`);
                }
            } catch (promoErr) {
                console.error('[BOOKING] Error incrementing promo usage count:', promoErr);
            }
        }

        res.status(201).json(newBooking);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// PATCH pick a booking (assign to employee)
router.patch('/:id/pick', async (req, res) => {
    try {
        const { employeeName } = req.body;
        if (!employeeName) {
            return res.status(400).json({ message: 'Employee name is required' });
        }

        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        booking.employeeName = employeeName;
        await booking.save();

        res.json({ message: 'Lead picked successfully', booking });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PATCH update booking status
router.patch('/:id/status', async (req, res) => {
    try {
        const { status, remark } = req.body;
        if (!status) {
            return res.status(400).json({ message: 'Status is required' });
        }

        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        booking.status = status;
        if (remark !== undefined) {
            booking.staffRemark = remark;
        }
        await booking.save();

        res.json({ message: 'Status updated successfully', booking });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PATCH mark a booking as viewed
router.patch('/:id/viewed', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        booking.isViewed = true;
        await booking.save();

        res.json({ message: 'Marked as viewed', booking });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE a booking
router.delete('/:id', async (req, res) => {
    try {
        await Booking.findByIdAndDelete(req.params.id);
        res.json({ message: 'Booking deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
