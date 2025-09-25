const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const excel = require('exceljs');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const uri = process.env.MONGO_URI;

let db;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'campaign-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// User and Roles routes
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
// Middleware setup - order is important
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Register user/roles API before static file serving and error handlers
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);

// API routes should come before static file serving
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Helper function to sync tag counters with actual saved tags
async function syncTagCounters() {
  try {
    const jobs = db.collection('jobcollection');
    const tagCounters = db.collection('tagCounters');
    
    // Get all jobs and extract all tag numbers
    const allJobs = await jobs.find({}).toArray();
    const tagNumbersByPrefix = {};
    
    // Collect all tag numbers by prefix
    allJobs.forEach(job => {
      if (job.channels && Array.isArray(job.channels)) {
        job.channels.forEach(channel => {
          if (channel.tagNumber && channel.tagNumber.trim() !== '') {
            const prefix = channel.tagNumber.substring(0, 2);
            const numberPart = parseInt(channel.tagNumber.substring(2));
            
            if (!tagNumbersByPrefix[prefix]) {
              tagNumbersByPrefix[prefix] = [];
            }
            tagNumbersByPrefix[prefix].push(numberPart);
          }
        });
      }
    });
    
    // Update counters based on actual saved tags
    for (const [prefix, numbers] of Object.entries(tagNumbersByPrefix)) {
      if (numbers.length > 0) {
        const maxNumber = Math.max(...numbers);
        
        // Update or create counter
        await tagCounters.updateOne(
          { prefix: prefix },
          { $set: { lastNumber: maxNumber } },
          { upsert: true }
        );
        
        console.log(`Synced counter for ${prefix} to ${maxNumber}`);
      }
    }
    
    // For prefixes with no saved tags, keep the existing counter (don't reset to 0)
    // This preserves the highest number ever used, even if all tags are deleted
    const existingCounters = await tagCounters.find({}).toArray();
    for (const counter of existingCounters) {
      if (!tagNumbersByPrefix[counter.prefix]) {
        // Don't reset to 0 - keep the existing counter value
        // This ensures gaps are preserved and numbers are never reused
        console.log(`Keeping counter for ${counter.prefix} at ${counter.lastNumber} (no current saved tags, but preserving history)`);
      }
    }
  } catch (err) {
    console.error('Error syncing tag counters:', err);
  }
}

