const mongoose = require('mongoose');
require('dotenv').config();
const Staff = require('./models/Staff');

const connectDB = require('./config/db');

async function checkStatus() {
    try {
        await connectDB();
        const users = await Staff.find({}, 'username fullName isOnline lastLogout');
        console.log('User Statuses:');
        console.table(users.map(u => ({
            Username: u.username,
            FullName: u.fullName,
            isOnline: u.isOnline,
            LastLogout: u.lastLogout
        })));
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkStatus();
