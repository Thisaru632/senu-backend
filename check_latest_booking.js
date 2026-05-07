require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('./models/Booking');

const connectDB = require('./config/db');

async function check() {
    await connectDB();
    const lastBooking = await Booking.findOne().sort({ createdAt: -1 });
    console.log('--- LATEST BOOKING ---');
    console.log(JSON.stringify(lastBooking, null, 2));
    mongoose.connection.close();
}
check();
