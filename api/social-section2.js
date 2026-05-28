// api/social-section2.js — Proposed posting schedule
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { businessName, niche, city, state, budget, goal, profiles } = req.body || {};
    const KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
    if (!KEY) return res.status(400).json({ success: false, error: 'API key missing' });

    const nicheLabel = (niche||'').trim() || 'local business';
    const cityStr = city || 'California';
    const present = Object.values(profiles||{}).filter(Boolean).length;

    const prompt = `Social media content planner. Return ONLY valid JSON, no markdown.
${nicheLabel} business in ${cityStr}. Budget: ${budget||'$800-1500/mo'}. Goal: ${goal||'more bookings'}. Active platforms: ${present}.

Return exactly:
{
  "proposedPostingSchedule": {
    "totalPostsPerMonth": 48,
    "summaryLine": "[1 compelling sentence about volume for ${businessName||'this business'}]",
    "breakdown": [
      {"platform":"Instagram","color":"#E1306C","icon":"📸","postsPerMonth":16,"detail":"8 feed posts + 4 Reels + 4 Stories"},
      {"platform":"TikTok","color":"#010101","icon":"🎵","postsPerMonth":12,"detail":"12 short-form videos"},
      {"platform":"Facebook","color":"#1877F2","icon":"📘","postsPerMonth":10,"detail":"6 posts + 4 video posts"},
      {"platform":"YouTube","color":"#FF0000","icon":"▶️","postsPerMonth":4,"detail":"4 Shorts from AI video"},
      {"platform":"Google Business","color":"#4285F4","icon":"📍","postsPerMonth":4,"detail":"4 updates for local SEO"},
      {"platform":"Other","color":"#6a1b9a","icon":"📱","postsPerMonth":2,"detail":"2 posts on supporting platforms"}
    ]
  }
}
Adjust numbers to match budget and goal. Keep total realistic. summaryLine must mention ${nicheLabel} specifically.`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key':KEY, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({ model:'claude-3-5-haiku-20241022', max_tokens:400, messages:[{role:'user',content:prompt}] }),
      signal: AbortSignal.timeout(9000)
    });
    if (!r.ok) throw new Error(`Claude ${r.status}`);
    const d = await r.json();
    let raw = (d.content||[]).map(b=>b.text||'').join('').replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s===-1||e===-1) throw new Error('No JSON');
    const data = JSON.parse(raw.slice(s,e+1));
    return res.status(200).json({ success:true, section:'section2', data });
  } catch(err) {
    return res.status(500).json({ success:false, error:err.message });
  }
}
