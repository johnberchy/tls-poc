# BLOCKSCOUT FROUNTEND TLS VERIFICATION:

`NODE_TLS_REJECT_UNAUTHORIZED=0` is global, not scoped to one proxy

## Claim being tested in;

deployments/monitoring/config-blockscout/frontend/frontend.env,

`NODE_TLS_REJECT_UNAUTHORIZED=0` is commonly added as a workaround for a
single TLS-intercepting corporate proxy (e.g. ZScaler), with the intent
"trust this one proxy's re-signed certs." The actual effect is much
broader: it disables certificate verification for **every** outbound TLS
connection the Node.js process makes, for its **entire lifetime** — not
scoped to any host, port, or proxy.

## What's in this PoC

- `server1.js` — an HTTPS server on port 8443 presenting a certificate for
  `CN=attacker.invalid` while actually serving on `localhost`. Echoes back
  whatever the client sends, including headers, to show real data delivery
  (not just "the handshake succeeded").
- `server2.js` — a second, **completely unrelated** HTTPS server on port
  9443, with a **different** bad certificate (`CN=totally-different-
  untrusted-host.example`). Exists purely to prove the bypass isn't scoped
  to one specific bad cert/host.
- `client.js` — makes an HTTPS POST to the first server carrying a fake
  `Authorization: Bearer ...` secret, using plain unmodified
  `https.request` (no custom `ca`/`rejectUnauthorized` overrides — this is
  what ordinary application code looks like).
- `global-scope-check.js` — hits *both* unrelated servers using the native
  `fetch()` API, to show the effect isn't specific to the low-level
  `https` module either.

## Results (captured on this run)

**Default Node.js behavior (`NODE_TLS_REJECT_UNAUTHORIZED` unset):**
```
[client] RESULT: connection REJECTED
[client] error: self-signed certificate
```
The malicious server's own log shows **no request was ever received** —
the TLS handshake failed before any HTTP data, including the
`Authorization` header, could be sent.

**With `NODE_TLS_REJECT_UNAUTHORIZED=0`:**
```
[client] RESULT: connection SUCCEEDED (status 200)
[client] server response: {"message":"data captured by attacker.invalid",
  "youSent":{"headers":{...,"authorization":"Bearer sk_live_..."},
  "body":"{\"action\":\"transferFunds\",\"amount\":1000000}"}}
```
The malicious server's log confirms it actually received the
`Authorization` header and the POST body — real data delivered to an
endpoint presenting a certificate for the wrong hostname. Node itself
also emits an explicit runtime warning:
```
Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to
'0' makes TLS connections and HTTPS requests insecure by disabling
certificate verification.
```

**Global-scope check, via `fetch()`, both unrelated endpoints:**
```
Default:
  fetch(https://localhost:8443/) -> REJECTED: DEPTH_ZERO_SELF_SIGNED_CERT
  fetch(https://localhost:9443/) -> REJECTED: DEPTH_ZERO_SELF_SIGNED_CERT

NODE_TLS_REJECT_UNAUTHORIZED=0:
  fetch(https://localhost:8443/) -> SUCCEEDED
  fetch(https://localhost:9443/) -> SUCCEEDED
```
Two unrelated certs, unrelated hosts, unrelated ports, no shared
configuration between them — both accepted once the flag is set. This is
the concrete evidence that the flag is process-global rather than scoped
to whichever proxy motivated adding it.

## reproducing it yourself

Requires Node.js and OpenSSL.

```bash
# generate the two bad certs
openssl req -x509 -newkey rsa:2048 -nodes -keyout server.key -out server.crt \
  -days 1 -subj "/CN=attacker.invalid"
openssl req -x509 -newkey rsa:2048 -nodes -keyout server2.key -out server2.crt \
  -days 1 -subj "/CN=totally-different-untrusted-host.example"

git clone https://github.com/johnberchy/tls-poc.git

# terminal 1
node server1.js
node server2.js &

# terminal 2 -- default (secure) behavior
node client.js
node global-scope-check.js

# terminal 2 -- vulnerable behavior
NODE_TLS_REJECT_UNAUTHORIZED=0 node client.js
NODE_TLS_REJECT_UNAUTHORIZED=0 node global-scope-check.js
```

## Recommended fix

Replace the blanket disable with a scoped trust of the specific
intercepting proxy's CA certificate:

```bash
NODE_EXTRA_CA_CERTS=/path/to/zscaler-root-ca.pem
```

This restores real verification — connections are still checked against a
trust store, just one that includes the proxy's CA — so an actual
MITM presenting an unrelated/invalid certificate (as demonstrated above)
is still rejected, while the proxy's legitimately re-signed traffic is
accepted.
