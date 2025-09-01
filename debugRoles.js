// Debug script to check API responses
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const baseUrl = 'http://localhost:3000/api/users';

async function debugRoles() {
  console.log('🔍 Debugging Roles API...\n');
  
  try {
    // Test 1: Get all roles
    console.log('1️⃣ Testing GET /roles/all...');
    const rolesResponse = await fetch(`${baseUrl}/roles/all`);
    console.log('Status:', rolesResponse.status);
    const roles = await rolesResponse.json();
    console.log('Response:', JSON.stringify(roles, null, 2));
    console.log('');
    
    // Test 2: Get role descriptions
    console.log('2️⃣ Testing GET /roles/descriptions...');
    const descriptionsResponse = await fetch(`${baseUrl}/roles/descriptions`);
    console.log('Status:', descriptionsResponse.status);
    const descriptions = await descriptionsResponse.json();
    console.log('Response:', JSON.stringify(descriptions, null, 2));
    console.log('');
    
    // Test 3: Get available permissions
    console.log('3️⃣ Testing GET /roles/permissions/available...');
    const permissionsResponse = await fetch(`${baseUrl}/roles/permissions/available`);
    console.log('Status:', permissionsResponse.status);
    const permissions = await permissionsResponse.json();
    console.log('Response:', JSON.stringify(permissions, null, 2));
    console.log('');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
  
  console.log('\n🏁 Debug completed!');
}

debugRoles(); 