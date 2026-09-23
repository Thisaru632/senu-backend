const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const xlsx = require('xlsx');
const OfficeAsset = require('../models/OfficeAsset');
const Staff = require('../models/Staff');

// Configure multer memory storage for CSV and Excel (.xlsx, .xls) file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (
            ext === '.csv' ||
            ext === '.xlsx' ||
            ext === '.xls' ||
            file.mimetype === 'text/csv' ||
            file.mimetype === 'application/vnd.ms-excel' ||
            file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV and Excel (.xlsx, .xls) files are allowed'));
        }
    },
});

// Helper to clean numeric values (remove currency symbols, commas, spaces)
const parseNumeric = (val, defaultVal = 0) => {
    if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
    if (!val) return defaultVal;
    const cleaned = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? defaultVal : num;
};

// Helper to format dates from Excel serial numbers or standard strings
function formatExcelDate(val) {
    if (!val) return '';
    if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
    }
    const str = String(val).trim();
    const parts = str.split('/');
    if (parts.length === 3) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2];
        return `${y}-${m}-${d}`;
    }
    return str;
}

// Helper to parse CSV lines with quotes handling
function parseCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
            if (inQuotes && line[i + 1] === char) {
                current += char;
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    return values;
}

// Map row array or header-based object to OfficeAsset schema object
function normalizeAssetRecord(raw) {
    const qty = parseNumeric(raw.qty, 1);
    const value = parseNumeric(raw.value, 0);
    let totalValue = parseNumeric(raw.totalValue, 0);
    if (!totalValue && qty && value) {
        totalValue = qty * value;
    }

    let billAvailability = 'N';
    if (raw.billAvailability !== undefined && raw.billAvailability !== null && raw.billAvailability !== '') {
        const billStr = String(raw.billAvailability).trim().toUpperCase();
        if (billStr === 'Y' || billStr === 'YES' || billStr === '1' || billStr === 'TRUE') {
            billAvailability = 'Y';
        } else {
            billAvailability = 'N';
        }
    }

    return {
        assetType: raw.assetType ? String(raw.assetType).trim() : '',
        description: raw.description ? String(raw.description).trim() : '',
        assetCode: raw.assetCode ? String(raw.assetCode).trim() : '',
        location: raw.location ? String(raw.location).trim() : '',
        assignedTo: raw.assignedTo ? String(raw.assignedTo).trim() : 'Unassigned',
        assignedUserId: raw.assignedUserId || null,
        assignedDate: raw.assignedDate ? String(raw.assignedDate).trim() : '',
        qty: qty,
        value: value,
        totalValue: totalValue,
        purchaseDate: raw.purchaseDate ? formatExcelDate(raw.purchaseDate) : '',
        billAvailability: billAvailability,
        warranty: raw.warranty ? String(raw.warranty).trim() : '',
        supplier: raw.supplier ? String(raw.supplier).trim() : '',
        contactNo: raw.contactNo ? String(raw.contactNo).trim() : '',
        invNo: raw.invNo ? String(raw.invNo).trim() : '',
        status: raw.status && (String(raw.status).trim().toLowerCase() === 'not in use' || String(raw.status).trim().toLowerCase() === 'notinuse' || String(raw.status).trim().toLowerCase() === 'no') ? 'Not in Use' : 'In Use',
    };
}

/**
 * @route   GET /api/office-assets/users
 * @desc    Get all staff/users for asset assignment
 */
