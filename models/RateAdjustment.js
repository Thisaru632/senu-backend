const mongoose = require('mongoose');

const RateAdjustmentSchema = new mongoose.Schema({
    vehicle: {
        type: String,
        default: 'All', // 'All' or specific vehicle name
    },
    type: {
        type: String,
        default: 'All', // 'All', 'Drop', 'Return'
    },
    percentage: {
        type: Number,
        default: 0
    },
    fixedAmount: {
        type: Number,
        default: 0
    },
    adjustmentType: {
        type: String,
        enum: ['percentage', 'fixed'],
        default: 'percentage'
    },
    minKm: {
        type: Number,
        default: 0
    },
    maxKm: {
        type: Number,
        default: 99999
    },
    validFrom: {
        type: Date,
        default: null
    },
    validTo: {
        type: Date,
        default: null
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('RateAdjustment', RateAdjustmentSchema);
