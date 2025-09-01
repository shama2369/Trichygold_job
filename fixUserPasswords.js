const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGO_URI;

async function fixUserPasswords() {
  let client;
  
  try {
    client = new MongoClient(uri, {
      ssl: true,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false,
    });
    
    await client.connect();
    console.log('Connected to MongoDB Atlas');
    
    const db = client.db('event_campaign_db');
    
    // Get all users
    const users = await db.collection('users').find({}).toArray();
    console.log(`Found ${users.length} users to check`);
    
    // Get all roles
    const roles = await db.collection('roles').find({}).toArray();
    console.log(`Found ${roles.length} roles`);
    
    const adminRole = roles.find(role => role.name === 'admin');
    const editorRole = roles.find(role => role.name === 'editor');
    const viewerRole = roles.find(role => role.name === 'viewer');
    
    for (const user of users) {
      let needsUpdate = false;
      const updates = {};
      
      // Check if password needs to be hashed
      if (user.password && user.password.length <= 20) {
        console.log(`Hashing password for user: ${user.username}`);
        const saltRounds = 10;
        updates.password = await bcrypt.hash(user.password, saltRounds);
        needsUpdate = true;
      }
      
      // Check if user has roles assigned
      if (!user.roles || user.roles.length === 0) {
        console.log(`Assigning default role (viewer) to user: ${user.username}`);
        updates.roles = [viewerRole._id.toString()];
        needsUpdate = true;
      }
      
      // Check if user has email
      if (!user.email) {
        console.log(`Adding email for user: ${user.username}`);
        updates.email = `${user.username}@trichygold.com`;
        needsUpdate = true;
      }
      
      // Update user if needed
      if (needsUpdate) {
        await db.collection('users').updateOne(
          { _id: user._id },
          { $set: updates }
        );
        console.log(`✅ Updated user: ${user.username}`);
      } else {
        console.log(`✅ User ${user.username} is already properly configured`);
      }
    }
    
    console.log('\n=== FINAL USER STATUS ===');
    const updatedUsers = await db.collection('users').find({}).toArray();
    updatedUsers.forEach((user, index) => {
      console.log(`\nUser ${index + 1}:`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Password: ${user.password ? (user.password.length > 20 ? 'Hashed' : 'Plain text') : 'No password'}`);
      console.log(`  Roles: ${user.roles ? user.roles.join(', ') : 'No roles'}`);
    });
    
    console.log('\n=== LOGIN CREDENTIALS ===');
    console.log('To test authentication, use these usernames:');
    updatedUsers.forEach(user => {
      console.log(`  - Username: ${user.username}`);
      if (user.password && user.password.length <= 20) {
        console.log(`    Password: ${user.password}`);
      } else {
        console.log(`    Password: (You need to know the original password)`);
      }
    });
    
  } catch (error) {
    console.error('Error fixing user passwords:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\nDisconnected from MongoDB');
    }
  }
}

fixUserPasswords(); 