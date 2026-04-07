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
    destinations: {
        type: [String],
        default: []
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
        required: true,
        match: [/^(?:\+94|0)?[0-9]{9,10}$/, 'Please provide a valid phone number']
    },
    additionalPhones: {
        type: [String],
        default: []
    },
    email: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Cancelled', 'Rejected', 'Completed', 'Sent Inquiry'],
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
    },
    isViewed: {
        type: Boolean,
        default: false
    },
    matchedPackage: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    remark: {
        type: String,
        default: ''
    },
    staffRemark: {
        type: String,
        default: ''
    },
    promoCode: {
        type: String,
        default: ''
    },
    discount: {
        type: Number,
        default: 0
    },
    nightSurcharge: {
        type: Number,
        default: 0
    },
    routeDistance: {
        type: Number,
        default: 0
    },
    routeDuration: {
        type: Number,
        default: 0
    },
    totalPrice: {
        type: Number,
        default: 0
    },
    provinceAdjustment: {
        type: Number,
        default: 0
    },
    seasonalAdjustment: {
        type: Number,
        default: 0
    },
    discountPercentage: {
        type: Number,
        default: 0
    }
});

// Pre-save hook to generate customId
BookingSchema.pre('save', async function () {
    if (!this.customId) {
        const lastBooking = await this.constructor.findOne({ customId: /^BL/ }, { customId: 1 }).sort({ customId: -1 });
        let nextNumber = 1;

        if (lastBooking && lastBooking.customId) {
            const lastNumber = parseInt(lastBooking.customId.substring(2));
            if (!isNaN(lastNumber)) {
                nextNumber = lastNumber + 1;
            }
        }

        this.customId = `BL${nextNumber.toString().padStart(3, '0')}`;
    }
});

module.exports = mongoose.model('Booking', BookingSchema);
