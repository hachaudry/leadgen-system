// api/social-audit.js — Social Media Presence Audit with Jina AI real-profile reading
// Fetches each user-provided profile page via Jina AI, extracts real metrics,
// applies critical flags, then sends all real data to Claude for analysis.

const PLATFORM_ORDER  = ['google','facebook','instagram','linkedin','tiktok','youtube','twitter','pinterest','yelp','threads'];
const PLATFORM_LABELS = {
  google:'Google Business Profile', facebook:'Facebook', instagram:'Instagram',
  linkedin:'LinkedIn', tiktok:'TikTok', youtube:'YouTube',
  twitter:'X / Twitter', pinterest:'Pinterest', yelp:'Yelp', threads:'Threads'
};

// ── Step 1: Fetch real profile page via Jina AI ──────────────────────────────
async function fetchProfileData(profileUrl, platform) {
  try {
    const jinaUrl = 'https://r.jina.ai/' + profileUrl;
    const response = await fetch(jinaUrl, {
      headers: { 'Accept': 'text/plain' },
      signal: AbortSignal.timeout(12000)
    });
    const text = await response.text();
    return { success: true, content: text.substring(0, 5000), platform, url: profileUrl };
  } catch (err) {
    return { success: false, content: '', platform, url: profileUrl, error: err.message };
  }
}

// ── Step 2: Parse a k/m/b-suffixed number string ─────────────────────────────
function parseCount(str) {
  if (!str) return null;
  const s = str.replace(/,/g, '').trim();
  if (/^\d+(\.\d+)?[Kk]$/.test(s)) return Math.round(parseFloat(s) * 1000);
  if (/^\d+(\.\d+)?[Mm]$/.test(s)) return Math.round(parseFloat(s) * 1000000);
  if (/^\d+(\.\d+)?[Bb]$/.test(s)) return Math.round(parseFloat(s) * 1000000000);
  const n = parseFloat(s);
  return isNaN(n) ? null : Math.round(n);
}

// ── Step 3: Detect last-post age from text signals ───────────────────────────
function detectLastPostDays(text) {
  if (/\bjust\s*now\b/i.test(text)) return 0;
  if (/\btoday\b/i.test(text)) return 0;
  if (/\byesterday\b/i.test(text)) return 1;
  const h = text.match(/(\d+)\s*hours?\s*ago/i);
  if (h) return Math.floor(parseInt(h[1]) / 24);
  const d = text.match(/(\d+)\s*days?\s*ago/i);
  if (d) return parseInt(d[1]);
  const w = text.match(/(\d+)\s*weeks?\s*ago/i);
  if (w) return parseInt(w[1]) * 7;
  const mo = text.match(/(\d+)\s*months?\s*ago/i);
  if (mo) return parseInt(mo[1]) * 30;
  return null;
}

// Count date references within the last 28 days (proxy for posts)
function countRecentPosts(text) {
  let n = 0;
  for (const m of text.matchAll(/(\d+)\s*hours?\s*ago/gi)) n++;
  for (const m of text.matchAll(/(\d+)\s*days?\s*ago/gi)) { if (parseInt(m[1]) <= 28) n++; }
  n += (text.match(/\byesterday\b/gi) || []).length;
  n += (text.match(/\btoday\b/gi) || []).length;
  n += (text.match(/\bjust\s*now\b/gi) || []).length;
  for (const m of text.matchAll(/(\d+)\s*weeks?\s*ago/gi)) { if (parseInt(m[1]) <= 4) n++; }
  return n;
}

