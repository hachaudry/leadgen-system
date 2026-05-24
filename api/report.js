const CORS = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key');
};

const claude = async (key, prompt, tokens = 1800) => {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: tokens, messages: [{ role: 'user', content: prompt }] })
  });
  const d = await r.json();
  return d.content?.map(b => b.text || '').join('') || '';
};

const parseJSON = (raw) => {
  const clean = raw.replace(/```json|```/g, '').trim();
  const si = clean.search(/[{[]/), ei = Math.max(clean.lastIndexOf('}'), clean.lastIndexOf(']'));
  try { return si !== -1 ? JSON.parse(clean.slice(si, ei + 1)) : null; } catch { return null; }
};

const prompts = {

'local-seo': (lead, niche, city) => `You are a senior local SEO analyst writing a detailed audit for a sales presentation.

Business: ${lead.name}
Type: ${niche}
City: ${city}
Rating: ${lead.rating || 'unknown'} (${lead.reviews || 0} reviews)
Website: ${lead.website || 'none'}
Address: ${lead.address || 'unknown'}

Score 6 local SEO categories. Most small local businesses score 25-55 overall.

Return ONLY valid JSON:
{
  "overallScore": <0-100>,
  "opportunityScore": <0-100>,
  "recommendedService": "<service to pitch>",
  "salesAngle": "<1 sentence hook>",
  "salesSummary": "<2-3 sentence why this prospect is worth targeting>",
  "subscores": [
    {"name":"GMB Presence","score":<0-100>,"status":"<Critical Gap|Needs Improvement|Average|Strong>","detail":"<specific finding>"},
    {"name":"Review Strength","score":<0-100>,"status":"<...>","detail":"<...>"},
    {"name":"Category Optimization","score":<0-100>,"status":"<...>","detail":"<...>"},
    {"name":"Local Keyword Presence","score":<0-100>,"status":"<...>","detail":"<...>"},
    {"name":"NAP Consistency","score":<0-100>,"status":"<...>","detail":"<...>"},
    {"name":"Local Ranking Opportunity","score":<0-100>,"status":"<...>","detail":"<...>"}
  ],
  "issues": ["<specific issue 1>","<issue 2>","<issue 3>"],
  "quickWins": ["<win 1>","<win 2>"],
  "painPoints": [
    {"rank":1,"problem":"<biggest local SEO gap>","costMin":<number>,"costMax":<number>},
    {"rank":2,"problem":"<second gap>","costMin":<number>,"costMax":<number>},
    {"rank":3,"problem":"<third gap>","costMin":<number>,"costMax":<number>}
  ],
  "nextBestStep": "Your single best next step: <specific action>. Here is why this will get you <specific result> in <timeframe> — <reason referencing their specific gap vs top competitor>."
}`,

'website': (lead, niche, city) => `You are a senior website conversion specialist writing a client-facing audit.

Business: ${lead.name}
Type: ${niche}
City: ${city}
Website: ${lead.website || 'none — no website detected'}
Rating: ${lead.rating || 'unknown'} (${lead.reviews || 0} reviews)

Audit their website (or lack thereof). Be specific and sales-oriented.

Return ONLY valid JSON:
{
  "overallScore": <0-100>,
  "opportunityScore": <0-100>,
  "recommendedService": "<service to pitch>",
  "salesAngle": "<1 sentence hook>",
  "salesSummary": "<2-3 sentences why targeting this prospect>",
  "subscores": [
    {"name":"Design Quality","score":<0-100>,"status":"<Critical|Needs Work|Average|Strong>","detail":"<finding>"},
    {"name":"Mobile Experience","score":<0-100>,"status":"<...>","detail":"<...>"},
    {"name":"Page Speed","score":<0-100>,"status":"<...>","detail":"<...>"},
    {"name":"CTA Clarity","score":<0-100>,"status":"<...>","detail":"<...>"},
    {"name":"Lead Capture","score":<0-100>,"status":"<...>","detail":"<...>"},
    {"name":"Trust Signals","score":<0-100>,"status":"<...>","detail":"<...>"},
    {"name":"Content Quality","score":<0-100>,"status":"<...>","detail":"<...>"}
  ],
  "annotations": [
    {"num":1,"issue":"<specific visible problem>"},
    {"num":2,"issue":"<specific visible problem>"},
    {"num":3,"issue":"<specific visible problem>"},
    {"num":4,"issue":"<specific visible problem>"}
  ],
  "painPoints": [
    {"rank":1,"problem":"<biggest website gap>","costMin":<number>,"costMax":<number>},
    {"rank":2,"problem":"<second gap>","costMin":<number>,"costMax":<number>},
    {"rank":3,"problem":"<third gap>","costMin":<number>,"costMax":<number>}
  ],
  "nextBestStep": "Your single best next step: <action>. Here is why this will get you <result> in <timeframe> — <specific reason>."
}`,

'ads': (lead, niche, city) => `You are a paid advertising strategist auditing a local business for an agency sales pitch.

Business: ${lead.name}
Type: ${niche}
City: ${city}
Website: ${lead.website || 'none'}
Rating: ${lead.rating || 'unknown'} (${lead.reviews || 0} reviews)

Estimate their current ad presence and opportunity.

Return ONLY valid JSON:
{
  "overallScore": <0-100>,
  "opportunityScore": <0-100>,
  "recommendedService": "<service to pitch>",
  "salesAngle": "<1 sentence hook>",
  "salesSummary": "<2-3 sentences>",
  "subscores": [
    {"name":"Google Ads Opportunity","score":<0-100>,"status":"<Critical|Needs Work|Average|Strong>","detail":"<...>"},
    {"name":"Meta Ads Opportunity","score":<0-100>,"status":"<...>","detail":"<...>"},
    {"name":"TikTok Ads Opportunity","score":<0-100>,"status":"<...>","detail":"<...>"},
    {"name":"Retargeting Opportunity","score":<0-100>,"status":"<...>","detail":"<...>"},
    {"name":"Landing Page Readiness","score":<0-100>,"status":"<...>","detail":"<...>"},
    {"name":"Offer Clarity","score":<0-100>,"status":"<...>","detail":"<...>"}
  ],
  "platforms": {
    "google": {"status":"Running|Not Running","competitorSpend":"<range>","missedRevenue":"<range>"},
    "meta":   {"status":"Running|Not Running","competitorSpend":"<range>","missedRevenue":"<range>"},
    "tiktok": {"status":"Running|Not Running","competitorSpend":"<range>","missedRevenue":"<range>"}
  },
  "painPoints": [
    {"rank":1,"problem":"<biggest ads gap>","costMin":<number>,"costMax":<number>},
    {"rank":2,"problem":"<second gap>","costMin":<number>,"costMax":<number>},
    {"rank":3,"problem":"<third gap>","costMin":<number>,"costMax":<number>}
  ],
  "nextBestStep": "Your single best next step: <action>. Here is why this will get you <result> in <timeframe> — <specific reason>."
}`,

'360': (lead, niche, city) => `You are a senior digital marketing director writing a 360-degree audit for a client presentation.

Business: ${lead.name}
Type: ${niche}
City: ${city}
Website: ${lead.website || 'none'}
Rating: ${lead.rating || 'unknown'} (${lead.reviews || 0} reviews)
Pain: ${lead.pain || 'unknown'}

Write a complete 360-degree digital marketing audit. Be specific and compelling.

Return ONLY valid JSON:
{
  "overallScore": <0-100>,
  "opportunityScore": <0-100>,
  "recommendedService": "<Full Digital Marketing Package description>",
  "salesAngle": "<1 sentence hook>",
  "salesSummary": "<2-3 sentences compelling reason to hire agency>",
  "categories": [
    {"name":"SEO Score","score":<0-100>,"status":"<Critical|Needs Work|Average|Strong|Excellent>","opportunity":"<High|Medium|Low>","action":"<recommended action>"},
    {"name":"Social Media Score","score":<0-100>,"status":"<...>","opportunity":"<...>","action":"<...>"},
    {"name":"Website Score","score":<0-100>,"status":"<...>","opportunity":"<...>","action":"<...>"},
    {"name":"Local SEO / GMB Score","score":<0-100>,"status":"<...>","opportunity":"<...>","action":"<...>"},
    {"name":"Ads Opportunity Score","score":<0-100>,"status":"<...>","opportunity":"<...>","action":"<...>"},
    {"name":"Competitor Gap Score","score":<0-100>,"status":"<...>","opportunity":"<...>","action":"<...>"},
    {"name":"AEO / GEO Readiness","score":<0-100>,"status":"<...>","opportunity":"<...>","action":"<...>"},
    {"name":"Overall Digital Score","score":<0-100>,"status":"<...>","opportunity":"<...>","action":"<...>"}
  ],
  "roadmap": {
    "month1": {"title":"Foundation","tasks":["<task>","<task>","<task>"],"expected":"<measurable result>"},
    "month2": {"title":"Content & Social","tasks":["<task>","<task>","<task>"],"expected":"<measurable result>"},
    "month3": {"title":"Growth & Scale","tasks":["<task>","<task>","<task>"],"expected":"<measurable result>"}
  },
  "painPoints": [
    {"rank":1,"problem":"<biggest gap>","costMin":<number>,"costMax":<number>},
    {"rank":2,"problem":"<second gap>","costMin":<number>,"costMax":<number>},
    {"rank":3,"problem":"<third gap>","costMin":<number>,"costMax":<number>},
    {"rank":4,"problem":"<fourth gap>","costMin":<number>,"costMax":<number>},
    {"rank":5,"problem":"<fifth gap>","costMin":<number>,"costMax":<number>}
  ],
  "nextBestStep": "Your single best next step: <action>. Here is why this will get you <result> in <timeframe> — <specific reason>."
}`
};

export default async function handler(req, res) {
  CORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, lead, niche, city } = req.body;
  if (!type || !lead) return res.status(400).json({ error: 'type and lead required' });

  const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(400).json({ error: 'Missing Anthropic API key' });

  const promptFn = prompts[type];
  if (!promptFn) return res.status(400).json({ error: `Unknown report type: ${type}` });

  try {
    const raw = await claude(ANTHROPIC_KEY, promptFn(lead, niche || lead.businessType || '', city || lead.city || ''), 2200);
    const data = parseJSON(raw);
    if (!data) return res.status(500).json({ error: 'Failed to parse AI response' });
    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
