const mongoose = require('mongoose');

const PromoCodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    discountType: {
        type: String,
        enum: ['Percentage', 'Fixed Amount'],
        default: 'Percentage',
        required: true
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0
    },
    applicableVehicle: {
        type: String,
        default: 'All'
    },
    description: {
        type: String,
        trim: true
    },
    validFrom: {
        type: Date,
        default: null
    },
    validTo: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['Active', 'Expired', 'Disabled'],
        default: 'Active'
    },
    usageCount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('PromoCode', PromoCodeSchema);
