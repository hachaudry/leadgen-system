// api/social-section4.js — Content pillars, sample ideas, week calendar
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
    const biz = businessName || 'this business';

    const prompt = `Social media content creator. Return ONLY valid JSON, no markdown.
${nicheLabel} business: ${biz} in ${cityStr}, ${state||'CA'}.

Return exactly:
{
  "contentPillars": [
    {"name":"[pillar name]","emoji":"[emoji]","description":"[1 sentence for ${nicheLabel}]","exampleCaption":"[full ready-to-post caption with emoji and 3-5 hashtags]","platforms":["Instagram","TikTok"]},
    {"name":"[pillar name]","emoji":"[emoji]","description":"[1 sentence]","exampleCaption":"[full caption with hashtags]","platforms":["Facebook","Instagram"]},
    {"name":"[pillar name]","emoji":"[emoji]","description":"[1 sentence]","exampleCaption":"[full caption with hashtags]","platforms":["TikTok","Instagram"]}
  ],
  "sampleContentIdeas": [
    {"platform":"Instagram","color":"#E1306C","contentType":"Reel","idea":"[specific idea for ${nicheLabel}]","caption":"[full caption with emoji + hashtags]"},
    {"platform":"TikTok","color":"#010101","contentType":"Video","idea":"[specific idea]","caption":"[full caption]"},
    {"platform":"Facebook","color":"#1877F2","contentType":"Post","idea":"[specific idea]","caption":"[full caption]"},
    {"platform":"Instagram","color":"#E1306C","contentType":"Carousel","idea":"[specific idea]","caption":"[full caption]"},
    {"platform":"Google Business","color":"#4285F4","contentType":"Update","idea":"[specific idea]","caption":"[full caption]"}
  ],
  "sampleWeekCalendar": [
    {"day":"Monday","platform":"Instagram","contentType":"Reel","idea":"[${nicheLabel} specific idea]","color":"#E1306C"},
    {"day":"Tuesday","platform":"TikTok","contentType":"Video","idea":"[specific idea]","color":"#010101"},
    {"day":"Wednesday","platform":"Facebook","contentType":"Post","idea":"[specific idea]","color":"#1877F2"},
    {"day":"Thursday","platform":"Instagram","contentType":"Story","idea":"[specific idea]","color":"#E1306C"},
    {"day":"Friday","platform":"TikTok","contentType":"Video","idea":"[specific idea]","color":"#010101"},
    {"day":"Saturday","platform":"Instagram","contentType":"Feed Post","idea":"[specific idea]","color":"#E1306C"},
    {"day":"Sunday","platform":"Google Business","contentType":"Post","idea":"[specific idea]","color":"#4285F4"}
  ]
}`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key':KEY, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({ model:'claude-3-5-haiku-20241022', max_tokens:900, messages:[{role:'user',content:prompt}] }),
      signal: AbortSignal.timeout(9000)
    });
    if (!r.ok) throw new Error(`Claude ${r.status}`);
    const d = await r.json();
    let raw = (d.content||[]).map(b=>b.text||'').join('').replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s===-1||e===-1) throw new Error('No JSON');
    const data = JSON.parse(raw.slice(s,e+1));
    return res.status(200).json({ success:true, section:'section4', data });
  } catch(err) {
    return res.status(500).json({ success:false, error:err.message });
  }
}
