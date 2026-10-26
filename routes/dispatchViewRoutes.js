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
        const rawHeaders = upload.headers || [];
        const normalizedHeaders = rawHeaders.map((h, i) => {
            if (h === '20260879986' || (i === 13 && /^\d{10,12}$/.test(h))) {
                return 'Ref';
            }
            return h;
        });

        return res.json({
            success: true,
            hasData: true,
            uploadId: upload._id,
            fileName: upload.fileName,
            headers: normalizedHeaders,
            rows: rows,
            totalRows: upload.totalRows || rows.length,
            totalColumns: normalizedHeaders.length,
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
        const { fileName, headers: rawHeaders, rows, uploadedBy } = req.body;

        if (!Array.isArray(rawHeaders) || rawHeaders.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid headers. At least one column header is required.'
            });
        }

        const headers = rawHeaders.map((h, i) => {
            if (h === '20260879986' || (i === 13 && /^\d{10,12}$/.test(h))) {
                return 'Ref';
            }
            return h;
        });

        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid rows. At least one row of data is required.'
            });
        }

        // Filter to keep only details since 01.01.2026 to front from timestamp column
        let rowsToSave = rows;
        const tsIdx = headers.findIndex(h => h && h.toLowerCase().trim() === 'timestamp');
        if (tsIdx !== -1) {
            const filtered = rows.filter(row => {
                const tsVal = row[tsIdx];
                if (!tsVal || typeof tsVal !== 'string') return false;
                const trimmed = tsVal.trim();
                const iso = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
                if (iso) {
                    const dateStr = `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
                    return dateStr >= '2026-01-01';
                }
                const dmy = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
                if (dmy) {
                    const dateStr = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
                    return dateStr >= '2026-01-01';
                }
                return false;
            });
            if (filtered.length > 0) {
                rowsToSave = filtered;
            }
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
            totalRows: rowsToSave.length,
            totalColumns: headers.length,
            uploadedBy: uploadedBy || '',
            uploadedAt: new Date(),
            isActive: true
        });

        // Insert chunks in batches of 1000 rows
        const CHUNK_SIZE = 1000;
        const chunkDocs = [];
        for (let i = 0; i < rowsToSave.length; i += CHUNK_SIZE) {
            chunkDocs.push({
                uploadId: upload._id,
                chunkIndex: Math.floor(i / CHUNK_SIZE),
                rows: rowsToSave.slice(i, i + CHUNK_SIZE)
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
