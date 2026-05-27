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

'website': (lead, niche, city) => {
  // Extract clean domain for blog detection hints
  let domain = '';
  if (lead.website) {
    try { domain = new URL(lead.website.startsWith('http') ? lead.website : 'https://' + lead.website).hostname.replace('www.', ''); } catch {}
  }

  // Determine blog likelihood from niche so Claude has a strong prior
  const HIGH_BLOG = ['Law Firm','Dental Clinic','Med Spa','Real Estate Agency','Chiropractor','Roofing Company','Plumbing Company'];
  const LOW_BLOG  = ['Restaurant','Hair Salon','Gym'];
  const blogPrior = HIGH_BLOG.includes(niche) ? 'HIGH — professional service businesses almost always have a blog or resources section'
                  : LOW_BLOG.includes(niche)  ? 'LOW — local hospitality/personal-care businesses sometimes lack a blog, but still check for /news or /updates'
                  : 'MEDIUM — likely has some form of content section; lean toward Likely Present if uncertain';

  return `You are a senior website conversion specialist writing a client-facing audit.

Business: ${lead.name}
Type: ${niche}
City: ${city}
Website: ${lead.website || 'none — no website detected'}${domain ? `\nDomain: ${domain}` : ''}
Rating: ${lead.rating || 'unknown'} (${lead.reviews || 0} reviews)

Audit their website (or lack thereof). Be specific and sales-oriented.

━━━ BLOG DETECTION — READ CAREFULLY BEFORE SETTING blogData ━━━

You must reason about blog presence using ALL of the following signals:

SIGNAL 1 — URL PATTERNS: These paths commonly indicate a blog exists:
  /blog  /blogs  /news  /articles  /resources  /insights
  /posts  /journal  /updates  /media  /tips  /guides  /learn
${domain ? `For domain "${domain}" consider which of these paths are likely based on the domain name and business type.` : ''}

SIGNAL 2 — BUSINESS TYPE PRIOR: Blog likelihood for "${niche}" is ${blogPrior}

SIGNAL 3 — DOMAIN AUTHORITY: If the website appears established (professional domain, clear niche branding), assume content exists unless strong evidence otherwise.

BLOG STATUS RULES — use exactly one of these 4 values:
• "Active"         — Blog clearly exists AND shows signs of recent activity (posts within ~3 months)
• "Outdated"       — Blog exists but last post appears to be 4+ months ago or content is stale
• "Likely Present" — Signals strongly suggest a blog or content section exists but cannot be confirmed with certainty. USE THIS for: any professional service business (law, dental, med spa, coaching, consulting, agencies, training companies), B2B businesses, or any site where blog-style paths are plausible. DO NOT mark these businesses as Missing.
• "Missing"        — Use ONLY when you have strong evidence no blog exists. This is appropriate ONLY for clearly local brick-and-mortar businesses (restaurants, nail salons, auto body shops, barbershops) where content marketing is uncommon AND the domain gives no content signals.

⚠ CRITICAL DEFAULT RULE: When uncertain → always output "Likely Present", never "Missing".
Most businesses with a website have some content section. Reserve "Missing" for cases where you are confident (e.g., a restaurant with a menu-only site, or a business with no website at all).

For "blogPath": output the most likely blog path based on the domain and business type (e.g. "/blog", "/blogs", "/news", "/resources"). Default to "/blog" if unsure.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
  "blogData": {
    "status": "Active|Outdated|Likely Present|Missing",
    "blogPath": "<most likely blog path e.g. '/blog' or '/blogs' or '/news'>",
    "confidence": "High|Medium|Low",
    "lastPostEstimate": "<e.g. '2 weeks ago' or '8 months ago' or 'Unable to verify' or 'None detected'>",
    "monthlyTrafficLost": "<estimate e.g. '800–2,000 visitors/mo due to inactive/missing blog content' — omit if blog is Active>",
    "quickWin": "<specific quick win e.g. 'Publish 2 blog posts/month targeting local keywords like best ${niche} in ${city}'>"
  },
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
}`;
},

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

