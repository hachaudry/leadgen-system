// api/social-audit.js — Social Media Plan (single fast call, Haiku model)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      businessName, niche, city, state, rating, reviews,
      profiles, observations, goal, painPoint, budget
    } = req.body || {};

    const KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
    if (!KEY)          return res.status(400).json({ success: false, error: 'Anthropic API key missing.' });
    if (!businessName) return res.status(400).json({ success: false, error: 'businessName is required.' });

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
      const url = (profiles  || {})[k] || '';
      const obs = (observations || {})[k] || '';
      if (url) present.push(`${PLAT[k]}: ${url}${obs ? ' — ' + obs : ''}`);
      else     missing.push(`${PLAT[k]}${obs ? ' (' + obs + ')' : ''}`);
    });

    const nicheLabel = (niche || '').trim() || 'local business';
    const cityStr    = city  || 'California';
    const nicheNote  = (niche || '').trim()
      ? nicheLabel
      : `(infer from "${businessName}" in ${cityStr})`;

    const prompt = `You are a social media strategist. Create a social media plan for ${businessName}, a ${nicheNote} in ${cityStr}, ${state || 'CA'}.
Rating: ${rating || 'N/A'} (${reviews || 0} reviews). Goal: ${goal || 'more bookings'}. Challenge: ${painPoint || 'not enough customers'}. Budget: ${budget || '$800-1500/mo'}.
Present channels: ${present.join('; ') || 'none found'}.
Missing channels: ${missing.join(', ') || 'none'}.

Return ONLY valid JSON (no markdown) with EXACTLY this structure. Keep all string values under 25 words:
{
  "planTitle": "Social Media Plan for ${businessName}",
  "tagline": "short punchy tagline for ${nicheLabel}",
  "openingStatement": {
    "headline": "short headline addressing the challenge",
    "body": "2 sentences about social media opportunity for ${nicheLabel} in ${cityStr}",
    "agentObservations": "2 sentences on what was found — platforms present, gaps identified"
  },
  "whyNow": "1-2 sentences urgency for ${nicheLabel} in ${cityStr}",
  "channelAssessment": [
    {"platform":"Facebook","color":"#1877F2","status":"Present or Missing","agentObservation":"brief note","currentState":"1 sentence","whatWeWillDo":"1 action sentence","postsPerMonth":10,"contentTypes":["Posts"],"priority":"High"},
    {"platform":"Instagram","color":"#E1306C","status":"Present or Missing","agentObservation":"brief note","currentState":"1 sentence","whatWeWillDo":"1 action sentence","postsPerMonth":16,"contentTypes":["Reels","Posts"],"priority":"High"},
    {"platform":"LinkedIn","color":"#0A66C2","status":"Present or Missing","agentObservation":"brief note","currentState":"1 sentence","whatWeWillDo":"1 action sentence","postsPerMonth":4,"contentTypes":["Posts"],"priority":"Medium"},
    {"platform":"TikTok","color":"#010101","status":"Present or Missing","agentObservation":"brief note","currentState":"1 sentence","whatWeWillDo":"1 action sentence","postsPerMonth":12,"contentTypes":["Videos"],"priority":"High"},
    {"platform":"YouTube","color":"#FF0000","status":"Present or Missing","agentObservation":"brief note","currentState":"1 sentence","whatWeWillDo":"1 action sentence","postsPerMonth":4,"contentTypes":["Shorts"],"priority":"Medium"},
    {"platform":"X/Twitter","color":"#000000","status":"Present or Missing","agentObservation":"brief note","currentState":"1 sentence","whatWeWillDo":"1 action sentence","postsPerMonth":4,"contentTypes":["Posts"],"priority":"Low"},
    {"platform":"Pinterest","color":"#E60023","status":"Present or Missing","agentObservation":"brief note","currentState":"1 sentence","whatWeWillDo":"1 action sentence","postsPerMonth":4,"contentTypes":["Pins"],"priority":"Low"},
    {"platform":"Yelp","color":"#D32323","status":"Present or Missing","agentObservation":"brief note","currentState":"1 sentence","whatWeWillDo":"1 action sentence","postsPerMonth":2,"contentTypes":["Posts"],"priority":"Medium"},
    {"platform":"Google Business","color":"#4285F4","status":"Present or Missing","agentObservation":"brief note","currentState":"1 sentence","whatWeWillDo":"1 action sentence","postsPerMonth":4,"contentTypes":["Posts"],"priority":"High"},
    {"platform":"Threads","color":"#1c1c1c","status":"Present or Missing","agentObservation":"brief note","currentState":"1 sentence","whatWeWillDo":"1 action sentence","postsPerMonth":4,"contentTypes":["Posts"],"priority":"Low"}
  ],
  "proposedPostingSchedule": {
    "totalPostsPerMonth": 48,
    "summaryLine": "one sentence about volume for ${businessName}",
    "breakdown": [
      {"platform":"Instagram","color":"#E1306C","icon":"📸","postsPerMonth":16,"detail":"brief breakdown"},
      {"platform":"TikTok","color":"#010101","icon":"🎵","postsPerMonth":12,"detail":"brief breakdown"},
      {"platform":"Facebook","color":"#1877F2","icon":"📘","postsPerMonth":10,"detail":"brief breakdown"},
      {"platform":"YouTube","color":"#FF0000","icon":"▶️","postsPerMonth":4,"detail":"brief breakdown"},
      {"platform":"Google Business","color":"#4285F4","icon":"📍","postsPerMonth":4,"detail":"brief breakdown"},
      {"platform":"Other","color":"#6a1b9a","icon":"📱","postsPerMonth":2,"detail":"brief breakdown"}
    ]
  },
  "aiVideoStrategy": {
    "hook": "1 punchy sentence about competitors using AI video",
    "whyItMatters": "2 sentences on AI video for ${nicheLabel}",
    "whatWeCreate": ["video type 1 for ${nicheLabel}", "video type 2", "video type 3"],
    "platforms": ["Instagram Reels","TikTok","YouTube Shorts"],
    "videosPerMonth": 6,
    "turnaround": "48 hours per video",
    "veo3Advantage": "2 sentences on Google Veo 3 advantage",
    "sampleIdea": "1 specific AI video idea for ${businessName}"
  },
  "contentPillars": [
    {"name":"pillar name","emoji":"emoji","description":"1 sentence for ${nicheLabel}","exampleCaption":"ready-to-post caption with hashtags","platforms":["Instagram","TikTok"]},
    {"name":"pillar name","emoji":"emoji","description":"1 sentence","exampleCaption":"caption with hashtags","platforms":["Facebook","Instagram"]},
    {"name":"pillar name","emoji":"emoji","description":"1 sentence","exampleCaption":"caption with hashtags","platforms":["TikTok","Instagram"]}
  ],
  "sampleContentIdeas": [
    {"platform":"Instagram","color":"#E1306C","contentType":"Reel","idea":"specific idea for ${nicheLabel}","caption":"full caption with hashtags"},
    {"platform":"TikTok","color":"#010101","contentType":"Video","idea":"specific idea","caption":"full caption"},
    {"platform":"Facebook","color":"#1877F2","contentType":"Post","idea":"specific idea","caption":"full caption"},
    {"platform":"Instagram","color":"#E1306C","contentType":"Carousel","idea":"specific idea","caption":"full caption"},
    {"platform":"Google Business","color":"#4285F4","contentType":"Update","idea":"specific idea","caption":"full caption"}
  ],
  "sampleWeekCalendar": [
    {"day":"Monday","platform":"Instagram","contentType":"Reel","idea":"${nicheLabel} specific idea","color":"#E1306C"},
    {"day":"Tuesday","platform":"TikTok","contentType":"Video","idea":"specific idea","color":"#010101"},
    {"day":"Wednesday","platform":"Facebook","contentType":"Post","idea":"specific idea","color":"#1877F2"},
    {"day":"Thursday","platform":"Instagram","contentType":"Story","idea":"specific idea","color":"#E1306C"},
    {"day":"Friday","platform":"TikTok","contentType":"Video","idea":"specific idea","color":"#010101"},
    {"day":"Saturday","platform":"Instagram","contentType":"Feed Post","idea":"specific idea","color":"#E1306C"},
    {"day":"Sunday","platform":"Google Business","contentType":"Post","idea":"specific idea","color":"#4285F4"}
  ],
  "missingChannelOpportunities": [
    {"platform":"top missing platform","color":"hex","icon":"emoji","whyNow":"1 sentence opportunity","opportunity":"1 sentence action","priority":"High"},
    {"platform":"second missing","color":"hex","icon":"emoji","whyNow":"1 sentence","opportunity":"1 sentence","priority":"Medium"},
    {"platform":"third missing","color":"hex","icon":"emoji","whyNow":"1 sentence","opportunity":"1 sentence","priority":"Medium"}
  ],
  "expectedJourney": {
    "month1": {"label":"Month 1 — Foundation","color":"#1565c0","focus":"profile setup and first content","wins":["win 1 for ${nicheLabel}","win 2","win 3"]},
    "month3": {"label":"Month 3 — Results","color":"#2e7d32","focus":"engagement converting to inquiries","wins":["result 1","result 2","result 3"]}
  },
  "callToAction": {
    "headline": "compelling CTA for ${nicheLabel}",
    "subtext": "2 sentences — competitors posting now, cost of waiting",
    "buttonText": "Book Your Free Strategy Call"
  }
}
Set each platform status "Present" if its URL was provided, "Missing" otherwise.`;

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-5',
        max_tokens: 1800,
        messages:   [{ role: 'user', content: prompt }]
      }),
      signal: AbortSignal.timeout(9000)
    });

    if (!apiRes.ok) {
      const txt = await apiRes.text().catch(() => '');
      throw new Error(`Claude API ${apiRes.status}: ${txt.slice(0, 200)}`);
    }

    const apiData = await apiRes.json();
    let raw = (apiData.content || []).map(b => b.text || '').join('');
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s === -1 || e === -1) throw new Error('No JSON in Claude response');
    const plan = JSON.parse(raw.slice(s, e + 1));
    if (!plan.planTitle) throw new Error('Response missing planTitle');

    return res.status(200).json({ success: true, plan });

  } catch (err) {
    console.error('social-audit error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
