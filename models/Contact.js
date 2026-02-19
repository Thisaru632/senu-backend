const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
        minlength: [2, 'Full name must be at least 2 characters'],
        maxlength: [100, 'Full name cannot exceed 100 characters']
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
    },
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true,
        match: [/^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/, 'Please provide a valid phone number']
    },
    reason: {
        type: String,
        enum: {
            values: ['General Inquiry', 'Booking Question', 'Complaint', 'Feedback', 'Other'],
            message: '{VALUE} is not a valid reason'
        },
        default: 'General Inquiry'
    },
    preferredTravelDates: {
        type: String,
        trim: true,
        maxlength: [200, 'Preferred travel dates cannot exceed 200 characters']
    },
    numberOfGuests: {
        type: Number,
        min: [0, 'Number of guests cannot be negative'],
        max: [100, 'Number of guests cannot exceed 100'],
        default: 1
    },
    message: {
        type: String,
        trim: true,
        maxlength: [1000, 'Message cannot exceed 1000 characters'],
        default: ''
    },
    status: {
        type: String,
        enum: ['new', 'read', 'responded', 'archived', 'Confirmed', 'Rejected'],
        default: 'new'
    },
    respondedAt: {
        type: Date
    },
    employeeName: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Index for faster queries
contactSchema.index({ createdAt: -1 });
contactSchema.index({ status: 1 });
contactSchema.index({ email: 1 });

module.exports = mongoose.model('Contact', contactSchema);