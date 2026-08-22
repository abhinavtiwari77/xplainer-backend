const fetch = require('node-fetch'); // Assuming node-fetch is available or using built-in fetch in newer node

// If node < 18, we might need node-fetch, but let's assume standard fetch or require 'http'
// Using http to avoid dependency issues in test script
const http = require('http');

const data = JSON.stringify({
  prompt: "Explain photosynthesis briefly",
  chatID: "test-chat-id"
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/explain',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('BODY:', responseData.substring(0, 500) + "..."); // Truncate for readability
    if (res.statusCode === 200 && responseData.includes('steps')) {
      console.log("TEST PASSED: Response contains 'steps'");
    } else {
      console.log("TEST FAILED");
    }
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
