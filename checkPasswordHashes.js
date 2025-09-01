const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGO_URI;

async function checkPasswordHashes() {
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
    
    // Get all users and check their passwords
    const users = await db.collection('users').find({}).toArray();
    console.log(`\n=== PASSWORD ANALYSIS FOR ${users.length} USERS ===`);
    
    users.forEach((user, index) => {
      console.log(`\nUser ${index + 1}: ${user.username}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Password field: ${user.password ? 'Present' : 'Missing'}`);
      
      if (user.password) {
        console.log(`  Password length: ${user.password.length}`);
        console.log(`  Password starts with: ${user.password.substring(0, 10)}...`);
        
        // Check if it looks like a bcrypt hash
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')) {
          console.log(`  ✅ Password appears to be a valid bcrypt hash`);
        } else if (user.password.length <= 20) {
          console.log(`  ⚠️  Password appears to be plain text (too short for hash)`);
        } else {
          console.log(`  ❓ Password format unclear - may not be properly hashed`);
        }
      } else {
        console.log(`  ❌ No password field found`);
      }
      
      console.log(`  Roles: ${user.roles ? user.roles.join(', ') : 'None'}`);
    });
    
    // Test a specific user's password validation
    if (users.length > 0) {
      const testUser = users[0];
      console.log(`\n=== TESTING PASSWORD VALIDATION FOR ${testUser.username} ===`);
      
      // Try some common passwords
      const bcrypt = require('bcryptjs');
      const testPasswords = ['admin', 'password', '123456', 'admin123', 'user', 'test'];
      
      for (const testPassword of testPasswords) {
        try {
          const isValid = await bcrypt.compare(testPassword, testUser.password);
          console.log(`  Testing "${testPassword}": ${isValid ? '✅ MATCH' : '❌ No match'}`);
        } catch (error) {
          console.log(`  Error testing "${testPassword}": ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error checking password hashes:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\nDisconnected from MongoDB');
    }
  }
}

checkPasswordHashes(); 