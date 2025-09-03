// Test script to verify visitor tracking is working
const axios = require('axios');

async function testVisitorTracking() {
    try {
        console.log('🧪 Testing visitor tracking...');
        
        // Test 1: Check if stats endpoint is accessible
        console.log('📊 Testing /api/stats endpoint...');
        const statsResponse = await axios.get('http://localhost:10000/api/stats');
        console.log('✅ Stats endpoint response:', statsResponse.data);
        
        // Test 2: Simulate a visitor by accessing the main page
        console.log('🌐 Simulating visitor access to main page...');
        const mainPageResponse = await axios.get('http://localhost:10000/');
        console.log('✅ Main page accessible, status:', mainPageResponse.status);
        
        // Test 3: Check stats again to see if visitor was tracked
        console.log('📊 Checking stats after visitor simulation...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        const statsAfterResponse = await axios.get('http://localhost:10000/api/stats');
        console.log('✅ Stats after visitor simulation:', statsAfterResponse.data);
        
        // Test 4: Check database connection status
        console.log('🗄️ Testing database connection...');
        const testToolsResponse = await axios.get('http://localhost:10000/api/test-tools');
        console.log('✅ Tools test response:', testToolsResponse.data);
        
        console.log('\n🎉 All tests completed successfully!');
        console.log('📊 Current visitor stats:', statsAfterResponse.data);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

// Run the test
testVisitorTracking();
