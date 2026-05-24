export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { businessName, businessType, score, priority, channels } = req.body;
  if (!businessName || !channels) return res.status(400).json({ error: 'businessName and channels required' });

  const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(400).json({ error: 'Missing Anthropic API key' });

  const weak = channels.filter(c => c.status !== 'Active').slice(0, 4);
  const topThree = (priority || []).slice(0, 3).join(', ');

  const prompt = `You are a digital marketing sales consultant writing a cold outreach pitch.

Business: ${businessName}
Type: ${businessType}
Social media score: ${score}/100
Biggest gaps: ${topThree}

Specific problems found:
${weak.map(c => `- ${c.name}: ${c.problem}`).join('\n')}

Write a SHORT personalized sales pitch under 160 words.

Format exactly:
Subject: [subject line]

Hi [Business Owner / use business name naturally],

[body]

[Your Name]
Digital Marketing Consultant

Rules:
- Open with a specific observation about their weak online presence
- Name 2-3 specific platforms they're missing or underusing
- Promise one concrete outcome (e.g. "30% more bookings in 60 days")
- End with CTA for a free 15-minute social media audit call
- Sound human and specific, NOT templated

Write only the pitch.`;

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
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await resp.json();
    const pitch = data.content.map(b => b.text || '').join('');
    return res.status(200).json({ pitch });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate pitch', detail: err.message });
  }
}
