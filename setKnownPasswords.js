const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGO_URI;

async function setKnownPasswords() {
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
    
    // Define known passwords for each user
    const userPasswords = {
      'Muad': 'muad123',
      'Superuser': 'super123',
      'Samim': 'samim123'
    };
    
    console.log('\n=== SETTING KNOWN PASSWORDS ===');
    
    for (const [username, password] of Object.entries(userPasswords)) {
      try {
        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Update the user's password
        const result = await db.collection('users').updateOne(
          { username: username },
          { $set: { password: hashedPassword } }
        );
        
        if (result.matchedCount > 0) {
          console.log(`✅ Set password for ${username}: ${password}`);
        } else {
          console.log(`❌ User ${username} not found`);
        }
      } catch (error) {
        console.log(`❌ Error setting password for ${username}: ${error.message}`);
      }
    }
    
    console.log('\n=== LOGIN CREDENTIALS ===');
    console.log('You can now test authentication with these credentials:');
    for (const [username, password] of Object.entries(userPasswords)) {
      console.log(`  Username: ${username} | Password: ${password}`);
    }
    
    console.log('\n=== TESTING PASSWORDS ===');
    // Test that the passwords work
    for (const [username, password] of Object.entries(userPasswords)) {
      try {
        const user = await db.collection('users').findOne({ username: username });
        if (user) {
          const isValid = await bcrypt.compare(password, user.password);
          console.log(`  ${username}: ${isValid ? '✅ Password works' : '❌ Password failed'}`);
        }
      } catch (error) {
        console.log(`  ${username}: ❌ Error testing password`);
      }
    }
    
  } catch (error) {
    console.error('Error setting known passwords:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\nDisconnected from MongoDB');
    }
  }
}

setKnownPasswords(); 