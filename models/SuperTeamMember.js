const mongoose = require('mongoose');

const SuperTeamMemberSchema = new mongoose.Schema({
    ownerName: { type: String, required: true },
    ownerNIC: { type: String, required: true },
    ownerPhone: { type: String, required: true },
    ownerNicFrontImage: { type: String, required: true }, // Path to GridFS file
    ownerNicBackImage: { type: String, required: true }, // Path to GridFS file
    ownerDate: { type: String },

    driverName: { type: String, required: true },
    driverNIC: { type: String, required: true },
    driverPhone: { type: String, required: true },
    driverLicenseNo: { type: String, required: true },
    driverDocFrontImage: { type: String, required: true }, // Path to GridFS file
    driverDocBackImage: { type: String, required: true }, // Path to GridFS file
    driverDate: { type: String },

    status: { type: String, default: 'Pending', enum: ['Pending', 'Approved', 'Rejected'] }
}, {
    timestamps: true
});

module.exports = mongoose.model('SuperTeamMember', SuperTeamMemberSchema);