// ── Step 4: Extract per-platform real metrics from Jina content ──────────────
function extractPlatformMetrics(content, platform) {
  const m = {
    followers: null, following: null, posts: null, likes: null,
    reviews: null, rating: null, employees: null, subscribers: null,
    videos: null, bio: null, lastPostDaysAgo: null, postsLast28Days: null,
    hasReels: false, hasHighlights: false, hasBusinessContact: false,
    responseTime: null, priceRange: null, verified: false
  };
  if (!content) return m;
  const c = content;

  m.lastPostDaysAgo  = detectLastPostDays(c);
  m.postsLast28Days  = countRecentPosts(c);

  if (platform === 'instagram') {
    const postsM = c.match(/(\d[\d,]*\.?\d*[KkMm]?)\s*[Pp]osts?/);
    if (postsM) m.posts = parseCount(postsM[1]);
    const followersM = c.match(/(\d[\d,]*\.?\d*[KkMm]?)\s*[Ff]ollowers?/);
    if (followersM) m.followers = parseCount(followersM[1]);
    const followingM = c.match(/(\d[\d,]*\.?\d*[KkMm]?)\s*[Ff]ollowing/);
    if (followingM) m.following = parseCount(followingM[1]);
    m.hasReels            = /\bReels?\b/i.test(c);
    m.hasHighlights       = /\bHighlights?\b/i.test(c);
    m.hasBusinessContact  = /\b(Contact|Book\s+Now|Call|Email|Get\s+Directions|Message)\b/i.test(c);
    const bioM = c.match(/[Bb]io[:\s]+([^\n]{10,150})/);
    if (bioM) m.bio = bioM[1].trim();

  } else if (platform === 'facebook') {
    const likesM = c.match(/(\d[\d,]*\.?\d*[KkMm]?)\s*(?:people\s+)?[Ll]ikes?(?:\s+this)?/);
    if (likesM) m.likes = parseCount(likesM[1]);
    const followersM = c.match(/(\d[\d,]*\.?\d*[KkMm]?)\s*(?:people\s+)?[Ff]ollowers?(?:\s+follow)?/);
    if (followersM) m.followers = parseCount(followersM[1]);
    const ratingM = c.match(/(\d\.?\d?)\s*(?:stars?|out\s+of\s+5)/i);
    if (ratingM) m.rating = parseFloat(ratingM[1]);
    const reviewsM = c.match(/(\d[\d,]*)\s*[Rr]eviews?/);
    if (reviewsM) m.reviews = parseCount(reviewsM[1]);
    const respM = c.match(/Typically\s+responds[^\n]*/i);
    if (respM) m.responseTime = respM[0].trim();
    m.hasBusinessContact = /\b(Call\s+Now|Send\s+Message|Book\s+Now|Get\s+Directions|Email)\b/i.test(c);

  } else if (platform === 'linkedin') {
    const followersM = c.match(/(\d[\d,]*\.?\d*[KkMm]?)\s*[Ff]ollowers?/);
    if (followersM) m.followers = parseCount(followersM[1]);
    const empM = c.match(/(\d[\d,\-\+]*\.?\d*[KkMm]?)\s*employees?/i);
    if (empM) m.employees = empM[1].trim();
    m.verified = /\bVerified\b/i.test(c);

  } else if (platform === 'tiktok') {
    const followersM = c.match(/(\d[\d,]*\.?\d*[KkMm]?)\s*[Ff]ollowers?/);
    if (followersM) m.followers = parseCount(followersM[1]);
    const followingM = c.match(/(\d[\d,]*\.?\d*[KkMm]?)\s*[Ff]ollowing/);
    if (followingM) m.following = parseCount(followingM[1]);
    const likesM = c.match(/(\d[\d,]*\.?\d*[KkMm]?)\s*[Ll]ikes?/);
    if (likesM) m.likes = parseCount(likesM[1]);
    const videosM = c.match(/(\d[\d,]*\.?\d*[KkMm]?)\s*[Vv]ideos?/);
    if (videosM) m.videos = parseCount(videosM[1]);

  } else if (platform === 'youtube') {
    const subM = c.match(/(\d[\d,]*\.?\d*[KkMm]?)\s*[Ss]ubscribers?/);
    if (subM) m.subscribers = parseCount(subM[1]);
    const videosM = c.match(/(\d[\d,]*\.?\d*[KkMm]?)\s*[Vv]ideos?/);
    if (videosM) m.videos = parseCount(videosM[1]);

  } else if (platform === 'twitter') {
    const followersM = c.match(/(\d[\d,]*\.?\d*[KkMm]?)\s*[Ff]ollowers?/);
    if (followersM) m.followers = parseCount(followersM[1]);
    const followingM = c.match(/(\d[\d,]*\.?\d*[KkMm]?)\s*[Ff]ollowing/);
    if (followingM) m.following = parseCount(followingM[1]);
    m.verified = /\bVerified\b/i.test(c) || c.includes('✓') || c.includes('✔');

  } else if (platform === 'google') {
    const ratingM = c.match(/(\d\.?\d?)\s*(?:stars?|★)/i);
    if (ratingM) m.rating = parseFloat(ratingM[1]);
    const reviewsM = c.match(/(\d[\d,]*)\s*(?:Google\s+)?[Rr]eviews?/);
    if (reviewsM) m.reviews = parseCount(reviewsM[1]);
    m.hasBusinessContact = /\b(Call|Directions|Website|Menu|Order\s+Online)\b/i.test(c);

  } else if (platform === 'yelp') {
    const ratingM = c.match(/(\d\.?\d?)\s*(?:stars?|star\s+rating)/i);
    if (ratingM) m.rating = parseFloat(ratingM[1]);
    const reviewsM = c.match(/(\d[\d,]*)\s*[Rr]eviews?/);
    if (reviewsM) m.reviews = parseCount(reviewsM[1]);
    const priceM = c.match(/\$+/);
    if (priceM) m.priceRange = priceM[0];

  } else if (platform === 'pinterest') {
    const followersM = c.match(/(\d[\d,]*\.?\d*[KkMm]?)\s*[Ff]ollowers?/);
    if (followersM) m.followers = parseCount(followersM[1]);
    const followingM = c.match(/(\d[\d,]*\.?\d*[KkMm]?)\s*[Ff]ollowing/);
    if (followingM) m.following = parseCount(followingM[1]);

  } else if (platform === 'threads') {
    const followersM = c.match(/(\d[\d,]*\.?\d*[KkMm]?)\s*[Ff]ollowers?/);
    if (followersM) m.followers = parseCount(followersM[1]);
  }

  return m;
}

