// Stanmore Golf Club — Supabase Proxy (Vercel)
// Replaces JSONBin with Supabase for faster, more reliable storage

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const TABLE        = 'club_data';
const ROW_ID       = 1; // single row stores all data

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

export default async function handler(req, res) {
  const cors = getCorsHeaders();
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'PUT'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  const headers = {
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
  };

  try {
    if (req.method === 'GET') {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${ROW_ID}&select=data`,
        { headers }
      );
      const rows = await r.json();
      if (!rows || !rows.length) {
        return res.status(200).json({ scores:[], settings:{}, competitions:[] });
      }
      return res.status(200).json(rows[0].data);
    }

    if (req.method === 'PUT') {
      let body;
      try { body = await readBody(req); }
      catch(e) { return res.status(400).json({ error: 'Invalid JSON body' }); }

      // Upsert — insert or update row with id=1
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/${TABLE}`,
        {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify({ id: ROW_ID, data: body }),
        }
      );
      const result = await r.json();
      return res.status(200).json({ success: true });
    }

  } catch(e) {
    return res.status(500).json({ error: 'Proxy error', message: e.message });
  }
}
