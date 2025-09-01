const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://localhost:27017';
const DB_NAME = 'trichygold_campaigns';

async function testExistingAuth() {
  let client;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    
    // Check users collection
    console.log('\n=== EXISTING USERS ===');
    const users = await db.collection('users').find({}).toArray();
    console.log(`Found ${users.length} users:`);
    
    if (users.length === 0) {
      console.log('No users found. You need to create users first.');
      return;
    }
    
    users.forEach((user, index) => {
      console.log(`\nUser ${index + 1}:`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Password: ${user.password ? (user.password.length > 20 ? 'Hashed' : 'Plain text') : 'No password'}`);
      console.log(`  Roles: ${user.roles ? user.roles.join(', ') : 'No roles'}`);
      
      // Check if password needs to be hashed
      if (user.password && user.password.length <= 20) {
        console.log(`  ⚠️  WARNING: Password appears to be plain text and needs to be hashed!`);
      }
    });
    
    // Check roles collection
    console.log('\n=== EXISTING ROLES ===');
    const roles = await db.collection('roles').find({}).toArray();
    console.log(`Found ${roles.length} roles:`);
    
    if (roles.length === 0) {
      console.log('No roles found. You need to create roles first.');
      return;
    }
    
    roles.forEach((role, index) => {
      console.log(`\nRole ${index + 1}:`);
      console.log(`  Name: ${role.name}`);
      console.log(`  Description: ${role.description || 'No description'}`);
      console.log(`  Permissions: ${JSON.stringify(role.permissions, null, 2)}`);
    });
    
    // Test authentication with first user
    if (users.length > 0) {
      console.log('\n=== AUTHENTICATION TEST ===');
      const testUser = users[0];
      console.log(`Testing authentication for user: ${testUser.username}`);
      
      if (testUser.password && testUser.password.length > 20) {
        console.log('✅ Password is hashed - authentication should work');
        console.log('📋 To test login:');
        console.log(`   - Username: ${testUser.username}`);
        console.log('   - You need to know the original password for this user');
      } else if (testUser.password) {
        console.log('⚠️  Password is plain text - needs to be hashed');
        console.log('📋 To test login:');
        console.log(`   - Username: ${testUser.username}`);
        console.log(`   - Password: ${testUser.password}`);
      } else {
        console.log('❌ No password found for this user');
      }
    }
    
  } catch (error) {
    console.error('Error testing authentication:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\nDisconnected from MongoDB');
    }
  }
}

testExistingAuth(); 