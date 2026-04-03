const mongoose = require('mongoose');

const SimSchema = new mongoose.Schema({
    simNumber: {
        type: Number,
        required: true,
        unique: true
    },
    phoneNumber: {
        type: String,
        required: true
    },
    status: {
        type: String,
        default: 'Active'
    }
}, { timestamps: true });

module.exports = mongoose.model('Sim', SimSchema);
