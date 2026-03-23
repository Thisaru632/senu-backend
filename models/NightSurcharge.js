const mongoose = require('mongoose');

const NightSurchargeSchema = new mongoose.Schema({
    vehicle: {
        type: String,
        default: 'All', // 'All' or specific vehicle name
    },
    type: {
        type: String,
        default: 'All', // 'All', 'Drop', 'Return'
    },
    minKm: {
        type: Number,
        default: 0
    },
    maxKm: {
        type: Number,
        default: 99999
    },
    startTime: {
        type: String,
        default: '00:00' // 24h format HH:mm
    },
    endTime: {
        type: String,
        default: '04:00'
    },
    amount: {
        type: Number,
        required: true,
        default: 0
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('NightSurcharge', NightSurchargeSchema);
