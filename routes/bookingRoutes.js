const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');

// GET all bookings
router.get('/', async (req, res) => {
    try {
        const bookings = await Booking.find().sort({ createdAt: -1 });
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
        email,
        matchedPackage
    } = req.body;

    // Debug log — confirms what the backend received
    console.log('[BOOKING] Received matchedPackage:', !!matchedPackage);

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
        email,
        matchedPackage
    });

    try {
        const newBooking = await booking.save();
        console.log('[BOOKING] Saved destinations:', newBooking.destinations);
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
        const { status } = req.body;
        if (!status) {
            return res.status(400).json({ message: 'Status is required' });
        }

        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        booking.status = status;
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
