const mongoose = require('mongoose');
const Customer = require('./models/Customer');
require('dotenv').config();
const connectDB = require('./config/db');

connectDB()
    .then(async () => {
        const count = await Customer.countDocuments();
        const users = await Customer.find().limit(5);
        console.log('Total Customers:', count);
        console.log('Sample Users:', JSON.stringify(users, null, 2));
        mongoose.disconnect();
    })
    .catch(err => {
        console.error('Connection error:', err);
        process.exit(1);
    });
