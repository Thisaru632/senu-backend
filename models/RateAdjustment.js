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
        required: true,
        default: 0
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
