const express = require('express');
const { MongoClient } = require('mongodb');
const bodyParser = require('body-parser');
const XLSX = require('xlsx');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// MongoDB Atlas connection URI from environment variable
const uri = process.env.MONGO_URI;

// Middleware
app.use(bodyParser.json());
app.use(express.static('.'));

// MongoDB client
const client = new MongoClient(uri);

// Create unique index on campaignId
async function setupDatabase() {
  try {
    await client.connect();
    const db = client.db('event_campaign_db');
    const campaigns = db.collection('campaigns');
    await campaigns.createIndex({ campaignId: 1 }, { unique: true });
    console.log('Unique index on campaignId created');
  } catch (err) {
    console.error('Error setting up database:', err);
  } finally {
    await client.close();
  }
}

setupDatabase();

// Save campaign
app.post('/api/campaigns', async (req, res) => {
  try {
    await client.connect();
    const db = client.db('event_campaign_db');
    const campaigns = db.collection('campaigns');

    const campaign = req.body;

    if (!campaign.campaignId || !campaign.name || !campaign.startDate || !campaign.endDate || !campaign.budget || !campaign.channelDetails.length) {
      return res.status(400).json({ error: 'Missing required fields or channels' });
    }

    const existingCampaign = await campaigns.findOne({ campaignId: campaign.campaignId });
    if (existingCampaign) {
      return res.status(400).json({ error: 'Campaign ID already exists' });
    }

    const result = await campaigns.insertOne(campaign);
    res.status(201).json({ message: 'Campaign saved', id: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    await client.close();
  }
});

// Query campaigns
app.post('/api/campaigns/query', async (req, res) => {
  try {
    await client.connect();
    const db = client.db('event_campaign_db');
    const campaigns = db.collection('campaigns');

    const query = req.body;
    const campaignData = await campaigns.find(query).toArray();
    res.status(200).json(campaignData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    await client.close();
  }
});

// Export campaigns to Excel
app.get('/api/campaigns/export', async (req, res) => {
  try {
    await client.connect();
    const db = client.db('event_campaign_db');
    const campaigns = db.collection('campaigns');

    const campaignData = await campaigns.find({}).toArray();

    const excelData = [];
    campaignData.forEach(campaign => {
      if (campaign.channelDetails && campaign.channelDetails.length > 0) {
        campaign.channelDetails.forEach(channel => {
          excelData.push({
            campaignId: campaign.campaignId,
            name: campaign.name,
            description: campaign.description,
            startDate: campaign.startDate ? campaign.startDate.toISOString().split('T')[0] : '',
            endDate: campaign.endDate ? campaign.endDate.toISOString().split('T')[0] : '',
            budget: campaign.budget,
            status: campaign.status,
            targetAudience_age: campaign.targetAudience?.demographics?.age || '',
            targetAudience_gender: campaign.targetAudience?.demographics?.gender || '',
            targetAudience_location: campaign.targetAudience?.location || '',
            goals_sales: campaign.goals?.sales || 0,
            goals_impressions: campaign.goals?.impressions || 0,
            goals_conversions: campaign.goals?.conversions || 0,
            channel_type: channel.type,
            channel_name: channel.name,
            channel_cost: channel.cost,
            channel_platform: channel.platform || '',
            channel_adType: channel.adType || '',
            channel_postType: channel.postType || '',
            channel_mediaType: channel.mediaType || '',
            channel_publication: channel.publication || '',
            channel_adSize: channel.adSize || '',
            channel_publicationDate: channel.publicationDate ? channel.publicationDate.toISOString().split('T')[0] : '',
            channel_distributionArea: channel.distributionArea || '',
            channel_quantity: channel.quantity || 0,
            channel_distributionDate: channel.distributionDate ? channel.distributionDate.toISOString().split('T')[0] : '',
            channel_subject: channel.subject || '',
            channel_station: channel.station || '',
            channel_slot: channel.slot || '',
            channel_eventName: channel.eventName || '',
            channel_eventDate: channel.eventDate ? channel.eventDate.toISOString().split('T')[0] : ''
          });
        });
      } else {
        excelData.push({
          campaignId: campaign.campaignId,
          name: campaign.name,
          description: campaign.description,
          startDate: campaign.startDate ? campaign.startDate.toISOString().split('T')[0] : '',
          endDate: campaign.endDate ? campaign.endDate.toISOString().split('T')[0] : '',
          budget: campaign.budget,
          status: campaign.status,
          targetAudience_age: campaign.targetAudience?.demographics?.age || '',
          targetAudience_gender: campaign.targetAudience?.demographics?.gender || '',
          targetAudience_location: campaign.targetAudience?.location || '',
          goals_sales: campaign.goals?.sales || 0,
          goals_impressions: campaign.goals?.impressions || 0,
          goals_conversions: campaign.goals?.conversions || 0,
          channel_type: '',
          channel_name: '',
          channel_cost: 0,
          channel_platform: '',
          channel_adType: '',
          channel_postType: '',
          channel_mediaType: '',
          channel_publication: '',
          channel_adSize: '',
          channel_publicationDate: '',
          channel_distributionArea: '',
          channel_quantity: 0,
          channel_distributionDate: '',
          channel_subject: '',
          channel_station: '',
          channel_slot: '',
          channel_eventName: '',
          channel_eventDate: ''
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Campaigns');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', 'attachment; filename=campaigns.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(excelBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    await client.close();
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});