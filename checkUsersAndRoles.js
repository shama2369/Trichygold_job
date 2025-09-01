const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://localhost:27017';
const DB_NAME = 'trichygold_campaigns';

async function checkUsersAndRoles() {
  let client;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    
    // Check users collection
    console.log('\n=== USERS COLLECTION ===');
    const users = await db.collection('users').find({}).toArray();
    console.log(`Found ${users.length} users:`);
    users.forEach((user, index) => {
      console.log(`\nUser ${index + 1}:`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Password: ${user.password ? (user.password.length > 20 ? 'Hashed' : 'Plain text') : 'No password'}`);
      console.log(`  Roles: ${user.roles ? user.roles.join(', ') : 'No roles'}`);
    });
    
    // Check roles collection
    console.log('\n=== ROLES COLLECTION ===');
    const roles = await db.collection('roles').find({}).toArray();
    console.log(`Found ${roles.length} roles:`);
    roles.forEach((role, index) => {
      console.log(`\nRole ${index + 1}:`);
      console.log(`  Name: ${role.name}`);
      console.log(`  Description: ${role.description || 'No description'}`);
      console.log(`  Permissions: ${JSON.stringify(role.permissions, null, 2)}`);
    });
    
  } catch (error) {
    console.error('Error checking users and roles:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\nDisconnected from MongoDB');
    }
  }
}

checkUsersAndRoles(); 