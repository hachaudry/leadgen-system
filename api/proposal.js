// api/proposal.js — World-Class Personalized Proposal Generator
// Accepts real audit data; AI converts verified findings into a 10-section consulting proposal.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anthropic-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prospect, auditData = {}, agencyNiche, nicheValues = {} } = req.body || {};
  if (!prospect?.name) return res.status(400).json({ error: 'prospect with name is required' });

  const ANTHROPIC_KEY = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(400).json({ error: 'Anthropic API key required' });

  const bizName = prospect.name;
  const niche   = prospect.niche || 'Local Business';
  const city    = prospect.city  || 'your city';
  const state   = prospect.state || 'CA';
  const rating  = prospect.rating  ? `${prospect.rating} stars` : 'unrated on Google';
  const reviews = prospect.reviews ? `${prospect.reviews} Google reviews` : 'no reviews yet';
  const website = prospect.website || 'no website on file';
  const agency  = agencyNiche || `${niche.toLowerCase().replace(/\s+/g, '')}marketing.com`;
  const date    = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  const loc     = [city, state].filter(Boolean).join(', ');
  const nv      = nicheValues;

  const auditLines = buildAuditLines(auditData);

  const prompt = buildPrompt({ bizName, niche, city, state, loc, rating, reviews, website, agency, date, auditLines, nv });

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: AbortSignal.timeout(60000)
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return res.status(502).json({ error: `AI API error (${resp.status})`, detail: errText.slice(0, 200) });
    }

    const claudeData = await resp.json();
    const raw = (claudeData.content || []).map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
    const si = raw.indexOf('{');
    const ei = raw.lastIndexOf('}');
    if (si === -1) return res.status(500).json({ error: 'AI did not return valid JSON', raw: raw.slice(0, 300) });

    let proposal;
    try {
      proposal = JSON.parse(raw.slice(si, ei + 1));
    } catch (e) {
      return res.status(500).json({ error: 'JSON parse failed: ' + e.message, raw: raw.slice(0, 400) });
    }

    return res.status(200).json({
      proposal,
      prospect,
      agencyNiche: agency,
      generatedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('proposal.js error:', err);
    return res.status(500).json({ error: 'Proposal generation failed: ' + (err.message || 'Unknown error') });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD AUDIT SUMMARY LINES
// ─────────────────────────────────────────────────────────────────────────────

function buildAuditLines(auditData) {
  const lines = [];

  // Real-time SEO audit (prospect-seo.js format)
  const seo = auditData.seo;
  if (seo) {
    if (seo.scores?.overall != null)     lines.push(`SEO Overall Score: ${seo.scores.overall}/100`);
    if (seo.scores?.Performance != null) lines.push(`Performance: ${seo.scores.Performance}/100`);
    if (seo.scores?.OnPageSEO != null)   lines.push(`On-Page SEO: ${seo.scores.OnPageSEO}/100`);
    if (seo.scores?.Content != null)     lines.push(`Content: ${seo.scores.Content}/100`);
    if (seo.overallScore != null)        lines.push(`SEO Score: ${seo.overallScore}/100`);
    if (seo.issues?.length) {
      seo.issues
        .filter(i => i.severity === 'Critical' || i.severity === 'High')
        .slice(0, 5)
        .forEach(i => lines.push(`SEO ${i.severity}: ${i.title} — ${i.evidence}`));
    }
    const ps = seo.realData?.pagespeed;
    if (ps?.mobile?.performance != null) lines.push(`Mobile Performance: ${ps.mobile.performance}/100`);
    if (ps?.vitals?.lcp)                 lines.push(`LCP (page load): ${ps.vitals.lcp}`);
    const h = seo.realData?.html;
    if (h?.titleTag)         lines.push(`Title tag: "${h.titleTag.slice(0, 70)}" (${h.titleLength} chars)`);
    if (h?.wordCount != null) lines.push(`Homepage word count: ${h.wordCount} words`);
    if (h?.schemaTypes?.length) lines.push(`Schema markup found: ${h.schemaTypes.slice(0, 3).join(', ')}`);
    else if (h && !h.jsonLdExists) lines.push(`Schema markup: missing`);
  }

  // Social media report
  const social = auditData.social;
  if (social) {
    if (social.overallScore != null) lines.push(`Social Media Score: ${social.overallScore}/100`);
    social.platformSummary?.slice(0, 4).forEach(p =>
      lines.push(`${p.platform}: ${p.status}${p.followers ? ` (${p.followers} followers)` : ''}`)
    );
  }

  // Website audit
  const web = auditData.website;
  if (web) {
    if (web.overallScore != null) lines.push(`Website Score: ${web.overallScore}/100`);
    web.subscores?.slice(0, 4).forEach(s => lines.push(`  ${s.name}: ${s.score}/100 — ${s.status}`));
    if (web.keyFindings?.length) lines.push(`Website finding: ${web.keyFindings[0]}`);
  }

  // Local SEO / GMB
  const gmb = auditData['local-seo'];
  if (gmb) {
    if (gmb.overallScore != null) lines.push(`GMB/Local SEO Score: ${gmb.overallScore}/100`);
    if (gmb.salesSummary) lines.push(`GMB Summary: ${gmb.salesSummary.slice(0, 100)}`);
  }

  // Competitors
  const comps = auditData.competitors?.competitors;
  if (comps?.length) {
    lines.push(`Local competitors found: ${comps.length}`);
    comps.slice(0, 3).forEach(c =>
      lines.push(`  Competitor: ${c.name} — ${c.rating || '?'} stars, ${c.reviews || 0} reviews`)
    );
  }

  // Ads
  const ads = auditData.ads;
  if (ads?.overallScore != null) lines.push(`Ads Opportunity Score: ${ads.overallScore}/100`);

  return lines.length > 0 ? lines.join('\n') : 'No detailed audit data available — use general industry knowledge.';
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD PROPOSAL PROMPT
// ─────────────────────────────────────────────────────────────────────────────

function buildPrompt({ bizName, niche, city, state, loc, rating, reviews, website, agency, date, auditLines, nv }) {
  const nvBlock = nv.avgValue
    ? `NICHE ECONOMICS (use for ROI calc): avg transaction $${nv.avgValue}, monthly volume ~${nv.monthlyVolume}, typical conversion rate ${nv.convRate}%`
    : '';

  return `You are a senior digital marketing strategist with 20 years of experience specializing in ${niche} businesses in California. You know this industry deeply: the customer psychology, competitive dynamics, seasonal windows, and which platforms drive real revenue for ${niche} businesses.

Write a personalized proposal for:
Business: ${bizName}
Type: ${niche} in ${loc}
Google: ${rating}, ${reviews}
Website: ${website}
Prepared by: ${agency}
Date: ${date}

VERIFIED REAL DATA (reference these facts — never contradict or invent):
${auditLines}
${nvBlock}

STRICT RULES: Never use "cutting-edge", "synergize", "leverage", "game-changer", "holistic", "best-in-class", "world-class", "revolutionary". Never guarantee rankings or traffic numbers. Every number must be conservative and credible. Always reference "${bizName}" and "${city}" by name throughout. Write like a trusted advisor, not a salesperson.

Return ONLY valid JSON (no markdown, no text before or after):

{
  "coverPage": {
    "headline": "<compelling outcome headline for this specific ${niche} in ${city} — NOT 'Digital Marketing Proposal'>",
    "subheadline": "<one sentence about the specific growth opportunity>",
    "date": "${date}",
    "confidentialityNote": "Prepared exclusively for ${bizName} · Confidential"
  },
  "executiveSummary": {
    "openingStatement": "<2 paragraphs showing deep knowledge of ${bizName} situation — reference real rating, review count, city>",
    "keyFindings": ["<finding with real evidence>", "<finding>", "<finding>", "<finding>"],
    "opportunityStatement": "<specific market opportunity in ${city} for ${niche} right now>",
    "ourPromise": "<specific conservative promise — no rank guarantees>"
  },
  "marketContext": {
    "localMarketAnalysis": "<1-2 paragraphs about the ${niche} market in ${city}>",
    "customerBehaviorInsights": "<how ${city} customers research and choose ${niche} businesses>",
    "competitiveLandscape": "<competitive environment for ${niche} in ${city}>",
    "seasonalOpportunities": [
      {"month":"Jan-Mar","icon":"❄️","opportunity":"<seasonal angle for ${niche}>"},
      {"month":"Apr-Jun","icon":"🌸","opportunity":"<seasonal angle>"},
      {"month":"Jul-Sep","icon":"☀️","opportunity":"<seasonal angle>"},
      {"month":"Oct-Dec","icon":"🎄","opportunity":"<seasonal angle>"}
    ]
  },
  "auditFindings": {
    "headline": "<one sentence on overall digital health of ${bizName}>",
    "findings": [
      {"category":"<name>","severity":"Critical","evidence":"<exact real audit evidence>","businessImpact":"<revenue/customer impact plain language>","recommendation":"<specific fix>"},
      {"category":"<name>","severity":"High","evidence":"<evidence>","businessImpact":"<impact>","recommendation":"<fix>"},
      {"category":"<name>","severity":"Medium","evidence":"<evidence>","businessImpact":"<impact>","recommendation":"<fix>"}
    ]
  },
  "strategicRecommendations": {
    "priorityActions": [
      {"rank":1,"action":"<highest-impact action>","rationale":"<why this first>","timeframe":"<when>"},
      {"rank":2,"action":"<second action>","rationale":"<why>","timeframe":"<when>"},
      {"rank":3,"action":"<third action>","rationale":"<why>","timeframe":"<when>"}
    ],
    "thirtyDayPlan": {
      "week1":"<specific Week 1 tasks>",
      "week2":"<specific Week 2 tasks>",
      "week3":"<specific Week 3 tasks>",
      "week4":"<specific Week 4 tasks>"
    },
    "ninetyDayRoadmap": [
      {"phase":"Month 1","theme":"Foundation","deliverables":["<item>","<item>","<item>"],"expectedOutcome":"<specific metric>"},
      {"phase":"Month 2","theme":"Momentum","deliverables":["<item>","<item>","<item>"],"expectedOutcome":"<specific metric>"},
      {"phase":"Month 3","theme":"Growth","deliverables":["<item>","<item>","<item>"],"expectedOutcome":"<specific metric>"}
    ],
    "longTermVision": "<where ${bizName} could realistically be in 12 months>"
  },
  "servicePackages": {
    "starter": {
      "packageName":"<niche-specific name NOT Basic>",
      "price":997,
      "tagline":"<compelling outcome sentence>",
      "includedServices":["<service>","<service>","<service>","<service>"],
      "expectedResults":"<conservative 90-day outcome>",
      "idealFor":"<client type>",
      "timeToResults":"<timeline>"
    },
    "growth": {
      "packageName":"<niche-specific name>",
      "price":1897,
      "tagline":"<compelling outcome>",
      "includedServices":["<service>","<service>","<service>","<service>","<service>"],
      "expectedResults":"<conservative outcome>",
      "idealFor":"<client type>",
      "timeToResults":"<timeline>"
    },
    "dominator": {
      "packageName":"<niche-specific name>",
      "price":2997,
      "tagline":"<compelling outcome>",
      "includedServices":["<service>","<service>","<service>","<service>","<service>","<service>"],
      "expectedResults":"<conservative outcome>",
      "idealFor":"<client type>",
      "timeToResults":"<timeline>"
    },
    "recommendation":"<which package and exactly why based on real findings>"
  },
  "investmentJustification": {
    "revenueOpportunity":"<specific revenue calculation for ${niche} — conservative>",
    "roiCalculation":"<show math: investment amount → breakeven point → realistic monthly outcome → ROI%>",
    "costOfInaction":"<what staying as-is costs monthly — reference real audit gaps>",
    "competitorAdvantage":"<specific edge over ${city} competitors from this investment>"
  },
  "whyUs": {
    "expertiseStatement":"<why ${agency} is uniquely suited for ${niche} businesses>",
    "nicheSpecialization":"<specific deep knowledge of ${niche} — concrete industry observations>",
    "provenProcess":"<specific methodology described with confidence>",
    "clientCommitment":"<what ${bizName} can expect: response times, reporting, direct contact>"
  },
  "nextSteps": {
    "callToAction":"Schedule a 20-minute strategy call this week to walk through these findings together.",
    "meetingAsk":"<specific booking ask with day/time suggestion>",
    "onboardingPreview":[
      {"day":"Day 1","task":"Welcome call and business brief (30 min)","icon":"👋"},
      {"day":"Day 2-3","task":"Deep audit completion and custom strategy build","icon":"🔍"},
      {"day":"Day 4-5","task":"Account access setup: GMB, Analytics, Social","icon":"🔑"},
      {"day":"Day 7","task":"Strategy presentation and campaign launch","icon":"🚀"}
    ],
    "urgencySignal":"<legitimate reason to move this week — no fake scarcity>"
  },
  "closingStatement": {
    "personalNote":"<1 paragraph — genuinely warm, reference something specific about ${bizName}>",
    "signOff":"The ${agency} Team"
  }
}`;
}
