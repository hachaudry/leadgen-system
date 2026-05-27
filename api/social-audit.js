// api/social-audit.js — Real Social Media Presence Audit
// Step 1: Scrapes business website via Jina AI to detect linked social profiles
// Step 2: Claude AI analysis of detected + estimated presence

const PLATFORM_ORDER = ['facebook','instagram','linkedin','tiktok','youtube','twitter','pinterest','yelp','google','threads'];

// ── Search URLs ──────────────────────────────────────────────────────────────
function buildSearchUrls(bizName, city) {
  const e = encodeURIComponent;
  const tag = e(bizName.replace(/\s+/g, ''));
  return {
    facebook:  `https://www.facebook.com/search/pages/?q=${e(bizName)}`,
    instagram: `https://www.instagram.com/explore/tags/${tag}`,
    linkedin:  `https://www.linkedin.com/search/results/companies/?keywords=${e(bizName)}`,
    tiktok:    `https://www.tiktok.com/search?q=${e(bizName)}`,
    youtube:   `https://www.youtube.com/results?search_query=${e(bizName)}`,
    twitter:   `https://twitter.com/search?q=${e(bizName)}`,
    pinterest: `https://www.pinterest.com/search/pins/?q=${e(bizName)}`,
    yelp:      `https://www.yelp.com/search?find_desc=${e(bizName)}&find_loc=${e(city || 'CA')}`,
    google:    `https://www.google.com/maps/search/${e(bizName + (city ? ' ' + city : ''))}`,
    threads:   `https://www.threads.net/search?q=${e(bizName)}`
  };
}

// ── Social URL regex extraction ──────────────────────────────────────────────
function extractSocialUrls(text) {
  if (!text) return {};
  const found = {};

  const PATTERNS = {
    facebook:  /https?:\/\/(?:www\.)?facebook\.com\/(?!sharer|share|dialog|photo|login|home|watch|groups\/)(?:pages\/[^/\s"'<>]+\/|)([a-zA-Z0-9._-]{3,80})/gi,
    instagram: /https?:\/\/(?:www\.)?instagram\.com\/(?!explore\/|p\/|reel\/|tv\/|stories\/)([a-zA-Z0-9._]{2,40})/gi,
    linkedin:  /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in|school)\/([a-zA-Z0-9._%-]{2,80})/gi,
    tiktok:    /https?:\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9._]{2,40})/gi,
    youtube:   /https?:\/\/(?:www\.)?youtube\.com\/(?:channel\/|@|user\/)([a-zA-Z0-9._-]{2,80})/gi,
    twitter:   /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/(?!intent\/|share|home|search|hashtag|i\/)([a-zA-Z0-9_]{2,40})/gi,
    pinterest: /https?:\/\/(?:www\.)?pinterest\.com\/([a-zA-Z0-9._-]{2,40})\//gi,
    yelp:      /https?:\/\/(?:www\.)?yelp\.com\/biz\/([a-zA-Z0-9._-]{2,80})/gi,
    threads:   /https?:\/\/(?:www\.)?threads\.net\/@?([a-zA-Z0-9._]{2,40})/gi,
    google:    /(?:g\.co\/kgs\/[^\s"'<>]{3,40}|maps\.google\.com[^\s"'<>]{0,100}|goo\.gl\/maps\/[^\s"'<>]{0,40})/gi
  };

  for (const [key, regex] of Object.entries(PATTERNS)) {
    regex.lastIndex = 0;
    const match = regex.exec(text);
    if (match) {
      // Reconstruct clean profile URL
      if (key === 'google') {
        found[key] = match[0];
      } else {
        const handle = match[1];
        const BASE = {
          facebook:  `https://www.facebook.com/${handle}`,
          instagram: `https://www.instagram.com/${handle}`,
          linkedin:  match[0].replace(/^https?:\/\/(?:www\.)?/, 'https://www.'),
          tiktok:    `https://www.tiktok.com/@${handle}`,
          youtube:   match[0].replace(/^https?:\/\/(?:www\.)?/, 'https://www.'),
          twitter:   `https://twitter.com/${handle}`,
          pinterest: `https://www.pinterest.com/${handle}`,
          yelp:      `https://www.yelp.com/biz/${handle}`,
          threads:   `https://www.threads.net/@${handle}`
        };
        found[key] = BASE[key] || match[0];
      }
    }
  }
  return found;
}

