// api/social-section1.js — Plan title, opening, channel assessment
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { businessName, niche, city, state, rating, reviews, profiles, observations } = req.body || {};
    const KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
    if (!KEY) return res.status(400).json({ success: false, error: 'API key missing' });
    if (!businessName) return res.status(400).json({ success: false, error: 'businessName required' });

    const PLAT = {
      facebook:'Facebook', instagram:'Instagram', linkedin:'LinkedIn', tiktok:'TikTok',
      youtube:'YouTube', twitter:'X/Twitter', pinterest:'Pinterest', yelp:'Yelp',
      googleBusiness:'Google Business', threads:'Threads'
    };
    const COLORS = {
      facebook:'#1877F2', instagram:'#E1306C', linkedin:'#0A66C2', tiktok:'#010101',
      youtube:'#FF0000', twitter:'#000000', pinterest:'#E60023', yelp:'#D32323',
      googleBusiness:'#4285F4', threads:'#1c1c1c'
    };

    const present = [], missing = [];
    Object.keys(PLAT).forEach(k => {
      const url = (profiles||{})[k]||'', obs = (observations||{})[k]||'';
      if (url) present.push(`${PLAT[k]}: ${url}${obs?' ('+obs+')':''}`);
      else missing.push(`${PLAT[k]}${obs?' ('+obs+')':''}`);
    });

    const nicheLabel = (niche||'').trim() || 'local business';
    const cityStr = city || 'California';
    const nicheNote = (niche||'').trim()
      ? `Niche: ${nicheLabel}`
      : `Niche: NOT PROVIDED — infer from name "${businessName}" in ${cityStr}`;

    const prompt = `Social media strategist. Return ONLY valid JSON, no markdown.
Business: ${businessName}, ${cityStr}, ${state||'CA'}. Rating: ${rating||'N/A'} (${reviews||0} reviews). ${nicheNote}.
Present: ${present.join('; ')||'none'}. Missing: ${missing.join(', ')||'none'}.

Return exactly:
{
  "planTitle": "Social Media Plan for ${businessName} — [5-word subtitle for ${nicheLabel}]",
  "tagline": "[10-word max punchy tagline]",
  "openingStatement": {
    "headline": "[12-word max headline for ${nicheLabel}]",
    "body": "[2 sentences on social opportunity for ${nicheLabel} in ${cityStr}]",
    "agentObservations": "[2 sentences on research findings — platforms found, gaps identified]"
  },
  "whyNow": "[1-2 sentences urgency for ${nicheLabel} in ${cityStr}]",
  "channelAssessment": [
    {"platform":"Facebook","color":"#1877F2","status":"Present or Missing","agentObservation":"[brief obs]","currentState":"[1 sentence]","whatWeWillDo":"[1 sentence action]","postsPerMonth":10,"contentTypes":["Posts","Videos"],"priority":"High"},
    {"platform":"Instagram","color":"#E1306C","status":"Present or Missing","agentObservation":"[brief]","currentState":"[1 sentence]","whatWeWillDo":"[1 sentence]","postsPerMonth":16,"contentTypes":["Reels","Posts"],"priority":"High"},
    {"platform":"LinkedIn","color":"#0A66C2","status":"Present or Missing","agentObservation":"[brief]","currentState":"[1 sentence]","whatWeWillDo":"[1 sentence]","postsPerMonth":4,"contentTypes":["Posts"],"priority":"Medium"},
    {"platform":"TikTok","color":"#010101","status":"Present or Missing","agentObservation":"[brief]","currentState":"[1 sentence]","whatWeWillDo":"[1 sentence]","postsPerMonth":12,"contentTypes":["Videos"],"priority":"High"},
    {"platform":"YouTube","color":"#FF0000","status":"Present or Missing","agentObservation":"[brief]","currentState":"[1 sentence]","whatWeWillDo":"[1 sentence]","postsPerMonth":4,"contentTypes":["Shorts","Videos"],"priority":"Medium"},
    {"platform":"X / Twitter","color":"#000000","status":"Present or Missing","agentObservation":"[brief]","currentState":"[1 sentence]","whatWeWillDo":"[1 sentence]","postsPerMonth":4,"contentTypes":["Posts"],"priority":"Low"},
    {"platform":"Pinterest","color":"#E60023","status":"Present or Missing","agentObservation":"[brief]","currentState":"[1 sentence]","whatWeWillDo":"[1 sentence]","postsPerMonth":4,"contentTypes":["Pins"],"priority":"Low"},
    {"platform":"Yelp","color":"#D32323","status":"Present or Missing","agentObservation":"[brief]","currentState":"[1 sentence]","whatWeWillDo":"[1 sentence]","postsPerMonth":2,"contentTypes":["Reviews","Posts"],"priority":"Medium"},
    {"platform":"Google Business","color":"#4285F4","status":"Present or Missing","agentObservation":"[brief]","currentState":"[1 sentence]","whatWeWillDo":"[1 sentence]","postsPerMonth":4,"contentTypes":["Posts","Photos"],"priority":"High"},
    {"platform":"Threads","color":"#1c1c1c","status":"Present or Missing","agentObservation":"[brief]","currentState":"[1 sentence]","whatWeWillDo":"[1 sentence]","postsPerMonth":4,"contentTypes":["Posts"],"priority":"Low"}
  ]
}
Set each platform status to "Present" if it appears in Present list, "Missing" if in Missing list.`;

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
    return res.status(200).json({ success:true, section:'section1', data });
  } catch(err) {
    return res.status(500).json({ success:false, error:err.message });
  }
}
