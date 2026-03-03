const mongoose = require('mongoose');

const RateCardSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
    },
    vehicle: {
        type: String,
        required: true,
    },
    days: {
        type: Number,
        required: true,
    },
    km: {
        type: Number,
        required: true,
    },
    hrs: {
        type: Number,
        required: true,
    },
    ratePercent: {
        type: String, // String because of '%'
        required: true,
    },
    rateAmount: {
        type: Number,
        required: true,
    },
    extraKMRate: {
        type: Number,
        required: true,
    },
    extraHrRate1: {
        type: Number,
        required: true,
    },
    extraHrRate2: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        default: 'Pending',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model('RateCard', RateCardSchema);
