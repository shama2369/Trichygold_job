const { MongoClient } = require('mongodb');
require('dotenv').config();

// MongoDB connection URI from environment variable
const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = 'event_campaign_db';

async function checkTagCounters() {
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    // Connect to MongoDB
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const tagCountersCollection = db.collection('tagCounters');
    const campaignsCollection = db.collection('campaigns');

    // Check tagCounters collection
    console.log('\n=== Checking tagCounters collection ===');
    const tagCounters = await tagCountersCollection.find({}).toArray();
    
    if (tagCounters.length === 0) {
      console.log('No tag counters found in the database.');
    } else {
      console.log(`Found ${tagCounters.length} tag counters:`);
      tagCounters.forEach((counter, index) => {
        console.log(`${index + 1}. Prefix: ${counter.prefix}, Last Number: ${counter.lastNumber}`);
      });
    }

    // Check campaigns collection for existing tag numbers
    console.log('\n=== Checking campaigns for existing tag numbers ===');
    const campaigns = await campaignsCollection.find({}).toArray();
    
    const allTags = new Set();
    campaigns.forEach(campaign => {
      if (campaign.channels && Array.isArray(campaign.channels)) {
        campaign.channels.forEach(channel => {
          if (channel.tagNumber) {
            allTags.add(channel.tagNumber);
          }
        });
      }
    });

    if (allTags.size === 0) {
      console.log('No tag numbers found in any campaigns.');
    } else {
      console.log(`Found ${allTags.size} tag numbers in campaigns:`);
      Array.from(allTags).sort().forEach(tag => {
        console.log(`- ${tag}`);
      });
    }

    // Suggest how to create counters
    if (tagCounters.length === 0 && allTags.size > 0) {
      console.log('\n=== Suggestion ===');
      console.log('You have tag numbers in campaigns but no counters in the database.');
      console.log('To fix this, you can either:');
      console.log('1. Generate new tags using the "Generate Tag" button in the app');
      console.log('2. Or manually create counters based on existing tags');
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    // Close the connection
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the function
checkTagCounters(); 