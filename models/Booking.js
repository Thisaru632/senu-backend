const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
    vehicleType: {
        type: String,
        required: true
    },
    vehicleName: {
        type: String,
        required: true
    },
    tripType: {
        type: String,
        required: true
    },
    pickupLocation: {
        type: String,
        required: true
    },
    dropoffLocation: {
        type: String,
        required: true
    },
    dateTime: {
        type: Date,
        required: true
    },
    numberOfDays: {
        type: Number,
        default: 1
    },
    maxPersons: {
        type: Number,
        required: true
    },
    maxBags: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    telephone: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Cancelled', 'Completed'],
        default: 'Pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Booking', BookingSchema);
