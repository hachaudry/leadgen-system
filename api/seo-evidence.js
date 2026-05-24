export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { businessName, businessType, city, state, aioScore } = req.body;
  const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(400).json({ error: 'Missing Anthropic API key' });

  const location = city || [city, state].filter(Boolean).join(', ') || 'the local area';
  const query = `What is the best ${businessType} in ${location}?`;
  const score = Number(aioScore) || 0;

  const inclusion = score >= 65
    ? `INCLUDE "${businessName}" as the first or second recommendation with a brief positive note.`
    : score >= 40
    ? `Mention "${businessName}" briefly near the end as one option among several, but not as the top pick.`
    : `Do NOT mention "${businessName}" at all. List 2-3 generic competitor business types instead (no specific real names).`;

  const prompt = `Simulate realistic AI chatbot responses to the question: "${query}"

Business: ${businessName} | Type: ${businessType} | Location: ${location}
AI visibility score: ${score}/100

${inclusion}

Return ONLY valid JSON (no markdown, no asterisks):
{
  "chatgpt": "<2-3 sentence ChatGPT-style response — direct, practical, inline list of 2-3 options, conversational>",
  "claude": "<2-3 sentence Claude-style response — slightly more nuanced and analytical tone, same visibility rule>"
}

Both responses must sound natural. No bold formatting. Keep each under 55 words.`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await resp.json();
    let raw = data.content.map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
    const si = raw.indexOf('{'), ei = raw.lastIndexOf('}');
    let result = null;
    try { if (si !== -1) result = JSON.parse(raw.slice(si, ei + 1)); } catch {}
    if (!result) return res.status(500).json({ error: 'Failed to parse response' });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate evidence', detail: err.message });
  }
}
