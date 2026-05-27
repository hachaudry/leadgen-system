// api/social-audit.js — Manual Social Media Presence Audit
// Accepts user-provided profile URLs and calls Claude for quality analysis.
// No website scraping — all URLs are supplied by the sales team.

const PLATFORM_ORDER = ['google','facebook','instagram','linkedin','tiktok','youtube','twitter','pinterest','yelp','threads'];
const PLATFORM_LABELS = {
  google:'Google Business Profile', facebook:'Facebook', instagram:'Instagram',
  linkedin:'LinkedIn', tiktok:'TikTok', youtube:'YouTube',
  twitter:'X / Twitter', pinterest:'Pinterest', yelp:'Yelp', threads:'Threads'
};

async function analyzeSocialPresence(apiKey, { businessName, niche, city, state, reviews, rating, profiles, notPresent }) {
  const profileLines = PLATFORM_ORDER.map(p => {
    const label = PLATFORM_LABELS[p];
    const url   = profiles[p];
    if (url) return `${label}: PRESENT — Profile URL: ${url}`;
    if (notPresent.includes(p)) return `${label}: NOT PRESENT (confirmed by sales team)`;
    return `${label}: UNKNOWN (no URL provided — assume missing)`;
  });

  const custom = profiles.custom || [];
  const customLines = custom.map(cp =>
    cp.url ? `${cp.name}: PRESENT — Profile URL: ${cp.url}` : `${cp.name}: UNKNOWN`
  );

  const prompt = `You are a social media analyst for a digital marketing agency. Analyze this business social media presence based on profiles the sales team has manually verified.

Business: ${businessName}
Niche: ${niche || 'local business'}
Location: ${[city, state].filter(Boolean).join(', ') || 'California'}
Google Rating: ${rating || 'not available'} stars with ${reviews || 0} reviews
IMPORTANT: These Google stats are REAL DATA — never contradict them in your analysis.

Manually verified social media profiles:
${[...profileLines, ...customLines].join('\n')}

ANALYSIS INSTRUCTIONS:
- PRESENT platforms: estimate quality and activity level based on (a) niche typical patterns, (b) Google rating as business health proxy, (c) URL structure (personal vs business handle, handle professionalism)
- NOT PRESENT / UNKNOWN platforms: mark as Missing, estimate the monthly reach they're losing by not being on this platform
- NEVER contradict the real Google data (${reviews || 0} reviews, ${rating || 'N/A'} rating)
- Use follower/reach RANGES, never specific numbers
- Every gap and insight must be specific to the ${niche || 'local business'} niche, not generic
- proposalAngle: one sentence on how to pitch improving this specific platform to this business

Return ONLY valid JSON, no markdown fences, no text outside JSON:
{
  "platforms": {
    "google":    {"status":"Active|Likely Active|Needs Improvement|Missing","profileUrl":null,"score":0,"estimatedFollowers":"","activityLevel":"High|Medium|Low|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":""},
    "facebook":  {"status":"Active|Likely Active|Needs Improvement|Missing","profileUrl":null,"score":0,"estimatedFollowers":"","activityLevel":"High|Medium|Low|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":""},
    "instagram": {"status":"Active|Likely Active|Needs Improvement|Missing","profileUrl":null,"score":0,"estimatedFollowers":"","activityLevel":"High|Medium|Low|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":""},
    "linkedin":  {"status":"Active|Likely Active|Needs Improvement|Missing","profileUrl":null,"score":0,"estimatedFollowers":"","activityLevel":"High|Medium|Low|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":""},
    "tiktok":    {"status":"Active|Likely Active|Needs Improvement|Missing","profileUrl":null,"score":0,"estimatedFollowers":"","activityLevel":"High|Medium|Low|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":""},
    "youtube":   {"status":"Active|Likely Active|Needs Improvement|Missing","profileUrl":null,"score":0,"estimatedFollowers":"","activityLevel":"High|Medium|Low|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":""},
    "twitter":   {"status":"Active|Likely Active|Needs Improvement|Missing","profileUrl":null,"score":0,"estimatedFollowers":"","activityLevel":"High|Medium|Low|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":""},
    "pinterest": {"status":"Active|Likely Active|Needs Improvement|Missing","profileUrl":null,"score":0,"estimatedFollowers":"","activityLevel":"High|Medium|Low|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":""},
    "yelp":      {"status":"Active|Likely Active|Needs Improvement|Missing","profileUrl":null,"score":0,"estimatedFollowers":"","activityLevel":"High|Medium|Low|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":""},
    "threads":   {"status":"Active|Likely Active|Needs Improvement|Missing","profileUrl":null,"score":0,"estimatedFollowers":"","activityLevel":"High|Medium|Low|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":""}
  },
  "customPlatforms": [],
  "overallScore": 0,
  "priorityActions": [
    {"platform":"","action":"","impact":"High|Medium","effort":"Low|Medium|High","revenueImpact":""},
    {"platform":"","action":"","impact":"High|Medium","effort":"Low|Medium|High","revenueImpact":""},
    {"platform":"","action":"","impact":"High|Medium","effort":"Low|Medium|High","revenueImpact":""}
  ],
  "salesAngle": "",
  "estimatedTotalReachLost": ""
}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 3200, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(15000)
    });
    if (!resp.ok) throw new Error(`Claude API HTTP ${resp.status}`);
    const d = await resp.json();
    const raw = (d.content || []).map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
    const si = raw.indexOf('{'), ei = raw.lastIndexOf('}');
    if (si === -1) return null;
    return JSON.parse(raw.slice(si, ei + 1));
  } catch (e) {
    console.error('Claude social analysis error:', e.message);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(400).json({ error: 'Anthropic API key missing. Add it in Settings.' });

  const { businessName, niche, city, state, reviews, rating, profiles, notPresent = [] } = req.body || {};
  if (!businessName) return res.status(400).json({ error: 'businessName is required' });

  const safeProfiles = profiles || {};
  const custom = safeProfiles.custom || [];
  const providedPlatforms = PLATFORM_ORDER.filter(p => !!safeProfiles[p]);
  const missingPlatforms  = PLATFORM_ORDER.filter(p => !safeProfiles[p]);

  if (providedPlatforms.length === 0 && custom.filter(c => c.url).length === 0) {
    return res.status(400).json({ error: 'At least one social media profile URL is required.' });
  }

  const analysis = await analyzeSocialPresence(ANTHROPIC_KEY, {
    businessName, niche, city, state, reviews, rating,
    profiles: safeProfiles, notPresent
  });

  if (!analysis) {
    return res.status(200).json({
      businessName, niche: niche || null, city: city || null, state: state || null,
      providedPlatforms, missingPlatforms, profiles: safeProfiles, notPresent,
      platforms: null, customPlatforms: custom, overallScore: null,
      priorityActions: [], salesAngle: null, estimatedTotalReachLost: null,
      _error: 'AI analysis unavailable — profile data collected.'
    });
  }

  // Pin profileUrl to exactly what the user provided (Claude must not invent URLs)
  if (analysis.platforms) {
    for (const p of PLATFORM_ORDER) {
      if (analysis.platforms[p]) {
        analysis.platforms[p].profileUrl = safeProfiles[p] || null;
      }
    }
  }

  return res.status(200).json({
    businessName, niche: niche || null, city: city || null, state: state || null,
    providedPlatforms, missingPlatforms, profiles: safeProfiles, notPresent,
    platforms: analysis.platforms || null,
    customPlatforms: analysis.customPlatforms?.length
      ? analysis.customPlatforms.map((cp, i) => ({ ...cp, profileUrl: custom[i]?.url || null }))
      : custom.map(cp => ({
          name: cp.name, profileUrl: cp.url || null,
          status: cp.url ? 'Likely Active' : 'Missing', score: cp.url ? 45 : 0,
          gaps: [], quickWin: '', nicheSpecificInsight: '', proposalAngle: ''
        })),
    overallScore: analysis.overallScore || null,
    priorityActions: analysis.priorityActions || [],
    salesAngle: analysis.salesAngle || null,
    estimatedTotalReachLost: analysis.estimatedTotalReachLost || null
  });
}