'360': (lead, niche, city) => `You are a senior digital marketing director and ${niche} industry specialist writing a comprehensive 360-degree audit for a high-stakes client presentation.

Business: ${lead.name}
Niche: ${niche}
City: ${city}
Website: ${lead.website || 'none'}
Rating: ${lead.rating || 'unknown'} (${lead.reviews || 0} reviews)

This is a ${niche} business in ${city}. Generate a complete digital marketing audit from the perspective of a ${niche} marketing specialist. All recommendations, keywords, competitor comparisons, content strategies, and ad targeting must be specific to the ${niche} industry — not generic digital marketing advice.

Write a complete 360-degree digital marketing audit. Be specific, compelling, and data-driven. Most small local businesses score 20-50 overall.

Return ONLY valid JSON (no markdown, no commentary):
{
  "opportunityScore": <number 0-100>,
  "overallScore": <number 0-100>,
  "revenueLoss": <number — estimated monthly dollar amount this business is losing due to digital gaps>,
  "recommendedService": "<Full Digital Marketing Package — be specific about which services>",
  "bestSalesAngle": "<1 sentence compelling hook to open the sales conversation>",
  "salesSummary": "<2-3 sentences explaining why this business is worth targeting and what the agency can deliver>",
  "scores": {
    "localSEO": <number 0-100>,
    "onPageSEO": <number 0-100>,
    "technicalSEO": <number 0-100>,
    "socialMedia": <number 0-100>,
    "website": <number 0-100>,
    "adsOpportunity": <number 0-100>,
    "competitorGap": <number 0-100>,
    "aeoGeoReadiness": <number 0-100>,
    "llmVisibility": <number 0-100>,
    "overall": <number 0-100>
  },
  "scoreDetails": [
    {"category":"Local SEO / GMB","score":<0-100>,"status":"<Critical Gap|Needs Improvement|Average|Strong>","salesOpportunity":"<High|Medium|Low>","recommendedAction":"<specific action>"},
    {"category":"On-Page SEO","score":<0-100>,"status":"<Critical Gap|Needs Improvement|Average|Strong>","salesOpportunity":"<High|Medium|Low>","recommendedAction":"<specific action>"},
    {"category":"Technical SEO","score":<0-100>,"status":"<Critical Gap|Needs Improvement|Average|Strong>","salesOpportunity":"<High|Medium|Low>","recommendedAction":"<specific action>"},
    {"category":"Social Media","score":<0-100>,"status":"<Critical Gap|Needs Improvement|Average|Strong>","salesOpportunity":"<High|Medium|Low>","recommendedAction":"<specific action>"},
    {"category":"Website","score":<0-100>,"status":"<Critical Gap|Needs Improvement|Average|Strong>","salesOpportunity":"<High|Medium|Low>","recommendedAction":"<specific action>"},
    {"category":"Ads Opportunity","score":<0-100>,"status":"<Critical Gap|Needs Improvement|Average|Strong>","salesOpportunity":"<High|Medium|Low>","recommendedAction":"<specific action>"},
    {"category":"Competitor Gap","score":<0-100>,"status":"<Critical Gap|Needs Improvement|Average|Strong>","salesOpportunity":"<High|Medium|Low>","recommendedAction":"<specific action>"},
    {"category":"AEO / GEO Readiness","score":<0-100>,"status":"<Critical Gap|Needs Improvement|Average|Strong>","salesOpportunity":"<High|Medium|Low>","recommendedAction":"<specific action>"},
    {"category":"LLM / AI Visibility","score":<0-100>,"status":"<Critical Gap|Needs Improvement|Average|Strong>","salesOpportunity":"<High|Medium|Low>","recommendedAction":"<specific action>"},
    {"category":"Overall Digital Score","score":<0-100>,"status":"<Critical Gap|Needs Improvement|Average|Strong>","salesOpportunity":"<High|Medium|Low>","recommendedAction":"<specific action>"}
  ],
  "criticalIssues": [
    "<most urgent problem costing money right now — be specific and dollar-quantified>",
    "<second critical issue — specific and urgent>",
    "<third critical issue — specific and urgent>"
  ],
  "quickWins": [
    "<fix that can be done this week for fast visible results — be specific>",
    "<second quick win — actionable this week>",
    "<third quick win — actionable this week>"
  ],
  "growthOpportunities": [
    "<long-term opportunity that compounds over 6-12 months — be specific>",
    "<second growth opportunity — long-term>",
    "<third growth opportunity — long-term>"
  ],
  "nextBestStep": "<one specific, compelling single action they should take immediately — explain why it will produce measurable results in a specific timeframe>",
  "roadmap": {
    "month1": {
      "title": "Foundation",
      "tasks": ["<specific task>","<specific task>","<specific task>","<specific task>"],
      "expectedResult": "+20% local visibility"
    },
    "month2": {
      "title": "Growth",
      "tasks": ["<specific task>","<specific task>","<specific task>","<specific task>"],
      "expectedResult": "+40% social engagement"
    },
    "month3": {
      "title": "Domination",
      "tasks": ["<specific task>","<specific task>","<specific task>","<specific task>"],
      "expectedResult": "+60% total inquiries"
    }
  }
}`,

