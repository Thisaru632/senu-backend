const mongoose = require('mongoose');

const TourPackageSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['freedom', 'destination'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    limit: {
        type: String, // e.g., "100 KM / 5 Hours"
        required: function () { return this.type === 'freedom'; }
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    gradient: {
        type: String, // linear-gradient for freedom packages
        default: "linear-gradient(to top, rgba(13, 148, 136, 0.9), transparent)"
    },
    tall: {
        type: Boolean, // for destination layout
        default: false
    },
    label: {
        type: String, // "Destinations" or similar
        default: "Destinations"
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, { timestamps: true });

module.exports = mongoose.model('TourPackage', TourPackageSchema);
