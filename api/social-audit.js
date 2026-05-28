// api/social-audit.js — Social Media Content & Posting Plan Generator
// Split into two lean Claude calls so each stays well under 25 s

async function callClaude(ANTHROPIC_KEY, prompt, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-5',
      max_tokens: maxTokens,
      messages:   [{ role: 'user', content: prompt }]
    }),
    signal: AbortSignal.timeout(28000)
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Claude API HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  let raw = (data.content || []).map(b => b.text || '').join('');
  raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const start = raw.indexOf('{');
  const end   = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON in Claude response');
  return JSON.parse(raw.slice(start, end + 1));
}

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
    const nicheLabel  = nicheStr || 'local business';
    const cityStr     = city      || 'California';
    const stateStr    = state     || 'CA';
    const budgetLabel = budget    || 'Growth: $800-1500/month';
    const painLabel   = painPoint || 'Not enough new customers';
    const goalLabel   = goal      || 'More bookings/reservations/appointments';

    const nicheInstruction = nicheStr
      ? `- Type: ${nicheLabel}`
      : `- Type: NOT PROVIDED — infer from business name "${businessName}" and location "${cityStr}, ${stateStr}" and use throughout.`;

    const channelContext = [
      presentLines.length ? `PRESENT:\n${presentLines.join('\n')}` : 'PRESENT: None found',
      missingLines.length ? `MISSING:\n${missingLines.join('\n')}` : ''
    ].filter(Boolean).join('\n\n');

    const clientBlock = `CLIENT:
- Business: ${businessName}
${nicheInstruction}
- Location: ${cityStr}, ${stateStr}
- Rating: ${rating || 'N/A'} (${reviews || 0} reviews)
- Challenge: ${painLabel}
- Goal: ${goalLabel}
- Budget: ${budgetLabel}`;

    // ════════════════════════════════════════════════
    //  CALL 1 — Core plan: overview + channel audit + schedule
    // ════════════════════════════════════════════════
    const prompt1 = `You are a senior social media strategist. Return ONLY valid JSON, no markdown.
All text must be specific to ${nicheLabel} in ${cityStr} — zero generic filler.

${clientBlock}

SOCIAL MEDIA RESEARCH:
${channelContext}

Return exactly this JSON:
{
  "planTitle": "Social Media Plan for ${businessName} — [6-word subtitle]",
  "tagline": "[max 10-word punchy tagline]",
  "openingStatement": {
    "headline": "[max 12-word headline about '${painLabel}']",
    "body": "[2 sentences on social opportunity for ${nicheLabel} in ${cityStr}]",
    "agentObservations": "[2 sentences on what research found — specific platforms + gaps]"
  },
  "whyNow": "[1-2 sentences urgency for ${nicheLabel} in ${cityStr}]",
  "channelAssessment": [
    {
      "platform": "[name]", "key": "[key]", "status": "Present or Missing",
      "url": "[url or null]", "agentObservation": "[obs or null]",
      "currentState": "[1 sentence]",
      "whatWeWillDo": "[1-2 sentences specific to ${nicheLabel}]",
      "postsPerMonth": 0, "contentTypes": ["type1"], "priority": "High", "color": "[hex]"
    }
  ],
  "proposedPostingSchedule": {
    "totalPostsPerMonth": 48,
    "summaryLine": "[1 sentence]",
    "breakdown": [
      {"platform":"Instagram","color":"#E1306C","icon":"📸","postsPerMonth":16,"detail":"[brief]"},
      {"platform":"TikTok","color":"#010101","icon":"🎵","postsPerMonth":12,"detail":"[brief]"},
      {"platform":"Facebook","color":"#1877F2","icon":"📘","postsPerMonth":10,"detail":"[brief]"},
      {"platform":"YouTube","color":"#FF0000","icon":"▶️","postsPerMonth":4,"detail":"[brief]"},
      {"platform":"Google Business","color":"#4285F4","icon":"📍","postsPerMonth":4,"detail":"[brief]"},
      {"platform":"Other","color":"#6a1b9a","icon":"📱","postsPerMonth":2,"detail":"[brief]"}
    ]
  }
}

IMPORTANT: channelAssessment must include ALL 10 platforms. Present → status "Present". Missing → status "Missing". Colors: Facebook #1877F2, Instagram #E1306C, LinkedIn #0A66C2, TikTok #010101, YouTube #FF0000, Twitter #000000, Pinterest #E60023, Yelp #D32323, Google Business #4285F4, Threads #1c1c1c.`;

    // ════════════════════════════════════════════════
    //  CALL 2 — Content strategy: pillars + ideas + CTA
    // ════════════════════════════════════════════════
    const prompt2 = `You are a senior social media strategist. Return ONLY valid JSON, no markdown.
All text must be specific to ${nicheLabel} in ${cityStr}.

${clientBlock}

Return exactly this JSON:
{
  "aiVideoStrategy": {
    "hook": "[1 punchy sentence — competitors using video, this business missing out]",
    "whyItMatters": "[2 sentences on AI video for ${nicheLabel} in ${cityStr}]",
    "whatWeCreate": [
      "[AI video type 1 specific to ${nicheLabel}]",
      "[AI video type 2]",
      "[AI video type 3]"
    ],
    "platforms": ["Instagram Reels","TikTok","YouTube Shorts","Google Business Posts"],
    "videosPerMonth": 6,
    "turnaround": "48 hours per video",
    "veo3Advantage": "[2 sentences on Google Veo 3 vs $500-3000 traditional production]",
    "sampleIdea": "[1 vivid specific AI video concept for ${businessName} in 2 sentences]"
  },
  "contentPillars": [
    {"name":"[pillar 1]","emoji":"[emoji]","description":"[1 sentence for ${nicheLabel}]","exampleCaption":"[ready-to-post caption with emoji + hashtags]","platforms":["Instagram","TikTok"]},
    {"name":"[pillar 2]","emoji":"[emoji]","description":"[1 sentence]","exampleCaption":"[caption]","platforms":["Facebook","Instagram"]},
    {"name":"[pillar 3]","emoji":"[emoji]","description":"[1 sentence]","exampleCaption":"[caption]","platforms":["TikTok","Instagram"]}
  ],
  "sampleContentIdeas": [
    {"platform":"Instagram","color":"#E1306C","contentType":"Reel","idea":"[specific to ${nicheLabel}]","caption":"[full caption with emoji + hashtags]"},
    {"platform":"TikTok","color":"#010101","contentType":"Video","idea":"[specific]","caption":"[full caption]"},
    {"platform":"Facebook","color":"#1877F2","contentType":"Post","idea":"[specific]","caption":"[full caption]"},
    {"platform":"Instagram","color":"#E1306C","contentType":"Carousel","idea":"[specific]","caption":"[full caption]"},
    {"platform":"TikTok","color":"#010101","contentType":"Trending Audio","idea":"[specific]","caption":"[full caption]"}
  ],
  "sampleWeekCalendar": [
    {"day":"Monday","platform":"Instagram","contentType":"Reel","idea":"[${nicheLabel} idea]","color":"#E1306C"},
    {"day":"Tuesday","platform":"TikTok","contentType":"Video","idea":"[idea]","color":"#010101"},
    {"day":"Wednesday","platform":"Facebook","contentType":"Post","idea":"[idea]","color":"#1877F2"},
    {"day":"Thursday","platform":"Instagram","contentType":"Story","idea":"[idea]","color":"#E1306C"},
    {"day":"Friday","platform":"TikTok","contentType":"Video","idea":"[idea]","color":"#010101"},
    {"day":"Saturday","platform":"Instagram","contentType":"Feed Post","idea":"[idea]","color":"#E1306C"},
    {"day":"Sunday","platform":"Google Business","contentType":"Post","idea":"[idea]","color":"#4285F4"}
  ],
  "missingChannelOpportunities": [
    {"platform":"[top missing]","color":"[hex]","icon":"[emoji]","whyNow":"[1 sentence for ${nicheLabel} in ${cityStr}]","opportunity":"[1 sentence]","priority":"High"},
    {"platform":"[second missing]","color":"[hex]","icon":"[emoji]","whyNow":"[1 sentence]","opportunity":"[1 sentence]","priority":"Medium"},
    {"platform":"[third missing]","color":"[hex]","icon":"[emoji]","whyNow":"[1 sentence]","opportunity":"[1 sentence]","priority":"Medium"}
  ],
  "expectedJourney": {
    "month1": {"label":"Month 1 — Foundation","color":"#1565c0","focus":"[profile setup + content rhythm]","wins":["[win 1]","[win 2]","[win 3]"]},
    "month3": {"label":"Month 3 — Results","color":"#2e7d32","focus":"[engagement converting to real inquiries]","wins":["[win 1]","[win 2]","[win 3]"]}
  },
  "callToAction": {
    "headline": "[compelling CTA for ${nicheLabel} referencing '${goalLabel}']",
    "subtext": "[2 sentences urgency — competitors in ${cityStr} posting now, cost of waiting]",
    "buttonText": "Book Your Free Strategy Call"
  }
}`;

    // Run both calls sequentially
    const [part1, part2] = await Promise.all([
      callClaude(ANTHROPIC_KEY, prompt1, 2500),
      callClaude(ANTHROPIC_KEY, prompt2, 2500)
    ]);

    if (!part1.planTitle) throw new Error('Call 1 missing planTitle');
    if (!part2.callToAction) throw new Error('Call 2 missing callToAction');

    // Merge into single plan object
    const plan = { ...part1, ...part2 };

    return res.status(200).json({ success: true, plan });

  } catch (err) {
    console.error('social-audit error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