'seo': (lead, niche, city) => `You are a senior SEO strategist writing a keyword and search ranking audit for a sales presentation.

Business: ${lead.name}
Niche: ${niche}
City: ${city}
Website: ${lead.website || 'none — no website detected'}
Rating: ${lead.rating || 'unknown'} (${lead.reviews || 0} reviews)

This is a ${niche} business. Generate SEO analysis using ${niche}-specific keywords.

Key search terms to audit rankings for:
- best ${niche} in ${city}
- ${niche} near me
- ${niche} ${city}
- affordable ${niche} ${city}
- top ${niche} ${city}

For AIO/GEO readiness: evaluate whether this ${niche} business would appear when someone asks an AI assistant about ${niche} services in ${city}.

Audit their organic search performance and SEO health. Be specific and sales-oriented.

Return ONLY valid JSON:
{
  "overallScore": <0-100>,
  "opportunityScore": <0-100>,
  "recommendedService": "<service to pitch>",
  "salesAngle": "<1 sentence hook referencing their specific SEO gap>",
  "salesSummary": "<2-3 sentences why this prospect is worth targeting for SEO>",
  "subscores": [
    {"name":"Google Rankings","score":<0-100>,"status":"<Critical Gap|Needs Improvement|Average|Strong>","detail":"<specific finding about where they rank for key searches>"},
    {"name":"Keyword Targeting","score":<0-100>,"status":"<...>","detail":"<what keywords they should rank for vs. what they actually appear for>"},
    {"name":"On-Page SEO","score":<0-100>,"status":"<...>","detail":"<title tags, meta descriptions, heading structure>"},
    {"name":"Technical SEO","score":<0-100>,"status":"<...>","detail":"<site speed, mobile, schema, crawlability>"},
    {"name":"Backlink Authority","score":<0-100>,"status":"<...>","detail":"<link profile strength vs. local competitors>"},
    {"name":"Local Search Visibility","score":<0-100>,"status":"<...>","detail":"<local pack, maps, geo-targeted keywords>"}
  ],
  "keyFindings": [
    "<specific finding 1 — e.g. they rank page 3 for their main service keyword>",
    "<finding 2>",
    "<finding 3>",
    "<finding 4>"
  ],
  "painPoints": [
    {"rank":1,"problem":"<biggest SEO gap>","costMin":<number>,"costMax":<number>},
    {"rank":2,"problem":"<second gap>","costMin":<number>,"costMax":<number>},
    {"rank":3,"problem":"<third gap>","costMin":<number>,"costMax":<number>}
  ],
  "presenceData": {
    "googleSearch": {
      "present": <true if ranking page 1, false if page 2+>,
      "position": "<Top 3|Page 1 (4-10)|Page 2+|Not Found>",
      "monthlyTrafficLost": "<estimate e.g. '500–1,200 visitors/mo'>"
    },
    "googleAIO": {
      "present": <true if likely mentioned in Google AI Overviews, false if not>,
      "context": "<one sentence — would they appear in Google's AI overview for 'best ${niche} in ${city}'?>"
    },
    "chatGPT": {
      "present": <true if they would likely appear in ChatGPT answers, false if not>,
      "context": "<one sentence — would ChatGPT mention them for local ${niche} searches?>"
    },
    "gemini": {
      "present": <true if likely in Gemini results, false if not>,
      "context": "<one sentence>"
    },
    "claudeAI": {
      "present": <true if notable enough to appear in Claude answers, false if not>,
      "context": "<one sentence>"
    },
    "bing": {
      "present": <true if ranking on Bing page 1, false if not>,
      "position": "<Top 3|Page 1|Page 2+|Not Found>",
      "monthlyTrafficLost": "<estimate>"
    }
  },
  "nextBestStep": "Your single best next step: <action>. Here is why this will get you <result> in <timeframe> — <specific reason referencing their keyword gap vs top competitor>."
}`,

