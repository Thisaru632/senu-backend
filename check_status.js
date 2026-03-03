const mongoose = require('mongoose');
require('dotenv').config();
const Staff = require('./models/Staff');

async function checkStatus() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
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
