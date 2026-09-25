const mongoose = require('mongoose');

const OfficeAssetSchema = new mongoose.Schema(
    {
        no: {
            type: String,
            trim: true,
            default: '',
        },
        image: {
            type: String,
            trim: true,
            default: '',
        },
        assetType: {
            type: String,
            trim: true,
            default: '',
        },
        description: {
            type: String,
            trim: true,
            default: '',
        },
        assetCode: {
            type: String,
            trim: true,
            default: '',
        },
        location: {
            type: String,
            trim: true,
            default: '',
        },
        qty: {
            type: Number,
            default: 1,
        },
        value: {
            type: Number,
            default: 0,
        },
        totalValue: {
            type: Number,
            default: 0,
        },
        purchaseDate: {
            type: String,
            trim: true,
            default: '',
        },
        billAvailability: {
            type: String,
            enum: ['Y', 'N'],
            default: 'Y',
        },
        billReceipt: {
            type: String,
            trim: true,
            default: '',
        },
        warranty: {
            type: String,
            trim: true,
            default: '',
        },
        warrantyReceipt: {
            type: String,
            trim: true,
            default: '',
        },
        supplier: {
            type: String,
            trim: true,
            default: '',
        },
        contactNo: {
            type: String,
            trim: true,
            default: '',
        },
        invNo: {
            type: String,
            trim: true,
            default: '',
        },
        assignedTo: {
            type: String,
            trim: true,
            default: 'Unassigned',
        },
        assignedUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Staff',
            default: null,
        },
        assignedDate: {
            type: String,
            trim: true,
            default: '',
        },
        status: {
            type: String,
            enum: ['In Use', 'Not in Use', 'Sold'],
            default: 'In Use',
            trim: true,
        },
        soldPrice: {
            type: Number,
            default: 0,
        },
        soldDate: {
            type: String,
            trim: true,
            default: '',
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('OfficeAsset', OfficeAssetSchema);
