#!/usr/bin/env node
/**
 * Performance smoke test
 * 
 * Tests basic API responsiveness with concurrent requests.
 * Skips gracefully if server is not running.
 * 
 * Usage: node smoke.mjs [url] [concurrent] [duration]
 * Example: node smoke.mjs http://localhost:3000 10 5
 */

const API_URL = process.argv[2] || 'http://localhost:3000';
const CONCURRENT = parseInt(process.argv[3] || '10', 10);
const DURATION_SECONDS = parseInt(process.argv[4] || '5', 10);

async function checkHealth() {
  try {
    const response = await fetch(`${API_URL}/api/v1/health/live`, {
      signal: AbortSignal.timeout(3000)
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function runRequest() {
  const start = Date.now();
  try {
    const response = await fetch(`${API_URL}/api/v1/health/live`, {
      signal: AbortSignal.timeout(5000)
    });
    const duration = Date.now() - start;
    return {
      success: response.ok,
      status: response.status,
      duration
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      duration: Date.now() - start,
      error: error.message
    };
  }
}

async function smokeSuite() {
  console.log(`🔥 Performance Smoke Test`);
  console.log(`   URL: ${API_URL}`);
  console.log(`   Concurrent: ${CONCURRENT}`);
  console.log(`   Duration: ${DURATION_SECONDS}s\n`);

  // Check if server is running
  console.log('Checking server health...');
  const healthy = await checkHealth();
  if (!healthy) {
    console.log('⚠️  Server not responding, skipping test');
    process.exit(0);
  }
  console.log('✓ Server is healthy\n');

  const results = [];
  const startTime = Date.now();
  const endTime = startTime + (DURATION_SECONDS * 1000);

  console.log('Running requests...');
  
  while (Date.now() < endTime) {
    const batch = [];
    for (let i = 0; i < CONCURRENT; i++) {
      batch.push(runRequest());
    }
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const totalTime = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;
  const durations = results.map(r => r.duration);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const maxDuration = Math.max(...durations);
  const minDuration = Math.min(...durations);
  const requestsPerSecond = (results.length / (totalTime / 1000)).toFixed(2);

  console.log(`\n📊 Results:`);
  console.log(`   Total requests: ${results.length}`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Requests/sec: ${requestsPerSecond}`);
  console.log(`   Avg response: ${avgDuration.toFixed(0)}ms`);
  console.log(`   Min response: ${minDuration}ms`);
  console.log(`   Max response: ${maxDuration}ms`);

  if (failCount > 0) {
    console.log(`\n⚠️  ${failCount} requests failed`);
    const errors = results.filter(r => !r.success);
    const errorSample = errors.slice(0, 3);
    errorSample.forEach(err => {
      console.log(`   Status ${err.status}: ${err.error || 'Unknown error'}`);
    });
  }

  console.log(successCount === results.length ? '\n✅ All requests successful' : '\n❌ Some requests failed');
  process.exit(failCount > 0 ? 1 : 0);
}

smokeSuite().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
