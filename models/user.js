// User model with database-driven roles for MongoDB
const { ObjectId } = require('mongodb');

class User {
  constructor({ _id, username, password, roles = [] }) {
    this._id = _id ? new ObjectId(_id) : new ObjectId();
    this.username = username;
    this.password = password; // Should be hashed in production
    this.roles = roles; // Array of role ObjectIds
    this.created_at = new Date();
    this.updated_at = new Date();
  }

  // Validate user data
  static validate(userData) {
    const errors = [];
    
    if (!userData.username || typeof userData.username !== 'string') {
      errors.push('Username is required and must be a string');
    }
    
    if (!userData.password || typeof userData.password !== 'string') {
      errors.push('Password is required and must be a string');
    }
    
    
    if (userData.roles && !Array.isArray(userData.roles)) {
      errors.push('Roles must be an array');
    }
    
    return errors;
  }

  // Create user from data
  static create(userData) {
    const errors = this.validate(userData);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
    
    return new User(userData);
  }
}

module.exports = User;
