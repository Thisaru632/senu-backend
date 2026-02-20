const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
    vehicleType: {
        type: String,
        required: true
    },
    vehicleName: {
        type: String,
        required: true
    },
    tripType: {
        type: String,
        required: true
    },
    pickupLocation: {
        type: String,
        required: true
    },
    dropoffLocation: {
        type: String,
        required: true
    },
    dateTime: {
        type: Date,
        required: true
    },
    numberOfDays: {
        type: Number,
        default: 1
    },
    maxPersons: {
        type: Number,
        required: true
    },
    maxBags: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    telephone: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Cancelled', 'Rejected', 'Completed'],
        default: 'Pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    employeeName: {
        type: String,
        default: ''
    },
    customId: {
        type: String,
        unique: true
    }
});

// Pre-save hook to generate customId
BookingSchema.pre('save', async function () {
    if (!this.customId) {
        const lastBooking = await this.constructor.findOne({}, { customId: 1 }).sort({ createdAt: -1 });
        let nextNumber = 1;

        if (lastBooking && lastBooking.customId && lastBooking.customId.startsWith('BL')) {
            const lastNumber = parseInt(lastBooking.customId.substring(2));
            if (!isNaN(lastNumber)) {
                nextNumber = lastNumber + 1;
            }
        }

        this.customId = `BL${nextNumber.toString().padStart(3, '0')}`;
    }
});

module.exports = mongoose.model('Booking', BookingSchema);
