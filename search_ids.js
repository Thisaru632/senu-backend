require('dotenv').config();
const mongoose = require('mongoose');

async function searchIds() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const ids = ["6996adc8b37851fb862879e5", "6996b011b37851fb862879fe", "6996c8b42811348810062951", "6996d4ab0c02d956130ad19a"];

        const collections = await mongoose.connection.db.listCollections().toArray();
        for (const col of collections) {
            for (const id of ids) {
                const doc = await mongoose.connection.db.collection(col.name).findOne({ _id: id });
                if (doc) {
                    console.log(`FOUND ID ${id} in collection ${col.name}`);
                    console.log('Doc:', JSON.stringify(doc));
                }
                // Also search as ObjectID just in case
                try {
                    const objIdDoc = await mongoose.connection.db.collection(col.name).findOne({ _id: new mongoose.Types.ObjectId(id) });
                    if (objIdDoc) {
                        console.log(`FOUND OBJ_ID ${id} in collection ${col.name}`);
                        console.log('Doc:', JSON.stringify(objIdDoc));
                    }
                } catch (e) { }
            }
        }
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

searchIds();
