const { MongoClient } = require('mongodb');
require('dotenv').config();

async function createEmployeesDatabase() {
  const client = new MongoClient(process.env.MONGO_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('job_db');
    const employeesCollection = db.collection('employees');
    
    // Create employees with ID and name
    const employees = [
      { _id: 'EMP001', name: 'John Smith' },
      { _id: 'EMP002', name: 'Sarah Johnson' },
      { _id: 'EMP003', name: 'Mike Wilson' },
      { _id: 'EMP004', name: 'Emily Davis' },
      { _id: 'EMP005', name: 'David Brown' },
      { _id: 'EMP006', name: 'Lisa Anderson' },
      { _id: 'EMP007', name: 'Robert Taylor' },
      { _id: 'EMP008', name: 'Jennifer Martinez' },
      { _id: 'EMP009', name: 'Christopher Lee' },
      { _id: 'EMP010', name: 'Amanda Garcia' }
    ];
    
    // Clear existing employees
    await employeesCollection.deleteMany({});
    
    // Insert new employees
    const result = await employeesCollection.insertMany(employees);
    console.log(`Created ${result.insertedCount} employees`);
    
    // Create index on _id for faster lookups
    await employeesCollection.createIndex({ _id: 1 });
    console.log('Created index on employee ID');
    
    // Display created employees
    const allEmployees = await employeesCollection.find({}).toArray();
    console.log('\nCreated employees:');
    allEmployees.forEach(emp => {
      console.log(`ID: ${emp._id}, Name: ${emp.name}`);
    });
    
  } catch (error) {
    console.error('Error creating employees database:', error);
  } finally {
    await client.close();
  }
}

createEmployeesDatabase();
