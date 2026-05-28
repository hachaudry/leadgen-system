// api/social-section5.js — Missing channels, journey, call to action
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { businessName, niche, city, state, goal, profiles } = req.body || {};
    const KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
    if (!KEY) return res.status(400).json({ success: false, error: 'API key missing' });

    const nicheLabel = (niche||'').trim() || 'local business';
    const cityStr = city || 'California';
    const biz = businessName || 'this business';
    const goalLabel = goal || 'more bookings';

    const PLAT_COLORS = {
      facebook:'#1877F2', instagram:'#E1306C', linkedin:'#0A66C2', tiktok:'#010101',
      youtube:'#FF0000', twitter:'#000000', pinterest:'#E60023', yelp:'#D32323',
      googleBusiness:'#4285F4', threads:'#1c1c1c'
    };
    const PLAT_NAMES = {
      facebook:'Facebook', instagram:'Instagram', linkedin:'LinkedIn', tiktok:'TikTok',
      youtube:'YouTube', twitter:'X/Twitter', pinterest:'Pinterest', yelp:'Yelp',
      googleBusiness:'Google Business', threads:'Threads'
    };
    const PLAT_ICONS = {
      facebook:'📘', instagram:'📸', linkedin:'💼', tiktok:'🎵',
      youtube:'▶️', twitter:'🐦', pinterest:'📌', yelp:'⭐',
      googleBusiness:'📍', threads:'🧵'
    };

    const missingKeys = Object.keys(PLAT_NAMES).filter(k => !(profiles||{})[k]);
    const missingList = missingKeys.slice(0,5).map(k => `${PLAT_NAMES[k]} (${PLAT_ICONS[k]})`).join(', ');

    const prompt = `Social media strategist writing a proposal close. Return ONLY valid JSON, no markdown.
${nicheLabel} business: ${biz} in ${cityStr}, ${state||'CA'}. Goal: ${goalLabel}.
Missing channels: ${missingList||'several platforms'}.

Return exactly:
{
  "missingChannelOpportunities": [
    {"platform":"[top missing platform name]","color":"[hex]","icon":"[emoji]","whyNow":"[1 sentence — opportunity for ${nicheLabel} in ${cityStr}]","opportunity":"[1 sentence — what content + outcome]","priority":"High"},
    {"platform":"[second missing]","color":"[hex]","icon":"[emoji]","whyNow":"[1 sentence]","opportunity":"[1 sentence]","priority":"Medium"},
    {"platform":"[third missing]","color":"[hex]","icon":"[emoji]","whyNow":"[1 sentence]","opportunity":"[1 sentence]","priority":"Medium"}
  ],
  "expectedJourney": {
    "month1": {"label":"Month 1 — Foundation","color":"#1565c0","focus":"Profile setup + content system + first posts","wins":["[win for ${nicheLabel}]","[win]","[win]"]},
    "month3": {"label":"Month 3 — Results","color":"#2e7d32","focus":"Engagement converting to real business inquiries","wins":["[result for ${nicheLabel}]","[result]","[result]"]}
  },
  "callToAction": {
    "headline": "[compelling CTA for ${nicheLabel} referencing '${goalLabel}']",
    "subtext": "[2 sentences — competitors in ${cityStr} posting now, cost of waiting for ${nicheLabel}]",
    "buttonText": "Book Your Free Strategy Call"
  }
}
Use the actual color hex for each platform (Facebook #1877F2, Instagram #E1306C, LinkedIn #0A66C2, TikTok #010101, YouTube #FF0000, Pinterest #E60023, Yelp #D32323, Google Business #4285F4, Threads #1c1c1c, Twitter #000000).`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key':KEY, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({ model:'claude-3-5-haiku-20241022', max_tokens:600, messages:[{role:'user',content:prompt}] }),
      signal: AbortSignal.timeout(9000)
    });
    if (!r.ok) throw new Error(`Claude ${r.status}`);
    const d = await r.json();
    let raw = (d.content||[]).map(b=>b.text||'').join('').replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s===-1||e===-1) throw new Error('No JSON');
    const data = JSON.parse(raw.slice(s,e+1));
    return res.status(200).json({ success:true, section:'section5', data });
  } catch(err) {
    return res.status(500).json({ success:false, error:err.message });
  }
}
