#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting OSINT Lookup Engine via index.js...');
console.log('🔍 Current working directory:', process.cwd());
console.log('🔍 Node.js version:', process.version);
console.log('🔍 Environment variables:');
console.log('  - PORT:', process.env.PORT);
console.log('  - FASTAPI_PORT:', process.env.FASTAPI_PORT);
console.log('  - NODE_ENV:', process.env.NODE_ENV);

// Try to run the start.sh script
const startScript = '/app/start.sh';
console.log('🔧 Attempting to run start script:', startScript);

const child = spawn('bash', [startScript], {
    stdio: 'inherit',
    cwd: '/app'
});

child.on('error', (error) => {
    console.error('❌ Failed to start start.sh:', error);
    console.log('🔄 Falling back to direct node server.js...');
    
    // Fallback to direct server.js
    const server = spawn('node', ['server.js'], {
        stdio: 'inherit',
        cwd: '/app'
    });
    
    server.on('error', (serverError) => {
        console.error('❌ Failed to start server.js:', serverError);
        process.exit(1);
    });
});

child.on('exit', (code) => {
    console.log('🔚 start.sh exited with code:', code);
    if (code !== 0) {
        console.log('🔄 start.sh failed, falling back to direct server.js...');
        
        // Fallback to direct server.js
        const server = spawn('node', ['server.js'], {
            stdio: 'inherit',
            cwd: '/app'
        });
        
        server.on('error', (serverError) => {
            console.error('❌ Failed to start server.js:', serverError);
            process.exit(1);
        });
    }
});
