require('dotenv').config();
const mongoose = require('mongoose');
const GlobalSetting = require('./models/GlobalSetting');

const PROVINCES = [
    'Western', 'Central', 'Southern', 'North Western', 
    'Sabaragamuwa', 'North Central', 'Uva', 'Eastern', 'Northern'
];

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        // Initializing with no blocked provinces (all activated)
        await GlobalSetting.findOneAndUpdate(
            { key: 'blockedProvinces' },
            { value: [], description: 'List of blocked provinces for starting locations' },
            { upsert: true, new: true }
        );
        console.log('Successfully initialized blockedProvinces setting');
        mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
})();
