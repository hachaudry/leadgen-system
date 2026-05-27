// api/social-audit.js — Social Media Presence Audit
// Social platforms (Instagram, Facebook, TikTok, LinkedIn) block automated scraping.
// This uses URL handle extraction + best-effort Google search snippets + Claude AI
// niche analysis to produce realistic, actionable estimates.

const PLATFORM_ORDER  = ['google','facebook','instagram','linkedin','tiktok','youtube','twitter','pinterest','yelp','threads'];
const PLATFORM_LABELS = {
  google:'Google Business Profile', facebook:'Facebook', instagram:'Instagram',
  linkedin:'LinkedIn', tiktok:'TikTok', youtube:'YouTube',
  twitter:'X / Twitter', pinterest:'Pinterest', yelp:'Yelp', threads:'Threads'
};

// ── Extract social handle from profile URL ───────────────────────────────────
function extractHandle(url, platform) {
  if (!url) return null;
  try {
    const u     = new URL(url.startsWith('http') ? url : 'https://' + url);
    const parts = u.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    switch (platform) {
      case 'instagram':
      case 'facebook':
      case 'twitter':
      case 'pinterest':
      case 'threads':
        return parts[0]?.replace(/^@/, '') || null;
      case 'tiktok':
        return parts[0]?.replace(/^@/, '') || null;
      case 'youtube':
        if (parts[0] === 'c' || parts[0] === 'user') return parts[1] || null;
        if (parts[0]?.startsWith('@'))               return parts[0].slice(1);
        if (parts[0] === 'channel')                  return null;
        return parts[0] || null;
      case 'linkedin':
        if (parts[0] === 'company' || parts[0] === 'in') return parts[1] || null;
        return parts[0] || null;
      case 'yelp':
        if (parts[0] === 'biz') return parts[1] || null;
        return parts[0] || null;
      default:
        return parts[0] || null;
    }
  } catch { return null; }
}

// ── Best-effort: Google search via Jina for cached social snippet data ────────
// Instagram/FB/TikTok block direct reads — Google sometimes has cached counts.
async function fetchGoogleSearchData(businessName, handle, platform, city) {
  try {
    const label = PLATFORM_LABELS[platform] || platform;
    const q     = handle
      ? `${handle} ${label} followers`
      : `"${businessName}" ${city} ${label}`;
    const resp  = await fetch(
      `https://r.jina.ai/https://www.google.com/search?q=${encodeURIComponent(q)}`,
      { headers: { 'Accept': 'text/plain' }, signal: AbortSignal.timeout(10000) }
    );
    if (!resp.ok) return null;
    const text      = await resp.text();
    const data      = {};
    const followerM = text.match(/(\d[\d,]*\.?\d*[KkMm]?)\s*[Ff]ollowers?/);
    if (followerM) data.followers = followerM[1];
    const likeM     = text.match(/(\d[\d,]*\.?\d*[KkMm]?)\s*(?:people\s+)?[Ll]ikes?/);
    if (likeM)     data.likes = likeM[1];
    const ratingM   = text.match(/(\d\.?\d?)\s*(?:★|stars?|rating)/i);
    if (ratingM)   data.rating = ratingM[1];
    return Object.keys(data).length ? data : null;
  } catch { return null; }
}

