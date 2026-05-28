const CORS = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key');
};

const claude = async (key, prompt, tokens = 400) => {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: tokens, messages: [{ role: 'user', content: prompt }] })
  });
  const d = await r.json();
  return d.content?.map(b => b.text || '').join('') || '';
};

const parseJSON = (raw) => {
  const clean = raw.replace(/```json|```/g, '').trim();
  const si = clean.search(/[{[]/), ei = Math.max(clean.lastIndexOf('}'), clean.lastIndexOf(']'));
  try { return si !== -1 ? JSON.parse(clean.slice(si, ei + 1)) : null; } catch { return null; }
};

// Derive a readable business name from a domain
function nameFromDomain(url) {
  try {
    const host = new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace('www.', '');
    const core = host.split('.')[0];
    return core.charAt(0).toUpperCase() + core.slice(1).replace(/[-_]/g, ' ');
  } catch { return null; }
}

export default async function handler(req, res) {
  CORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = req.headers['x-anthropic-key'];
  if (!key) return res.status(400).json({ error: 'Missing Anthropic API key' });

  const { url = '', name = '', niche = '', city = '' } = req.body || {};

  // Fast-path: if no URL and only a name, just return name-based object without calling Claude
  if (!url && name) {
    return res.json({ name, website: null, phone: null, address: city || null, description: niche ? `A local ${niche} business.` : 'Local business.' });
  }

  const prompt = `You are a business data extractor for a lead generation tool.

Given:
- URL: ${url || 'not provided'}
- Business Name: ${name || 'not provided'}
- Niche/Industry: ${niche || 'not specified'}
- City: ${city || 'not specified'}

Infer the business details. Use the domain name to guess the business name if not provided (e.g. "joesplumbing.com" → "Joe's Plumbing"). Do NOT invent phone numbers — set phone to null. Provide a concise 1-sentence description based on the niche and name.

Return ONLY valid JSON, no markdown:
{
  "name": "business name string",
  "website": "full URL with https:// or null",
  "phone": null,
  "address": "city-level address string or null",
  "description": "1-sentence description"
}`;

  try {
    const raw = await claude(key, prompt);
    const data = parseJSON(raw);
    if (!data) throw new Error('parse failed');
    // Ensure website is set if URL was provided
    if (url && !data.website) data.website = url.startsWith('http') ? url : 'https://' + url;
    return res.json(data);
  } catch (e) {
    // Graceful fallback — don't let extraction failure block the add-lead flow
    return res.json({
      name: name || nameFromDomain(url) || 'Inbound Lead',
      website: url ? (url.startsWith('http') ? url : 'https://' + url) : null,
      phone: null,
      address: city || null,
      description: niche ? `A local ${niche} business.` : 'Local business.'
    });
  }
}