'social': (lead, niche, city) => {
  const SOCIAL_CONTEXT = {
    'Restaurant':         'focus on food photography, daily specials, behind-the-scenes kitchen content, and event announcements',
    'Med Spa':            'focus on before/after transformations, treatment spotlights, skincare tips, and client testimonials',
    'Dental Clinic':      'focus on smile transformations, patient education, dental tips, and friendly staff content',
    'Gym':                'focus on member transformations, workout videos, motivational content, and class schedules',
    'Law Firm':           'focus on educational legal tips, case results (anonymized), community involvement, and trust-building content',
    'Real Estate Agency': 'focus on property listings, neighborhood guides, market updates, and client success stories',
    'Roofing Company':    'focus on project before/after, storm damage tips, customer testimonials, and seasonal promotions',
    'Plumbing Company':   'focus on emergency tips, project showcases, how-to content, and customer reviews',
    'Hair Salon':         'focus on transformation photos, style inspiration, product tips, and booking promotions',
    'Chiropractor':       'focus on pain relief education, adjustment videos, patient testimonials, and wellness content'
  };
  const socialCtx = SOCIAL_CONTEXT[niche] || 'focus on local community engagement, service quality content, and customer success stories';

  return `You are a senior social media strategist writing a full 6-platform audit for a sales presentation.

Business: ${lead.name}
Niche: ${niche}
City: ${city}
Website: ${lead.website || 'none'}
Rating: ${lead.rating || 'unknown'} (${lead.reviews || 0} reviews)

This is a ${niche} business. Analyze their social media presence in the context of ${niche} marketing.
${niche}-specific content strategy: ${socialCtx}

Audit their presence across ALL 6 major platforms in this exact order: Facebook, X/Twitter, Instagram, LinkedIn, YouTube, TikTok.
Most small local businesses score 20-45 overall and are weak on 3-5 platforms.

Return ONLY valid JSON:
{
  "overallScore": <0-100>,
  "opportunityScore": <0-100>,
  "recommendedService": "<service to pitch>",
  "salesAngle": "<1 sentence hook about their social media gap>",
  "salesSummary": "<2-3 sentences why targeting this prospect for social media management>",
  "subscores": [
    {"name":"Facebook","score":<0-100>,"status":"<Critical Gap|Needs Improvement|Average|Strong>","detail":"<page likes, post frequency, ad presence>"},
    {"name":"X / Twitter","score":<0-100>,"status":"<...>","detail":"<account presence, tweet frequency, follower estimate>"},
    {"name":"Instagram","score":<0-100>,"status":"<...>","detail":"<estimated followers, post frequency, engagement rate>"},
    {"name":"LinkedIn","score":<0-100>,"status":"<...>","detail":"<company page presence, posts per month>"},
    {"name":"YouTube","score":<0-100>,"status":"<...>","detail":"<channel presence, estimated subscribers, video count>"},
    {"name":"TikTok","score":<0-100>,"status":"<...>","detail":"<account presence, estimated followers, video posting frequency>"}
  ],
  "platformSummary": [
    {
      "platform": "Facebook",
      "status": "Active|Inactive|Not Found",
      "followers": "<estimate e.g. '~600 page likes'>",
      "totalPosts": "<estimate e.g. '~85 posts'>",
      "postsPerMonth": "<estimate e.g. '1-2/month'>",
      "lastPost": "<estimate e.g. '~3 weeks ago'>",
      "engagementRate": "<estimate e.g. '0.5%' or 'Very Low'>",
      "gap": "<2 specific sentences about what they are missing on Facebook>",
      "quickWin": "<one specific, immediately actionable quick win for Facebook>",
      "monthlyReachLost": "<estimate e.g. '2,000–4,000 local users/mo'>"
    },
    {
      "platform": "X / Twitter",
      "status": "Active|Inactive|Not Found",
      "followers": "<estimate>",
      "totalPosts": "<estimate>",
      "postsPerMonth": "<estimate>",
      "lastPost": "<estimate>",
      "engagementRate": "<estimate>",
      "gap": "<2 specific sentences>",
      "quickWin": "<one actionable quick win>",
      "monthlyReachLost": "<estimate>"
    },
    {
      "platform": "Instagram",
      "status": "Active|Inactive|Not Found",
      "followers": "<estimate>",
      "totalPosts": "<estimate>",
      "postsPerMonth": "<estimate>",
      "lastPost": "<estimate>",
      "engagementRate": "<estimate>",
      "gap": "<2 specific sentences>",
      "quickWin": "<one actionable quick win>",
      "monthlyReachLost": "<estimate>"
    },
    {
      "platform": "LinkedIn",
      "status": "Active|Inactive|Not Found",
      "followers": "<estimate>",
      "totalPosts": "<estimate>",
      "postsPerMonth": "<estimate>",
      "lastPost": "<estimate>",
      "engagementRate": "<estimate>",
      "gap": "<2 specific sentences>",
      "quickWin": "<one actionable quick win>",
      "monthlyReachLost": "<estimate>"
    },
    {
      "platform": "YouTube",
      "status": "Active|Inactive|Not Found",
      "followers": "<estimate subscribers>",
      "totalPosts": "<estimate videos>",
      "postsPerMonth": "<estimate videos/mo>",
      "lastPost": "<estimate>",
      "engagementRate": "<estimate or N/A>",
      "gap": "<2 specific sentences>",
      "quickWin": "<one actionable quick win>",
      "monthlyReachLost": "<estimate>"
    },
    {
      "platform": "TikTok",
      "status": "Active|Inactive|Not Found",
      "followers": "<estimate>",
      "totalPosts": "<estimate>",
      "postsPerMonth": "<estimate>",
      "lastPost": "<estimate>",
      "engagementRate": "<estimate>",
      "gap": "<2 specific sentences>",
      "quickWin": "<one actionable quick win>",
      "monthlyReachLost": "<estimate>"
    }
  ],
  "painPoints": [
    {"rank":1,"problem":"<biggest social media gap across all platforms>","costMin":<number>,"costMax":<number>},
    {"rank":2,"problem":"<second gap>","costMin":<number>,"costMax":<number>},
    {"rank":3,"problem":"<third gap>","costMin":<number>,"costMax":<number>}
  ],
  "nextBestStep": "Your single best next step: <action>. Here is why this will get you <result> in <timeframe> — <specific reason>."
}`;
}
};

