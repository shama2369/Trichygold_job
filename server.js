const express = require('express');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const excel = require('exceljs');
const bodyParser = require('body-parser');
const path = require('path');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const uri = process.env.MONGO_URI;

let db;

// Middleware setup - order is important
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API routes should come before static file serving
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// POST: Create or update campaign
app.post('/api/campaigns', async (req, res) => {
  try {
    let campaignData = req.body;
    
    // Generate campaignId if not provided
    if (!campaignData.campaignId) {
      campaignData.campaignId = await generateCampaignId();
    }
    
    const campaigns = db.collection('campaigns');
    await campaigns.updateOne(
      { campaignId: campaignData.campaignId },
      { $set: campaignData },
      { upsert: true }
    );
    res.status(200).json({ message: 'Campaign saved successfully', campaignId: campaignData.campaignId });
  } catch (err) {
    console.error('Error saving campaign:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT: Update campaign
app.put('/api/campaigns/:campaignId', async (req, res) => {
  try {
    const campaignId = req.params.campaignId;
    const campaignData = req.body;
    
    if (!campaignData) {
      return res.status(400).json({ error: 'No campaign data provided' });
    }
    
    // Ensure the campaignId in the URL matches the one in the body
    if (campaignData.campaignId !== campaignId) {
      return res.status(400).json({ error: 'Campaign ID mismatch' });
    }
    
    const campaigns = db.collection('campaigns');
    const result = await campaigns.updateOne(
      { campaignId },
      { $set: campaignData },
      { upsert: false }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    return res.status(200).json({ 
      message: 'Campaign updated successfully', 
      campaignId 
    });
  } catch (err) {
    console.error('Error updating campaign:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET: Retrieve all campaigns
app.get('/api/campaigns', async (req, res) => {
  console.log('Received GET request for all campaigns (/api/campaigns)');
  try {
    const campaigns = db.collection('campaigns');
    const allCampaigns = await campaigns.find().toArray();
    res.status(200).json(allCampaigns);
  } catch (err) {
    console.error('Error retrieving campaigns:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET: Export all campaigns to Excel
app.get('/api/campaigns/export', async (req, res) => {
  console.log('Received GET request for Excel export (/api/campaigns/export)');
  try {
    const campaigns = db.collection('campaigns');
    const data = await campaigns.find().toArray();
    
    if (data.length === 0) {
        console.log('No campaigns found for export.');
        return res.status(404).json({ error: 'No campaigns found to export' });
    }

    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Campaigns');
    
    worksheet.columns = [
      { header: 'Campaign ID', key: 'campaignId', width: 15 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Start Date', key: 'startDate', width: 15 },
      { header: 'End Date', key: 'endDate', width: 15 },
      { header: 'Budget (AED)', key: 'budget', width: 10 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Channels', key: 'channels', width: 50 },
    ];
    
    data.forEach(campaign => {
      const channelDetails = campaign.channels ? campaign.channels.map(channel => {
        if (channel.type === 'Social Media') {
          return `Social Media: ${channel.platform}, ${channel.adName}, ${channel.cost} AED, ${channel.adType}`;
        } else if (channel.type === 'TV') {
          return `TV: ${channel.network || ''}, ${channel.adName}, ${channel.cost} AED`;
        } else if (channel.type === 'Print Media') {
          return `Print Media: ${channel.publication}, ${channel.adName}, ${channel.cost} AED`;
        } else if (channel.type === 'Radio') {
          return `Radio: ${channel.station || ''}, ${channel.adName}, ${channel.cost} AED`;
        }
        return '';
      }).join('; ') : '';
      
      worksheet.addRow({
        campaignId: campaign.campaignId,
        name: campaign.name,
        description: campaign.description,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        budget: campaign.budget,
        status: campaign.status,
        channels: channelDetails,
      });
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=campaigns.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error exporting campaigns:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET: Query campaigns by campaignId
app.get('/api/campaigns/:campaignId', async (req, res) => {
  console.log(`Received GET request for campaignId: ${req.params.campaignId}`);
  try {
    const campaignId = req.params.campaignId;
    const campaigns = db.collection('campaigns');
    const campaign = await campaigns.findOne({ campaignId });
    if (campaign) {
      res.status(200).json(campaign);
    } else {
      res.status(404).json({ error: 'Campaign not found' });
    }
  } catch (err) {
    console.error('Error querying campaign:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Static file serving should come after API routes
app.use(express.static('.'));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (req.path.startsWith('/api/')) {
    res.status(500).json({ error: 'Server error' });
  } else {
    res.status(500).send('Server error');
  }
});

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Not found' });
  } else {
    res.status(404).sendFile(path.join(__dirname, 'index.html'));
  }
});

async function setupDatabase() {
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
      console.log('Connected to MongoDB');
      db = client.db('event_campaign_db');
      const campaigns = db.collection('campaigns');
      await campaigns.createIndex({ campaignId: 1 }, { unique: true });
      console.log('Unique index on campaignId created');
      return;
    } catch (err) {
      console.error(`MongoDB connection failed (Attempt ${4 - retries}):`, err.message);
      retries -= 1;
      if (retries === 0) {
        console.error('All MongoDB connection retries failed');
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Generate Campaign ID
async function generateCampaignId() {
  try {
    const campaigns = db.collection('campaigns');
    const lastCampaign = await campaigns.find().sort({ campaignId: -1 }).limit(1).toArray();
    let nextId = 1;
    if (lastCampaign.length > 0) {
      const lastId = lastCampaign[0].campaignId;
      const number = parseInt(lastId.replace('CAMP_', '')) + 1;
      nextId = number;
    }
    return `CAMP_${nextId.toString().padStart(4, '0')}`;
  } catch (err) {
    console.error('Error generating campaignId:', err);
    throw err;
  }
}

// Initialize database and start server
async function startServer() {
  try {
    await setupDatabase();
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log('Application startup completed');
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();