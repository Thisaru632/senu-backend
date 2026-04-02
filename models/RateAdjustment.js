const mongoose = require('mongoose');

const RateAdjustmentSchema = new mongoose.Schema({
    vehicle: {
        type: String,
        default: 'All', // 'All', specific name, or comma-separated names
    },
    category: {
        type: String,
        default: 'All', // 'All', 'City & Mountain', etc.
    },
    type: {
        type: String,
        default: 'All', // 'All', 'Drop', 'Return'
    },
    days: {
        type: String,
        default: 'All', // 'All' or a specific number as string
    },
    hrs: {
        type: String,
        default: 'All', // 'All' or a specific number as string
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
