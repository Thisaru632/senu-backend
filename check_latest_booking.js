require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Booking = require('./models/Booking');

async function check() {
    await connectDB();
    const lastBooking = await Booking.findOne().sort({ createdAt: -1 });
    console.log('--- LATEST BOOKING ---');
    console.log(JSON.stringify(lastBooking, null, 2));
    mongoose.connection.close();
}
check();
