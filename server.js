const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const excel = require('exceljs');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

dotenv.config();

// Import Twilio service after dotenv.config()
const twilioService = require('./services/twilioService');

const app = express();
const port = process.env.PORT || 3000;
const uri = process.env.MONGO_URI;

let db;

// Helper function to get employee phone number
async function getEmployeePhoneNumber(employeeIdentifier, db) {
  try {
    // Try to find by name first (legacy support)
    let employee = await db.collection('employees').findOne({ 
      name: employeeIdentifier,
      status: 'active'
    });
    
    // If not found by name, try by employeeId
    if (!employee) {
      employee = await db.collection('employees').findOne({ 
        employeeId: employeeIdentifier,
        status: 'active'
      });
    }
    
    // If still not found, try by _id (MongoDB ObjectId)
    if (!employee && employeeIdentifier.match(/^[0-9a-fA-F]{24}$/)) {
      const { ObjectId } = require('mongodb');
      employee = await db.collection('employees').findOne({ 
        _id: new ObjectId(employeeIdentifier),
        status: 'active'
      });
    }
    
    if (employee) {
      console.log(`📱 Found employee: ${employee.name} (${employee.whatsapp})`);
      return employee.whatsapp;
    } else {
      console.log(`❌ Employee not found: ${employeeIdentifier}`);
      return null;
    }
  } catch (error) {
    console.error('Error fetching employee phone:', error);
    return null;
  }
}