router.get('/users', async (req, res) => {
    try {
        const staffList = await Staff.find({}, '_id username fullName email role eNo').sort({ fullName: 1, username: 1 });
        const formatted = staffList.map((s) => ({
            id: s._id,
            name: s.fullName || s.username,
            username: s.username,
            email: s.email,
            role: s.role,
            eNo: s.eNo || '',
        }));
        res.status(200).json({ success: true, count: formatted.length, data: formatted });
    } catch (error) {
        console.error('Error fetching users for asset assignment:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   GET /api/office-assets
 * @desc    Get all office assets
 */
router.get('/', async (req, res) => {
    try {
        const assets = await OfficeAsset.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: assets.length,
            data: assets,
        });
    } catch (error) {
        console.error('Error fetching office assets:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/office-assets
 * @desc    Create a single office asset
 */
router.post('/', async (req, res) => {
    try {
        const normalized = normalizeAssetRecord(req.body);
        const newAsset = new OfficeAsset(normalized);
        const saved = await newAsset.save();
        res.status(201).json({
            success: true,
            data: saved,
        });
    } catch (error) {
        console.error('Error creating office asset:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/office-assets/batch
 * @desc    Batch insert multiple assets
 */
router.post('/batch', async (req, res) => {
    try {
        const rawAssets = Array.isArray(req.body) ? req.body : req.body.assets;
        if (!Array.isArray(rawAssets) || rawAssets.length === 0) {
            return res.status(400).json({ success: false, message: 'No assets provided for batch creation' });
        }

        const normalizedList = rawAssets
            .map((item) => normalizeAssetRecord(item))
            .filter((item) => item.assetType || item.description || item.assetCode);

        if (normalizedList.length === 0) {
            return res.status(400).json({ success: false, message: 'Valid asset data not found' });
        }

        const inserted = await OfficeAsset.insertMany(normalizedList);
        res.status(201).json({
            success: true,
            message: `${inserted.length} assets successfully saved to MongoDB`,
            count: inserted.length,
            data: inserted,
        });
    } catch (error) {
        console.error('Batch save error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/office-assets/upload-csv
 * @desc    Upload and parse CSV or Excel (.xlsx, .xls) file, save records directly to MongoDB
 */
router.post('/upload-csv', upload.single('file'), async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const ext = path.extname(req.file.originalname).toLowerCase();
        let rows = [];

        if (ext === '.xlsx' || ext === '.xls') {
            const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
            let targetSheet = null;
            // Scan for the sheet that contains asset data
            for (const name of wb.SheetNames) {
                const sheet = wb.Sheets[name];
                const sheetRows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
                if (sheetRows && sheetRows.length > 0) {
                    const firstRowStr = (sheetRows[0] || []).join(' ').toLowerCase();
                    if (firstRowStr.includes('asset') || firstRowStr.includes('descr')) {
                        targetSheet = sheet;
                        break;
                    }
                }
            }
            if (!targetSheet) targetSheet = wb.Sheets[wb.SheetNames[0]];
            rows = xlsx.utils.sheet_to_json(targetSheet, { header: 1 });
        } else {
            // CSV
            try {
                const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
                rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
            } catch (e) {
                const csvContent = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
                rows = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0).map(parseCsvLine);
            }
        }

        if (!rows || rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Uploaded file contains no data' });
        }

        const firstRow = (rows[0] || []).map((c) => String(c || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
        const hasHeader = firstRow.some((col) =>
            ['assettype', 'type', 'description', 'descreption', 'assetcode', 'qty', 'location', 'value', 'totalvalue', 'invno'].includes(col)
        );

        let dataRows = rows;
        let headerIndexMap = {};

        if (hasHeader) {
            firstRow.forEach((col, index) => {
                if (col.includes('type')) headerIndexMap['assetType'] = index;
                else if (col.includes('descr')) headerIndexMap['description'] = index;
                else if (col.includes('code')) headerIndexMap['assetCode'] = index;
                else if (col.includes('loc')) headerIndexMap['location'] = index;
                else if (col.includes('qty') || col.includes('quantity')) headerIndexMap['qty'] = index;
                else if (col.includes('total')) headerIndexMap['totalValue'] = index;
                else if (col.includes('val') || col.includes('price')) headerIndexMap['value'] = index;
                else if (col.includes('date')) headerIndexMap['purchaseDate'] = index;
                else if (col.includes('bill')) headerIndexMap['billAvailability'] = index;
                else if (col.includes('warr')) headerIndexMap['warranty'] = index;
                else if (col.includes('supp') || col.includes('vend')) headerIndexMap['supplier'] = index;
                else if (col.includes('contact') || col.includes('phone') || col.includes('mobile')) headerIndexMap['contactNo'] = index;
                else if (col.includes('inv')) headerIndexMap['invNo'] = index;
                else if (col.includes('assign') || col.includes('user') || col.includes('owner') || col.includes('staff') || col.includes('employee')) headerIndexMap['assignedTo'] = index;
                else if (col.includes('status') || col.includes('inuse') || col.includes('usage') || col.includes('use')) headerIndexMap['status'] = index;
            });
            dataRows = rows.slice(1);
        }

        const assetsToInsert = [];

        for (const row of dataRows) {
            if (!row || !Array.isArray(row) || row.every((c) => c === undefined || c === null || String(c).trim() === '')) {
                continue;
            }

            let assetObj = {};
            if (hasHeader && Object.keys(headerIndexMap).length > 0) {
                assetObj = {
                    assetType: headerIndexMap['assetType'] !== undefined ? row[headerIndexMap['assetType']] : row[0],
                    description: headerIndexMap['description'] !== undefined ? row[headerIndexMap['description']] : row[1],
                    assetCode: headerIndexMap['assetCode'] !== undefined ? row[headerIndexMap['assetCode']] : row[2],
                    location: headerIndexMap['location'] !== undefined ? row[headerIndexMap['location']] : row[3],
                    assignedTo: headerIndexMap['assignedTo'] !== undefined ? row[headerIndexMap['assignedTo']] : (row[13] || 'Unassigned'),
                    qty: headerIndexMap['qty'] !== undefined ? row[headerIndexMap['qty']] : row[4],
                    value: headerIndexMap['value'] !== undefined ? row[headerIndexMap['value']] : row[5],
                    totalValue: headerIndexMap['totalValue'] !== undefined ? row[headerIndexMap['totalValue']] : row[6],
                    purchaseDate: headerIndexMap['purchaseDate'] !== undefined ? row[headerIndexMap['purchaseDate']] : row[7],
                    billAvailability: headerIndexMap['billAvailability'] !== undefined ? row[headerIndexMap['billAvailability']] : row[8],
                    warranty: headerIndexMap['warranty'] !== undefined ? row[headerIndexMap['warranty']] : row[9],
                    supplier: headerIndexMap['supplier'] !== undefined ? row[headerIndexMap['supplier']] : row[10],
                    contactNo: headerIndexMap['contactNo'] !== undefined ? row[headerIndexMap['contactNo']] : row[11],
                    invNo: headerIndexMap['invNo'] !== undefined ? row[headerIndexMap['invNo']] : row[12],
                    status: headerIndexMap['status'] !== undefined ? row[headerIndexMap['status']] : (row[14] || 'In Use'),
                };
            } else {
                assetObj = {
                    assetType: row[0],
                    description: row[1],
                    assetCode: row[2],
                    location: row[3],
                    assignedTo: row[13] || 'Unassigned',
                    qty: row[4],
                    value: row[5],
                    totalValue: row[6],
                    purchaseDate: row[7],
                    billAvailability: row[8],
                    warranty: row[9],
                    supplier: row[10],
                    contactNo: row[11],
                    invNo: row[12],
                    status: row[14] || 'In Use',
                };
            }

            const normalized = normalizeAssetRecord(assetObj);
            if (normalized.assetType || normalized.description || normalized.assetCode) {
                assetsToInsert.push(normalized);
            }
        }

        if (assetsToInsert.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid asset data rows found in the file' });
        }

        const savedDocs = await OfficeAsset.insertMany(assetsToInsert);
        const allAssets = await OfficeAsset.find().sort({ createdAt: -1 });

        res.status(201).json({
            success: true,
            message: `Successfully uploaded ${savedDocs.length} assets to MongoDB!`,
            count: savedDocs.length,
            inserted: savedDocs,
            data: allAssets,
        });
    } catch (error) {
        console.error('Error uploading spreadsheet:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   PATCH /api/office-assets/:id/assign
 * @desc    Quickly assign an asset to a user
 */
router.patch('/:id/assign', async (req, res) => {
    try {
        const { assignedTo, assignedUserId } = req.body;
        const assignedDate = assignedTo && assignedTo !== 'Unassigned' ? new Date().toISOString().split('T')[0] : '';
        const updated = await OfficeAsset.findByIdAndUpdate(
            req.params.id,
            {
                assignedTo: assignedTo ? String(assignedTo).trim() : 'Unassigned',
                assignedUserId: assignedUserId || null,
                assignedDate: assignedDate,
            },
            { new: true }
        );
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Asset not found' });
        }
        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error('Error assigning asset:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   PATCH /api/office-assets/:id/status
 * @desc    Toggle or update the usage status of an asset (In Use / Not in Use)
 */
router.patch('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const validStatus = status === 'Not in Use' ? 'Not in Use' : 'In Use';
        const updated = await OfficeAsset.findByIdAndUpdate(
            req.params.id,
            { status: validStatus },
            { new: true }
        );
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Asset not found' });
        }
        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error('Error updating asset status:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   PUT /api/office-assets/:id
 * @desc    Update an office asset
 */
router.put('/:id', async (req, res) => {
    try {
        const normalized = normalizeAssetRecord(req.body);
        const updated = await OfficeAsset.findByIdAndUpdate(req.params.id, normalized, { new: true });
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Asset not found' });
        }
        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error('Error updating asset:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   DELETE /api/office-assets/clear-all
 * @desc    Delete all office assets from the database
 */
router.delete('/clear-all', async (req, res) => {
    try {
        const result = await OfficeAsset.deleteMany({});
        res.status(200).json({
            success: true,
            message: `All office assets (${result.deletedCount}) successfully cleared`,
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        console.error('Error clearing all office assets:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   DELETE /api/office-assets/:id
 * @desc    Delete an office asset
 */
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await OfficeAsset.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Asset not found' });
        }
        res.status(200).json({ success: true, message: 'Asset deleted successfully' });
    } catch (error) {
        console.error('Error deleting asset:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
