const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://shama2369:trichygold123@cluster0.7xhqo.mongodb.net/trichygold_job?retryWrites=true&w=majority';

async function updateAdminRole() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('trichygold_job');
    const rolesCollection = db.collection('roles');
    
    // Update admin role to include manage_employees permission
    const result = await rolesCollection.updateOne(
      { name: 'admin' },
      { 
        $set: { 
          'permissions.manage_employees': true,
          updated_at: new Date()
        } 
      }
    );
    
    if (result.matchedCount > 0) {
      console.log('✅ Admin role updated successfully with manage_employees permission');
    } else {
      console.log('❌ Admin role not found');
    }
    
    // Also update the role creation form to include manage_employees checkbox
    console.log('\n📝 Don\'t forget to add the manage_employees checkbox to the role creation form in index.html');
    
  } catch (error) {
    console.error('Error updating admin role:', error);
  } finally {
    await client.close();
  }
}

updateAdminRole();
