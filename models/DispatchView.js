const mongoose = require('mongoose');

const DispatchUploadSchema = new mongoose.Schema({
    fileName: {
        type: String,
        default: 'dispatch_data.csv'
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

const DispatchChunkSchema = new mongoose.Schema({
    uploadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DispatchUpload',
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

const DispatchUpload = mongoose.models.DispatchUpload || mongoose.model('DispatchUpload', DispatchUploadSchema);
const DispatchChunk = mongoose.models.DispatchChunk || mongoose.model('DispatchChunk', DispatchChunkSchema);

module.exports = {
    DispatchUpload,
    DispatchChunk
};
