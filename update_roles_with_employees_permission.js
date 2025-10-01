const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/trichygold_job')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Update all existing roles to include manage_employees permission
    const result = await db.collection('roles').updateMany(
      {}, // Update all roles
      { 
        $set: { 
          'permissions.manage_employees': false // Default to false for existing roles
        } 
      }
    );
    
    console.log(`Updated ${result.modifiedCount} roles with manage_employees permission`);
    
    // Set manage_employees to true for admin role
    const adminResult = await db.collection('roles').updateOne(
      { name: 'admin' },
      { 
        $set: { 
          'permissions.manage_employees': true 
        } 
      }
    );
    
    console.log(`Updated admin role: ${adminResult.modifiedCount} documents`);
    
    // Verify the changes
    const roles = await db.collection('roles').find({}).toArray();
    console.log('\nUpdated roles:');
    roles.forEach(role => {
      console.log(`- ${role.name}: manage_employees = ${role.permissions.manage_employees}`);
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
