const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    staffId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff'
    },
    eNo: {
        type: String,
        required: true,
        trim: true
    },
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    date: {
        type: String,
        required: true
    },
    clockInTime: {
        type: String,
        required: true
    },
    clockOutTime: {
        type: String,
        default: 'Active Session'
    },
    clockInLocation: {
        type: String,
        default: ''
    },
    clockOutLocation: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['Clocked In', 'Clocked Out'],
        default: 'Clocked In'
    }
}, { timestamps: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
