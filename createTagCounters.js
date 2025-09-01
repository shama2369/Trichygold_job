const { MongoClient } = require('mongodb');
require('dotenv').config();

// MongoDB connection URI from environment variable
const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = 'event_campaign_db';

async function createTagCounters() {
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    // Connect to MongoDB
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const tagCountersCollection = db.collection('tagCounters');
    const campaignsCollection = db.collection('campaigns');

    // Get all campaigns and extract tag numbers
    const campaigns = await campaignsCollection.find({}).toArray();
    
    const tagPrefixes = new Map(); // prefix -> highest number
    
    campaigns.forEach(campaign => {
      if (campaign.channels && Array.isArray(campaign.channels)) {
        campaign.channels.forEach(channel => {
          if (channel.tagNumber) {
            // Extract prefix and number from tag (e.g., "IG023" -> prefix: "IG", number: 23)
            const match = channel.tagNumber.match(/^([A-Z]+)(\d+)$/);
            if (match) {
              const prefix = match[1];
              const number = parseInt(match[2]);
              
              if (!tagPrefixes.has(prefix) || tagPrefixes.get(prefix) < number) {
                tagPrefixes.set(prefix, number);
              }
            }
          }
        });
      }
    });

    console.log('Found tag prefixes and their highest numbers:');
    tagPrefixes.forEach((highestNumber, prefix) => {
      console.log(`${prefix}: ${highestNumber}`);
    });

    if (tagPrefixes.size === 0) {
      console.log('No tag numbers found to create counters for.');
      return;
    }

    // Create counters for each prefix
    console.log('\nCreating tag counters...');
    for (const [prefix, highestNumber] of tagPrefixes) {
      try {
        await tagCountersCollection.updateOne(
          { prefix: prefix },
          { $set: { lastNumber: highestNumber } },
          { upsert: true }
        );
        console.log(`✓ Created counter for ${prefix} with last number: ${highestNumber}`);
      } catch (err) {
        console.error(`✗ Error creating counter for ${prefix}:`, err.message);
      }
    }

    // Verify the counters were created
    console.log('\n=== Verifying created counters ===');
    const createdCounters = await tagCountersCollection.find({}).toArray();
    
    if (createdCounters.length === 0) {
      console.log('No counters were created.');
    } else {
      console.log(`Successfully created ${createdCounters.length} counters:`);
      createdCounters.forEach(counter => {
        const nextTag = `${counter.prefix}${String(counter.lastNumber + 1).padStart(4, '0')}`;
        console.log(`- ${counter.prefix}: Last used ${counter.lastNumber}, Next: ${nextTag}`);
      });
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
createTagCounters(); 