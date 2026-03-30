const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const staffSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Please provide a username'],
        unique: true,
        trim: true
    },
    fullName: {
        type: String,
        required: [true, 'Please provide a full name'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        lowercase: true,
        trim: true
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastLogout: {
        type: Date,
        default: null
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: 6,
        select: false // Don't return password by default
    },
    role: {
        type: String,
        enum: ['staff', 'admin', 'superadmin'],
        default: 'staff'
    },
    permissions: {
        dashboard: { type: Boolean, default: true },
        leads: { type: Boolean, default: false },
        cms: { type: Boolean, default: false },
        userManagement: { type: Boolean, default: false },
        reports: { type: Boolean, default: false },
        rateCardManage: { type: Boolean, default: false },
        promoCodeManage: { type: Boolean, default: false },
        staffGuideManage: { type: Boolean, default: false },
        cabService: { type: Boolean, default: false }
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'rejected'],
        default: 'pending'
    },
    resetPasswordOTP: {
        type: String,
        default: null
    },
    resetPasswordExpires: {
        type: Date,
        default: null
    }
}, { timestamps: true });

// Hash password before saving
staffSchema.pre('save', async function () {
    if (!this.isModified('password')) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare password
staffSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Staff', staffSchema);
