const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/trichygold_job')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const adminUser = {
      username: 'admin',
      email: 'admin@trichygold.com',
      password: hashedPassword,
      role: 'admin',
      permissions: {
        create_jobs: true,
        edit_jobs: true,
        delete_jobs: true,
        view_reports: true,
        manage_users: true,
        export_data: true
      },
      createdAt: new Date(),
      isActive: true
    };
    
    // Insert admin user
    const result = await db.collection('users').insertOne(adminUser);
    console.log('Admin user created:', result.insertedId);
    
    // Verify the user was created
    const users = await db.collection('users').find({}).toArray();
    console.log('Total users:', users.length);
    console.log('Users:', users.map(u => ({ username: u.username, role: u.role, permissions: u.permissions })));
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
