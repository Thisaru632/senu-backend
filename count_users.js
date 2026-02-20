require('dotenv').config();
const mongoose = require('mongoose');

async function countUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
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
