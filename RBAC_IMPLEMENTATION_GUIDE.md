# Role-Based Access Control (RBAC) Implementation Guide

## Overview

The Campaign Management System now implements a comprehensive Role-Based Access Control (RBAC) system that controls user permissions based on their assigned roles. This system ensures that users can only access features and perform actions that are appropriate for their role level.

## 🏗️ System Architecture

### 1. **Roles & Permissions Structure**

#### Available Roles:
- **Admin**: Full system access
- **Editor**: Create and edit campaigns, view reports, export data
- **Viewer**: View campaigns and reports only

#### Available Permissions:
```javascript
{
  create_campaigns: boolean,    // Can create new campaigns
  edit_campaigns: boolean,      // Can edit existing campaigns
  delete_campaigns: boolean,    // Can delete campaigns
  view_campaigns: boolean,      // Can view campaigns
  view_reports: boolean,        // Can view reports
  export_data: boolean,         // Can export data
  manage_users: boolean,        // Can manage users
  manage_roles: boolean,        // Can manage roles
  generate_tags: boolean,       // Can generate tags
  manage_channels: boolean      // Can manage channels
}
```

### 2. **Role Definitions**

#### Admin Role:
```javascript
{
  name: 'admin',
  description: 'Full access - Can create, edit, delete campaigns, manage users, view reports, and export data',
  permissions: {
    create_campaigns: true,
    edit_campaigns: true,
    delete_campaigns: true,
    view_campaigns: true,
    view_reports: true,
    export_data: true,
    manage_users: true,
    manage_roles: true,
    generate_tags: true,
    manage_channels: true
  }
}
```

#### Editor Role:
```javascript
{
  name: 'editor',
  description: 'Edit access - Can create and edit campaigns, view reports, and export data',
  permissions: {
    create_campaigns: true,
    edit_campaigns: true,
    delete_campaigns: false,
    view_campaigns: true,
    view_reports: true,
    export_data: true,
    manage_users: false,
    manage_roles: false,
    generate_tags: false,
    manage_channels: false
  }
}
```

#### Viewer Role:
```javascript
{
  name: 'viewer',
  description: 'View only - Can view campaigns and reports, no editing permissions',
  permissions: {
    create_campaigns: false,
    edit_campaigns: false,
    delete_campaigns: false,
    view_campaigns: true,
    view_reports: true,
    export_data: false,
    manage_users: false,
    manage_roles: false,
    generate_tags: false,
    manage_channels: false
  }
}
```

## 🔐 Authentication & Session Management

### 1. **Session Manager (`public/sessionManager.js`)**
- Manages user authentication state
- Fetches and caches user permissions
- Controls UI visibility based on permissions
- Handles login/logout functionality

### 2. **Authentication Flow**
1. User submits login credentials
2. Server validates credentials and returns user data with roles
3. Session manager fetches permissions from user roles
4. UI is updated based on user permissions
5. User can access only permitted features

### 3. **Demo Users**
For testing purposes, the following demo users are available:

| Username | Password | Role | Access Level |
|----------|----------|------|--------------|
| `admin` | `admin123` | Admin | Full access |
| `editor` | `editor123` | Editor | Create/Edit campaigns |
| `viewer` | `viewer123` | Viewer | View only |

## 🎯 Permission-Based UI Control

### 1. **Navigation Control**
```javascript
// Hide/show navigation based on permissions
updateNavigation() {
  const campaignNav = document.getElementById('campaigns-nav');
  campaignNav.style.display = this.canViewCampaigns() ? 'block' : 'none';
  
  const userNav = document.getElementById('user-manager-nav');
  userNav.style.display = this.canManageUsers() ? 'block' : 'none';
}
```

### 2. **Action Button Control**
```javascript
// Show/hide action buttons based on permissions
updateCampaignActions() {
  const createBtn = document.getElementById('create-campaign-btn');
  createBtn.style.display = this.canCreateCampaigns() ? 'inline-block' : 'none';
  
  const editButtons = document.querySelectorAll('.edit-campaign-btn');
  editButtons.forEach(btn => {
    btn.style.display = this.canEditCampaigns() ? 'inline-block' : 'none';
  });
}
```