// ── Real-data guard header ─────────────────────────────────────────────────
// Prepended to EVERY prompt so Claude never fabricates data that contradicts
// real Google values (rating, review count, phone, website, etc.)
function buildRealDataHeader(lead, niche, city, state) {
  const reviews = parseInt(lead.reviews) || 0;
  const rating  = parseFloat(lead.rating) || 0;

  const ratingNote = !lead.rating
    ? 'NOT FOUND — do not assume any rating; do not score reputation negatively'
    : rating >= 4.8 ? `${rating} ★ — EXCELLENT: reputation is a strength; do NOT say it is a problem`
    : rating >= 4.5 ? `${rating} ★ — STRONG: only minor improvement opportunity`
    : rating >= 4.0 ? `${rating} ★ — GOOD: review growth is an opportunity`
    : rating >= 3.5 ? `${rating} ★ — BELOW AVERAGE: reputation pitch is a priority`
    : `${rating} ★ — CRITICAL: urgent reputation fix needed`;

  const reviewsNote = reviews >= 500
    ? `${reviews.toLocaleString()} — HIGH social proof; NEVER pitch "get more reviews" here`
    : reviews >= 200 ? `${reviews} — above average; de-emphasise review generation`
    : reviews >= 50  ? `${reviews} — below average; pitch review growth`
    : reviews > 0    ? `${reviews} — very few; strong review generation pitch`
    : 'ZERO — no Google reviews; pitch GMB setup and review generation';

  const fences = [];
  if (reviews >= 500) fences.push('Do NOT include review-generation revenue loss — 500+ reviews is already strong');
  if (reviews < 50 && reviews > 0) fences.push('Include $1,500–2,500/mo loss from low review volume');
  if (reviews === 0) fences.push('Include $2,000–3,500/mo loss from zero reviews / no GMB presence');
  if (rating >= 4.5) fences.push(`Do NOT include rating-based revenue loss — rating ${rating} is strong`);
  if (rating > 0 && rating < 4.0) fences.push(`Include $2,000–3,500/mo loss from below-average rating (${rating})`);

  return `════════════════════════════════════════════════════════════
VERIFIED REAL BUSINESS DATA — NEVER CONTRADICT — NEVER USE DIFFERENT FIGURES:
  Name:     ${lead.name || 'Unknown'}
  Rating:   ${ratingNote}
  Reviews:  ${reviewsNote}
  Phone:    ${lead.phone || 'not found'}
  Website:  ${lead.website || 'NONE — no website detected'}
  Address:  ${lead.address || 'not found'}
  Email:    ${lead.email  || 'not found'}
  Niche:    ${niche || lead.niche || ''}
  Location: ${[city || lead.city, state || lead.state].filter(Boolean).join(', ') || 'unknown'}

Revenue-loss rules for THIS specific business:
${fences.length ? fences.map(f => '  • ' + f).join('\n') : '  • Standard estimates apply'}

CRITICAL RULES:
  • NEVER say "0 reviews" or "no reviews" if the review count above is > 0
  • NEVER say "invisible online" or "no Google presence" if rating AND reviews are present
  • NEVER pitch review generation if reviews ≥ 500
  • ALL scores, issues, and pain points MUST be consistent with the verified data above
════════════════════════════════════════════════════════════

`;
}

