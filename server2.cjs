const https = require('https');
const fs = require('fs');
const options = {
  key: fs.readFileSync(__dirname + '/server2.key'),
  cert: fs.readFileSync(__dirname + '/server2.crt'),
};
https.createServer(options, (req, res) => {
  console.log('[server2] request received on unrelated endpoint, cert CN=totally-different-untrusted-host.example');
  res.end('also reachable');
}).listen(9443, () => console.log('[server2] listening on https://localhost:9443'));
