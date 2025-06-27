const { MongoClient } = require('mongodb');
require('dotenv').config();

// MongoDB connection URI from environment variable
const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = 'event_campaign_db'; // Database name
const collectionName = 'campaigns'; // Collection name

async function viewCollectionData() {
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    // Connect to MongoDB
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Fetch all documents in the collection
    const documents = await collection.find({}).toArray();

    if (documents.length === 0) {
      console.log('No documents found in the collection.');
    } else {
      console.log(`Found ${documents.length} documents in the "${collectionName}" collection:`);
      console.log('--------------------------------------------------');
      documents.forEach((doc, index) => {
        console.log(`Document ${index + 1}:`);
        console.log(JSON.stringify(doc, null, 2));
        console.log('--------------------------------------------------');
      });
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    // Close the connection
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run the function
viewCollectionData();