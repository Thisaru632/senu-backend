require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Booking = require('./models/Booking');

async function check() {
    await connectDB();
    const bookings = await Booking.find({}, { customId: 1, name: 1, promoCode: 1 });
    console.log('--- ALL BOOKINGS ---');
    bookings.forEach(b => {
        console.log(`ID: ${b.customId}, Name: ${b.name}, PromoCode: "${b.promoCode}" (Type: ${typeof b.promoCode})`);
    });
    mongoose.connection.close();
}
check();