// ── Claude analysis ──────────────────────────────────────────────────────────
async function analyzeSocialPresence(apiKey, businessName, niche, city, website, reviews, rating, detectedUrls) {
  const profileLines = PLATFORM_ORDER.map(p => {
    const url = detectedUrls[p];
    return `${p}: ${url ? 'FOUND ON WEBSITE → ' + url : 'NOT FOUND on website'}`;
  }).join('\n');

  const prompt = `You are a social media analyst for a digital marketing agency.

Business: ${businessName}
Type: ${niche || 'local business'}
City: ${city || 'California'}
Website: ${website || 'none'}
Google Reviews: ${reviews || 0} (rating: ${rating || 'unknown'})

Social profiles detected on their website:
${profileLines}

Analyze social media presence. Base "status" strictly on detection:
- If FOUND ON WEBSITE → status can be "Active" or "Inactive" (use niche judgment)
- If NOT FOUND → status is "Not Linked"
- Never invent URLs. profileUrl = only real detected URLs (null if not found)

Return ONLY valid JSON, no markdown, no text outside JSON:
{
  "platforms": {
    "facebook":  {"status":"Active|Inactive|Not Linked","profileUrl":null,"estimatedFollowers":"string","postsPerMonth":"string","lastPostEstimate":"string","engagementLevel":"High|Medium|Low|Unknown","score":0-100,"gaps":["gap1","gap2"],"quickWin":"string","monthlyReachLost":"string"},
    "instagram": {"status":"Active|Inactive|Not Linked","profileUrl":null,"estimatedFollowers":"string","postsPerMonth":"string","lastPostEstimate":"string","engagementLevel":"High|Medium|Low|Unknown","score":0-100,"gaps":["gap1","gap2"],"quickWin":"string","monthlyReachLost":"string"},
    "linkedin":  {"status":"Active|Inactive|Not Linked","profileUrl":null,"estimatedFollowers":"string","postsPerMonth":"string","lastPostEstimate":"string","engagementLevel":"High|Medium|Low|Unknown","score":0-100,"gaps":["gap1","gap2"],"quickWin":"string","monthlyReachLost":"string"},
    "tiktok":    {"status":"Active|Inactive|Not Linked","profileUrl":null,"estimatedFollowers":"string","postsPerMonth":"string","lastPostEstimate":"string","engagementLevel":"High|Medium|Low|Unknown","score":0-100,"gaps":["gap1","gap2"],"quickWin":"string","monthlyReachLost":"string"},
    "youtube":   {"status":"Active|Inactive|Not Linked","profileUrl":null,"estimatedFollowers":"string","postsPerMonth":"string","lastPostEstimate":"string","engagementLevel":"High|Medium|Low|Unknown","score":0-100,"gaps":["gap1","gap2"],"quickWin":"string","monthlyReachLost":"string"},
    "twitter":   {"status":"Active|Inactive|Not Linked","profileUrl":null,"estimatedFollowers":"string","postsPerMonth":"string","lastPostEstimate":"string","engagementLevel":"High|Medium|Low|Unknown","score":0-100,"gaps":["gap1","gap2"],"quickWin":"string","monthlyReachLost":"string"},
    "pinterest": {"status":"Active|Inactive|Not Linked","profileUrl":null,"estimatedFollowers":"string","postsPerMonth":"string","lastPostEstimate":"string","engagementLevel":"High|Medium|Low|Unknown","score":0-100,"gaps":["gap1","gap2"],"quickWin":"string","monthlyReachLost":"string"},
    "yelp":      {"status":"Active|Inactive|Not Linked","profileUrl":null,"estimatedFollowers":"string","postsPerMonth":"string","lastPostEstimate":"string","engagementLevel":"High|Medium|Low|Unknown","score":0-100,"gaps":["gap1","gap2"],"quickWin":"string","monthlyReachLost":"string"},
    "google":    {"status":"Active|Inactive|Not Linked","profileUrl":null,"estimatedFollowers":"string","postsPerMonth":"string","lastPostEstimate":"string","engagementLevel":"High|Medium|Low|Unknown","score":0-100,"gaps":["gap1","gap2"],"quickWin":"string","monthlyReachLost":"string"},
    "threads":   {"status":"Active|Inactive|Not Linked","profileUrl":null,"estimatedFollowers":"string","postsPerMonth":"string","lastPostEstimate":"string","engagementLevel":"High|Medium|Low|Unknown","score":0-100,"gaps":["gap1","gap2"],"quickWin":"string","monthlyReachLost":"string"}
  },
  "overallScore": 0-100,
  "priorityActions": [
    {"platform":"string","action":"string max 20 words","impact":"High|Medium","effort":"Low|Medium|High","revenueImpact":"string"},
    {"platform":"string","action":"string max 20 words","impact":"High|Medium","effort":"Low|Medium|High","revenueImpact":"string"},
    {"platform":"string","action":"string max 20 words","impact":"High|Medium","effort":"Low|Medium|High","revenueImpact":"string"}
  ],
  "salesAngle": "string max 25 words — why they need social media help right now",
  "estimatedTotalReachLost": "string e.g. 2,000-5,000 people/month"
}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2800,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: AbortSignal.timeout(8000)
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

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(400).json({ error: 'Anthropic API key missing. Add it in Settings.' });

  const { businessName, website, niche, city, state, phone, reviews, rating } = req.body || {};
  if (!businessName) return res.status(400).json({ error: 'businessName is required' });

  const searchUrls = buildSearchUrls(businessName, city);

  // ── Step 1: Jina AI website scrape ────────────────────────────────────────
  let scrapeText = '';
  let scrapedSuccessfully = false;
  let scrapeError = null;

  if (website) {
    try {
      const jinaResp = await fetch(`https://r.jina.ai/${website}`, {
        headers: { 'Accept': 'text/plain', 'User-Agent': 'LeadGen-AI/1.0' },
        signal: AbortSignal.timeout(4500)
      });
      if (jinaResp.ok) {
        scrapeText = await jinaResp.text();
        scrapedSuccessfully = true;
      } else {
        scrapeError = `Jina HTTP ${jinaResp.status}`;
      }
    } catch (e) {
      scrapeError = e.message;
      console.error('Jina scrape failed:', e.message);
    }
  }

  // ── Step 2: Extract social profile URLs from scraped text ─────────────────
  const detectedUrls = extractSocialUrls(scrapeText);
  const foundCount = Object.keys(detectedUrls).length;

  // Build detectedProfiles array for frontend
  const detectedProfiles = PLATFORM_ORDER.map(p => ({
    platform: p,
    foundOnWebsite: !!detectedUrls[p],
    profileUrl: detectedUrls[p] || null,
    searchUrl: searchUrls[p],
    status: detectedUrls[p] ? 'linked' : 'not-linked'
  }));

  // ── Step 3: Claude AI analysis ────────────────────────────────────────────
  const analysis = await analyzeSocialPresence(
    ANTHROPIC_KEY, businessName, niche, city, website, reviews, rating, detectedUrls
  );

  // If Claude failed, return detection-only results
  if (!analysis) {
    return res.status(200).json({
      businessName,
      website: website || null,
      scrapedSuccessfully,
      scrapeError,
      foundCount,
      detectedProfiles,
      platforms: null,
      overallScore: null,
      priorityActions: [],
      salesAngle: null,
      estimatedTotalReachLost: null,
      _analysisOnly: false,
      _error: 'AI analysis unavailable — showing detected profiles only'
    });
  }

  // Merge real detected URLs into Claude's response
  if (analysis.platforms) {
    for (const p of PLATFORM_ORDER) {
      if (analysis.platforms[p] && detectedUrls[p]) {
        analysis.platforms[p].profileUrl = detectedUrls[p];
      }
    }
  }

  return res.status(200).json({
    businessName,
    website: website || null,
    niche: niche || null,
    city: city || null,
    scrapedSuccessfully,
    scrapeError: scrapeError || null,
    foundCount,
    detectedProfiles,
    platforms: analysis.platforms || null,
    overallScore: analysis.overallScore || null,
    priorityActions: analysis.priorityActions || [],
    salesAngle: analysis.salesAngle || null,
    estimatedTotalReachLost: analysis.estimatedTotalReachLost || null
  });
}