// POST: Manually sync tag counters with actual saved tags
app.post('/api/tags/sync', async (req, res) => {
  try {
    await syncTagCounters();
    res.json({ message: 'Tag counters synced successfully' });
  } catch (err) {
    console.error('Error syncing tag counters:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET: Debug endpoint to check job data structure
app.get('/api/debug/jobs', async (req, res) => {
  try {
    console.log('Debug jobs endpoint called');
    const jobs = db.collection('jobcollection');
    const allJobs = await jobs.find({}).toArray();
    
    console.log(`Found ${allJobs.length} jobs`);
    
    // Show simplified job data
    const debugData = allJobs.map(job => ({
      campaignId: job.campaignId,
      name: job.name,
      description: job.description,
      workStartDate: job.workStartDate,
      startDate: job.startDate,
      endDate: job.endDate,
      budget: job.budget,
      status: job.status,
      jobAssignedTo: job.jobAssignedTo
    }));
    
    res.json(debugData);
  } catch (err) {
    console.error('Error getting debug jobs:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST: Create or update job
app.post('/api/jobs', async (req, res) => {
  try {
    // Parse job data from form
    let jobData;
    try {
      jobData = JSON.parse(req.body.jobData);
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid job data format' });
    }
    
    console.log('=== JOB SUBMISSION DEBUG ===');
    console.log('Job data received:', JSON.stringify(jobData, null, 2));
    
    // Generate campaignId if not provided
    if (!jobData.campaignId) {
      jobData.campaignId = await getNextCampaignId();
    }
    
    const jobs = db.collection('jobcollection');
    await jobs.updateOne(
      { campaignId: jobData.campaignId },
      { $set: jobData },
      { upsert: true }
    );
    
    res.status(200).json({ message: 'Job saved successfully', campaignId: jobData.campaignId });
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
    
    // Note: campaignId in URL is MongoDB _id, campaignId in body is human-readable ID
    // No need to compare them as they serve different purposes
    
    // Validate tag numbers for uniqueness
    if (campaignData.channels && Array.isArray(campaignData.channels)) {
      const tagNumbers = campaignData.channels
        .map(channel => channel.tagNumber)
        .filter(tag => tag && tag.trim() !== '');
      
      if (tagNumbers.length > 0) {
        // Check for duplicates within the same campaign
        const uniqueTags = new Set(tagNumbers);
        if (uniqueTags.size !== tagNumbers.length) {
          return res.status(400).json({ 
            error: 'Duplicate tag numbers found within the campaign. Each tag number must be unique.' 
          });
        }
        
        // Check for duplicates across all existing campaigns (excluding current campaign)
        const campaigns = db.collection('jobcollection');
        const existingCampaigns = await campaigns.find({}).toArray();
        const existingTags = new Set();
        
        console.log(`Update: Checking tag uniqueness for campaign ${campaignId}`);
        console.log(`Update: Current campaign has tags: ${tagNumbers.join(', ')}`);
        
        existingCampaigns.forEach(campaign => {
          // Skip current campaign by comparing MongoDB _id
          if (campaign._id.toString() !== campaignId) {
            if (campaign.channels && Array.isArray(campaign.channels)) {
              campaign.channels.forEach(channel => {
                if (channel.tagNumber) {
                  existingTags.add(channel.tagNumber);
                }
              });
            }
          }
        });
        
        console.log(`Update: Found existing tags from other campaigns: ${Array.from(existingTags).join(', ')}`);
        
        const duplicateTags = tagNumbers.filter(tag => existingTags.has(tag));
        if (duplicateTags.length > 0) {
          console.log(`Update: Duplicate tags found: ${duplicateTags.join(', ')}`);
          return res.status(400).json({ 
            error: `Tag number(s) already exist: ${duplicateTags.join(', ')}. Each tag number must be globally unique.` 
          });
        }
        
        console.log(`Update: All tags are unique, proceeding with update`);
      }
    }
    
    const campaigns = db.collection('jobcollection');
    const result = await campaigns.updateOne(
      { _id: new ObjectId(campaignId) },
      { $set: campaignData },
      { upsert: false }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Sync tag counters after update to ensure consistency
    await syncTagCounters();
    
    return res.status(200).json({ 
      message: 'Campaign updated successfully', 
      campaignId 
    });
  } catch (err) {
    console.error('Error updating campaign:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET: Retrieve all jobs
app.get('/api/jobs', async (req, res) => {
  console.log('Received GET request for all jobs (/api/jobs)');
  try {
    const jobs = db.collection('jobcollection');
    const allJobs = await jobs.find().toArray();
    res.status(200).json(allJobs);
  } catch (err) {
    console.error('Error retrieving jobs:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET: Retrieve all campaigns (backward compatibility)
app.get('/api/campaigns', async (req, res) => {
  console.log('Received GET request for all campaigns (/api/campaigns)');
  try {
    const jobs = db.collection('jobcollection');
    const allJobs = await jobs.find().toArray();
    res.status(200).json(allJobs);
  } catch (err) {
    console.error('Error retrieving campaigns:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST: Create or update campaign (backward compatibility)
app.post('/api/campaigns', async (req, res) => {
  try {
    // Parse job data from form
    let jobData;
    try {
      jobData = JSON.parse(req.body.campaignData || req.body.jobData);
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid job data format' });
    }
    
    console.log('=== JOB SUBMISSION DEBUG (via campaigns endpoint) ===');
    console.log('Job data received:', JSON.stringify(jobData, null, 2));
    
    // Generate campaignId if not provided
    if (!jobData.campaignId) {
      jobData.campaignId = await getNextCampaignId();
    }
    
    const jobs = db.collection('jobcollection');
    await jobs.updateOne(
      { campaignId: jobData.campaignId },
      { $set: jobData },
      { upsert: true }
    );
    
    res.status(200).json({ message: 'Job saved successfully', campaignId: jobData.campaignId });
  } catch (err) {
    console.error('Error saving job:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET: Export all campaigns to Excel
// GET: Find campaigns by tag number (for debugging)
app.get('/api/campaigns/tag/:tagNumber', async (req, res) => {
  try {
    const tagNumber = req.params.tagNumber;
    const campaigns = db.collection('jobcollection');
    
    const campaignsWithTag = await campaigns.find({
      'channels.tagNumber': tagNumber
    }).toArray();
    
    if (campaignsWithTag.length === 0) {
      return res.status(404).json({ 
        message: `No campaigns found using tag number: ${tagNumber}` 
      });
    }
    
    res.json({
      tagNumber: tagNumber,
      campaigns: campaignsWithTag.map(c => ({
        _id: c._id,
        campaignId: c.campaignId,
        name: c.name,
        channels: c.channels.filter(ch => ch.tagNumber === tagNumber)
      }))
    });
  } catch (err) {
    console.error('Error finding campaigns by tag:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET: Export a single campaign to Excel
app.get('/api/campaigns/:campaignId/export', async (req, res) => {
  const campaignId = req.params.campaignId;
  try {
    const campaigns = db.collection('jobcollection');
    const campaign = await campaigns.findOne({ campaignId });
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Campaigns');
    worksheet.columns = [
      { header: 'Marketing ID', key: 'campaignId', width: 15 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Start Date', key: 'startDate', width: 15 },
      { header: 'End Date', key: 'endDate', width: 15 },
      { header: 'Budget (AED)', key: 'budget', width: 10 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Job Assigned To', key: 'jobAssignedTo', width: 15 },
      { header: 'Channels', key: 'channels', width: 50 },
    ];

    // Format channels as readable string (same as all-campaigns export)
    let channelDetails = '';
    if (campaign.channels && Array.isArray(campaign.channels)) {
      channelDetails = campaign.channels.map(channel => {
        let baseInfo = '';
        if (channel.type === 'Social Media') {
          baseInfo = `Social Media: ${channel.platform}, ${channel.adName}, ${channel.cost} AED, ${channel.adType}`;
        } else if (channel.type === 'TV') {
          baseInfo = `TV: ${channel.network || ''}, ${channel.adName}, ${channel.cost} AED`;
        } else if (channel.type === 'Print Media') {
          baseInfo = `Print Media: ${channel.publication}, ${channel.adName}, ${channel.cost} AED`;
        } else if (channel.type === 'Radio') {
          baseInfo = `Radio: ${channel.station || ''}, ${channel.adName}, ${channel.cost} AED`;
        } else {
          baseInfo = `${channel.type}: ${channel.adName}, ${channel.cost} AED`;
        }
        
        // Add impressions if available
        if (channel.impressions) {
          baseInfo += `, ${channel.impressions.toLocaleString()} impressions`;
        }
        
        // Add tag number if available
        if (channel.tagNumber) {
          baseInfo += `, Tag: ${channel.tagNumber}`;
        }
        
        return baseInfo;
      }).join('; ');
    }

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
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=campaign_${campaignId}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error exporting campaign:', err);
    res.status(500).json({ error: 'Server error during export' });
  }
});

app.get('/api/campaigns/export', async (req, res) => {
  console.log('Received GET request for Excel export (/api/campaigns/export)');
  try {
    const campaigns = db.collection('jobcollection');
    const data = await campaigns.find().toArray();
    
    if (data.length === 0) {
        console.log('No campaigns found for export.');
        return res.status(404).json({ error: 'No campaigns found to export' });
    }

    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Campaigns');
    
    worksheet.columns = [
      { header: 'Marketing ID', key: 'campaignId', width: 15 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Start Date', key: 'startDate', width: 15 },
      { header: 'End Date', key: 'endDate', width: 15 },
      { header: 'Budget (AED)', key: 'budget', width: 10 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Job Assigned To', key: 'jobAssignedTo', width: 15 },
      { header: 'Channels', key: 'channels', width: 50 },
    ];
    
    data.forEach(campaign => {
      const channelDetails = campaign.channels ? campaign.channels.map(channel => {
        let baseInfo = '';
        if (channel.type === 'Social Media') {
          baseInfo = `Social Media: ${channel.platform}, ${channel.adName}, ${channel.cost} AED, ${channel.adType}`;
        } else if (channel.type === 'TV') {
          baseInfo = `TV: ${channel.network || ''}, ${channel.adName}, ${channel.cost} AED`;
        } else if (channel.type === 'Print Media') {
          baseInfo = `Print Media: ${channel.publication}, ${channel.adName}, ${channel.cost} AED`;
        } else if (channel.type === 'Radio') {
          baseInfo = `Radio: ${channel.station || ''}, ${channel.adName}, ${channel.cost} AED`;
        } else {
          baseInfo = `${channel.type}: ${channel.adName}, ${channel.cost} AED`;
        }
        
        // Add impressions if available
        if (channel.impressions) {
          baseInfo += `, ${channel.impressions.toLocaleString()} impressions`;
        }
        
        // Add tag number if available
        if (channel.tagNumber) {
          baseInfo += `, Tag: ${channel.tagNumber}`;
        }
        
        return baseInfo;
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

// GET: Search campaigns by tag number
app.get('/api/campaigns/tag/:tagNumber', async (req, res) => {
  const tagNumber = req.params.tagNumber;
  console.log(`Searching for campaigns with tag number: ${tagNumber}`);
  try {
    const campaigns = db.collection('jobcollection');
    const matchingCampaigns = await campaigns.find({
      'channels.tagNumber': tagNumber
    }).toArray();
    
    console.log(`Found ${matchingCampaigns.length} campaigns with tag ${tagNumber}`);
    
    if (matchingCampaigns.length === 0) {
      return res.status(404).json({ error: 'No campaigns found with this tag number' });
    }
    
    res.json({
      tagNumber: tagNumber,
      campaigns: matchingCampaigns,
      count: matchingCampaigns.length
    });
  } catch (err) {
    console.error('Error searching campaigns by tag:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET: Query campaigns by campaignId
app.get('/api/campaigns/:campaignId', async (req, res) => {
  console.log(`Received GET request for campaignId: ${req.params.campaignId}`);
  try {
    const campaignId = req.params.campaignId;
    const campaigns = db.collection('jobcollection');
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

// DELETE: Delete campaign by MongoDB _id
app.delete('/api/campaigns/:campaignId', async (req, res) => {
  console.log(`Received DELETE request for campaignId: ${req.params.campaignId}`);
  try {
    const campaignId = req.params.campaignId;
    const campaigns = db.collection('jobcollection');
    
    // Delete the campaign by MongoDB _id
    const result = await campaigns.deleteOne({ _id: new ObjectId(campaignId) });
    
    if (result.deletedCount === 1) {
      console.log(`Campaign deleted successfully: ${campaignId}`);
      res.status(200).json({ message: 'Campaign deleted successfully' });
    } else {
      console.log(`Campaign not found for deletion: ${campaignId}`);
      res.status(404).json({ error: 'Campaign not found' });
    }
  } catch (err) {
    console.error('Error deleting campaign:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT: Update impressions for a specific tag number
app.put('/api/campaigns/impressions/:tagNumber', async (req, res) => {
  const tagNumber = req.params.tagNumber;
  const { impressions } = req.body;
  
  console.log(`Updating impressions for tag ${tagNumber} to ${impressions}`);
  
  try {
    const campaigns = db.collection('jobcollection');
    
    // Validate impressions is a number
    if (typeof impressions !== 'number' || impressions < 0) {
      return res.status(400).json({ error: 'Impressions must be a positive number' });
    }
    
    // Find the campaign that contains this tag number and update the impressions
    const result = await campaigns.updateOne(
      { 'channels.tagNumber': tagNumber },
      { $set: { 'channels.$.impressions': impressions } }
    );
    
    console.log(`Update result: matched=${result.matchedCount}, modified=${result.modifiedCount}`);
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'No campaign found with this tag number' });
    }
    
    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: 'Channel not found or no changes made' });
    }
    
    res.json({ 
      message: 'Impressions updated successfully',
      tagNumber: tagNumber,
      impressions: impressions
    });
  } catch (err) {
    console.error('Error updating impressions:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT: Update impressions for a specific platform in a campaign (fallback for channel index)
app.put('/api/campaigns/:campaignId/channels/:channelIndex/impressions', async (req, res) => {
  const campaignId = req.params.campaignId;
  const channelIndex = parseInt(req.params.channelIndex);
  const { impressions } = req.body;
  
  console.log(`Updating impressions for campaign ${campaignId}, channel ${channelIndex} to ${impressions}`);
  
  try {
    const campaigns = db.collection('jobcollection');
    
    // Validate impressions is a number
    if (typeof impressions !== 'number' || impressions < 0) {
      return res.status(400).json({ error: 'Impressions must be a positive number' });
    }
    
    // Update the specific channel's impressions
    const result = await campaigns.updateOne(
      { campaignId },
      { $set: { [`channels.${channelIndex}.impressions`]: impressions } }
    );
    
    console.log(`Update result: matched=${result.matchedCount}, modified=${result.modifiedCount}`);
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: 'Channel not found or no changes made' });
    }
    
    res.json({ 
      message: 'Impressions updated successfully',
      impressions: impressions
    });
  } catch (err) {
    console.error('Error updating impressions:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET: Get all unique tag numbers
app.get('/api/tags', async (req, res) => {
  try {
    const campaigns = db.collection('jobcollection');
    const allCampaigns = await campaigns.find({}).toArray();
    
    const tags = new Set();
    allCampaigns.forEach(campaign => {
      if (campaign.channels && Array.isArray(campaign.channels)) {
        campaign.channels.forEach(channel => {
          if (channel.tagNumber) {
            tags.add(channel.tagNumber);
          }
        });
      }
    });
    
    res.json({
      tags: Array.from(tags).sort(),
      count: tags.size
    });
  } catch (err) {
    console.error('Error getting tags:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET: Get tag counters (for admin purposes)
app.get('/api/tags/counters', async (req, res) => {
  try {
    const tagCounters = db.collection('tagCounters');
    const counters = await tagCounters.find({}).toArray();
    
    // Function to get platform name from prefix
    function getPlatformName(prefix) {
      const platformMap = {
        'IG': 'Instagram',
        'FB': 'Facebook', 
        'TT': 'TikTok',
        'GG': 'Google',
        'WA': 'Whatsup group',
        'OS': 'Other Social',
        'PM': 'Print Media',
        'TV': 'TV',
        'RD': 'Radio',
        'EM': 'Email',
        'MSG': 'Message',
        'OE': 'Outdoor Events',
        'PI': 'Promotional Items',
        'PO': 'Promotional Offer',
        'OT': 'Other'
      };
      return platformMap[prefix] || prefix;
    }

    // Format counters for display
    const formattedCounters = counters.map(counter => ({
      prefix: counter.prefix,
      platformName: getPlatformName(counter.prefix),
      lastNumber: counter.lastNumber,
      nextTag: `${counter.prefix}${String(counter.lastNumber + 1).padStart(4, '0')}`
    }));
    
    res.json({
      counters: formattedCounters,
      count: counters.length
    });
  } catch (err) {
    console.error('Error getting tag counters:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST: Generate unique tag number (using last saved counter)
app.post('/api/tags/generate', async (req, res) => {
  const { channelType, platform } = req.body;
  
  console.log('Tag generation request:', { channelType, platform });
  console.log('Platform type:', typeof platform);
  console.log('Platform length:', platform ? platform.length : 'null');
  console.log('Platform exact match with Whatsup group:', platform === 'Whatsup group');
  
  try {
    // Determine prefix based on channel type and platform
    let prefix = '';
    if (channelType === 'Social Media') {
      if (platform === 'Instagram') prefix = 'IG';
      else if (platform === 'Facebook') prefix = 'FB';
      else if (platform === 'TikTok') prefix = 'TT';
      else if (platform === 'Google') prefix = 'GG';
      else if (platform === 'Whatsup group' || platform?.trim() === 'Whatsup group' || platform?.includes('Whatsup')) prefix = 'WA';
      else if (platform === 'Other') prefix = 'OS';
      else {
        // If no platform selected, return error
        console.log('Unknown platform for Social Media:', platform);
        return res.status(400).json({ error: 'Please select a platform for Social Media' });
      }
    } else if (channelType === 'Print Media') {
      prefix = 'PM';
    } else if (channelType === 'TV') {
      prefix = 'TV';
    } else if (channelType === 'Radio') {
      prefix = 'RD';
    } else if (channelType === 'Email') {
      prefix = 'EM';
    } else if (channelType === 'Message') {
      prefix = 'MSG';
    } else if (channelType === 'Outdoor Events') {
      prefix = 'OE';
    } else if (channelType === 'Promotional Items') {
      prefix = 'PI';
    } else if (channelType === 'Promotional Offer') {
      prefix = 'PO';
    } else if (channelType === 'Other') {
      prefix = 'OT';
    } else {
      // If no channel type selected, return error
      return res.status(400).json({ error: 'Please select a channel type' });
    }
    
    const tagCounters = db.collection('tagCounters');
    
    // Get current counter (represents last saved tag number)
    let counter = await tagCounters.findOne({ prefix: prefix });
    
    if (!counter) {
      // If counter doesn't exist, create it with lastNumber: 0
      await tagCounters.insertOne({ prefix: prefix, lastNumber: 0 });
      counter = { prefix: prefix, lastNumber: 0 };
    }
    
    // Generate next tag number (last saved + 1)
    const nextNumber = counter.lastNumber + 1;
    const newTagNumber = `${prefix}${String(nextNumber).padStart(4, '0')}`;
    
    // Check if this tag number already exists in any campaign
    const campaigns = db.collection('jobcollection');
    const existingTag = await campaigns.findOne({
      'channels.tagNumber': newTagNumber
    });
    
    if (existingTag) {
      // If tag exists, increment counter and try again
      const incrementedNumber = nextNumber + 1;
      const incrementedTagNumber = `${prefix}${String(incrementedNumber).padStart(4, '0')}`;
      
      console.log(`Tag ${newTagNumber} already exists, generating ${incrementedTagNumber} instead`);
      
      // Update counter to the incremented number
      await tagCounters.updateOne(
        { prefix: prefix },
        { $set: { lastNumber: incrementedNumber } },
        { upsert: true }
      );
      
      res.json({
        tagNumber: incrementedTagNumber,
        prefix: prefix,
        counter: incrementedNumber,
        shouldIncrement: true
      });
    } else {
      // Immediately increment the counter to prevent duplicate tags
      await tagCounters.updateOne(
        { prefix: prefix },
        { $set: { lastNumber: nextNumber } },
        { upsert: true }
      );
      
      console.log(`Generated unique tag: ${newTagNumber} for ${channelType}${platform ? ' - ' + platform : ''}`);
      
      res.json({
        tagNumber: newTagNumber,
        prefix: prefix,
        counter: nextNumber,
        shouldIncrement: true
      });
    }
  } catch (err) {
    console.error('Error generating tag:', err);
    res.status(500).json({ error: 'Server error' });
  }
});



// GET: Get impression statistics for all campaigns
app.get('/api/impressions/stats', async (req, res) => {
  try {
    console.log('Impression stats endpoint called'); // Debug log
    const campaigns = db.collection('jobcollection');
    const allCampaigns = await campaigns.find({}).toArray();
    console.log('Found campaigns:', allCampaigns.length); // Debug log
    
    const stats = {
      totalImpressions: 0,
      impressionsByChannel: {},
      impressionsByPlatform: {},
      topPerformingChannels: [],
      campaignsWithImpressions: 0
    };
    
    allCampaigns.forEach(campaign => {
      let campaignHasImpressions = false;
      console.log('Processing campaign:', campaign.campaignId, 'with channels:', campaign.channels?.length || 0); // Debug log
      console.log('Campaign raw data:', JSON.stringify(campaign, null, 2)); // Full campaign data
      
      if (campaign.channels && Array.isArray(campaign.channels)) {
        campaign.channels.forEach(channel => {
          const impressions = channel.impressions || 0;
          console.log('Channel:', channel.type, 'Platform:', channel.platform, 'Impressions:', impressions); // Debug log
          console.log('Channel raw data:', JSON.stringify(channel, null, 2)); // Full channel data
          
          if (impressions > 0) {
            campaignHasImpressions = true;
            stats.totalImpressions += impressions;
            
            // Track by channel type
            if (!stats.impressionsByChannel[channel.type]) {
              stats.impressionsByChannel[channel.type] = 0;
            }
            stats.impressionsByChannel[channel.type] += impressions;
            
            // Track by platform (for Social Media)
            if (channel.type === 'Social Media' && channel.platform) {
              if (!stats.impressionsByPlatform[channel.platform]) {
                stats.impressionsByPlatform[channel.platform] = 0;
              }
              stats.impressionsByPlatform[channel.platform] += impressions;
            }
            
            // Track top performing channels
            stats.topPerformingChannels.push({
              campaignId: campaign.campaignId,
              campaignName: campaign.name,
              channelType: channel.type,
              platform: channel.platform || 'N/A',
              adName: channel.adName,
              impressions: impressions
            });
          }
        });
      }
      
      if (campaignHasImpressions) {
        stats.campaignsWithImpressions++;
      }
    });
    
    // Sort top performing channels by impressions
    stats.topPerformingChannels.sort((a, b) => b.impressions - a.impressions);
    stats.topPerformingChannels = stats.topPerformingChannels.slice(0, 10); // Top 10
    
    console.log('Final stats being sent:', stats); // Debug log
    res.json(stats);
  } catch (err) {
    console.error('Error getting impression stats:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Static file serving should come after API routes
app.use(express.static('.'));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static('uploads'));

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
      db = client.db('job_db');
      const jobs = db.collection('jobcollection');
      await jobs.createIndex({ campaignId: 1 }, { unique: true });
      console.log('Unique index on campaignId created');
      const tagCounters = db.collection('tagCounters');
      await tagCounters.createIndex({ prefix: 1 }, { unique: true });
      console.log('Unique index on tagCounters created');
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

// Generate Marketing ID using a persistent counter (5-digit format: MAK_00001, MAK_00002, etc.)
async function getNextCampaignId() {
  try {
    const counters = db.collection('counters');
    console.log('Getting next marketing ID from persistent counter...');
    
    // Atomically increment the counter and get the new value
    const result = await counters.findOneAndUpdate(
      { _id: 'campaignId' },
      { $inc: { lastNumber: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    
    console.log('findOneAndUpdate result:', JSON.stringify(result, null, 2));
    
    // Handle different MongoDB driver versions
    let nextId;
    if (result && result.value) {
      nextId = result.value.lastNumber;
      console.log('Using result.value.lastNumber:', nextId);
    } else if (result && result.lastNumber) {
      nextId = result.lastNumber;
      console.log('Using result.lastNumber:', nextId);
    } else {
      // Fallback: get the current value
      console.log('Using fallback method...');
      const currentDoc = await counters.findOne({ _id: 'campaignId' });
      nextId = currentDoc ? currentDoc.lastNumber : 1;
      console.log('Fallback nextId:', nextId);
    }
    
    const campaignId = `MAK_${nextId.toString().padStart(5, '0')}`;
    console.log(`Generated marketing ID: ${campaignId} (5-digit format)`);
    return campaignId;
  } catch (err) {
    console.error('Error generating persistent campaignId:', err);
    throw err;
  }
}

// Initialize database and start server
async function startServer() {
  try {
    await setupDatabase();
    app.locals.db = db;

    // Start server after DB connection
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