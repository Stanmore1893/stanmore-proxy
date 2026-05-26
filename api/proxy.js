// Stanmore Golf Club — JSONBin Proxy (Vercel)

const BIN_ID  = process.env.JSONBIN_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '86400',
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch(e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

// Fetch with a hard timeout so Vercel never hits its limit
function fetchWithTimeout(url, options, ms = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

export default async function handler(req, res) {
  const cors = getCorsHeaders();
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!['GET', 'PUT'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!BIN_ID || !API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured — check environment variables' });
  }

  try {
    if (req.method === 'GET') {
      const r = await fetchWithTimeout(`${JSONBIN_URL}/latest`, {
        method: 'GET',
        headers: { 'X-Master-Key': API_KEY, 'X-Bin-Meta': 'false' }
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    if (req.method === 'PUT') {
      let body;
      try { body = await readBody(req); }
      catch(e) { return res.status(400).json({ error: 'Invalid JSON body' }); }

      const r = await fetchWithTimeout(JSONBIN_URL, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY },
        body:    JSON.stringify(body),
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

  } catch(e) {
    const msg = e.name === 'AbortError' ? 'Request timed out' : e.message;
    return res.status(504).json({ error: 'Proxy error', message: msg });
  }
}