// ── Step 5: Apply critical flags ─────────────────────────────────────────────
function applyCriticalFlags(metrics, platform, niche) {
  const flags = [];

  // Flag 1 — Last post too old
  const days = metrics.lastPostDaysAgo;
  if (days !== null && days > 2) {
    const sev = days > 14 ? 'CRITICAL' : days > 7 ? 'HIGH' : 'MEDIUM';
    flags.push({
      id: 'lastPostStale', severity: sev,
      message: `Last post detected was ${days} day${days !== 1 ? 's' : ''} ago — audience engagement dropping`,
      detail: days > 14
        ? 'Algorithm stops showing content after 3-4 days of inactivity. Followers are no longer seeing posts at full reach.'
        : 'Consistent posting is required to maintain algorithm reach and audience engagement.',
      fix: 'Post today and set up a daily posting schedule immediately.'
    });
  }

  // Flag 2 — Insufficient posting frequency
  const p28 = metrics.postsLast28Days;
  if (p28 !== null && p28 < 20) {
    const sev = p28 < 5 ? 'CRITICAL' : p28 < 10 ? 'HIGH' : 'MEDIUM';
    flags.push({
      id: 'lowPostFrequency', severity: sev,
      message: `Only ${p28} post${p28 !== 1 ? 's' : ''} detected in the last 28 days — platform algorithm deprioritizing this account`,
      detail: 'Platform algorithms recommend 5-7 posts per week for business accounts to maintain full organic reach.',
      fix: 'Increase to daily posting with a mix of Reels, Stories, and feed posts.'
    });
  }

  // Flag 3 — No Reels on Instagram
  if (platform === 'instagram' && !metrics.hasReels) {
    flags.push({
      id: 'noReels', severity: 'HIGH',
      message: 'No Reels detected — Instagram algorithm heavily favors Reels over static posts',
      detail: 'Reels get 3-5× more reach than static posts on Instagram. Missing Reels means missing the majority of potential organic reach.',
      fix: 'Start posting 3-4 Reels per week immediately. Even repurposed TikTok content works well.'
    });
  }

  // Flag 4 — Low followers for niche benchmark
  const followerCount = metrics.followers ?? metrics.likes;
  if (followerCount !== null && followerCount !== undefined) {
    const nicheLC = (niche || '').toLowerCase();
    let benchmark = 100;
    if (nicheLC.includes('restaurant') && platform === 'instagram') benchmark = 500;
    else if ((nicheLC.includes('med spa') || nicheLC.includes('medspa')) && platform === 'instagram') benchmark = 1000;
    else if (nicheLC.includes('auto') && platform === 'facebook') benchmark = 200;
    else if (nicheLC.includes('limo') && platform === 'instagram') benchmark = 300;

    if (followerCount < benchmark) {
      flags.push({
        id: 'lowFollowers', severity: 'MEDIUM',
        message: `${followerCount.toLocaleString()} followers is below the ${benchmark.toLocaleString()} benchmark for ${niche || 'this niche'} on ${PLATFORM_LABELS[platform] || platform}`,
        detail: `Businesses in the ${niche || 'local'} space with under ${benchmark.toLocaleString()} followers struggle to convert social presence into leads.`,
        fix: 'Run a targeted follower growth campaign with local hashtags and paid promotion.'
      });
    }
  }

  return flags;
}

