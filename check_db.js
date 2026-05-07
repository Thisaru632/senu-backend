require('dotenv').config();
console.log('URI:', process.env.MONGO_URI ? 'FOUND' : 'NOT FOUND');
const mongoose = require('mongoose');
const Booking = require('./models/Booking');

const connectDB = require('./config/db');

async function check() {
    await connectDB();
    console.log('Connected');

    const lastBookings = await Booking.find({}, { customId: 1, createdAt: 1 }).sort({ createdAt: -1 }).limit(10);
    console.log('Last 10 bookings by createdAt:');
    lastBookings.forEach(b => console.log(`${b.customId} - ${b.createdAt}`));

    const maxIdBooking = await Booking.findOne({ customId: /^BL/ }).sort({ customId: -1 });
    console.log('Max customId found:', maxIdBooking ? maxIdBooking.customId : 'none');

    await mongoose.disconnect();
}

check().catch(console.error);
