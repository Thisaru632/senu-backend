require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = require('./config/db');

async function debugDB() {
    try {
        await connectDB();
        console.log('DB Name:', mongoose.connection.name);

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name).join(', '));

        const Staff = require('./models/Staff');
        const count = await Staff.countDocuments();
        console.log(`TOTAL_USERS in 'staffs' collection: ${count}`);

        const users = await Staff.find({});
        console.log('User Details:');
        users.forEach(u => console.log(`- ${u.fullName} (${u.username}) email: ${u.email}`));

        // Also check 'users' collection just in case
        try {
            const rawUsers = await mongoose.connection.db.collection('users').find().toArray();
            console.log(`RAW_USERS in 'users' collection: ${rawUsers.length}`);
        } catch (e) { }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

debugDB();
