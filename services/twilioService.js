const twilio = require('twilio');

class TwilioService {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.whatsappNumber = null;
    // Don't initialize immediately, wait for explicit call
  }

  initialize() {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

      console.log('🔍 Twilio initialization debug:');
      console.log('Account SID:', accountSid ? '✅ Set' : '❌ Missing');
      console.log('Auth Token:', authToken ? '✅ Set' : '❌ Missing');
      console.log('WhatsApp Number:', whatsappNumber ? '✅ Set' : '❌ Missing');

      if (!accountSid || !authToken || !whatsappNumber) {
        console.warn('Twilio credentials not found. WhatsApp notifications will be disabled.');
        return;
      }

      this.client = twilio(accountSid, authToken);
      this.whatsappNumber = whatsappNumber;
      this.isInitialized = true;
      console.log('✅ Twilio service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Twilio service:', error);
    }
  }

  async sendJobAssignmentNotification(jobData, employeePhone) {
    if (!this.isInitialized || !employeePhone) {
      console.log('Twilio not initialized or no phone number provided');
      return null;
    }

    try {
      const message = `🎯 *New Job Assigned*\n\n` +
        `*Job ID:* ${jobData.campaignId || jobData.jobId}\n` +
        `*Title:* ${jobData.jobTitle}\n` +
        `*Description:* ${jobData.jobDescription}\n` +
        `*Priority:* ${jobData.priority || 'Normal'}\n` +
        `*Start Date:* ${jobData.plannedStartDate}\n` +
        `*End Date:* ${jobData.plannedEndDate}\n` +
        `*Assigned To:* ${jobData.jobAssignedTo}\n\n` +
        `Please check the system for more details. Good luck! 🚀`;

      const result = await this.client.messages.create({
        from: this.whatsappNumber,
        to: `whatsapp:${employeePhone}`,
        body: message
      });

      console.log('Job assignment notification sent:', result.sid);
      return result.sid;
    } catch (error) {
      console.error('Failed to send job assignment notification:', error);
      throw error;
    }
  }

  async sendJobUpdateNotification(jobData, employeePhone, updateType = 'details') {
    if (!this.isInitialized || !employeePhone) {
      console.log('Twilio not initialized or no phone number provided');
      return null;
    }

    try {
      let message = '';
      
      if (updateType === 'details') {
        message = `📝 *Job Details Updated*\n\n` +
          `*Job ID:* ${jobData.campaignId || jobData.jobId}\n` +
          `*Title:* ${jobData.jobTitle}\n` +
          `*Updated By:* System\n` +
          `*Update Time:* ${new Date().toLocaleString()}\n\n` +
          `Please check the system for the latest updates.`;
      } else if (updateType === 'status') {
        message = `🔄 *Job Status Updated*\n\n` +
          `*Job ID:* ${jobData.campaignId || jobData.jobId}\n` +
          `*Title:* ${jobData.jobTitle}\n` +
          `*New Status:* ${jobData.status}\n` +
          `*Updated By:* System\n` +
          `*Update Time:* ${new Date().toLocaleString()}\n\n` +
          `Please check the system for more details.`;
      } else if (updateType === 'priority') {
        message = `⚡ *Job Priority Updated*\n\n` +
          `*Job ID:* ${jobData.campaignId || jobData.jobId}\n` +
          `*Title:* ${jobData.jobTitle}\n` +
          `*New Priority:* ${jobData.priority}\n` +
          `*Updated By:* System\n` +
          `*Update Time:* ${new Date().toLocaleString()}\n\n` +
          `Please check the system for more details.`;
      }

      const result = await this.client.messages.create({
        from: this.whatsappNumber,
        to: `whatsapp:${employeePhone}`,
        body: message
      });

      console.log('Job update notification sent:', result.sid);
      return result.sid;
    } catch (error) {
      console.error('Failed to send job update notification:', error);
      throw error;
    }
  }

  async sendJobCompletionNotification(jobData, employeePhone) {
    if (!this.isInitialized || !employeePhone) {
      console.log('Twilio not initialized or no phone number provided');
      return null;
    }

    try {
      const message = `✅ *Job Completed*\n\n` +
        `*Job ID:* ${jobData.campaignId || jobData.jobId}\n` +
        `*Title:* ${jobData.jobTitle}\n` +
        `*Completed By:* ${jobData.jobAssignedTo}\n` +
        `*Completion Date:* ${new Date().toLocaleString()}\n` +
        `*Duration:* ${this.calculateDuration(jobData.plannedStartDate, new Date())}\n\n` +
        `Great work! 🎉`;

      const result = await this.client.messages.create({
        from: this.whatsappNumber,
        to: `whatsapp:${employeePhone}`,
        body: message
      });

      console.log('Job completion notification sent:', result.sid);
      return result.sid;
    } catch (error) {
      console.error('Failed to send job completion notification:', error);
      throw error;
    }
  }

  calculateDuration(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  }

  async sendTestMessage(phoneNumber) {
    if (!this.isInitialized) {
      throw new Error('Twilio service not initialized');
    }

    try {
      console.log('🔍 Debug: Sending test message...');
      console.log('From:', this.whatsappNumber);
      console.log('To:', `whatsapp:${phoneNumber}`);
      
      // Validate phone number format
      if (!phoneNumber.startsWith('+')) {
        throw new Error('Phone number must start with + (country code)');
      }
      
      // Check if it's a valid phone number format
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      if (!phoneRegex.test(phoneNumber)) {
        throw new Error('Invalid phone number format. Use format: +1234567890');
      }
      
      const message = `🧪 *Test Message*\n\n` +
        `This is a test message from your Job Management System.\n` +
        `If you received this, WhatsApp notifications are working correctly! ✅\n\n` +
        `Time: ${new Date().toLocaleString()}`;

      console.log('📤 Attempting to send message...');
      const result = await this.client.messages.create({
        from: this.whatsappNumber,
        to: `whatsapp:${phoneNumber}`,
        body: message
      });

      console.log('✅ Test message sent successfully:', result.sid);
      console.log('Message Status:', result.status);
      console.log('Message Direction:', result.direction);
      return result.sid;
    } catch (error) {
      console.error('❌ Failed to send test message:');
      console.error('Error Code:', error.code);
      console.error('Error Message:', error.message);
      console.error('More Info:', error.moreInfo);
      console.error('Status:', error.status);
      console.error('Phone Number:', phoneNumber);
      console.error('WhatsApp Number:', this.whatsappNumber);
      
      // Provide specific error messages for common issues
      if (error.code === 21211) {
        throw new Error('Invalid phone number format. Please check the number and try again.');
      } else if (error.code === 21214) {
        throw new Error('Phone number is not a valid WhatsApp number. Make sure the number is registered with WhatsApp.');
      } else if (error.code === 63007) {
        throw new Error('WhatsApp Business API is not set up properly. Check your Twilio console configuration.');
      } else if (error.code === 63016) {
        throw new Error('Message content is not allowed. Check Twilio content policies.');
      } else if (error.code === 63017) {
        throw new Error('WhatsApp number is not verified. Complete the verification process in Twilio console.');
      }
      
      throw error;
    }
  }
}

module.exports = new TwilioService();
