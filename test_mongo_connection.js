const { MongoClient } = require('mongodb');
require('dotenv').config();

async function testConnection() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not defined in .env');
    return;
  }

  console.log('MONGO_URI:', uri.replace(/:([^@]+)@/, ':<hidden>@'));

  const client = new MongoClient(uri, {
    ssl: true,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    tlsAllowInvalidCertificates: false,
    tlsAllowInvalidHostnames: false,
  });

  let retries = 3;
  while (retries > 0) {
    try {
      console.log(`Attempting to connect to MongoDB (Retries left: ${retries})...`);
      await client.connect();
      console.log('Connected successfully to cluster!');

      // Verify authentication
      const adminDb = client.db('admin');
      const authInfo = await adminDb.command({ connectionStatus: 1 });
      console.log('Authenticated User:', authInfo.authInfo.authenticatedUsers);

      // Server status
      const serverStatus = await adminDb.command({ serverStatus: 1 });
      console.log('Server Status:', {
        host: serverStatus.host,
        version: serverStatus.version,
        uptime: serverStatus.uptime,
        connections: serverStatus.connections,
      });

      // Check topology
      const topology = await adminDb.command({ isMaster: 1 });
      console.log('Cluster Details:', {
        setName: topology.setName,
        primary: topology.primary,
        hosts: topology.hosts,
      });

      // Check database and collection
      const db = client.db('event_campaign_db');
      const collections = await db.listCollections().toArray();
      console.log('Collections in event_campaign_db:', collections.map(c => c.name));

      const campaigns = db.collection('campaigns');
      await campaigns.createIndex({ campaignId: 1 }, { unique: true });
      console.log('Created unique index on campaignId');

      await campaigns.insertOne({
        campaignId: 'TEST-001',
        name: 'Test Campaign',
        description: 'Test',
        startDate: new Date(),
        endDate: new Date(),
        budget: 1000,
        status: 'test',
      });
      console.log('Inserted test document');

      return;
    } catch (err) {
      console.error(`Connection failed (Attempt ${4 - retries}):`, err.message);
      console.error('Error details:', {
        name: err.name,
        code: err.code,
        sslError: err.sslError || 'None',
        stack: err.stack.split('\n').slice(0, 3),
      });
      retries -= 1;
      if (retries === 0) {
        console.error('All retries failed');
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    } finally {
      await client.close().catch(err => console.error('Error closing client:', err));
    }
  }
}

testConnection();