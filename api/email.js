export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { lead, niche, city } = req.body;
  if (!lead) return res.status(400).json({ error: 'lead data required' });

  const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(400).json({ error: 'Missing Anthropic API key' });

  const prompt = `You are a digital marketing consultant writing a cold outreach email.

Business: ${lead.name}
Contact: ${lead.ownerName || 'Business Owner'}
Industry: ${niche}
City: ${city}
Google Rating: ${lead.rating || 'unknown'} stars (${lead.reviews || 0} reviews)
Website: ${lead.website || 'no website'}
Pain point: ${lead.pain}

Write a SHORT personalized cold email under 160 words.

Format exactly:
Subject: [subject line]

Hi [name],

[body]

[Your Name]
Digital Marketing Consultant

Rules:
- Open with a specific observation about their business
- One concrete result promise (e.g. "20 more bookings/month")
- Zero filler phrases
- End with CTA for a free 15-minute call
- Sound human, not templated

Write only the email.`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await resp.json();
    const email = data.content.map(b => b.text || '').join('');
    return res.status(200).json({ email });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate email', detail: err.message });
  }
}
