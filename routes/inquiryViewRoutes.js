const express = require('express');
const router = express.Router();
const { InquiryUpload, InquiryChunk } = require('../models/InquiryView');

// GET latest active inquiry data
router.get('/', async (req, res) => {
    try {
        const upload = await InquiryUpload.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
        if (!upload) {
            return res.json({
                success: true,
                hasData: false,
                fileName: '',
                headers: [],
                rows: [],
                totalRows: 0,
                totalColumns: 0
            });
        }

        const chunks = await InquiryChunk.find({ uploadId: upload._id })
            .sort({ chunkIndex: 1 })
            .lean();

        const rows = chunks.flatMap(c => c.rows || []);

        return res.json({
            success: true,
            hasData: true,
            uploadId: upload._id,
            fileName: upload.fileName,
            headers: upload.headers || [],
            rows: rows,
            totalRows: upload.totalRows || rows.length,
            totalColumns: upload.totalColumns || (upload.headers ? upload.headers.length : 0),
            uploadedAt: upload.uploadedAt,
            uploadedBy: upload.uploadedBy
        });
    } catch (err) {
        console.error('Error fetching inquiry data:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch inquiry data from database',
            error: err.message
        });
    }
});

// POST upload and save CSV data to database
router.post('/upload', async (req, res) => {
    try {
        const { fileName, headers, rows, uploadedBy } = req.body;

        if (!Array.isArray(headers) || headers.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid headers. At least one column header is required.'
            });
        }

        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid rows. At least one row of data is required.'
            });
        }

        // Clean up previous uploads to maintain current active inquiry view
        const prevUploads = await InquiryUpload.find({});
        if (prevUploads.length > 0) {
            const prevIds = prevUploads.map(u => u._id);
            await InquiryChunk.deleteMany({ uploadId: { $in: prevIds } });
            await InquiryUpload.deleteMany({ _id: { $in: prevIds } });
        }

        // Create new upload document
        const upload = await InquiryUpload.create({
            fileName: fileName || 'uploaded_inquiries.csv',
            headers: headers,
            totalRows: rows.length,
            totalColumns: headers.length,
            uploadedBy: uploadedBy || '',
            uploadedAt: new Date(),
            isActive: true
        });

        // Insert chunks in batches of 1000 rows
        const CHUNK_SIZE = 1000;
        const chunkDocs = [];
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
            chunkDocs.push({
                uploadId: upload._id,
                chunkIndex: Math.floor(i / CHUNK_SIZE),
                rows: rows.slice(i, i + CHUNK_SIZE)
            });
        }

        if (chunkDocs.length > 0) {
            await InquiryChunk.insertMany(chunkDocs, { ordered: true });
        }

        return res.status(201).json({
            success: true,
            message: 'CSV saved to database successfully',
            uploadId: upload._id,
            fileName: upload.fileName,
            headers: upload.headers,
            totalRows: upload.totalRows,
            totalColumns: upload.totalColumns
        });
    } catch (err) {
        console.error('Error saving inquiry CSV to database:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to save CSV data to database',
            error: err.message
        });
    }
});

// DELETE clear all inquiry data from database
router.delete('/', async (req, res) => {
    try {
        await InquiryChunk.deleteMany({});
        await InquiryUpload.deleteMany({});
        return res.json({
            success: true,
            message: 'Inquiry data cleared from database successfully'
        });
    } catch (err) {
        console.error('Error clearing inquiry data:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to clear inquiry data from database',
            error: err.message
        });
    }
});

module.exports = router;
