const mongoose = require('mongoose');
const Sim = require('./models/Sim');
const dotenv = require('dotenv');

dotenv.config();

const updateSims = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Delete all current SIMS
        await Sim.deleteMany({});
        console.log('Removed old SIMS');

        // Add the single requested number
        await new Sim({
            simNumber: 1,
            phoneNumber: '0702787787',
            status: 'Active'
        }).save();
        
        console.log('Added new SIM: 0702787787');
        
        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error('Error updating SIMS:', err);
        process.exit(1);
    }
};

updateSims();