// ── Step 6: Score & status from real metrics ─────────────────────────────────
function calculateScore(metrics, platform, niche) {
  let score = 100;
  const days = metrics.lastPostDaysAgo;
  if (days !== null) {
    if (days > 14) score -= 50;
    else if (days > 7) score -= 35;
    else if (days > 2) score -= 20;
  } else {
    score -= 10;
  }
  const p28 = metrics.postsLast28Days;
  if (p28 !== null) {
    if (p28 < 5) score -= 25;
    else if (p28 < 10) score -= 20;
    else if (p28 < 20) score -= 15;
  }
  if (platform === 'instagram' && !metrics.hasReels) score -= 15;
  const fc = metrics.followers ?? metrics.likes;
  if (fc !== null && fc !== undefined) {
    const nicheLC = (niche || '').toLowerCase();
    let bench = 100;
    if (nicheLC.includes('restaurant') && platform === 'instagram') bench = 500;
    else if ((nicheLC.includes('med spa') || nicheLC.includes('medspa')) && platform === 'instagram') bench = 1000;
    if (fc < bench) score -= 10;
  }
  if (!metrics.bio) score -= 5;
  if (!metrics.hasBusinessContact && ['instagram', 'facebook', 'google'].includes(platform)) score -= 5;
  return Math.max(5, Math.min(100, score));
}

function determineStatus(metrics) {
  const days = metrics.lastPostDaysAgo;
  const p28  = metrics.postsLast28Days;
  if (days !== null) {
    if (days > 14) return 'Critical';
    if (days > 7)  return 'Inactive';
    if (days > 2)  return 'Needs Attention';
    // days <= 2
    if (p28 === null || p28 >= 20) return 'Active';
    return 'Needs Attention';
  }
  if (p28 !== null) {
    if (p28 >= 20) return 'Likely Active';
    if (p28 >= 10) return 'Needs Attention';
    if (p28 > 0)   return 'Inactive';
  }
  return 'Likely Active';
}

