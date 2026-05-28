// api/social-audit.js — Social Media Content & Posting Plan Generator

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

    const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_KEY) return res.status(400).json({ success: false, error: 'Anthropic API key missing.' });
    if (!businessName)  return res.status(400).json({ success: false, error: 'businessName is required' });

    const PLAT_NAMES = {
      facebook:'Facebook', instagram:'Instagram', linkedin:'LinkedIn', tiktok:'TikTok',
      youtube:'YouTube', twitter:'X / Twitter', pinterest:'Pinterest', yelp:'Yelp',
      googleBusiness:'Google Business Profile', threads:'Threads'
    };
    const PLAT_COLORS = {
      facebook:'#1877F2', instagram:'#E1306C', linkedin:'#0A66C2', tiktok:'#010101',
      youtube:'#FF0000', twitter:'#000000', pinterest:'#E60023', yelp:'#D32323',
      googleBusiness:'#4285F4', threads:'#1c1c1c'
    };

    const presentLines = [];
    const missingLines = [];
    Object.keys(PLAT_NAMES).forEach(pk => {
      const url = (profiles || {})[pk] || '';
      const obs = (observations || {})[pk] || '';
      const name = PLAT_NAMES[pk];
      if (url) presentLines.push(`${name}: FOUND — ${url}${obs ? ` (note: ${obs})` : ''}`);
      else missingLines.push(`${name}: NOT FOUND${obs ? ` (note: ${obs})` : ''}`);
    });

    const nicheStr    = (niche || '').trim();
    const nicheLabel  = nicheStr || 'local business';  // display label; AI infers actual type when blank
    const cityStr     = city      || 'California';
    const stateStr    = state     || 'CA';
    const budgetLabel = budget    || 'Growth: $800-1500/month';
    const painLabel   = painPoint || 'Not enough new customers';
    const goalLabel   = goal      || 'More bookings/reservations/appointments';

    // If niche is missing, ask Claude to infer it from the business name + city
    const nicheInstruction = nicheStr
      ? `- Type: ${nicheLabel}`
      : `- Type: NOT PROVIDED — infer the most likely business type from the business name "${businessName}" and location "${cityStr}, ${stateStr}", then use that throughout the entire analysis.`;

    const channelContext = [
      presentLines.length ? `PRESENT:\n${presentLines.join('\n')}` : 'PRESENT: None found',
      missingLines.length ? `MISSING:\n${missingLines.join('\n')}` : ''
    ].filter(Boolean).join('\n\n');

    const prompt = `You are a senior social media strategist at a premium digital marketing agency. Create a focused Social Media Content & Posting Plan for this prospect.

ONLY cover: social media content, posting strategy, AI video (Google Veo 3), community management. NO SEO, NO website, NO pricing tiers.

CLIENT:
- Business: ${businessName}
${nicheInstruction}
- Location: ${cityStr}, ${stateStr}
- Rating: ${rating || 'N/A'} (${reviews || 0} reviews)
- Challenge: ${painLabel}
- Goal: ${goalLabel}
- Budget: ${budgetLabel}

SOCIAL MEDIA RESEARCH:
${channelContext}

Return ONLY valid JSON (no markdown, no commentary) with exactly these fields. Make every sentence specific to ${nicheLabel} in ${cityStr} — zero generic advice:

{
  "planTitle": "Social Media Content Plan for ${businessName} — [compelling 6-8 word subtitle for ${nicheLabel}]",
  "tagline": "[punchy max-10-word tagline like 'More Visibility. More Bookings. Zero Effort.']",
  "openingStatement": {
    "headline": "[punchy max-12-word headline addressing '${painLabel}']",
    "body": "[2 sentences about the social media opportunity for ${nicheLabel} in ${cityStr} right now]",
    "agentObservations": "[2 sentences about what was found during research — specific platforms, gaps, strengths]"
  },
  "whyNow": "[1-2 sentences of urgency — why acting NOW is critical, what ${nicheLabel} competitors in ${cityStr} are doing]",
  "channelAssessment": [
    {
      "platform": "[name]", "key": "[key]", "status": "[Present or Missing]",
      "url": "[url or null]", "agentObservation": "[obs or null]",
      "currentState": "[1 honest sentence based on evidence]",
      "whatWeWillDo": "[2 specific sentences about content we create on this platform for ${nicheLabel}]",
      "postsPerMonth": 12, "contentTypes": ["Feed Posts","Reels"], "priority": "High", "color": "[hex]"
    }
  ],
  "proposedPostingSchedule": {
    "totalPostsPerMonth": 52,
    "summaryLine": "[compelling line about volume and consistency for ${businessName}]",
    "breakdown": [
      {"platform":"Instagram","color":"#E1306C","icon":"📸","postsPerMonth":16,"detail":"8 feed posts + 4 Reels + 4 Stories highlights"},
      {"platform":"TikTok","color":"#010101","icon":"🎵","postsPerMonth":12,"detail":"12 short-form videos using trending audio"},
      {"platform":"Facebook","color":"#1877F2","icon":"📘","postsPerMonth":12,"detail":"8 feed posts + 4 video posts"},
      {"platform":"YouTube","color":"#FF0000","icon":"▶️","postsPerMonth":4,"detail":"4 Shorts repurposed from AI video"},
      {"platform":"Google Business","color":"#4285F4","icon":"📍","postsPerMonth":4,"detail":"4 updates/offers for local visibility"},
      {"platform":"Other","color":"#6a1b9a","icon":"📱","postsPerMonth":4,"detail":"4 posts across supporting platforms"}
    ]
  },
  "aiVideoStrategy": {
    "hook": "[1 punchy sentence — competitors posting video, this business missing out]",
    "whyItMatters": "[2 sentences why AI video is transformative for ${nicheLabel} in ${cityStr}]",
    "whatWeCreate": [
      "[AI video type 1 — vivid niche-specific description]",
      "[AI video type 2]",
      "[AI video type 3]",
      "[AI video type 4]"
    ],
    "platforms": ["Instagram Reels","TikTok","YouTube Shorts","Google Business Posts"],
    "videosPerMonth": 8,
    "turnaround": "48 hours per video",
    "veo3Advantage": "[2 sentences on Google Veo 3 — cinematic quality vs $500-3000 traditional production]",
    "sampleIdea": "[1 vivid specific AI video concept for ${businessName} — opening scene, hook, outcome in 2 sentences]"
  },
  "contentPillars": [
    {"name":"[pillar 1]","emoji":"[emoji]","description":"[1 sentence for ${nicheLabel}]","exampleCaption":"[complete ready-to-post caption with emoji + 3-5 hashtags]","platforms":["Instagram","TikTok"]},
    {"name":"[pillar 2]","emoji":"[emoji]","description":"[1 sentence]","exampleCaption":"[complete caption]","platforms":["Facebook","Instagram"]},
    {"name":"[pillar 3]","emoji":"[emoji]","description":"[1 sentence]","exampleCaption":"[complete caption]","platforms":["TikTok","Instagram"]},
    {"name":"[pillar 4]","emoji":"[emoji]","description":"[1 sentence]","exampleCaption":"[complete caption]","platforms":["Instagram","Facebook"]},
    {"name":"[pillar 5]","emoji":"[emoji]","description":"[1 sentence]","exampleCaption":"[complete caption]","platforms":["Instagram","Google Business"]}
  ],
  "sampleContentIdeas": [
    {"platform":"Instagram","color":"#E1306C","contentType":"Reel","idea":"[specific idea for ${nicheLabel}]","caption":"[FULL ready-to-post caption with emoji + hashtags]"},
    {"platform":"TikTok","color":"#010101","contentType":"Video","idea":"[specific idea]","caption":"[full caption]"},
    {"platform":"Facebook","color":"#1877F2","contentType":"Post","idea":"[specific idea]","caption":"[full caption]"},
    {"platform":"Instagram","color":"#E1306C","contentType":"Carousel","idea":"[specific idea]","caption":"[full caption]"},
    {"platform":"TikTok","color":"#010101","contentType":"Video","idea":"[specific idea]","caption":"[full caption]"},
    {"platform":"Instagram","color":"#E1306C","contentType":"Feed Post","idea":"[specific idea]","caption":"[full caption]"},
    {"platform":"Facebook","color":"#1877F2","contentType":"Video Post","idea":"[specific idea]","caption":"[full caption]"},
    {"platform":"Instagram","color":"#E1306C","contentType":"Story","idea":"[specific idea]","caption":"[full caption]"},
    {"platform":"TikTok","color":"#010101","contentType":"Trending Audio","idea":"[specific idea]","caption":"[full caption]"},
    {"platform":"Instagram","color":"#E1306C","contentType":"Reel","idea":"[specific idea]","caption":"[full caption]"}
  ],
  "sampleWeekCalendar": [
    {"day":"Monday","platform":"Instagram","contentType":"Reel","idea":"[niche-specific idea]","color":"#E1306C"},
    {"day":"Tuesday","platform":"TikTok","contentType":"Video","idea":"[niche-specific idea]","color":"#010101"},
    {"day":"Wednesday","platform":"Facebook","contentType":"Post","idea":"[niche-specific idea]","color":"#1877F2"},
    {"day":"Thursday","platform":"Instagram","contentType":"Story","idea":"[niche-specific idea]","color":"#E1306C"},
    {"day":"Friday","platform":"TikTok","contentType":"Video","idea":"[niche-specific idea]","color":"#010101"},
    {"day":"Saturday","platform":"Instagram","contentType":"Feed Post","idea":"[niche-specific idea]","color":"#E1306C"},
    {"day":"Sunday","platform":"Facebook","contentType":"Post","idea":"[niche-specific idea]","color":"#1877F2"}
  ],
  "missingChannelOpportunities": [
    {"platform":"[top missing platform for ${nicheLabel}]","color":"[hex]","icon":"[emoji]","whyNow":"[1 sentence — opportunity for ${nicheLabel} in ${cityStr}]","opportunity":"[1 sentence — what content + what outcome]","priority":"High"},
    {"platform":"[second missing platform]","color":"[hex]","icon":"[emoji]","whyNow":"[1 sentence]","opportunity":"[1 sentence]","priority":"Medium"},
    {"platform":"[third missing platform]","color":"[hex]","icon":"[emoji]","whyNow":"[1 sentence]","opportunity":"[1 sentence]","priority":"Medium"}
  ],
  "expectedJourney": {
    "month1": {"label":"Month 1 — Foundation","color":"#1565c0","focus":"[profile optimisation + content system + first rhythm]","wins":["[win 1]","[win 2]","[win 3]"]},
    "month2": {"label":"Month 2 — Momentum","color":"#6a1b9a","focus":"[algorithm traction + growing engagement]","wins":["[win 1]","[win 2]","[win 3]"]},
    "month3": {"label":"Month 3 — Results","color":"#2e7d32","focus":"[engagement converting to real business inquiries]","wins":["[win 1]","[win 2]","[win 3]"]}
  },
  "ourContentProcess": [
    {"step":1,"icon":"🔍","title":"Deep Dive Brand Audit","description":"[1 sentence specific to ${nicheLabel}]"},
    {"step":2,"icon":"🎨","title":"Brand Kit & Visual System","description":"[1 sentence]"},
    {"step":3,"icon":"📅","title":"Content Calendar Build","description":"[1 sentence]"},
    {"step":4,"icon":"🎬","title":"Content Production & AI Video","description":"[1 sentence about Google Veo 3]"},
    {"step":5,"icon":"📊","title":"Post, Manage & Report","description":"[1 sentence]"}
  ],
  "callToAction": {
    "headline":"[compelling CTA for ${nicheLabel} referencing '${goalLabel}']",
    "subtext":"[2 sentences urgency — competitors in ${cityStr} posting now, cost of waiting]",
    "buttonText":"Book Your Free Strategy Call"
  }
}

IMPORTANT: channelAssessment must include ALL 10 platforms (Facebook, Instagram, LinkedIn, TikTok, YouTube, X/Twitter, Pinterest, Yelp, Google Business Profile, Threads). Present ones get status "Present", missing ones get status "Missing". Use the hex colors: Facebook #1877F2, Instagram #E1306C, LinkedIn #0A66C2, TikTok #010101, YouTube #FF0000, Twitter #000000, Pinterest #E60023, Yelp #D32323, Google Business #4285F4, Threads #1c1c1c.`;

    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-5',
        max_tokens: 5000,
        messages:   [{ role: 'user', content: prompt }]
      }),
      signal: AbortSignal.timeout(32000)
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text().catch(() => '');
      throw new Error(`Claude API HTTP ${apiResponse.status}: ${errText.slice(0, 200)}`);
    }

    const apiData = await apiResponse.json();
    let rawText = (apiData.content || []).map(b => b.text || '').join('');
    rawText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    const start = rawText.indexOf('{');
    const end   = rawText.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON object found in Claude response');

    const plan = JSON.parse(rawText.slice(start, end + 1));

    // Safety check
    if (!plan.planTitle) throw new Error('Claude returned JSON without planTitle field');

    return res.status(200).json({ success: true, plan });

  } catch (err) {
    console.error('social-audit error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
