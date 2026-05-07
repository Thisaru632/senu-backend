const mongoose = require('mongoose');
const Customer = require('./models/Customer');
require('dotenv').config();

const connectDB = require('./config/db');

async function check() {
    try {
        await connectDB();
        const count = await Customer.countDocuments();
        const users = await Customer.find().limit(5);
        console.log('Total Customers:', count);
        console.log('Sample Users:', JSON.stringify(users, null, 2));
        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

check();
