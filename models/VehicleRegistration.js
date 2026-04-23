const mongoose = require('mongoose');

const VehicleRegistrationSchema = new mongoose.Schema({
    driverName: {
        type: String,
        required: true,
        trim: true
    },
    whatsappNo: {
        type: String,
        required: true,
        trim: true
    },
    busLocation: {
        type: String,
        required: true,
        trim: true
    },
    busImages: {
        type: [String],
        default: []
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Registered'],
        default: 'Pending'
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('VehicleRegistration', VehicleRegistrationSchema);
