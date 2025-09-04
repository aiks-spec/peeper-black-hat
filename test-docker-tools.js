#!/usr/bin/env node

/**
 * Test script to verify Docker integration for OSINT tools
 * This script tests the Docker commands that will be used by the main application
 */

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function testDockerCommand(toolName, dockerCommand, testInput) {
    console.log(`\n🧪 Testing ${toolName}...`);
    console.log(`🐳 Command: ${dockerCommand.join(' ')}`);
    
    try {
        // Replace placeholder with test input
        const command = dockerCommand.map(arg => {
            if (typeof arg === 'string' && arg.includes('<username>')) {
                return arg.replace('<username>', testInput);
            }
            if (typeof arg === 'string' && arg.includes('<email>')) {
                return arg.replace('<email>', testInput);
            }
            if (typeof arg === 'string' && arg.includes('<phone_number>')) {
                return arg.replace('<phone_number>', testInput);
            }
            return arg;
        });
        
        console.log(`🔍 Executing: docker ${command.join(' ')}`);
        
        const { stdout, stderr } = await execAsync(`docker ${command.join(' ')}`, {
            timeout: 60000, // 1 minute timeout for testing
            maxBuffer: 1024 * 1024 * 10
        });
        
        console.log(`✅ ${toolName} executed successfully`);
        console.log(`📤 Output length: ${stdout?.length || 0}`);
        if (stdout) {
            console.log(`📄 Output preview: ${stdout.substring(0, 200)}...`);
        }
        if (stderr) {
            console.log(`⚠️ Stderr: ${stderr.substring(0, 200)}...`);
        }
        
        return true;
    } catch (error) {
        console.log(`❌ ${toolName} failed: ${error.message}`);
        if (error.code === 'ETIMEDOUT') {
            console.log(`⏰ Command timed out (this is normal for first run as it needs to download images)`);
        }
        return false;
    }
}

async function main() {
    console.log('🚀 Testing Docker integration for OSINT tools...\n');
    
    // Test commands (same as defined in server.js)
    const testCommands = {
        'Sherlock': {
            dockerArgs: ['run', '-it', '--rm', 'python:3.11-slim', 'bash', '-c', 'apt-get update && apt-get install -y git && pip install sherlock-project && sherlock <username>'],
            placeholder: '<username>',
            testInput: 'testuser123'
        },
        'Maigret': {
            dockerArgs: ['run', '-it', '--rm', 'python:3.11-slim', 'bash', '-c', 'pip install maigret && maigret <username>'],
            placeholder: '<username>',
            testInput: 'testuser123'
        },
        'Holehe': {
            dockerArgs: ['run', '-it', '--rm', 'python:3.11-slim', 'bash', '-c', 'pip install holehe && holehe <email>'],
            placeholder: '<email>',
            testInput: 'test@example.com'
        },
        'PhoneInfoga': {
            dockerArgs: ['run', '-it', '--rm', 'sundowndev/phoneinfoga:latest', 'scan', '--number', '<phone_number>'],
            placeholder: '<phone_number>',
            testInput: '+1234567890'
        }
    };
    
    let successCount = 0;
    let totalCount = 0;
    
    for (const [toolName, config] of Object.entries(testCommands)) {
        totalCount++;
        const success = await testDockerCommand(toolName, config.dockerArgs, config.testInput);
        if (success) successCount++;
        
        // Add delay between tests to avoid overwhelming Docker
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`\n📊 Test Results: ${successCount}/${totalCount} tools working`);
    
    if (successCount === totalCount) {
        console.log('🎉 All Docker tools are working correctly!');
    } else {
        console.log('⚠️ Some tools may need additional setup or Docker images may need to be pulled');
        console.log('💡 First runs may fail due to image downloads - this is normal');
    }
}

// Run the test
main().catch(console.error);