// ── Step 7: Build Claude prompt & call API ───────────────────────────────────
async function analyzeSocialPresence(apiKey, { businessName, niche, city, state, reviews, rating, profiles, notPresent }) {

  // Fetch all provided profile pages simultaneously
  const fetchTasks = [];
  const fetchMeta  = [];   // { platform, key }

  for (const p of PLATFORM_ORDER) {
    if (!profiles[p]) continue;
    fetchTasks.push(fetchProfileData(profiles[p], p));
    fetchMeta.push({ platform: p, key: p });
  }
  const custom = profiles.custom || [];
  for (const cp of custom) {
    if (!cp.url) continue;
    fetchTasks.push(fetchProfileData(cp.url, cp.name));
    fetchMeta.push({ platform: cp.name, key: `custom_${cp.name}` });
  }

  const settled = await Promise.allSettled(fetchTasks);
  const results = settled.map(r => r.status === 'fulfilled' ? r.value : { success: false, content: '' });

  // Build per-platform extracted data
  const extractedMap = {};
  results.forEach((result, i) => {
    const { platform, key } = fetchMeta[i];
    const platformKey = PLATFORM_ORDER.includes(platform) ? platform : platform;
    if (result.success && result.content) {
      const metrics = extractPlatformMetrics(result.content, platformKey);
      const flags   = applyCriticalFlags(metrics, platformKey, niche);
      const score   = calculateScore(metrics, platformKey, niche);
      const status  = determineStatus(metrics);
      extractedMap[key] = { metrics, flags, score, status, fetched: true };
    } else {
      extractedMap[key] = { metrics: {}, flags: [], score: null, status: null, fetched: false };
    }
  });

  // Build Claude prompt lines describing each platform
  const profileLines = PLATFORM_ORDER.map(p => {
    const label = PLATFORM_LABELS[p];
    const url   = profiles[p];
    if (!url) {
      return notPresent.includes(p)
        ? `${label}: NOT PRESENT (confirmed by sales team)`
        : `${label}: UNKNOWN (no URL provided — assume missing)`;
    }
    const ex = extractedMap[p];
    if (!ex?.fetched) {
      return `${label}: PRESENT — URL: ${url} — NOTE: profile page could not be read (platform may block automated access)`;
    }
    const mx = ex.metrics;
    const parts = [`${label}: PRESENT — URL: ${url}`];
    if (mx.followers   != null)  parts.push(`Followers: ${mx.followers.toLocaleString()}`);
    if (mx.likes       != null)  parts.push(`Page Likes: ${mx.likes.toLocaleString()}`);
    if (mx.posts       != null)  parts.push(`Total Posts: ${mx.posts.toLocaleString()}`);
    if (mx.subscribers != null)  parts.push(`Subscribers: ${mx.subscribers.toLocaleString()}`);
    if (mx.videos      != null)  parts.push(`Videos: ${mx.videos.toLocaleString()}`);
    if (mx.rating      != null)  parts.push(`Rating: ${mx.rating} stars`);
    if (mx.reviews     != null)  parts.push(`Reviews: ${mx.reviews.toLocaleString()}`);
    if (mx.employees   != null)  parts.push(`Employees: ${mx.employees}`);
    if (mx.lastPostDaysAgo != null) parts.push(`Last post: ${mx.lastPostDaysAgo} days ago`);
    if (mx.postsLast28Days != null) parts.push(`Posts in last 28 days: ${mx.postsLast28Days}`);
    if (p === 'instagram') parts.push(`Reels present: ${mx.hasReels ? 'YES' : 'NO'}`);
    if (mx.hasBusinessContact) parts.push('Business contact buttons present: YES');
    if (mx.responseTime) parts.push(`Response time: ${mx.responseTime}`);
    if (ex.flags.length) parts.push(`CRITICAL FLAGS: ${ex.flags.map(f => f.message).join('; ')}`);
    return parts.join(' | ');
  });

  const customLines = custom.map(cp => {
    if (!cp.url) return `${cp.name}: UNKNOWN`;
    const ex = extractedMap[`custom_${cp.name}`];
    if (!ex?.fetched) return `${cp.name}: PRESENT — URL: ${cp.url} — could not read`;
    const mx = ex.metrics;
    const parts = [`${cp.name}: PRESENT — URL: ${cp.url}`];
    if (mx.followers != null) parts.push(`Followers: ${mx.followers.toLocaleString()}`);
    if (mx.lastPostDaysAgo != null) parts.push(`Last post: ${mx.lastPostDaysAgo} days ago`);
    return parts.join(' | ');
  });

  const allCritFlagLines = PLATFORM_ORDER
    .filter(p => extractedMap[p]?.flags?.length)
    .map(p => `${PLATFORM_LABELS[p]}: ${extractedMap[p].flags.map(f => f.message).join('; ')}`)
    .join('\n');

  const prompt = `You are a social media analyst for a digital marketing agency. Analyze this business's social media presence based on REAL data extracted from their live profile pages.

Business: ${businessName}
Niche: ${niche || 'local business'}
Location: ${[city, state].filter(Boolean).join(', ') || 'California'}
Google Rating: ${rating || 'not available'} stars with ${reviews || 0} reviews
IMPORTANT: These Google stats are REAL — never contradict them.

REAL DATA EXTRACTED FROM LIVE PROFILE PAGES:
${[...profileLines, ...customLines].join('\n')}

${allCritFlagLines ? `CRITICAL FLAGS ALREADY DETECTED (do not contradict):\n${allCritFlagLines}` : ''}

ANALYSIS INSTRUCTIONS:
- Use ONLY the real data above. Never invent specific numbers not in the data.
- If a field was not found, say "not detected" — do not guess a number.
- status values MUST match real data: Active = posted ≤2 days AND ≥20 posts/month | Needs Attention = posted ≤7 days OR 10-19 posts | Inactive = last post >7 days OR <10 posts | Critical = last post >14 days OR <5 posts | Missing = no URL
- score: base 100, deduct per critical flags found in extracted data (not estimated)
- Every gap must be specific to the ${niche || 'local business'} niche
- revenueImpact: estimated monthly revenue impact of fixing this platform
- proposalAngle: one sentence pitching improvement of this specific platform
- For Missing platforms: estimate monthly reach lost based on niche

Return ONLY valid JSON, no markdown, no extra text:
{
  "platforms": {
    "google":    {"status":"Active|Needs Attention|Inactive|Critical|Missing","profileUrl":null,"score":0,"estimatedFollowers":"","activityLevel":"High|Medium|Low|Critical|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":"","activityAssessment":"","audienceGrowth":"","contentQuality":"","revenueImpact":""},
    "facebook":  {"status":"Active|Needs Attention|Inactive|Critical|Missing","profileUrl":null,"score":0,"estimatedFollowers":"","activityLevel":"High|Medium|Low|Critical|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":"","activityAssessment":"","audienceGrowth":"","contentQuality":"","revenueImpact":""},
    "instagram": {"status":"Active|Needs Attention|Inactive|Critical|Missing","profileUrl":null,"score":0,"estimatedFollowers":"","activityLevel":"High|Medium|Low|Critical|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":"","activityAssessment":"","audienceGrowth":"","contentQuality":"","revenueImpact":""},
    "linkedin":  {"status":"Active|Needs Attention|Inactive|Critical|Missing","profileUrl":null,"score":0,"estimatedFollowers":"","activityLevel":"High|Medium|Low|Critical|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":"","activityAssessment":"","audienceGrowth":"","contentQuality":"","revenueImpact":""},
    "tiktok":    {"status":"Active|Needs Attention|Inactive|Critical|Missing","profileUrl":null,"score":0,"estimatedFollowers":"","activityLevel":"High|Medium|Low|Critical|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":"","activityAssessment":"","audienceGrowth":"","contentQuality":"","revenueImpact":""},
    "youtube":   {"status":"Active|Needs Attention|Inactive|Critical|Missing","profileUrl":null,"score":0,"estimatedFollowers":"","activityLevel":"High|Medium|Low|Critical|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":"","activityAssessment":"","audienceGrowth":"","contentQuality":"","revenueImpact":""},
    "twitter":   {"status":"Active|Needs Attention|Inactive|Critical|Missing","profileUrl":null,"score":0,"estimatedFollowers":"","activityLevel":"High|Medium|Low|Critical|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":"","activityAssessment":"","audienceGrowth":"","contentQuality":"","revenueImpact":""},
    "pinterest": {"status":"Active|Needs Attention|Inactive|Critical|Missing","profileUrl":null,"score":0,"estimatedFollowers":"","activityLevel":"High|Medium|Low|Critical|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":"","activityAssessment":"","audienceGrowth":"","contentQuality":"","revenueImpact":""},
    "yelp":      {"status":"Active|Needs Attention|Inactive|Critical|Missing","profileUrl":null,"score":0,"estimatedFollowers":"","activityLevel":"High|Medium|Low|Critical|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":"","activityAssessment":"","audienceGrowth":"","contentQuality":"","revenueImpact":""},
    "threads":   {"status":"Active|Needs Attention|Inactive|Critical|Missing","profileUrl":null,"score":0,"estimatedFollowers":"","activityLevel":"High|Medium|Low|Critical|Unknown","gaps":["","",""],"quickWin":"","monthlyReachLost":"","nicheSpecificInsight":"","proposalAngle":"","activityAssessment":"","audienceGrowth":"","contentQuality":"","revenueImpact":""}
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
    const d = await resp.json();
    const raw = (d.content || []).map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
    const si = raw.indexOf('{'), ei = raw.lastIndexOf('}');
    if (si === -1) return { analysis: null, extractedMap };
    return { analysis: JSON.parse(raw.slice(si, ei + 1)), extractedMap };
  } catch (e) {
    console.error('Claude social analysis error:', e.message);
    return { analysis: null, extractedMap };
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

  const safeProfiles     = profiles || {};
  const custom           = safeProfiles.custom || [];
  const providedPlatforms = PLATFORM_ORDER.filter(p => !!safeProfiles[p]);
  const missingPlatforms  = PLATFORM_ORDER.filter(p => !safeProfiles[p]);

  if (providedPlatforms.length === 0 && custom.filter(c => c.url).length === 0) {
    return res.status(400).json({ error: 'At least one social media profile URL is required.' });
  }

  const { analysis, extractedMap } = await analyzeSocialPresence(ANTHROPIC_KEY, {
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

  // Pin profileUrl to user-provided URL; merge real extracted data
  if (analysis.platforms) {
    for (const p of PLATFORM_ORDER) {
      if (!analysis.platforms[p]) continue;
      analysis.platforms[p].profileUrl = safeProfiles[p] || null;

      const ex = extractedMap[p];
      if (ex?.fetched) {
        // Override Claude's guesses with ground-truth calculated values
        analysis.platforms[p].score  = ex.score;
        analysis.platforms[p].status = ex.status;
        analysis.platforms[p]._extracted     = ex.metrics;
        analysis.platforms[p]._criticalFlags = ex.flags || [];
        analysis.platforms[p]._dataSource    = 'live';
      } else if (safeProfiles[p]) {
        analysis.platforms[p]._dataSource    = 'estimated';
        analysis.platforms[p]._extracted     = null;
        analysis.platforms[p]._criticalFlags = [];
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
