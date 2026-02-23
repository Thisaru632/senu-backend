require('dotenv').config();
const mongoose = require('mongoose');
const Staff = require('./models/Staff');

async function updateThisaru() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const user = await Staff.findOne({ $or: [{ username: /thisaru/i }, { fullName: /thisaru/i }] });

        if (user) {
            console.log(`Found user: ${user.username}, current role: ${user.role}`);
            user.role = 'superadmin';
            user.status = 'active'; // Also ensure active
            // Give all permissions just in case
            user.permissions = {
                dashboard: true,
                leads: true,
                cms: true,
                userManagement: true,
                reports: true
            };
            await user.save();
            console.log('User updated to superadmin and all permissions granted.');
        } else {
            console.log('User thisaru not found.');
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

updateThisaru();
