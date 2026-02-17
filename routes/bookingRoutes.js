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
        dateTime,
        numberOfDays,
        maxPersons,
        maxBags,
        name,
        telephone,
        email
    } = req.body;

    const booking = new Booking({
        vehicleType,
        vehicleName,
        tripType,
        pickupLocation,
        dropoffLocation,
        dateTime,
        numberOfDays,
        maxPersons,
        maxBags,
        name,
        telephone,
        email
    });

    try {
        const newBooking = await booking.save();
        res.status(201).json(newBooking);
    } catch (err) {
        res.status(400).json({ message: err.message });
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
