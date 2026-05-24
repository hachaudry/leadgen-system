export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { businessName, website, businessType } = req.body;
  if (!businessName || !businessType) {
    return res.status(400).json({ error: 'businessName and businessType are required' });
  }

  const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(400).json({ error: 'Missing Anthropic API key' });

  const prompt = `You are a social media marketing expert auditing a local business's online presence.

Business: ${businessName}
Website: ${website || 'Not provided'}
Type: ${businessType}

Evaluate this business's likely social media presence across 9 channels. Be realistic — most small local businesses have weak or missing presence on several platforms. Use the business type and name to make educated inferences.

Return ONLY a valid JSON object, no markdown, no explanation:
{
  "score": <integer 0-100>,
  "summary": "<2 sentence overall assessment>",
  "channels": [
    { "name": "Google Business Profile", "icon": "🔍", "status": "Active|Weak|Missing", "problem": "<specific gap, max 12 words>", "action": "<concrete fix, max 12 words>" },
    { "name": "Instagram",   "icon": "📸", "status": "Active|Weak|Missing", "problem": "<max 12 words>", "action": "<max 12 words>" },
    { "name": "Facebook",    "icon": "👥", "status": "Active|Weak|Missing", "problem": "<max 12 words>", "action": "<max 12 words>" },
    { "name": "TikTok",      "icon": "🎵", "status": "Active|Weak|Missing", "problem": "<max 12 words>", "action": "<max 12 words>" },
    { "name": "YouTube",     "icon": "▶️", "status": "Active|Weak|Missing", "problem": "<max 12 words>", "action": "<max 12 words>" },
    { "name": "Twitter / X", "icon": "✖️", "status": "Active|Weak|Missing", "problem": "<max 12 words>", "action": "<max 12 words>" },
    { "name": "LinkedIn",    "icon": "💼", "status": "Active|Weak|Missing", "problem": "<max 12 words>", "action": "<max 12 words>" },
    { "name": "Yelp",        "icon": "⭐", "status": "Active|Weak|Missing", "problem": "<max 12 words>", "action": "<max 12 words>" },
    { "name": "Pinterest",   "icon": "📌", "status": "Active|Weak|Missing", "problem": "<max 12 words>", "action": "<max 12 words>" }
  ],
  "priority": ["<channel name 1>", "<channel name 2>", "<channel name 3>"]
}

Score guide: Active = strong maintained presence (~12pts each). Weak = exists but minimal (~5pts). Missing = no presence (0pts). Normalize total to 0-100.
Priority = 3 channels with highest ROI impact for ${businessType} businesses to improve first.`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await resp.json();
    let raw = data.content.map(b => b.text || '').join('');
    raw = raw.replace(/```json|```/g, '').trim();
    const si = raw.indexOf('{'), ei = raw.lastIndexOf('}');
    let scorecard = null;
    try { if (si !== -1) scorecard = JSON.parse(raw.slice(si, ei + 1)); } catch {}

    if (!scorecard) return res.status(500).json({ error: 'Failed to parse AI response' });
    return res.status(200).json(scorecard);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
