const http = require('http');

const data = JSON.stringify({
  prompt: "Explain black holes with a diagram of event horizon",
  chatID: "debug_test_logger"
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
  res.setEncoding('utf8');
  let rawData = '';
  res.on('data', (chunk) => { rawData += chunk; });
  res.on('end', () => {
    try {
      console.log('BODY:', rawData);
    } catch (e) {
      console.error(e.message);
    }
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
