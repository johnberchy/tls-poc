// global-scope-check.js
// Proves NODE_TLS_REJECT_UNAUTHORIZED=0 is NOT scoped to any particular
// host/proxy -- it silently accepts BOTH of two completely unrelated,
// differently-invalid certificates (different CN, different port, no
// shared config), and it affects the native fetch() API too, not just the
// low-level https module. This matches Node's own documentation: the
// variable disables verification for "all" outbound TLS connections made
// by the process for its entire lifetime.

async function tryFetch(url) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log(`  fetch(${url}) -> SUCCEEDED: "${text}"`);
  } catch (err) {
    console.log(`  fetch(${url}) -> REJECTED: ${err.cause?.code || err.message}`);
  }
}

(async () => {
  console.log(`NODE_TLS_REJECT_UNAUTHORIZED=${process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? '(unset)'}`);
  await tryFetch('https://localhost:8443/');       // cert CN=attacker.invalid
  await tryFetch('https://localhost:9443/');        // cert CN=totally-different-untrusted-host.example
})();
