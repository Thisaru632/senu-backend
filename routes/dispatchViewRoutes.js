const express = require('express');
const router = express.Router();
const { DispatchUpload, DispatchChunk } = require('../models/DispatchView');

// GET latest active dispatch data
router.get('/', async (req, res) => {
    try {
        const upload = await DispatchUpload.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
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

        const chunks = await DispatchChunk.find({ uploadId: upload._id })
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
        console.error('Error fetching dispatch data:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch dispatch data from database',
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

        // Clean up previous uploads to maintain current active dispatch view
        const prevUploads = await DispatchUpload.find({});
        if (prevUploads.length > 0) {
            const prevIds = prevUploads.map(u => u._id);
            await DispatchChunk.deleteMany({ uploadId: { $in: prevIds } });
            await DispatchUpload.deleteMany({ _id: { $in: prevIds } });
        }

        // Create new upload document
        const upload = await DispatchUpload.create({
            fileName: fileName || 'uploaded_dispatch.csv',
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
            await DispatchChunk.insertMany(chunkDocs, { ordered: true });
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
        console.error('Error saving dispatch CSV to database:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to save CSV data to database',
            error: err.message
        });
    }
});

// DELETE clear all dispatch data from database
router.delete('/', async (req, res) => {
    try {
        await DispatchChunk.deleteMany({});
        await DispatchUpload.deleteMany({});
        return res.json({
            success: true,
            message: 'Dispatch data cleared from database successfully'
        });
    } catch (err) {
        console.error('Error clearing dispatch data:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to clear dispatch data from database',
            error: err.message
        });
    }
});

module.exports = router;
