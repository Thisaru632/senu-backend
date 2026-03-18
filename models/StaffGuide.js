const mongoose = require('mongoose');

const staffGuideSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please provide a title for the guide'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    fileName: {
        type: String,
        required: true
    },
    filePath: {
        type: String,
        required: true
    },
    fileUrl: {
        type: String,
        required: true
    },
    fileType: {
        type: String,
        default: 'application/pdf'
    },
    size: {
        type: Number
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff',
        required: true
    },
    category: {
        type: String,
        default: 'General'
    }
}, { timestamps: true });

module.exports = mongoose.model('StaffGuide', staffGuideSchema);
