require('dotenv').config();
const mongoose = require('mongoose');

async function searchEverywhere() {
    try {
        const client = await mongoose.connect(process.env.MONGO_URI);
        const admin = mongoose.connection.db.admin();
        const dbs = await admin.listDatabases();

        console.log('Databases:', dbs.databases.map(db => db.name).join(', '));

        for (const dbInfo of dbs.databases) {
            const dbName = dbInfo.name;
            if (['admin', 'local', 'config'].includes(dbName)) continue;

            const db = client.connection.useDb(dbName);
            const collections = await db.db.listCollections().toArray();

            for (const col of collections) {
                const count = await db.db.collection(col.name).countDocuments({
                    $or: [
                        { username: /amal/i },
                        { fullName: /amal/i },
                        { email: /amal/i }
                    ]
                });
                if (count > 0) {
                    console.log(`FOUND ${count} matching 'amal' in ${dbName}.${col.name}`);
                    const docs = await db.db.collection(col.name).find({
                        $or: [
                            { username: /amal/i },
                            { fullName: /amal/i },
                            { email: /amal/i }
                        ]
                    }).toArray();
                    docs.forEach(d => console.log('Doc:', JSON.stringify(d)));
                }
            }
        }
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

searchEverywhere();