// Authentication middleware
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = Buffer.from(token, 'base64').toString();
    const [userId] = decoded.split(':');

    if (!userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Add user ID to request for use in route handlers
    req.user = { userId: userId };
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

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
app.post('/api/jobs', verifyToken, async (req, res) => {
  try {
    // Get job data from form (already parsed by bodyParser)
    const jobData = req.body.jobData;
    if (!jobData) {
      return res.status(400).json({ error: 'No job data provided' });
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
app.put('/api/campaigns/:campaignId', verifyToken, async (req, res) => {
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

    // Send WhatsApp notification if job details are updated and assigned to employees
    const employeesToNotify = [];
    
    // Check for single employee assignment (legacy)
    if (campaignData.jobAssignedTo) {
      employeesToNotify.push(campaignData.jobAssignedTo);
    }
    
    // Check for multiple employee assignments (new system)
    if (campaignData.assignedEmployees && Array.isArray(campaignData.assignedEmployees)) {
      campaignData.assignedEmployees.forEach(emp => {
        if (emp.employeeName && !employeesToNotify.includes(emp.employeeName)) {
          employeesToNotify.push(emp.employeeName);
        }
      });
    }
    
    console.log('📱 Employees to notify for update:', employeesToNotify);
    
    // Send notifications to all assigned employees
    for (const employeeName of employeesToNotify) {
      try {
        const employeePhone = await getEmployeePhoneNumber(employeeName, db);
        if (employeePhone) {
          await twilioService.sendJobUpdateNotification(campaignData, employeePhone, 'details');
          console.log(`✅ WhatsApp update notification sent to ${employeeName} (${employeePhone})`);
        } else {
          console.log(`❌ No WhatsApp number found for employee: ${employeeName}`);
        }
      } catch (notificationError) {
        console.error(`❌ Failed to send WhatsApp update notification to ${employeeName}:`, notificationError);
        // Don't fail the job update if notification fails
      }
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

// GET: Retrieve all jobs
app.get('/api/jobs', verifyToken, async (req, res) => {
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
app.get('/api/campaigns', verifyToken, async (req, res) => {
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
app.post('/api/campaigns', verifyToken, async (req, res) => {
  try {
    // Get job data from form (already parsed by bodyParser)
    const jobData = req.body.campaignData || req.body.jobData;
    if (!jobData) {
      return res.status(400).json({ error: 'No job data provided' });
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
    
    // Send WhatsApp notification if job is assigned to employees
    const employeesToNotify = [];
    
    // Check for single employee assignment (legacy)
    if (jobData.jobAssignedTo) {
      employeesToNotify.push(jobData.jobAssignedTo);
    }
    
    // Check for multiple employee assignments (new system)
    if (jobData.assignedEmployees && Array.isArray(jobData.assignedEmployees)) {
      jobData.assignedEmployees.forEach(emp => {
        if (emp.employeeName && !employeesToNotify.includes(emp.employeeName)) {
          employeesToNotify.push(emp.employeeName);
        }
      });
    }
    
    console.log('📱 Employees to notify:', employeesToNotify);
    
    // Send notifications to all assigned employees
    for (const employeeName of employeesToNotify) {
      try {
        const employeePhone = await getEmployeePhoneNumber(employeeName, db);
        if (employeePhone) {
          await twilioService.sendJobAssignmentNotification(jobData, employeePhone);
          console.log(`✅ WhatsApp notification sent to ${employeeName} (${employeePhone})`);
        } else {
          console.log(`❌ No WhatsApp number found for employee: ${employeeName}`);
        }
      } catch (notificationError) {
        console.error(`❌ Failed to send WhatsApp notification to ${employeeName}:`, notificationError);
        // Don't fail the job creation if notification fails
      }
    }
    
    res.status(200).json({ message: 'Job saved successfully', campaignId: jobData.campaignId });
  } catch (err) {
    console.error('Error saving job:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET: Export all campaigns to Excel
// GET: Find campaigns by tag number (for debugging)
app.get('/api/campaigns/tag/:tagNumber', verifyToken, async (req, res) => {
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
app.get('/api/campaigns/:campaignId/export', verifyToken, async (req, res) => {
  const campaignId = req.params.campaignId;
  try {
    const campaigns = db.collection('jobcollection');
    const campaign = await campaigns.findOne({ campaignId });
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Jobs');
    worksheet.columns = [
      { header: 'Job ID', key: 'campaignId', width: 15 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Entry Date', key: 'entryDate', width: 15 },
      { header: 'Planned Start Date', key: 'plannedStartDate', width: 15 },
      { header: 'Actual Start Date', key: 'actualStartDate', width: 15 },
      { header: 'End Date', key: 'endDate', width: 15 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Job Assigned To', key: 'jobAssignedTo', width: 15 },
    ];


    worksheet.addRow({
      campaignId: campaign.campaignId,
      name: campaign.name,
      description: campaign.description,
      entryDate: campaign.entryDate,
      plannedStartDate: campaign.plannedStartDate,
      actualStartDate: campaign.actualStartDate,
      endDate: campaign.endDate,
      status: campaign.status,
      jobAssignedTo: campaign.jobAssignedTo,
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=job_${campaignId}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error exporting campaign:', err);
    res.status(500).json({ error: 'Server error during export' });
  }
});

app.get('/api/campaigns/export', verifyToken, async (req, res) => {
  console.log('Received GET request for Excel export (/api/campaigns/export)');
  try {
    const campaigns = db.collection('jobcollection');
    const data = await campaigns.find().toArray();
    
    if (data.length === 0) {
        console.log('No campaigns found for export.');
        return res.status(404).json({ error: 'No campaigns found to export' });
    }

    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Jobs');
    
    worksheet.columns = [
      { header: 'Job ID', key: 'campaignId', width: 15 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Entry Date', key: 'entryDate', width: 15 },
      { header: 'Planned Start Date', key: 'plannedStartDate', width: 15 },
      { header: 'Actual Start Date', key: 'actualStartDate', width: 15 },
      { header: 'End Date', key: 'endDate', width: 15 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Job Assigned To', key: 'jobAssignedTo', width: 15 },
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
        entryDate: campaign.entryDate,
        plannedStartDate: campaign.plannedStartDate,
        actualStartDate: campaign.actualStartDate,
        endDate: campaign.endDate,
        status: campaign.status,
        jobAssignedTo: campaign.jobAssignedTo,
      });
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=jobs.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error exporting campaigns:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET: Search campaigns by tag number
app.get('/api/campaigns/tag/:tagNumber', verifyToken, async (req, res) => {
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
app.get('/api/campaigns/:campaignId', verifyToken, async (req, res) => {
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
app.delete('/api/campaigns/:campaignId', verifyToken, async (req, res) => {
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








// Performance Rating API Endpoint
app.put('/api/jobs/:jobId/rating', verifyToken, async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const { performanceRating } = req.body;
    
    if (!performanceRating || !performanceRating.rating) {
      return res.status(400).json({ error: 'Performance rating data is required' });
    }
    
    const validRatings = ['excellent', 'good', 'average', 'bad'];
    if (!validRatings.includes(performanceRating.rating)) {
      return res.status(400).json({ error: 'Invalid rating. Must be excellent, good, average, or bad' });
    }
    
    const jobs = db.collection('jobcollection');
    const result = await jobs.updateOne(
      { _id: new ObjectId(jobId) },
      { 
        $set: { 
          performanceRating: {
            ...performanceRating,
            ratedAt: new Date().toISOString()
          }
        }
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    res.status(200).json({ message: 'Performance rating updated successfully' });
  } catch (err) {
    console.error('Error updating performance rating:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Badge Awarding API Endpoint
app.put('/api/jobs/:jobId/badge', verifyToken, async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const { appreciationBadges } = req.body;
    
    if (!appreciationBadges || !Array.isArray(appreciationBadges) || appreciationBadges.length === 0) {
      return res.status(400).json({ error: 'Badge data is required' });
    }
    
    const validBadges = ['on_time_completion', 'fast_delivery', 'innovation', 'problem_solver', 'team_player'];
    for (const badge of appreciationBadges) {
      if (!validBadges.includes(badge.badgeType)) {
        return res.status(400).json({ error: `Invalid badge type: ${badge.badgeType}` });
      }
    }
    
    const jobs = db.collection('jobcollection');
    
    // Add badges to existing badges array
    const badgesToAdd = appreciationBadges.map(badge => ({
      ...badge,
      awardedAt: new Date().toISOString()
    }));
    
    const result = await jobs.updateOne(
      { _id: new ObjectId(jobId) },
      { 
        $push: { 
          appreciationBadges: { $each: badgesToAdd }
        }
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    res.status(200).json({ message: 'Badge awarded successfully' });
  } catch (err) {
    console.error('Error awarding badge:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Performance Analytics API Endpoint
app.get('/api/performance/analytics', verifyToken, async (req, res) => {
  try {
    const jobs = db.collection('jobcollection');
    const allJobs = await jobs.find({}).toArray();
    
    // Calculate performance metrics
    const completedJobs = allJobs.filter(job => job.status === 'Completed');
    const onTimeJobs = completedJobs.filter(job => {
      if (!job.endDate || !job.plannedStartDate) return false;
      const endDate = new Date(job.endDate);
      const plannedEnd = new Date(job.plannedStartDate);
      return endDate <= plannedEnd;
    });
    
    const ratingCounts = {
      excellent: 0,
      good: 0,
      average: 0,
      bad: 0
    };
    
    const badgeCounts = {
      on_time_completion: 0,
      fast_delivery: 0,
      innovation: 0,
      problem_solver: 0,
      team_player: 0
    };
    
    completedJobs.forEach(job => {
      if (job.performanceRating && job.performanceRating.rating) {
        ratingCounts[job.performanceRating.rating]++;
      }
      
      if (job.appreciationBadges) {
        job.appreciationBadges.forEach(badge => {
          badgeCounts[badge.badgeType]++;
            });
          }
        });
    
    const analytics = {
      totalJobs: allJobs.length,
      completedJobs: completedJobs.length,
      onTimeJobs: onTimeJobs.length,
      onTimeRate: completedJobs.length > 0 ? (onTimeJobs.length / completedJobs.length * 100).toFixed(1) : 0,
      ratingCounts,
      badgeCounts,
      totalBadges: Object.values(badgeCounts).reduce((sum, count) => sum + count, 0)
    };
    
    res.status(200).json(analytics);
  } catch (err) {
    console.error('Error getting performance analytics:', err);
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

// Employee Management API Endpoints
app.get('/api/employees', verifyToken, async (req, res) => {
  try {
    const employees = req.app.locals.db.collection('employees');
    const allEmployees = await employees.find({}).toArray();
    res.status(200).json(allEmployees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.get('/api/employees/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const employees = req.app.locals.db.collection('employees');
    const employee = await employees.findOne({ _id: new ObjectId(id) });
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    
    res.status(200).json(employee);
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.post('/api/employees', verifyToken, async (req, res) => {
  try {
    const { name, whatsapp, department, position, status } = req.body;
    
    if (!name || !whatsapp) {
      return res.status(400).json({ error: 'Name and WhatsApp are required.' });
    }
    
    const employees = req.app.locals.db.collection('employees');
    const newEmployee = {
      name,
      whatsapp,
      department: department || '',
      position: position || '',
      status: status || 'active',
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const result = await employees.insertOne(newEmployee);
    res.status(201).json({ message: 'Employee created successfully.', id: result.insertedId });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.put('/api/employees/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, whatsapp, department, position, status } = req.body;
    
    const employees = req.app.locals.db.collection('employees');
    const updateData = {
      updated_at: new Date()
    };
    
    if (name) updateData.name = name;
    if (whatsapp) updateData.whatsapp = whatsapp;
    if (department !== undefined) updateData.department = department;
    if (position !== undefined) updateData.position = position;
    if (status) updateData.status = status;
    
    const result = await employees.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    
    res.status(200).json({ message: 'Employee updated successfully.' });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.delete('/api/employees/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const employees = req.app.locals.db.collection('employees');
    const result = await employees.deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    
    res.status(200).json({ message: 'Employee deleted successfully.' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Test WhatsApp notification endpoint
app.post('/api/test-whatsapp', verifyToken, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    // Ensure Twilio service is initialized
    if (!twilioService.isInitialized) {
      console.log('Twilio service not initialized, attempting to initialize...');
      twilioService.initialize();
    }
    
    if (!twilioService.isInitialized) {
      return res.status(500).json({ 
        error: 'Twilio service not available. Please check your credentials in .env file.' 
      });
    }
    
    const messageId = await twilioService.sendTestMessage(phoneNumber);
    res.status(200).json({ 
      message: 'Test message sent successfully', 
      messageId 
    });
  } catch (error) {
    console.error('Error sending test message:', error);
    res.status(500).json({ error: 'Failed to send test message: ' + error.message });
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
      const counters = db.collection('counters');
      // No need to create index on _id as it's automatically unique
      console.log('Counters collection ready');
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

// Generate Job ID using a persistent counter (5-digit format: JOB_00001, JOB_00002, etc.)
async function getNextCampaignId() {
  try {
    const counters = db.collection('counters');
    console.log('Getting next job ID from persistent counter...');
    
    // Atomically increment the counter and get the new value
    const result = await counters.findOneAndUpdate(
      { _id: 'JobId' },
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
      const currentDoc = await counters.findOne({ _id: 'JobId' });
      nextId = currentDoc ? currentDoc.lastNumber : 1;
      console.log('Fallback nextId:', nextId);
    }
    
    const campaignId = `JOB_${nextId.toString().padStart(5, '0')}`;
    console.log(`Generated job ID: ${campaignId} (5-digit format)`);
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

    // Initialize Twilio service after database setup
    console.log('Initializing Twilio service...');
    twilioService.initialize();

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


// Delete Job API Endpoint
app.delete('/api/jobs/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const jobsCollection = req.app.locals.db.collection('jobcollection');
    const result = await jobsCollection.deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Job not found.' });
    }
    
    res.status(200).json({ message: 'Job deleted successfully.' });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

startServer();