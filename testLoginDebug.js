const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const { ObjectId } = require('mongodb');

dotenv.config();

const uri = process.env.MONGO_URI;

async function testLoginDebug() {
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
    
    // Test 1: Check if we can find users
    console.log('\n=== TEST 1: Finding Users ===');
    const users = await db.collection('users').find({}).toArray();
    console.log(`Found ${users.length} users`);
    
    if (users.length === 0) {
      console.log('No users found!');
      return;
    }
    
    // Test 2: Check first user's password
    const testUser = users[0];
    console.log(`\n=== TEST 2: Testing User "${testUser.username}" ===`);
    console.log(`Password length: ${testUser.password ? testUser.password.length : 'No password'}`);
    console.log(`Password is hashed: ${testUser.password && testUser.password.length > 20 ? 'Yes' : 'No'}`);
    
    // Test 3: Try to verify a wrong password
    console.log('\n=== TEST 3: Testing Wrong Password ===');
    const wrongPassword = 'wrongpassword123';
    try {
      const isValid = await bcrypt.compare(wrongPassword, testUser.password);
      console.log(`Wrong password "${wrongPassword}" validation result: ${isValid}`);
    } catch (error) {
      console.log(`Error testing wrong password: ${error.message}`);
    }
    
    // Test 4: Try to verify the actual password (if we know it)
    console.log('\n=== TEST 4: Testing Known Passwords ===');
    const knownPasswords = ['admin123', 'password', '123456', 'admin', 'user', 'test'];
    
    for (const password of knownPasswords) {
      try {
        const isValid = await bcrypt.compare(password, testUser.password);
        if (isValid) {
          console.log(`✅ Found correct password: "${password}"`);
          break;
        } else {
          console.log(`❌ Password "${password}" is incorrect`);
        }
      } catch (error) {
        console.log(`Error testing password "${password}": ${error.message}`);
      }
    }
    
    // Test 5: Check user roles
    console.log('\n=== TEST 5: Checking User Roles ===');
    if (testUser.roles && testUser.roles.length > 0) {
      const roles = await db.collection('roles').find({
        _id: { $in: testUser.roles.map(roleId => new ObjectId(roleId)) }
      }).toArray();
      
      console.log(`User has ${roles.length} roles:`);
      roles.forEach(role => {
        console.log(`  - ${role.name}: ${JSON.stringify(role.permissions)}`);
      });
    } else {
      console.log('User has no roles assigned');
    }
    
  } catch (error) {
    console.error('Error in test:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\nDisconnected from MongoDB');
    }
  }
}

testLoginDebug(); 