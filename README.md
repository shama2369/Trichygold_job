# Trichy Gold Job Management System

A comprehensive job management system built for managing work assignments, employee tracking, and performance monitoring.

## 🚀 Features

### Job Management
- ✅ Create, edit, and delete jobs
- ✅ Assign multiple employees to jobs
- ✅ Track job progress with detailed updates
- ✅ File attachments support
- ✅ Priority management (High/Normal)
- ✅ Status tracking (Active, Planned, Suggested, Completed, Cancelled)
- ✅ Multiple date tracking (Entry, Planned Start, Actual Start, End)

### Employee Management
- ✅ Add, edit, and delete employees
- ✅ Employee profiles with contact information
- ✅ WhatsApp integration for notifications
- ✅ Department and position tracking
- ✅ Employee status management (Active/Inactive)

### Performance Tracking & Badges
- 🏆 Performance rating system (Excellent, Good, Average, Bad)
- 🏅 Appreciation badges system:
  - On-Time Completion 🚀
  - Fast Delivery ⚡
  - Innovation 💡
  - Problem Solver 🔧
  - Team Player 👥
- 📊 Employee leaderboard
- 📈 Recent activity tracking

### User & Role Management
- 👥 User authentication and authorization
- 🔐 Role-based access control (Admin, Editor, Viewer)
- 🛡️ Permission-based UI controls
- 🔑 Secure password handling

### Data Management
- 📥 Export jobs to Excel
- 🔍 Advanced filtering and search
- 📱 Real-time data updates
- 💾 MongoDB Atlas cloud database

### Notifications
- 📲 WhatsApp notifications via Twilio:
  - New job assignments
  - Job updates
  - Progress updates

## 🛠️ Technology Stack

### Frontend
- HTML5
- Tailwind CSS
- Vanilla JavaScript
- Responsive design

### Backend
- Node.js
- Express.js
- MongoDB (Atlas)
- JWT Authentication

### Integrations
- Twilio WhatsApp Business API
- ExcelJS for data export

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB Atlas account
- Twilio account (for WhatsApp notifications)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/shama2369/Trichygold_job.git
   cd Trichygold_job
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create a `.env` file in the root directory**
   ```env
   # MongoDB Atlas Connection
   MONGO_URI=your_mongodb_connection_string

   # Twilio WhatsApp Configuration
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
   ```

4. **Start the server**
   ```bash
   node server.js
   ```

5. **Access the application**
   - Open your browser and navigate to `http://localhost:3000`
   - Default admin credentials:
     - Username: `admin`
     - Password: `admin123`

## 📁 Project Structure

```
trichygold_job/
├── index.html              # Main application UI
├── server.js              # Express server and API routes
├── package.json           # Node.js dependencies
├── .env                   # Environment variables (not in git)
├── .gitignore            # Git ignore rules
├── models/               # Data models
│   ├── rolesManager.js   # Role management
│   └── user.js          # User model
├── routes/              # API routes
│   ├── authRoutes.js    # Authentication routes
│   └── userRoutes.js    # User management routes
├── services/            # External services
│   └── twilioService.js # WhatsApp notifications
├── public/              # Static files
│   ├── sessionManager.js # Session management
│   ├── userManager.js   # User UI logic
│   └── styles.css       # Custom styles
└── uploads/             # File uploads directory
```

## 🔐 User Roles & Permissions

### Admin
- Full access to all features
- User and role management
- Delete jobs
- All CRUD operations

### Editor
- Create and edit jobs
- View reports
- Export data
- Cannot delete or manage users

### Viewer
- View jobs and reports only
- No editing or administrative permissions

## 📱 WhatsApp Notifications

The system sends WhatsApp notifications for:
- New job assignments
- Job updates
- Additional details added

**Note:** For testing, use Twilio Sandbox. For production, set up a WhatsApp Business Account.

See [WHATSAPP_SETUP.md](WHATSAPP_SETUP.md) for detailed setup instructions.

## 🔒 Security Features

- JWT-based authentication
- Password hashing
- Role-based access control
- Secure API endpoints
- Environment variable protection

See [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md) for security details.

## 📊 Database Collections

- **users** - User accounts and authentication
- **roles** - User roles and permissions
- **employees** - Employee information
- **jobcollection** - Job records
- **counters** - Auto-increment counters for job IDs

## 🚀 Deployment

1. Set up MongoDB Atlas cluster
2. Configure environment variables on your hosting platform
3. Deploy to your preferred hosting service (Heroku, AWS, Azure, etc.)
4. Ensure `.env` file is properly configured on the server
5. Run database seed scripts if needed

## 🤝 Contributing

This is a private project. For contributions, please contact the project owner.

## 📝 License

All rights reserved. This project is proprietary software.

## 👨‍💻 Author

Shama - [GitHub Profile](https://github.com/shama2369)

## 📞 Support

For issues or questions, please contact the project administrator.

## 🎯 Future Enhancements

- [ ] Mobile app version
- [ ] Advanced analytics dashboard
- [ ] Email notifications
- [ ] Task scheduling
- [ ] Time tracking
- [ ] Client portal
- [ ] API documentation

---

**Note:** Make sure to keep your `.env` file secure and never commit it to version control!
