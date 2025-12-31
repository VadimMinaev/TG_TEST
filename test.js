const http = require('http');

const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({ status: 'ok', message: 'Server is running' }));
});

server.listen(3000, () => {
  console.log('Test server running on port 3000');
});
