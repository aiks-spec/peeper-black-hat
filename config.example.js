// OSINT Lookup Engine Configuration Example
// Copy this file to config.js and fill in your actual API keys

module.exports = {
    // API Keys (optional for demo mode)
    CUFINDER_API_KEY: 'your_cufinder_api_key_here',
    PHONE_API_KEY: 'your_phone_api_key_here',
    
    // Server Configuration
    PORT: process.env.PORT || 3000,
    
    // Database Configuration (SQLite - auto-created)
    // No additional configuration needed
    
    // Optional: Environment
    NODE_ENV: process.env.NODE_ENV || 'production'
};
