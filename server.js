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
      console.error('Error details:', {
        name: err.name,
        code: err.code,
        sslError: err.sslError || 'None',
      });
      retries -= 1;
      if (retries === 0) {
        console.error('All MongoDB connection retries failed');
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Middleware
app.use(bodyParser.json());
app.use(express.static('.'));

// Initialize database
setupDatabase().catch(err => {
  console.error('Failed to set up database:', err);
  process.exit(1);
});

// POST: Create or update campaign
app.post('/api/campaigns', async (req, res) => {
  try {
    const campaignData = req.body;
    const campaigns = db.collection('campaigns');
    await campaigns.updateOne(
      { campaignId: campaignData.campaignId },
      { $set: campaignData },
      { upsert: true }
    );
    res.status(200).json({ message: 'Campaign saved successfully' });
  } catch (err) {
    console.error('Error saving campaign:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET: Query campaigns by campaignId
app.get('/api/campaigns/:campaignId', async (req, res) => {
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

// GET: Export all campaigns to Excel
app.get('/api/campaigns/export', async (req, res) => {
  try {
    const campaigns = db.collection('campaigns');
    const data = await campaigns.find().toArray();
    
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Campaigns');
    
    worksheet.columns = [
      { header: 'Campaign ID', key: 'campaignId', width: 15 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Start Date', key: 'startDate', width: 15 },
      { header: 'End Date', key: 'endDate', width: 15 },
      { header: 'Budget', key: 'budget', width: 10 },
      { header: 'Status', key: 'status', width: 10 },
    ];
    
    data.forEach(campaign => {
      worksheet.addRow({
        campaignId: campaign.campaignId,
        name: campaign.name,
        description: campaign.description,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        budget: campaign.budget,
        status: campaign.status,
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

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});