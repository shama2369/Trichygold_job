// Role templates for job management system
// Use these as reference when creating viewer and editor roles

// VIEWER ROLE TEMPLATE
const viewerRole = {
  name: 'viewer',
  description: 'View only - Can view jobs and reports, no editing permissions',
  permissions: {
    create_jobs: false,
    edit_jobs: false,
    delete_jobs: false,
    view_jobs: true,
    view_reports: true,
    export_data: false,
    manage_users: false,
    manage_roles: false,
    manage_employees: false
  },
  created_at: new Date(),
  updated_at: new Date()
};

// EDITOR ROLE TEMPLATE
const editorRole = {
  name: 'editor',
  description: 'Edit access - Can create and edit jobs, view reports, and export data',
  permissions: {
    create_jobs: true,
    edit_jobs: true,
    delete_jobs: false,
    view_jobs: true,
    view_reports: true,
    export_data: true,
    manage_users: false,
    manage_roles: false,
    manage_employees: false
  },
  created_at: new Date(),
  updated_at: new Date()
};

// ADMIN ROLE TEMPLATE (for reference)
const adminRole = {
  name: 'admin',
  description: 'Full access - Can create, edit, delete jobs, manage users, view reports, and export data',
  permissions: {
    create_jobs: true,
    edit_jobs: true,
    delete_jobs: true,
    view_jobs: true,
    view_reports: true,
    export_data: true,
    manage_users: true,
    manage_roles: true,
    manage_employees: true
  },
  created_at: new Date(),
  updated_at: new Date()
};

// MongoDB commands to create these roles:

/*
// To create viewer role:
db.roles.insertOne({
  name: 'viewer',
  description: 'View only - Can view jobs and reports, no editing permissions',
  permissions: {
    create_jobs: false,
    edit_jobs: false,
    delete_jobs: false,
    view_jobs: true,
    view_reports: true,
    export_data: false,
    manage_users: false,
    manage_roles: false,
    manage_employees: false
  },
  created_at: new Date(),
  updated_at: new Date()
});

// To create editor role:
db.roles.insertOne({
  name: 'editor',
  description: 'Edit access - Can create and edit jobs, view reports, and export data',
  permissions: {
    create_jobs: true,
    edit_jobs: true,
    delete_jobs: false,
    view_jobs: true,
    view_reports: true,
    export_data: true,
    manage_users: false,
    manage_roles: false,
    manage_employees: false
  },
  created_at: new Date(),
  updated_at: new Date()
});
*/

module.exports = {
  viewerRole,
  editorRole,
  adminRole
}; 