### 3. **Section Visibility**
```javascript
// Control entire section visibility
updateUserManagement() {
  const userManagerSection = document.getElementById('user-manager');
  userManagerSection.style.display = this.canManageUsers() ? 'block' : 'none';
}
```

## 🔧 Implementation Details

### 1. **Backend API Endpoints**

#### Authentication Routes (`routes/authRoutes.js`):
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info

#### User Management Routes (`routes/userRoutes.js`):
- `POST /api/users/permissions` - Get permissions from role IDs
- `GET /api/users` - Get all users
- `POST /api/users` - Create user
- `PUT /api/users/:id/roles` - Update user roles

#### Role Management Routes:
- `GET /api/users/roles/all` - Get all roles
- `POST /api/users/roles` - Create role
- `PUT /api/users/roles/:id` - Update role
- `DELETE /api/users/roles/:id` - Delete role

### 2. **Frontend Permission Checking**

#### Session Manager Methods:
```javascript
// Check specific permissions
sessionManager.hasPermission('create_campaigns')
sessionManager.canCreateCampaigns()
sessionManager.canEditCampaigns()
sessionManager.canDeleteCampaigns()
sessionManager.canManageUsers()
sessionManager.canManageRoles()
```

#### User Manager Integration:
```javascript
// Updated permission functions now use session manager
function canManageUsers() {
  return window.sessionManager ? window.sessionManager.canManageUsers() : false;
}

function canCreateCampaigns() {
  return window.sessionManager ? window.sessionManager.canCreateCampaigns() : false;
}
```

### 3. **Database Schema**

#### Users Collection:
```javascript
{
  _id: ObjectId,
  username: String,
  email: String,
  password: String (hashed),
  roles: [ObjectId], // Array of role IDs
  created_at: Date,
  updated_at: Date
}
```

#### Roles Collection:
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  permissions: {
    create_campaigns: Boolean,
    edit_campaigns: Boolean,
    delete_campaigns: Boolean,
    view_campaigns: Boolean,
    view_reports: Boolean,
    export_data: Boolean,
    manage_users: Boolean,
    manage_roles: Boolean,
    generate_tags: Boolean,
    manage_channels: Boolean
  },
  created_at: Date,
  updated_at: Date
}
```

## 🚀 How to Use

### 1. **Login Process**
1. Open the application
2. Login form will be displayed
3. Enter credentials (use demo users above)
4. System will load user permissions
5. UI will be updated based on role

### 2. **Testing Different Roles**
1. **Admin User**: Full access to all features
2. **Editor User**: Can create/edit campaigns, view reports, export data
3. **Viewer User**: Can only view campaigns and reports

### 3. **Permission Changes**
- Edit roles through the User & Role Manager (admin only)
- Changes take effect immediately for new sessions
- Existing sessions maintain their permissions until logout

## 🔒 Security Considerations

### 1. **Frontend Security**
- UI elements are hidden based on permissions
- This is for UX purposes only
- All security must be enforced on the backend

### 2. **Backend Security**
- All API endpoints should validate user permissions
- Role-based middleware should be implemented
- Database queries should respect user permissions

### 3. **Production Recommendations**
- Implement proper JWT tokens
- Add password hashing with bcrypt
- Add rate limiting
- Implement session timeout
- Add audit logging

## 📝 Future Enhancements

### 1. **Advanced Features**
- Role inheritance
- Custom permissions
- Permission groups
- Time-based permissions
- IP-based restrictions

### 2. **UI Improvements**
- Permission indicators
- Role badges
- Access denied messages
- Permission request system

### 3. **Monitoring**
- Permission usage analytics
- Access logs
- Security alerts
- Role effectiveness metrics

## 🛠️ Troubleshooting

### Common Issues:
1. **Login not working**: Check if demo users exist in database
2. **Permissions not loading**: Check browser console for API errors
3. **UI not updating**: Ensure session manager is properly initialized
4. **Role changes not reflecting**: Logout and login again

### Debug Commands:
```javascript
// Check current user
console.log(window.sessionManager.getCurrentUser());

// Check permissions
console.log(window.sessionManager.getUserPermissions());

// Check specific permission
console.log(window.sessionManager.canManageUsers());
```

---

This RBAC system provides a solid foundation for secure, role-based access control in the Campaign Management System. The modular design allows for easy extension and customization as requirements evolve. 