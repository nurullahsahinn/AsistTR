/**
 * API Test Script
 * Tüm API endpoint'lerini test eder
 */

const axios = require('axios');

const API_URL = 'http://localhost:4000/api';
let authToken = '';
let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  tests: []
};

// Test helper
async function test(name, fn) {
  testResults.total++;
  try {
    await fn();
    testResults.passed++;
    testResults.tests.push({ name, status: '✅ BAŞARILI', error: null });
    console.log(`✅ ${name}`);
    return true;
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: '❌ BAŞARISIZ', error: error.message });
    console.log(`❌ ${name}: ${error.message}`);
    return false;
  }
}

// 1. Authentication Tests
async function authTests() {
  console.log('\n📋 AUTHENTICATION TESTS\n');
  
  await test('Login - Admin', async () => {
    const res = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@asistr.com',
      password: 'admin123'
    });
    if (res.status !== 200) throw new Error('Login failed');
    authToken = res.data.token;
    if (!authToken) throw new Error('Token not received');
  });

  await test('Get Me - Token Validation', async () => {
    const res = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.status !== 200) throw new Error('Get me failed');
    if (!res.data.user) throw new Error('User data not received');
  });
}

// 2. Chat Tests
async function chatTests() {
  console.log('\n📋 CHAT TESTS\n');
  
  await test('Get Conversations', async () => {
    const res = await axios.get(`${API_URL}/chat`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.status !== 200) throw new Error('Get conversations failed');
  });

  await test('Get Canned Responses', async () => {
    const res = await axios.get(`${API_URL}/canned`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.status !== 200) throw new Error('Get canned responses failed');
  });
}

// 3. RAG/AI Tests
async function ragTests() {
  console.log('\n📋 RAG/AI TESTS\n');
  
  await test('Get Knowledge Base', async () => {
    const res = await axios.get(`${API_URL}/rag/knowledge`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.status !== 200) throw new Error('Get knowledge failed');
  });

  await test('RAG Health Check', async () => {
    const res = await axios.get(`${API_URL}/rag/health`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.status !== 200) throw new Error('RAG health check failed');
  });
}

// 4. Admin Panel Tests
async function adminTests() {
  console.log('\n📋 ADMIN PANEL TESTS\n');
  
  await test('Get Agents', async () => {
    const res = await axios.get(`${API_URL}/agents`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.status !== 200) throw new Error('Get agents failed');
  });

  await test('Get Departments', async () => {
    const res = await axios.get(`${API_URL}/departments`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.status !== 200) throw new Error('Get departments failed');
  });

  await test('Get Analytics Dashboard', async () => {
    const res = await axios.get(`${API_URL}/analytics/dashboard`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.status !== 200) throw new Error('Get analytics failed');
  });

  await test('Get Queue Status', async () => {
    const res = await axios.get(`${API_URL}/queue/status`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.status !== 200) throw new Error('Get queue status failed');
  });

  await test('Get Agent Presence', async () => {
    const res = await axios.get(`${API_URL}/presence/agents`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.status !== 200) throw new Error('Get agent presence failed');
  });

  await test('Get Widget Sites', async () => {
    const res = await axios.get(`${API_URL}/widget/sites`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.status !== 200) throw new Error('Get widget sites failed');
  });
}

// 5. Voice Call Tests
async function voiceTests() {
  console.log('\n📋 VOICE CALL TESTS\n');
  
  await test('Get Active Calls', async () => {
    const res = await axios.get(`${API_URL}/voice/active`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.status !== 200) throw new Error('Get active calls failed');
  });
}

// 6. Notification Tests
async function notificationTests() {
  console.log('\n📋 NOTIFICATION TESTS\n');
  
  await test('Get Notification Preferences', async () => {
    const res = await axios.get(`${API_URL}/notifications/preferences`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.status !== 200) throw new Error('Get notification preferences failed');
  });
}

// Main test runner
async function runTests() {
  console.log('🚀 AsistTR API Test Suite\n');
  console.log('='.repeat(60));
  
  try {
    await authTests();
    await chatTests();
    await ragTests();
    await adminTests();
    await voiceTests();
    await notificationTests();
    
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 TEST SONUÇLARI:\n');
    console.log(`   Toplam Test: ${testResults.total}`);
    console.log(`   ✅ Başarılı: ${testResults.passed}`);
    console.log(`   ❌ Başarısız: ${testResults.failed}`);
    console.log(`   📈 Başarı Oranı: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
    
    if (testResults.failed > 0) {
      console.log('\n⚠️  BAŞARISIZ TESTLER:\n');
      testResults.tests
        .filter(t => t.status.includes('❌'))
        .forEach(t => console.log(`   ${t.name}: ${t.error}`));
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    process.exit(testResults.failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ Test suite crashed:', error.message);
    process.exit(1);
  }
}

runTests();
