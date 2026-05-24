export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { businessName, businessType, city, state, overallScore, competitorGap, categories, priorityActions } = req.body;
  if (!businessName || !categories) return res.status(400).json({ error: 'Missing required fields' });

  const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(400).json({ error: 'Missing Anthropic API key' });

  const location = [city, state].filter(Boolean).join(', ') || 'your area';
  const worst = [...categories].sort((a, b) => a.score - b.score).slice(0, 3);
  const topAction = priorityActions?.[0]?.action || '';

  const prompt = `You are a digital marketing consultant writing a cold outreach pitch selling SEO services.

Business: ${businessName}
Type: ${businessType}
Location: ${location}
Overall SEO score: ${overallScore}/100
Competitor gap: ${competitorGap}
Weakest areas: ${worst.map(c => `${c.name} (${c.score}/100)`).join(', ')}
Top priority fix: ${topAction}
Key issues: ${worst.flatMap(c => c.issues.slice(0, 1)).join(' | ')}

Write a SHORT personalized cold email under 160 words.

Format exactly:
Subject: [subject line]

Hi [Owner / use business name naturally],

[body]

[Your Name]
SEO Consultant

Rules:
- Open with a specific observation about their low SEO score or a specific gap
- Name 2 specific weaknesses (e.g. missing from Google Maps pack, no AI visibility)
- Promise one concrete outcome (e.g. "rank in the top 3 for '${businessType} ${location}' within 90 days")
- Reference that competitors are outranking them
- End with CTA for a free 15-minute SEO audit call
- Sound human and urgent, not templated

Write only the pitch.`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 600, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await resp.json();
    const pitch = data.content.map(b => b.text || '').join('');
    return res.status(200).json({ pitch });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate pitch', detail: err.message });
  }
}
