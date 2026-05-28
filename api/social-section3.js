// api/social-section3.js — AI Video Strategy
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { businessName, niche, city, state } = req.body || {};
    const KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
    if (!KEY) return res.status(400).json({ success: false, error: 'API key missing' });

    const nicheLabel = (niche||'').trim() || 'local business';
    const cityStr = city || 'California';

    const prompt = `AI video content strategist. Return ONLY valid JSON, no markdown.
${nicheLabel} business: ${businessName||'this business'} in ${cityStr}, ${state||'CA'}.

Return exactly:
{
  "aiVideoStrategy": {
    "hook": "[1 punchy sentence — competitors posting AI video, ${businessName||'this business'} missing out]",
    "whyItMatters": "[2 sentences why AI video is essential for ${nicheLabel} in ${cityStr} in 2026]",
    "whatWeCreate": [
      "[AI video type 1 vivid description for ${nicheLabel}]",
      "[AI video type 2]",
      "[AI video type 3]"
    ],
    "platforms": ["Instagram Reels","TikTok","YouTube Shorts","Google Business Posts"],
    "videosPerMonth": 6,
    "turnaround": "48 hours per video",
    "veo3Advantage": "[2 sentences on Google Veo 3 quality vs $500-3000 traditional production for ${nicheLabel}]",
    "sampleIdea": "[1 vivid specific AI video concept for ${businessName||'this business'} — opening scene, hook, outcome in 2 sentences]"
  }
}`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key':KEY, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({ model:'claude-3-5-haiku-20241022', max_tokens:550, messages:[{role:'user',content:prompt}] }),
      signal: AbortSignal.timeout(9000)
    });
    if (!r.ok) throw new Error(`Claude ${r.status}`);
    const d = await r.json();
    let raw = (d.content||[]).map(b=>b.text||'').join('').replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s===-1||e===-1) throw new Error('No JSON');
    const data = JSON.parse(raw.slice(s,e+1));
    return res.status(200).json({ success:true, section:'section3', data });
  } catch(err) {
    return res.status(500).json({ success:false, error:err.message });
  }
}
