const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const RateAdjustmentSchema = new mongoose.Schema({
    vehicle: String,
    type: String,
    category: String,
    percentage: Number,
    fixedAmount: Number,
    adjustmentType: String,
    minKm: Number,
    maxKm: Number,
    days: String,
    hrs: String,
    validFrom: Date,
    validTo: Date,
}, { strict: false });

const RateAdjustment = mongoose.model('RateAdjustment', RateAdjustmentSchema);

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/senu-tours');
        console.log('Connected to MongoDB');
        
        const adjustments = await RateAdjustment.find();
        console.log('Current Adjustments:');
        console.log(JSON.stringify(adjustments, null, 2));
        
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

check();
