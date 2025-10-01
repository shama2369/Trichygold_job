# WhatsApp Integration Setup Guide

## Prerequisites
1. Twilio Account (https://www.twilio.com/)
2. WhatsApp Business API access through Twilio

## Environment Variables
Add these variables to your `.env` file:

```env
# Twilio WhatsApp Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890
```

## Setup Steps

### 1. Get Twilio Credentials
1. Go to https://console.twilio.com/
2. Copy your Account SID and Auth Token
3. Add them to your `.env` file

### 2. Get WhatsApp Number
1. Go to https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
2. Follow the setup process to get your WhatsApp number
3. The number should be in format: `whatsapp:+1234567890`

### 3. Test the Integration
Use the test endpoint to verify WhatsApp notifications work:

```bash
curl -X POST http://localhost:3000/api/test-whatsapp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"phoneNumber": "+1234567890"}'
```

## Features

### Automatic Notifications
- **Job Assignment**: When a new job is assigned to an employee
- **Job Updates**: When job details are updated
- **Job Completion**: When a job status is changed to completed

### Message Types
1. **Job Assignment**: Includes job ID, title, description, priority, dates, and assigned employee
2. **Job Updates**: Notifies when details, status, or priority changes
3. **Job Completion**: Celebrates job completion with duration calculation

### Employee Phone Numbers
- Phone numbers are stored in the `employees` collection
- Field: `whatsapp` (e.g., "+1234567890")
- Only active employees receive notifications

## Error Handling
- If Twilio credentials are missing, notifications are disabled (no errors)
- If employee phone number is missing, notification is skipped
- If notification fails, job operations continue normally
- All errors are logged to console

## Testing
1. Add a test employee with WhatsApp number
2. Create a job and assign it to the employee
3. Check your WhatsApp for the notification
4. Update the job details to test update notifications
