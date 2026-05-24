export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { lead, niche, city, revenueLoss, nextBestStep } = req.body;
  if (!lead) return res.status(400).json({ error: 'lead data required' });

  const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(400).json({ error: 'Missing Anthropic API key' });

  const loss = revenueLoss || 3500;
  const nbs = nextBestStep || 'Book a free 15-minute call this week';

  const prompt = `You are a professional video sales script writer for a digital marketing agency.

Business: ${lead.name}
Type: ${niche}
City: ${city}
Monthly Revenue Loss: $${loss.toLocaleString()}
Next Best Step: ${nbs}

Write 5 video pitch scripts. Each must:
- START with the revenue loss number as the hook
- END with the exact next best step
- Sound natural and spoken — no bullet points inside scripts
- Be direct, urgent, and personalized

Return ONLY valid JSON:
{
  "hook": "<15-second video hook script — opens with '$${loss.toLocaleString()}/month', grabs attention in 15 seconds, ends with curiosity hook to keep watching>",
  "short45": "<45-second script — intro with revenue loss, 2 specific problems, 1 solution, CTA>",
  "standard60": "<60-second standard script — revenue loss opener, 3 specific gaps, your agency's solution, proof point, CTA>",
  "loom": "<Detailed Loom walkthrough script with [screen share instructions in brackets]. Covers: revenue loss intro, screen share of their Google search presence, screen share gap analysis, screen share competitor comparison, solution overview, pricing teaser, CTA. ~90-120 seconds narrated.>",
  "ctas": [
    "<CTA version 1 — soft close: asking for 15 minutes>",
    "<CTA version 2 — urgency close: competitor is already moving>",
    "<CTA version 3 — value close: free audit offer>"
  ]
}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2400, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await resp.json();
    let raw = data.content.map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
    const si = raw.indexOf('{'), ei = raw.lastIndexOf('}');
    let scripts = null;
    try { if (si !== -1) scripts = JSON.parse(raw.slice(si, ei + 1)); } catch {}
    if (!scripts) return res.status(500).json({ error: 'Failed to parse scripts' });
    return res.status(200).json(scripts);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate video pitch', detail: err.message });
  }
}
