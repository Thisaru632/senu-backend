const mongoose = require('mongoose');

const CabRateSchema = new mongoose.Schema({
    rateDate: { type: Date, default: Date.now },
    refNo: { type: String, unique: true },
    addedBy: { type: String },
    cabCompanyName: { type: String, required: true },
    hotline: { type: String },
    nearTown: { type: String },
    vehicle: { type: String },
    startLocation: { type: String },
    endLocation: { type: String },
    tripType: { type: String },
    km: { type: Number },
    hours: { type: Number },
    price: { type: Number },
    extraKmPrice: { type: Number },
    extraHourPrice: { type: Number },
    comment: { type: String },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CabRate', CabRateSchema);
