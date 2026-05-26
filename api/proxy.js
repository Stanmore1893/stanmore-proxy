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

async function fetchJSONBin(url, options) {
  // Try up to 2 times with a generous timeout
  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8500);
    try {
      const r = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return r;
    } catch(e) {
      clearTimeout(timer);
      if (attempt === 2) throw e;
      // Brief pause before retry
      await new Promise(r => setTimeout(r, 300));
    }
  }
}

export default async function handler(req, res) {
  const cors = getCorsHeaders();
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!['GET', 'PUT'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!BIN_ID || !API_KEY) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  try {
    if (req.method === 'GET') {
      const r = await fetchJSONBin(`${JSONBIN_URL}/latest`, {
        headers: { 'X-Master-Key': API_KEY, 'X-Bin-Meta': 'false' }
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    if (req.method === 'PUT') {
      let body;
      try { body = await readBody(req); }
      catch(e) { return res.status(400).json({ error: 'Invalid JSON body' }); }

      const r = await fetchJSONBin(JSONBIN_URL, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY },
        body:    JSON.stringify(body),
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

  } catch(e) {
    const msg = e.name === 'AbortError' ? 'JSONBin timeout — try again' : e.message;
    return res.status(504).json({ error: 'Proxy error', message: msg });
  }
}
