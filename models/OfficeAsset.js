const mongoose = require('mongoose');

const OfficeAssetSchema = new mongoose.Schema(
    {
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
        warranty: {
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
            enum: ['In Use', 'Not in Use'],
            default: 'In Use',
            trim: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('OfficeAsset', OfficeAssetSchema);
