const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const MONGODB_URI = 'mongodb://localhost:27017';
const DB_NAME = 'trichygold_campaigns';

async function createDemoUsers() {
  let client;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    
    // First, get the role IDs
    const roles = await db.collection('roles').find({}).toArray();
    const adminRole = roles.find(role => role.name === 'admin');
    const editorRole = roles.find(role => role.name === 'editor');
    const viewerRole = roles.find(role => role.name === 'viewer');
    
    if (!adminRole || !editorRole || !viewerRole) {
      console.error('Required roles not found. Please run seedRoles.js first.');
      return;
    }
    
    // Hash passwords
    const saltRounds = 10;
    const adminPassword = await bcrypt.hash('admin123', saltRounds);
    const editorPassword = await bcrypt.hash('editor123', saltRounds);
    const viewerPassword = await bcrypt.hash('viewer123', saltRounds);
    
    // Create demo users
    const demoUsers = [
      {
        username: 'admin',
        password: adminPassword,
        email: 'admin@trichygold.com',
        roles: [adminRole._id.toString()],
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        username: 'editor',
        password: editorPassword,
        email: 'editor@trichygold.com',
        roles: [editorRole._id.toString()],
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        username: 'viewer',
        password: viewerPassword,
        email: 'viewer@trichygold.com',
        roles: [viewerRole._id.toString()],
        created_at: new Date(),
        updated_at: new Date()
      }
    ];
    
    // Check if users already exist
    for (const user of demoUsers) {
      const existingUser = await db.collection('users').findOne({ username: user.username });
      if (existingUser) {
        console.log(`User ${user.username} already exists, skipping...`);
        continue;
      }
      
      await db.collection('users').insertOne(user);
      console.log(`Created user: ${user.username}`);
    }
    
    console.log('Demo users created successfully!');
    console.log('\nLogin credentials:');
    console.log('Admin - Username: admin, Password: admin123');
    console.log('Editor - Username: editor, Password: editor123');
    console.log('Viewer - Username: viewer, Password: viewer123');
    
  } catch (error) {
    console.error('Error creating demo users:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('Disconnected from MongoDB');
    }
  }
}

createDemoUsers(); 