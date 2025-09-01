const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function testLoginDirect() {
  console.log('=== TESTING LOGIN API DIRECTLY ===\n');
  
  // Test 1: Wrong username
  console.log('1. Testing wrong username...');
  try {
    const response1 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nonexistent', password: 'anything' })
    });
    
    const result1 = await response1.json();
    console.log(`   Status: ${response1.status}`);
    console.log(`   Response: ${JSON.stringify(result1)}`);
    console.log(`   Expected: Should fail with 401 status`);
    console.log(`   Result: ${response1.status === 401 ? '✅ PASS' : '❌ FAIL'}\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }
  
  // Test 2: Wrong password with correct username
  console.log('2. Testing wrong password with correct username...');
  try {
    const response2 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
    });
    
    const result2 = await response2.json();
    console.log(`   Status: ${response2.status}`);
    console.log(`   Response: ${JSON.stringify(result2)}`);
    console.log(`   Expected: Should fail with 401 status`);
    console.log(`   Result: ${response2.status === 401 ? '✅ PASS' : '❌ FAIL'}\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }
  
  // Test 3: Correct credentials
  console.log('3. Testing correct credentials...');
  try {
    const response3 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    
    const result3 = await response3.json();
    console.log(`   Status: ${response3.status}`);
    console.log(`   Response: ${result3.token ? 'Has token' : 'No token'}`);
    console.log(`   Expected: Should succeed with 200 status and token`);
    console.log(`   Result: ${response3.status === 200 && result3.token ? '✅ PASS' : '❌ FAIL'}\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }
  
  // Test 4: Empty password
  console.log('4. Testing empty password...');
  try {
    const response4 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: '' })
    });
    
    const result4 = await response4.json();
    console.log(`   Status: ${response4.status}`);
    console.log(`   Response: ${JSON.stringify(result4)}`);
    console.log(`   Expected: Should fail with 401 status`);
    console.log(`   Result: ${response4.status === 401 ? '✅ PASS' : '❌ FAIL'}\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }
}

testLoginDirect(); 