// ── Main analysis: handle extraction + Google search + Claude ─────────────────
async function analyzeSocialPresence(apiKey, { businessName, niche, city, state, reviews, rating, profiles, notPresent }) {
  const today  = new Date().toISOString().split('T')[0];
  const custom = profiles.custom || [];

  // Step 1 — Extract handles from all provided URLs
  const handleMap = {};
  for (const p of PLATFORM_ORDER) {
    if (profiles[p]) handleMap[p] = extractHandle(profiles[p], p);
  }

  // Step 2 — Best-effort Google search for social data (key platforms only, parallel)
  const searchPlatforms = PLATFORM_ORDER.filter(
    p => profiles[p] && ['instagram','facebook','tiktok','youtube','twitter'].includes(p)
  );
  const searchResults = await Promise.allSettled(
    searchPlatforms.map(p => fetchGoogleSearchData(businessName, handleMap[p], p, city || 'California'))
  );
  const googleDataMap = {};
  searchResults.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) googleDataMap[searchPlatforms[i]] = r.value;
  });

  // Step 3 — Build Claude prompt lines
  const presentLines = PLATFORM_ORDER.map(p => {
    if (!profiles[p]) return null;
    const label  = PLATFORM_LABELS[p];
    const handle = handleMap[p];
    const gd     = googleDataMap[p];
    const parts  = [`${label}: CONFIRMED PRESENT — URL: ${profiles[p]}`];
    if (handle)          parts.push(`Handle: @${handle}`);
    if (gd?.followers)   parts.push(`Google snippet: ~${gd.followers} followers`);
    if (gd?.likes)       parts.push(`Google snippet: ~${gd.likes} likes`);
    if (gd?.rating)      parts.push(`Google snippet: ${gd.rating} rating`);
    return parts.join(' | ');
  }).filter(Boolean);

  const missingLines = PLATFORM_ORDER.map(p => {
    if (profiles[p]) return null;
    if (notPresent.includes(p)) return `${PLATFORM_LABELS[p]}: NOT PRESENT (confirmed absent by sales team)`;
    return `${PLATFORM_LABELS[p]}: No profile URL provided`;
  }).filter(Boolean);

  const customLines = custom.map(cp => {
    if (!cp.url) return null;
    const h = extractHandle(cp.url, cp.name);
    return `${cp.name}: CONFIRMED — ${cp.url}${h ? ` | Handle: @${h}` : ''}`;
  }).filter(Boolean);

  const reviewLevel  = (reviews || 0) >= 100 ? 'high (100+)' : (reviews || 0) >= 30 ? 'medium (30-99)' : 'low (<30)';
  const ratingLevel  = (parseFloat(rating) || 0) >= 4.5 ? 'excellent (4.5+)' : (parseFloat(rating) || 0) >= 4.0 ? 'good (4.0-4.4)' : 'below average (<4.0)';

  const prompt = `You are a senior social media analyst for a digital marketing agency. Analyze this business's social media presence and provide realistic, actionable estimates.

Business: ${businessName}
Niche: ${niche || 'local business'}
Location: ${[city, state].filter(Boolean).join(', ') || 'California'}
Real Google Rating: ${rating || 'N/A'} stars (${ratingLevel}) with ${reviews || 0} Google reviews (${reviewLevel}) — VERIFIED DATA, never contradict
Today's date: ${today}

CONFIRMED SOCIAL PROFILES (verified by sales team):
${presentLines.join('\n')}

PLATFORMS WITHOUT PROFILES:
${missingLines.join('\n')}
${customLines.length ? `\nCUSTOM PLATFORMS:\n${customLines.join('\n')}` : ''}

ACTIVITY SIGNALS FROM BUSINESS PROFILE:
- Google review count (${reviews || 0}) indicates ${reviewLevel} digital engagement
- Google rating (${rating || 'N/A'}) indicates ${ratingLevel} customer engagement
- A ${niche || 'local business'} with ${reviewLevel} Google reviews in ${city || 'California'} typically has ${(reviews||0) >= 100 ? 'active, consistent' : (reviews||0) >= 30 ? 'moderate, inconsistent' : 'minimal, rare'} social media activity

ANALYSIS RULES:
1. Be REALISTIC — most local ${niche || 'businesses'} post 2-8 times per month, not daily
2. Follower estimates must be RANGES (e.g. "200–800") not single numbers
3. Post frequency estimates should reflect the activity signal from Google reviews
4. Set lastPostCritical=true for most local businesses unless Google reviews suggest very high engagement
5. Set postFrequencyCritical=true unless the business has 100+ Google reviews
6. criticalIssues should list the 1-2 most important missing elements for this specific niche+platform
7. revenueImpact must be specific to this niche in this city
8. All gaps must be NICHE-SPECIFIC for ${niche || 'local business'} on each platform

SCORING RULES:
- Present + very active (100+ reviews, high engagement signals): 60-75
- Present + moderately active (30-99 reviews): 40-60
- Present + low activity signal (<30 reviews): 20-40
- Missing: 0

Return ONLY valid JSON, no markdown fences, no text outside JSON:
{
  "platforms": {
    "google":    {"status":"Active|Likely Active|Needs Improvement|Inactive|Missing","profileUrl":null,"score":0,"estimatedFollowers":"range or N/A","estimatedPostsLast28Days":"e.g. 2-6","lastPostEstimate":"Within 2 days|3-7 days ago|1-2 weeks ago|Over 2 weeks ago|Unknown","lastPostCritical":false,"postFrequencyCritical":false,"engagementLevel":"High|Medium|Low","estimatedMonthlyReach":"range","activityLevel":"High|Medium|Low|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":"","revenueImpact":"","criticalIssues":[]},
    "facebook":  {"status":"Active|Likely Active|Needs Improvement|Inactive|Missing","profileUrl":null,"score":0,"estimatedFollowers":"range","estimatedPostsLast28Days":"range","lastPostEstimate":"Within 2 days|3-7 days ago|1-2 weeks ago|Over 2 weeks ago|Unknown","lastPostCritical":false,"postFrequencyCritical":false,"engagementLevel":"High|Medium|Low","estimatedMonthlyReach":"range","activityLevel":"High|Medium|Low|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":"","revenueImpact":"","criticalIssues":[]},
    "instagram": {"status":"Active|Likely Active|Needs Improvement|Inactive|Missing","profileUrl":null,"score":0,"estimatedFollowers":"range","estimatedPostsLast28Days":"range","lastPostEstimate":"Within 2 days|3-7 days ago|1-2 weeks ago|Over 2 weeks ago|Unknown","lastPostCritical":false,"postFrequencyCritical":false,"engagementLevel":"High|Medium|Low","estimatedMonthlyReach":"range","activityLevel":"High|Medium|Low|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":"","revenueImpact":"","criticalIssues":[]},
    "linkedin":  {"status":"Active|Likely Active|Needs Improvement|Inactive|Missing","profileUrl":null,"score":0,"estimatedFollowers":"range","estimatedPostsLast28Days":"range","lastPostEstimate":"Within 2 days|3-7 days ago|1-2 weeks ago|Over 2 weeks ago|Unknown","lastPostCritical":false,"postFrequencyCritical":false,"engagementLevel":"High|Medium|Low","estimatedMonthlyReach":"range","activityLevel":"High|Medium|Low|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":"","revenueImpact":"","criticalIssues":[]},
    "tiktok":    {"status":"Active|Likely Active|Needs Improvement|Inactive|Missing","profileUrl":null,"score":0,"estimatedFollowers":"range","estimatedPostsLast28Days":"range","lastPostEstimate":"Within 2 days|3-7 days ago|1-2 weeks ago|Over 2 weeks ago|Unknown","lastPostCritical":false,"postFrequencyCritical":false,"engagementLevel":"High|Medium|Low","estimatedMonthlyReach":"range","activityLevel":"High|Medium|Low|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":"","revenueImpact":"","criticalIssues":[]},
    "youtube":   {"status":"Active|Likely Active|Needs Improvement|Inactive|Missing","profileUrl":null,"score":0,"estimatedFollowers":"range","estimatedPostsLast28Days":"range","lastPostEstimate":"Within 2 days|3-7 days ago|1-2 weeks ago|Over 2 weeks ago|Unknown","lastPostCritical":false,"postFrequencyCritical":false,"engagementLevel":"High|Medium|Low","estimatedMonthlyReach":"range","activityLevel":"High|Medium|Low|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":"","revenueImpact":"","criticalIssues":[]},
    "twitter":   {"status":"Active|Likely Active|Needs Improvement|Inactive|Missing","profileUrl":null,"score":0,"estimatedFollowers":"range","estimatedPostsLast28Days":"range","lastPostEstimate":"Within 2 days|3-7 days ago|1-2 weeks ago|Over 2 weeks ago|Unknown","lastPostCritical":false,"postFrequencyCritical":false,"engagementLevel":"High|Medium|Low","estimatedMonthlyReach":"range","activityLevel":"High|Medium|Low|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":"","revenueImpact":"","criticalIssues":[]},
    "pinterest": {"status":"Active|Likely Active|Needs Improvement|Inactive|Missing","profileUrl":null,"score":0,"estimatedFollowers":"range","estimatedPostsLast28Days":"range","lastPostEstimate":"Within 2 days|3-7 days ago|1-2 weeks ago|Over 2 weeks ago|Unknown","lastPostCritical":false,"postFrequencyCritical":false,"engagementLevel":"High|Medium|Low","estimatedMonthlyReach":"range","activityLevel":"High|Medium|Low|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":"","revenueImpact":"","criticalIssues":[]},
    "yelp":      {"status":"Active|Likely Active|Needs Improvement|Inactive|Missing","profileUrl":null,"score":0,"estimatedFollowers":"range or N/A","estimatedPostsLast28Days":"range","lastPostEstimate":"Within 2 days|3-7 days ago|1-2 weeks ago|Over 2 weeks ago|Unknown","lastPostCritical":false,"postFrequencyCritical":false,"engagementLevel":"High|Medium|Low","estimatedMonthlyReach":"range","activityLevel":"High|Medium|Low|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":"","revenueImpact":"","criticalIssues":[]},
    "threads":   {"status":"Active|Likely Active|Needs Improvement|Inactive|Missing","profileUrl":null,"score":0,"estimatedFollowers":"range","estimatedPostsLast28Days":"range","lastPostEstimate":"Within 2 days|3-7 days ago|1-2 weeks ago|Over 2 weeks ago|Unknown","lastPostCritical":false,"postFrequencyCritical":false,"engagementLevel":"High|Medium|Low","estimatedMonthlyReach":"range","activityLevel":"High|Medium|Low|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":"","revenueImpact":"","criticalIssues":[]}
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
      body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(20000)
    });
    if (!resp.ok) throw new Error(`Claude API HTTP ${resp.status}`);
    const d   = await resp.json();
    const raw = (d.content || []).map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
    const si  = raw.indexOf('{'), ei = raw.lastIndexOf('}');
    if (si === -1) return null;
    return JSON.parse(raw.slice(si, ei + 1));
  } catch (e) {
    console.error('Claude social analysis error:', e.message);
    return null;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
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

  const safeProfiles      = profiles || {};
  const custom            = safeProfiles.custom || [];
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
      if (analysis.platforms[p]) analysis.platforms[p].profileUrl = safeProfiles[p] || null;
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
    overallScore:            analysis.overallScore            || null,
    priorityActions:         analysis.priorityActions         || [],
    salesAngle:              analysis.salesAngle              || null,
    estimatedTotalReachLost: analysis.estimatedTotalReachLost || null
  });
}
