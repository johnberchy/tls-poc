// client.js
// Simulates a legitimate app making an outbound HTTPS request that happens
// to carry a sensitive credential (Authorization header) -- standing in for
// any real API call your app would make (npm registry, your backend API,
// an OAuth token endpoint, etc).
//
// It is run TWICE against the exact same process environment, changing
// nothing except NODE_TLS_REJECT_UNAUTHORIZED, to isolate that one variable
// as the cause of the behavior difference.

const https = require('https');

const FAKE_SECRET = 'Bearer sk_live_totally_real_api_key_do_not_leak_12345';

const options = {
  hostname: 'localhost',
  port: 8443,
  path: '/api/sensitive-endpoint',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': FAKE_SECRET,
  },
  // Deliberately NOT passing `ca` or `rejectUnauthorized` here -- this is
  // the default, unmodified https client config any normal app code uses.
};

console.log(`[client] NODE_TLS_REJECT_UNAUTHORIZED=${process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? '(unset, default secure behavior)'}`);
console.log('[client] connecting to https://localhost:8443 (real cert CN=attacker.invalid) ...');

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => (body += chunk));
  res.on('end', () => {
    console.log(`[client] RESULT: connection SUCCEEDED (status ${res.statusCode})`);
    console.log('[client] server response:', body);
    console.log('[client] >>> the Authorization header above was delivered to the untrusted/mismatched-cert server <<<');
  });
});

req.on('error', (err) => {
  console.log('[client] RESULT: connection REJECTED');
  console.log('[client] error:', err.message);
});

req.end(JSON.stringify({ action: 'transferFunds', amount: 1000000 }));
