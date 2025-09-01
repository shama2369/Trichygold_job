// Run this script with: node seedUsersAndRoles.js
// It will use your .env MongoDB URI and create an admin user and roles

require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
const dbName = 'event_campaign_db'; // Adjust if your DB name is different

async function seed() {
  const client = new MongoClient(uri, { useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db(dbName);

    // Seed roles (if you use a roles collection)
    const rolesCollection = db.collection('roles');
    await rolesCollection.insertMany([
      { name: 'admin' },
      { name: 'user' }
    ]);
    console.log('Roles seeded.');

    // Seed users (password is plaintext for demo; hash in production!)
    const usersCollection = db.collection('users');
    await usersCollection.insertOne({
      username: 'admin',
      password: 'admin123', // Use a hashed password in production!
      email: 'admin@example.com',
      roles: ['admin']
    });
    console.log('Admin user seeded.');
  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    await client.close();
  }
}

seed();
