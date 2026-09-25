// server.js
// Simulates an attacker-controlled (or MITM'd) HTTPS endpoint.
// It presents a certificate for "attacker.invalid" while actually being
// served on localhost -- i.e. exactly the kind of certificate a correctly
// configured TLS client MUST reject (hostname mismatch / untrusted issuer).
//
// It also echoes back whatever the client sent, so we can show that with
// verification disabled, real data (e.g. an Authorization header) is
// actually delivered into attacker hands -- not just "the connection opened".

const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync(__dirname + '/server.key'),
  cert: fs.readFileSync(__dirname + '/server.crt'),
};

const server = https.createServer(options, (req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    console.log('[malicious-server] received request:');
    console.log('  headers:', JSON.stringify(req.headers));
    console.log('  body:   ', body || '(empty)');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'data captured by attacker.invalid', youSent: { headers: req.headers, body } }));
  });
});

server.listen(8443, () => {
  console.log('[malicious-server] listening on https://localhost:8443 (cert CN=attacker.invalid)');
});