// Build a real-content context block to prepend to prompts when scraped data is available
function buildRealContentBlock(scraped) {
  if (!scraped || !scraped.pagesFound) return '';
  const pageBlock = (key, label) => {
    const p = scraped[key];
    if (!p || !p.success) return `${label}: [Not found]\n`;
    const preview = (p.content || '').slice(0, 1500);
    return `${label} (${p.wordCount} words):\n${preview}\n`;
  };
  return `
⚠ IMPORTANT: You have REAL scraped content from this business's actual website (${scraped.pagesFound} pages, ${scraped.totalWords} words total). Base your analysis on this REAL content. Identify specific quotes, actual missing elements, and concrete improvements.

REAL WEBSITE CONTENT:
${pageBlock('homepage', 'HOMEPAGE')}
${pageBlock('about', 'ABOUT PAGE')}
${pageBlock('services', 'SERVICES PAGE')}
${pageBlock('contact', 'CONTACT PAGE')}
${pageBlock('blog', 'BLOG PAGE')}

When you find specific weaknesses, QUOTE the actual text and show what it should say instead. Mark all findings as "Based on actual website content" — not estimates.

---
`.trim() + '\n\n';
}

export default async function handler(req, res) {
  CORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, lead, niche, city, state, scrapedContent } = req.body;
  if (!type || !lead) return res.status(400).json({ error: 'type and lead required' });

  const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(400).json({ error: 'Missing Anthropic API key' });

  const promptFn = prompts[type];
  if (!promptFn) return res.status(400).json({ error: `Unknown report type: ${type}` });

  // Larger token budgets when real content is present (more detailed analysis possible)
  const hasRealContent = scrapedContent && (scrapedContent.pagesFound || 0) > 0;
  const TOKEN_MAP = hasRealContent
    ? { 'social': 3800, 'seo': 3400, '360': 4500, 'website': 3200, 'local-seo': 2200, 'ads': 1800 }
    : { 'social': 3200, 'seo': 2800, '360': 3800, 'website': 2400 };

  try {
    const resolvedCity = city || lead.city || '';
    const resolvedState = state || lead.state || '';
    const fullCity = resolvedCity && resolvedState ? `${resolvedCity}, ${resolvedState}` : resolvedCity || resolvedState || 'local area';

    // Build the full prompt: real-data guard first, then optional scraped content, then the analysis prompt
    const realDataHeader = buildRealDataHeader(lead, niche || lead.businessType || '', resolvedCity, resolvedState);
    const contentPrefix  = hasRealContent ? buildRealContentBlock(scrapedContent) : '';
    const basePrompt     = promptFn(lead, niche || lead.businessType || '', fullCity);
    const fullPrompt     = realDataHeader + contentPrefix + basePrompt;

    const raw = await claude(ANTHROPIC_KEY, fullPrompt, TOKEN_MAP[type] || 2200);
    const data = parseJSON(raw);
    if (!data) return res.status(500).json({ error: 'Failed to parse AI response' });

    // Tag whether real content was used
    data._dataSource = hasRealContent ? 'real' : 'estimated';
    data._pagesFound = hasRealContent ? (scrapedContent.pagesFound || 0) : 0;
    data._totalWords = hasRealContent ? (scrapedContent.totalWords || 0) : 0;

    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
