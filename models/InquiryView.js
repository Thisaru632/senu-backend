const mongoose = require('mongoose');

const InquiryUploadSchema = new mongoose.Schema({
    fileName: {
        type: String,
        default: 'inquiry_data.csv'
    },
    headers: {
        type: [String],
        default: []
    },
    totalRows: {
        type: Number,
        default: 0
    },
    totalColumns: {
        type: Number,
        default: 0
    },
    uploadedBy: {
        type: String,
        default: ''
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

const InquiryChunkSchema = new mongoose.Schema({
    uploadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InquiryUpload',
        required: true,
        index: true
    },
    chunkIndex: {
        type: Number,
        required: true,
        index: true
    },
    rows: {
        type: [[String]],
        default: []
    }
});

const InquiryUpload = mongoose.models.InquiryUpload || mongoose.model('InquiryUpload', InquiryUploadSchema);
const InquiryChunk = mongoose.models.InquiryChunk || mongoose.model('InquiryChunk', InquiryChunkSchema);

module.exports = {
    InquiryUpload,
    InquiryChunk
};
