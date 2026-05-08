require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');

async function countUsers() {
    try {
        await connectDB();
        const Staff = require('./models/Staff');
        const count = await Staff.countDocuments();
        console.log(`TOTAL_USERS: ${count}`);

        // Let's also list them briefly for confirmation
        const users = await Staff.find({}, 'fullName username email');
        console.log('--- User List ---');
        users.forEach(u => console.log(`- ${u.fullName || u.username} (${u.email})`));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

countUsers();
