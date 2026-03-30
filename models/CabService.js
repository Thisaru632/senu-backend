const mongoose = require('mongoose');

const CabServiceSchema = new mongoose.Schema({
    serviceName: { type: String, required: true },
    hotlineNumbers: { type: String }, // Storing as string to match the "0112337337 / 777456" style in screenshot
    location: { type: String },
    serviceType: { type: String }, 
    comments: { type: String },
    status: { type: String, default: 'Active' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CabService', CabServiceSchema);
